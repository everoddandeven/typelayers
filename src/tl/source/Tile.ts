/**
 * @module tl/source/Tile
 */
import Event from '../events/Event';
import Source, {AttributionLike, SourceState} from './Source';
import TileCache from '../TileCache';
import TileState from '../TileState';
import {assert} from '../asserts';
import {equivalent, ProjectionLike} from '../proj';
import {getKeyZXY, TileCoord, withinExtentAndZ} from '../tilecoord';
import {
  getForProjection as getTileGridForProjection,
  wrapX,
} from '../tilegrid';
import {scale as scaleSize, Size, toSize} from '../size';
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import BaseEvent from "../events/Event";
import {ObjectEventTypes} from "../ObjectEventType";
import {ObjectEvent} from "../Object";
import {TileSourceEventTypes} from "./TileEventType";
import TileGrid from "../tilegrid/TileGrid";
import {EventsKey} from "../events";
import Tile, {TileOptions} from "../Tile";
import Projection from "../proj/Projection";
import TileRange from "../TileRange";
import {NearestDirectionFunction} from "../array";

export type TileSourceOnSignature <Return>= OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<ObjectEventTypes, ObjectEvent, Return> &
    OnSignature<TileSourceEventTypes, TileSourceEvent, Return> &
    CombinedOnSignature<EventTypes | ObjectEventTypes |
        TileSourceEventTypes, Return>;

export interface TileSourceOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  opaque?: boolean;
  tilePixelRatio?: number;
  projection?: ProjectionLike;
  state?: SourceState;
  tileGrid?: TileGrid;
  wrapX?: boolean;
  transition?: number;
  key?: string;
  zDirection?: number | NearestDirectionFunction;
  interpolate?: boolean;
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for sources providing images divided into a tile grid.
 * @abstract
 * @api
 */
abstract class TileSource extends Source {
  /**
   * @param {Options} options SourceTile source options.
   */

  public on?: TileSourceOnSignature<EventsKey>;
  public once?: TileSourceOnSignature<EventsKey>;
  public un?: TileSourceOnSignature<void>;
  private opaque_: boolean;
  private tilePixelRatio_: number;
  public  tileGrid: TileGrid;
  protected tileCache: TileCache;
  protected tmpSize: Size;
  private key_: string;
  protected tileOptions: TileOptions;
  public zDirection: number | NearestDirectionFunction;

  protected constructor(options: TileSourceOptions) {
    super({
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      projection: options.projection,
      state: options.state,
      wrapX: options.wrapX,
      interpolate: options.interpolate,
    });

    /***
     * @type {TileSourceOnSignature<EventsKey>}
     */
    this.on = null;

    /***
     * @type {TileSourceOnSignature<EventsKey>}
     */
    this.once = null;

    /***
     * @type {TileSourceOnSignature<void>}
     */
    this.un = null;

    /**
     * @private
     * @type {boolean}
     */
    this.opaque_ = options.opaque !== undefined ? options.opaque : false;

    /**
     * @private
     * @type {number}
     */
    this.tilePixelRatio_ =
      options.tilePixelRatio !== undefined ? options.tilePixelRatio : 1;

    /**
     * @type {import("../tilegrid/TileGrid").default|null}
     */
    this.tileGrid = options.tileGrid !== undefined ? options.tileGrid : null;

    const tileSize: Size = [256, 256];
    if (this.tileGrid) {
      toSize(this.tileGrid.getTileSize(this.tileGrid.getMinZoom()), tileSize);
    }

    /**
     * @protected
     * @type {import("../TileCache").default}
     */
    this.tileCache = new TileCache(options.cacheSize || 0);

    /**
     * @protected
     * @type {import("../size").Size}
     */
    this.tmpSize = [0, 0];

    /**
     * @private
     * @type {string}
     */
    this.key_ = options.key || '';

    /**
     * @protected
     * @type {import("../Tile").Options}
     */
    this.tileOptions = {
      transition: options.transition,
      interpolate: options.interpolate,
    };

    /**
     * zDirection hint, read by the renderer. Indicates which resolution should be used
     * by a renderer if the views resolution does not match any resolution of the tile source.
     * If 0, the nearest resolution will be used. If 1, the nearest lower resolution
     * will be used. If -1, the nearest higher resolution will be used.
     * @type {number|import("../array").NearestDirectionFunction}
     */
    this.zDirection = options.zDirection ? options.zDirection : 0;
  }

  /**
   * @return {boolean} Can expire cache.
   */
  public canExpireCache(): boolean {
    return this.tileCache.canExpireCache();
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {!Object<string, boolean>} usedTiles Used tiles.
   */
  public expireCache(projection: Projection, usedTiles: {[key: string]: boolean}): void {
    const tileCache = this.getTileCacheForProjection(projection);
    if (tileCache) {
      tileCache.expireCache(usedTiles);
    }
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {number} z Zoom level.
   * @param {import("../TileRange").default} tileRange Tile range.
   * @param {function(import("../Tile").default):(boolean|void)} callback Called with each
   *     loaded tile.  If the callback returns `false`, the tile will not be
   *     considered loaded.
   * @return {boolean} The tile range is fully covered with loaded tiles.
   */
  public forEachLoadedTile(projection: Projection, z: number, tileRange: TileRange, callback: (tile: Tile) => boolean | void): boolean {
    const tileCache = this.getTileCacheForProjection(projection);
    if (!tileCache) {
      return false;
    }

    let covered = true;
    let tile: Tile, tileCoordKey: string, loaded: boolean;
    for (let x = tileRange.minX; x <= tileRange.maxX; ++x) {
      for (let y = tileRange.minY; y <= tileRange.maxY; ++y) {
        tileCoordKey = getKeyZXY(z, x, y);
        loaded = false;
        if (tileCache.containsKey(tileCoordKey)) {
          tile = /** @type {!import("../Tile").default} */ (
            tileCache.get(tileCoordKey)
          );
          loaded = tile.getState() === TileState.LOADED;
          if (loaded) {
            loaded = callback(tile) !== false;
          }
        }
        if (!loaded) {
          covered = false;
        }
      }
    }
    return covered;
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {number} Gutter.
   */
  public getGutterForProjection(projection: Projection): number {
    return 0;
  }

  /**
   * Return the key to be used for all tiles in the source.
   * @return {string} The key for all tiles.
   */
  public getKey(): string {
    return this.key_;
  }

  /**
   * Set the value to be used as the key for all tiles in the source.
   * @param {string} key The key for tiles.
   * @protected
   */
  protected setKey(key: string): void {
    if (this.key_ !== key) {
      this.key_ = key;
      this.changed();
    }
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {boolean} Opaque.
   */
  public getOpaque(projection: Projection): boolean {
    return this.opaque_;
  }

  /**
   * @param {import("../proj/Projection").default} [projection] Projection.
   * @return {Array<number>|null} Resolutions.
   */
  public getResolutions(projection: Projection): number[] | null {
    const tileGrid = projection
      ? this.getTileGridForProjection(projection)
      : this.tileGrid;
    if (!tileGrid) {
      return null;
    }
    return tileGrid.getResolutions();
  }

  /**
   * @abstract
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!import("../Tile").default} Tile.
   */
  public abstract getTile(z: number, x: number, y: number, pixelRatio: number, projection: Projection): Tile;

  /**
   * Return the tile grid of the tile source.
   * @return {import("../tilegrid/TileGrid").default|null} Tile grid.
   * @api
   */
  public getTileGrid(): TileGrid {
    return this.tileGrid;
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!import("../tilegrid/TileGrid").default} Tile grid.
   */
  public getTileGridForProjection(projection: Projection): TileGrid {
    if (!this.tileGrid) {
      return getTileGridForProjection(projection);
    }
    return this.tileGrid;
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../TileCache").default} Tile cache.
   * @protected
   */
  protected getTileCacheForProjection(projection: Projection): TileCache {
    const sourceProjection = this.getProjection();
    assert(
      sourceProjection === null || equivalent(sourceProjection, projection),
      68 // A VectorTile source can only be rendered if it has a projection compatible with the view projection.
    );
    return this.tileCache;
  }

  /**
   * Get the tile pixel ratio for this source. Subclasses may override this
   * method, which is meant to return a supported pixel ratio that matches the
   * provided `pixelRatio` as close as possible.
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} Tile pixel ratio.
   */
  public getTilePixelRatio(pixelRatio: number): number {
    return this.tilePixelRatio_;
  }

  /**
   * @param {number} z Z.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../size").Size} Tile size.
   */
  public getTilePixelSize(z: number, pixelRatio: number, projection: Projection): Size {
    const tileGrid = this.getTileGridForProjection(projection);
    const tilePixelRatio = this.getTilePixelRatio(pixelRatio);
    const tileSize = toSize(tileGrid.getTileSize(z), this.tmpSize);
    if (tilePixelRatio == 1) {
      return tileSize;
    }
    return scaleSize(tileSize, tilePixelRatio, this.tmpSize);
  }

  /**
   * Returns a tile coordinate wrapped around the x-axis. When the tile coordinate
   * is outside the resolution and extent range of the tile grid, `null` will be
   * returned.
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {import("../proj/Projection").default} [projection] Projection.
   * @return {import("../tilecoord").TileCoord} Tile coordinate to be passed to the tileUrlFunction or
   *     null if no tile URL should be created for the passed `tileCoord`.
   */
  public getTileCoordForTileUrlFunction(tileCoord: TileCoord, projection: Projection): TileCoord {
    projection = projection !== undefined ? projection : this.getProjection();
    const tileGrid = this.getTileGridForProjection(projection);
    if (this.getWrapX() && projection.isGlobal()) {
      tileCoord = wrapX(tileGrid, tileCoord, projection);
    }
    return withinExtentAndZ(tileCoord, tileGrid) ? tileCoord : null;
  }

  /**
   * Remove all cached tiles from the source. The next render cycle will fetch new tiles.
   * @api
   */
  public clear(): void {
    this.tileCache.clear();
  }

  public refresh(): void {
    this.clear();
    super.refresh();
  }

  /**
   * Increases the cache size if needed
   * @param {number} tileCount Minimum number of tiles needed.
   * @param {import("../proj/Projection").default} projection Projection.
   */
  public updateCacheSize(tileCount: number, projection: Projection): void {
    const tileCache = this.getTileCacheForProjection(projection);
    if (tileCount > tileCache.highWaterMark) {
      tileCache.highWaterMark = tileCount;
    }
  }

  /**
   * Marks a tile coord as being used, without triggering a load.
   * @abstract
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {import("../proj/Projection").default} projection Projection.
   */
  public abstract useTile(z: number, x: number, y: number, projection: Projection): void;
}

/**
 * @classdesc
 * Events emitted by {@link module:tl/source/Tile~TileSource} instances are instances of this
 * type.
 */
export class TileSourceEvent extends Event {
  /**
   * @param {string} type Type.
   * @param {import("../Tile").default} tile The tile.
   */

  public tile: Tile;

  constructor(type: string, tile: Tile) {
    super(type);

    /**
     * The tile related to the event.
     * @type {import("../Tile").default}
     * @api
     */
    this.tile = tile;
  }
}

export default TileSource;
