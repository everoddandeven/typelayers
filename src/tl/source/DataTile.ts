/**
 * @module tl/source/DataTile
 */
import DataTile, {Data} from '../DataTile';
import EventType from '../events/EventType';
import ReprojDataTile from '../reproj/DataTile';
import TileCache from '../TileCache';
import TileEventType from './TileEventType';
import TileSource, {TileSourceEvent} from './Tile';
import TileState from '../TileState';
import {
  createXYZ,
  extentFromProjection,
  getForProjection as getTileGridForProjection,
} from '../tilegrid';
import {equivalent, get as getProjection, ProjectionLike} from '../proj';
import {getKeyZXY, TileCoord} from '../tilecoord';
import {getUid} from '../util';
import {toPromise} from '../functions';
import {Size, toSize} from '../size';
import {AttributionLike, SourceState} from "./Source";
import TileGrid from "../tilegrid/TileGrid";
import Projection from "../proj/Projection";
import BaseEvent from "../events/Event";
import Tile from "../Tile";

export type DataTileLoaderFunction = (z: number, x: number, y: number) => Data | Promise<Data>;

export interface DataTileSourceOptions {
  loader?: DataTileLoaderFunction;
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  maxZoom?: number;
  minZoom?: number;
  tileSize?: number | Size;
  gutter?: number;
  maxResolution?: number;
  projection?: ProjectionLike;
  tileGrid?: TileGrid;
  opaque?: boolean;
  state?: SourceState;
  wrapX?: boolean;
  transition?: number;
  bandCount?: number;
  interpolate?: boolean;
}

/**
 * @classdesc
 * A source for typed array data tiles.
 *
 * @fires import("./Tile").TileSourceEvent
 * @api
 */
class DataTileSource extends TileSource {
  /**
   * @param {Options} options DataTile source options.
   */

    private gutter_: number;
    private tileSize_?: Size;
    private tileSizes_?: Size[];
    private tileLoadingKeys_: {[key: string]: boolean};
    private loader_?: DataTileLoaderFunction;
    public bandCount: number;
    private tileGridForProjection_: {[key: string]: TileGrid};
    private tileCacheForProjection_: {[key: string]: TileCache};


  constructor(options: DataTileSourceOptions) {
    const projection =
      options.projection === undefined ? 'EPSG:3857' : options.projection;

    let tileGrid = options.tileGrid;
    if (tileGrid === undefined && projection) {
      tileGrid = createXYZ({
        extent: extentFromProjection(<Projection>projection),
        maxResolution: options.maxResolution,
        maxZoom: options.maxZoom,
        minZoom: options.minZoom,
        tileSize: options.tileSize,
      });
    }

    super({
      cacheSize: 0.1, // don't cache on the source
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      projection: projection,
      tileGrid: tileGrid,
      opaque: options.opaque,
      state: options.state,
      wrapX: options.wrapX,
      transition: options.transition,
      interpolate: options.interpolate,
    });

    /**
     * @private
     * @type {number}
     */
    this.gutter_ = options.gutter !== undefined ? options.gutter : 0;

    /**
     * @private
     * @type {import('../size').Size|null}
     */
    this.tileSize_ = options.tileSize ? toSize(options.tileSize) : null;

    /**
     * @private
     * @type {Array<import('../size').Size>|null}
     */
    this.tileSizes_ = null;

    /**
     * @private
     * @type {!Object<string, boolean>}
     */
    this.tileLoadingKeys_ = {};

    /**
     * @private
     */
    this.loader_ = options.loader;

    this.handleTileChange_ = this.handleTileChange_.bind(this);

    /**
     * @type {number}
     */
    this.bandCount = options.bandCount === undefined ? 4 : options.bandCount; // assume RGBA if undefined

    /**
     * @private
     * @type {!Object<string, import("../tilegrid/TileGrid").default>}
     */
    this.tileGridForProjection_ = {};

    /**
     * @private
     * @type {!Object<string, import("../TileCache").default>}
     */
    this.tileCacheForProjection_ = {};
  }

  /**
   * Set the source tile sizes.  The length of the array is expected to match the number of
   * levels in the tile grid.
   * @protected
   * @param {Array<import('../size').Size>} tileSizes An array of tile sizes.
   */
  protected setTileSizes(tileSizes: Size[]): void {
    this.tileSizes_ = tileSizes;
  }

  /**
   * Get the source tile size at the given zoom level.  This may be different than the rendered tile
   * size.
   * @protected
   * @param {number} z Tile zoom level.
   * @return {import('../size').Size} The source tile size.
   */
  protected getTileSize(z: number): Size {
    if (this.tileSizes_) {
      return this.tileSizes_[z];
    }
    if (this.tileSize_) {
      return this.tileSize_;
    }
    const tileGrid = this.getTileGrid();
    return tileGrid ? toSize(tileGrid.getTileSize(z)) : [256, 256];
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {number} Gutter.
   */
  public getGutterForProjection(projection: Projection): number {
    const thisProj = this.getProjection();
    if (!thisProj || equivalent(thisProj, projection)) {
      return this.gutter_;
    }

    return 0;
  }

  /**
   * @param {Loader} loader The data loader.
   * @protected
   */
  protected setLoader(loader: DataTileLoaderFunction): void {
    this.loader_ = loader;
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {import("../proj/Projection").default} targetProj The output projection.
   * @param {import("../proj/Projection").default} sourceProj The input projection.
   * @return {!DataTile} Tile.
   */
  public getReprojTile_(z: number, x: number, y: number, targetProj: Projection, sourceProj: Projection): DataTile {
    const cache = this.getTileCacheForProjection(targetProj);
    const tileCoordKey = getKeyZXY(z, x, y);
    if (cache.containsKey(tileCoordKey)) {
      const tile = cache.get(tileCoordKey);
      if (tile && tile.key == this.getKey()) {
        return tile;
      }
    }

    const tileGrid = this.getTileGrid();
    const reprojTilePixelRatio = Math.max.apply(
      null,
      tileGrid.getResolutions().map((r, z) => {
        const tileSize = toSize(tileGrid.getTileSize(z));
        const textureSize = this.getTileSize(z);
        return Math.max(
          textureSize[0] / tileSize[0],
          textureSize[1] / tileSize[1]
        );
      })
    );

    const sourceTileGrid = this.getTileGridForProjection(sourceProj);
    const targetTileGrid = this.getTileGridForProjection(targetProj);
    const tileCoord: TileCoord = [z, x, y];
    const wrappedTileCoord = this.getTileCoordForTileUrlFunction(
      tileCoord,
      targetProj
    );

    const options = Object.assign(
      {
        sourceProj,
        sourceTileGrid,
        targetProj,
        targetTileGrid,
        tileCoord,
        wrappedTileCoord,
        pixelRatio: reprojTilePixelRatio,
        gutter: this.getGutterForProjection(sourceProj),
        getTileFunction: (z, x, y, pixelRatio) =>
          this.getTile(z, x, y, pixelRatio, sourceProj),
      },
      this.tileOptions
    );
    const newTile = new ReprojDataTile(options);
    newTile.key = this.getKey();
    return newTile;
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!DataTile} Tile.
   */
  public getTile(z: number, x: number, y: number, pixelRatio: number, projection: Projection): DataTile {
    const sourceProjection = this.getProjection();
    if (
      sourceProjection &&
      projection &&
      !equivalent(sourceProjection, projection)
    ) {
      return this.getReprojTile_(z, x, y, projection, sourceProjection);
    }

    const size = this.getTileSize(z);
    const tileCoordKey = getKeyZXY(z, x, y);
    if (this.tileCache.containsKey(tileCoordKey)) {
      return this.tileCache.get(tileCoordKey);
    }

    const sourceLoader = this.loader_;

    function loader() {
      return toPromise(function () {
        return sourceLoader(z, x, y);
      });
    }

    const options = Object.assign(
      {
        tileCoord: [z, x, y],
        loader: loader,
        size: size,
      },
      this.tileOptions
    );

    const tile = new DataTile(options);
    tile.key = this.getKey();
    tile.addEventListener(EventType.CHANGE, this.handleTileChange_);

    this.tileCache.set(tileCoordKey, tile);
    return tile;
  }

  /**
   * Handle tile change events.
   * @param {import("../events/Event").default} event Event.
   */
  private handleTileChange_(event: BaseEvent): void {
    const tile = /** @type {import("../Tile").default} */ (<Tile>event.target);
    const uid = getUid(tile);
    const tileState = tile.getState();
    let type: string;
    if (tileState == TileState.LOADING) {
      this.tileLoadingKeys_[uid] = true;
      type = TileEventType.TILELOADSTART;
    } else if (uid in this.tileLoadingKeys_) {
      delete this.tileLoadingKeys_[uid];
      type =
        tileState == TileState.ERROR
          ? TileEventType.TILELOADERROR
          : tileState == TileState.LOADED
          ? TileEventType.TILELOADEND
          : undefined;
    }
    if (type) {
      this.dispatchEvent(new TileSourceEvent(type, tile));
    }
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!import("../tilegrid/TileGrid").default} Tile grid.
   */
  public getTileGridForProjection(projection: Projection): TileGrid {
    const thisProj = this.getProjection();
    if (this.tileGrid && (!thisProj || equivalent(thisProj, projection))) {
      return this.tileGrid;
    }

    const projKey = getUid(projection);
    if (!(projKey in this.tileGridForProjection_)) {
      this.tileGridForProjection_[projKey] =
        getTileGridForProjection(projection);
    }
    return this.tileGridForProjection_[projKey];
  }

  /**
   * Sets the tile grid to use when reprojecting the tiles to the given
   * projection instead of the default tile grid for the projection.
   *
   * This can be useful when the default tile grid cannot be created
   * (e.g. projection has no extent defined) or
   * for optimization reasons (custom tile size, resolutions, ...).
   *
   * @param {import("../proj").ProjectionLike} projection Projection.
   * @param {import("../tilegrid/TileGrid").default} tilegrid Tile grid to use for the projection.
   * @api
   */
  public setTileGridForProjection(projection: Projection, tilegrid: TileGrid): void {
    const proj = getProjection(projection);
    if (proj) {
      const projKey = getUid(proj);
      if (!(projKey in this.tileGridForProjection_)) {
        this.tileGridForProjection_[projKey] = tilegrid;
      }
    }
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../TileCache").default} Tile cache.
   */
  public getTileCacheForProjection(projection: Projection): TileCache {
    const thisProj = this.getProjection();
    if (!thisProj || equivalent(thisProj, projection)) {
      return this.tileCache;
    }

    const projKey = getUid(projection);
    if (!(projKey in this.tileCacheForProjection_)) {
      this.tileCacheForProjection_[projKey] = new TileCache(0.1); // don't cache
    }
    return this.tileCacheForProjection_[projKey];
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {!Object<string, boolean>} usedTiles Used tiles.
   */
  public expireCache(projection: Projection, usedTiles: {[key: string]: boolean}): void {
    const usedTileCache = this.getTileCacheForProjection(projection);

    this.tileCache.expireCache(
      this.tileCache == usedTileCache ? usedTiles : {}
    );
    for (const id in this.tileCacheForProjection_) {
      const tileCache = this.tileCacheForProjection_[id];
      tileCache.expireCache(tileCache == usedTileCache ? usedTiles : {});
    }
  }

  public clear(): void {
    super.clear();
    for (const id in this.tileCacheForProjection_) {
      this.tileCacheForProjection_[id].clear();
    }
  }
}

export default DataTileSource;
