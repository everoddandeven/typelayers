/**
 * @module tl/source/TileImage
 */
import EventType from '../events/EventType';
import ImageTile from '../ImageTile';
import ReprojTile from '../reproj/Tile';
import TileCache from '../TileCache';
import TileState from '../TileState';
import UrlTileSource from './UrlTileSource';
import {equivalent, get as getProjection, ProjectionLike} from '../proj';
import {getKey, getKeyZXY, TileCoord} from '../tilecoord';
import {getForProjection as getTileGridForProjection} from '../tilegrid';
import {getUid} from '../util';
import {AttributionLike, SourceState} from "./Source";
import TileGrid from "../tilegrid/TileGrid";
import Tile, {TileLoadFunction, UrlFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";
import Projection from "../proj/Projection";

export interface TileImageOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  opaque?: boolean;
  projection?: ProjectionLike;
  reprojectionErrorThreshold?: number;
  state?: SourceState;
  tileClass?: typeof ImageTile;
  tileGrid?: TileGrid;
  tileLoadFunction?: TileLoadFunction;
  tilePixelRatio?: number;
  tileUrlFunction?: UrlFunction;
  url?: string;
  urls?: string[];
  wrapX?: boolean;
  transition?: number;
  key?: string;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Base class for sources providing images divided into a tile grid.
 *
 * @fires import("./Tile").TileSourceEvent
 * @api
 */
class TileImageSource extends UrlTileSource {
  protected crossOrigin: string;
  protected tileClass: typeof ImageTile;
  protected tileCacheForProjection: { [key: string]: TileCache };
  protected tileGridForProjection: { [key: string]: TileGrid };
  private reprojectionErrorThreshold_?: number;
  private renderReprojectionEdges_: boolean;

  /**
   * @param {!Options} options Image tile options.
   */
  constructor(options: TileImageOptions) {
    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      opaque: options.opaque,
      projection: options.projection,
      state: options.state,
      tileGrid: options.tileGrid,
      tileLoadFunction: options.tileLoadFunction
          ? options.tileLoadFunction
          : defaultTileLoadFunction,
      tilePixelRatio: options.tilePixelRatio,
      tileUrlFunction: options.tileUrlFunction,
      url: options.url,
      urls: options.urls,
      wrapX: options.wrapX,
      transition: options.transition,
      interpolate:
          options.interpolate !== undefined ? options.interpolate : true,
      key: options.key,
      attributionsCollapsible: options.attributionsCollapsible,
      zDirection: options.zDirection,
    });

    /**
     * @protected
     * @type {?string}
     */
    this.crossOrigin =
        options.crossOrigin !== undefined ? options.crossOrigin : null;

    /**
     * @protected
     * @type {typeof ImageTile}
     */
    this.tileClass =
        options.tileClass !== undefined ? options.tileClass : ImageTile;

    /**
     * @protected
     * @type {!Object<string, TileCache>}
     */
    this.tileCacheForProjection = {};

    /**
     * @protected
     * @type {!Object<string, import("../tilegrid/TileGrid").default>}
     */
    this.tileGridForProjection = {};

    /**
     * @private
     * @type {number|undefined}
     */
    this.reprojectionErrorThreshold_ = options.reprojectionErrorThreshold;

    /**
     * @private
     * @type {boolean}
     */
    this.renderReprojectionEdges_ = false;
  }

  /**
   * @return {boolean} Can expire cache.
   */
  public canExpireCache(): boolean {
    if (this.tileCache.canExpireCache()) {
      return true;
    }
    for (const key in this.tileCacheForProjection) {
      if (this.tileCacheForProjection[key].canExpireCache()) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {!Object<string, boolean>} usedTiles Used tiles.
   */
  public expireCache(projection: Projection, usedTiles: { [key: string]: boolean }): void {
    const usedTileCache = this.getTileCacheForProjection(projection);

    this.tileCache.expireCache(
        this.tileCache == usedTileCache ? usedTiles : {}
    );
    for (const id in this.tileCacheForProjection) {
      const tileCache = this.tileCacheForProjection[id];
      tileCache.expireCache(tileCache == usedTileCache ? usedTiles : {});
    }
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {number} Gutter.
   */
  public getGutterForProjection(projection: Projection): number {
    if (
        this.getProjection() &&
        projection &&
        !equivalent(this.getProjection(), projection)
    ) {
      return 0;
    }
    return this.getGutter();
  }

  /**
   * @return {number} Gutter.
   */
  public getGutter(): number {
    return 0;
  }

  /**
   * Return the key to be used for all tiles in the source.
   * @return {string} The key for all tiles.
   */
  public getKey(): string {
    let key = super.getKey();
    if (!this.getInterpolate()) {
      key += ':disable-interpolation';
    }
    return key;
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {boolean} Opaque.
   */
  public getOpaque(projection: Projection): boolean {
    if (
        this.getProjection() &&
        projection &&
        !equivalent(this.getProjection(), projection)
    ) {
      return false;
    }
    return super.getOpaque(projection);
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
    if (!(projKey in this.tileGridForProjection)) {
      this.tileGridForProjection[projKey] =
          getTileGridForProjection(projection);
    }
    return this.tileGridForProjection[projKey];
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
    if (!(projKey in this.tileCacheForProjection)) {
      this.tileCacheForProjection[projKey] = new TileCache(
          this.tileCache.highWaterMark
      );
    }
    return this.tileCacheForProjection[projKey];
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {string} key The key set on the tile.
   * @return {!ImageTile} Tile.
   * @private
   */
  private createTile_(z: number, x: number, y: number, pixelRatio: number, projection: Projection, key: string): ImageTile {
    const tileCoord: TileCoord = [z, x, y];
    const urlTileCoord = this.getTileCoordForTileUrlFunction(
        tileCoord,
        projection
    );
    const tileUrl = urlTileCoord
        ? this.tileUrlFunction(urlTileCoord, pixelRatio, projection)
        : undefined;
    const tile = new this.tileClass(
        tileCoord,
        tileUrl !== undefined ? TileState.IDLE : TileState.EMPTY,
        tileUrl !== undefined ? tileUrl : '',
        this.crossOrigin,
        this.tileLoadFunction,
        this.tileOptions
    );
    tile.key = key;
    tile.addEventListener(EventType.CHANGE, this.handleTileChange.bind(this));
    return tile;
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!(ImageTile|ReprojTile)} Tile.
   */
  public getTile(z: number, x: number, y: number, pixelRatio: number, projection: Projection): ImageTile | ReprojTile {
    const sourceProjection = this.getProjection();
    if (
        !sourceProjection ||
        !projection ||
        equivalent(sourceProjection, projection)
    ) {
      return this.getTileInternal(
          z,
          x,
          y,
          pixelRatio,
          sourceProjection || projection
      );
    }
    const cache = this.getTileCacheForProjection(projection);
    const tileCoord: TileCoord = [z, x, y];
    let tile: Tile;
    const tileCoordKey = getKey(tileCoord);
    if (cache.containsKey(tileCoordKey)) {
      tile = cache.get(tileCoordKey);
    }
    const key = this.getKey();
    if (tile && tile.key == key) {
      return <ImageTile | ReprojTile>tile;
    }
    const sourceTileGrid = this.getTileGridForProjection(sourceProjection);
    const targetTileGrid = this.getTileGridForProjection(projection);
    const wrappedTileCoord = this.getTileCoordForTileUrlFunction(
      tileCoord,
      projection
    );
    const newTile = new ReprojTile(
      sourceProjection,
      sourceTileGrid,
      projection,
      targetTileGrid,
      tileCoord,
      wrappedTileCoord,
      this.getTilePixelRatio(pixelRatio),
      this.getGutter(),
      (z, x, y, pixelRatio) =>
        this.getTileInternal(z, x, y, pixelRatio, sourceProjection),
      this.reprojectionErrorThreshold_,
      this.renderReprojectionEdges_,
      this.getInterpolate()
    );
    newTile.key = key;

    if (tile) {
      newTile.interimTile = tile;
      newTile.refreshInterimChain();
      cache.replace(tileCoordKey, newTile);
    } else {
      cache.set(tileCoordKey, newTile);
    }
    return newTile;
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {!import("../proj/Projection").default} projection Projection.
   * @return {!ImageTile} Tile.
   * @protected
   */
  protected getTileInternal(z: number, x: number, y: number, pixelRatio: number, projection: Projection): ImageTile {
    let tile: ImageTile;
    const tileCoordKey = getKeyZXY(z, x, y);
    const key = this.getKey();
    if (!this.tileCache.containsKey(tileCoordKey)) {
      tile = this.createTile_(z, x, y, pixelRatio, projection, key);
      this.tileCache.set(tileCoordKey, tile);
    } else {
      tile = <ImageTile>this.tileCache.get(tileCoordKey);
      if (tile.key != key) {
        // The source's params changed. If the tile has an interim tile and if we
        // can use it then we use it. Otherwise, we create a new tile.  In both
        // cases we attempt to assign an interim tile to the new tile.
        const interimTile = tile;
        tile = this.createTile_(z, x, y, pixelRatio, projection, key);

        //make the new tile the head of the list,
        if (interimTile.getState() == TileState.IDLE) {
          //the old tile hasn't begun loading yet, and is now outdated, so we can simply discard it
          tile.interimTile = interimTile.interimTile;
        } else {
          tile.interimTile = interimTile;
        }
        tile.refreshInterimChain();
        this.tileCache.replace(tileCoordKey, tile);
      }
    }
    return tile;
  }

  /**
   * Sets whether to render reprojection edges or not (usually for debugging).
   * @param {boolean} render Render the edges.
   * @api
   */
  public setRenderReprojectionEdges(render: boolean): void {
    if (this.renderReprojectionEdges_ == render) {
      return;
    }
    this.renderReprojectionEdges_ = render;
    for (const id in this.tileCacheForProjection) {
      this.tileCacheForProjection[id].clear();
    }
    this.changed();
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
  public setTileGridForProjection(projection: ProjectionLike, tilegrid: TileGrid): void {
    const proj = getProjection(projection);
    if (proj) {
      const projKey = getUid(proj);
      if (!(projKey in this.tileGridForProjection)) {
        this.tileGridForProjection[projKey] = tilegrid;
      }
    }
  }

  public clear(): void {
    super.clear();
    for (const id in this.tileCacheForProjection) {
      this.tileCacheForProjection[id].clear();
    }
  }
}

/**
 * @param {ImageTile} imageTile Image tile.
 * @param {string} src Source.
 */
export function defaultTileLoadFunction(imageTile: ImageTile, src: string): void {
  (<HTMLImageElement | HTMLVideoElement>imageTile.getImage()).src = src;
}

export default TileImageSource;
