/**
 * @module tl/source/UrlTile
 */
import TileEventType from './TileEventType';
import TileSource, {TileSourceEvent} from './Tile';
import TileState from '../TileState';
import {createFromTemplates, expandUrl} from '../tileurlfunction';
import {getKeyZXY, TileCoord} from '../tilecoord';
import {getUid} from '../util';
import Tile, {TileLoadFunction, UrlFunction} from "../Tile";
import BaseEvent from "../events/Event";
import Projection from "../proj/Projection";
import {AttributionLike, SourceState} from "./Source";
import {ProjectionLike} from "../proj";
import TileGrid from "../tilegrid/TileGrid";
import {NearestDirectionFunction} from "../array";

export interface UrlTileOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  opaque?: boolean;
  projection?: ProjectionLike;
  state?: SourceState;
  tileGrid?: TileGrid;
  tileLoadFunction: TileLoadFunction;
  tilePixelRatio?: number;
  tileUrlFunction?: UrlFunction;
  url?: string;
  urls?: string[];
  wrapX?: boolean;
  transition?: number;
  key?: string;
  zDirection?: number | NearestDirectionFunction;
  interpolate?: boolean;
}

/**
 * @classdesc
 * Base class for sources providing tiles divided into a tile grid over http.
 *
 * @fires import("./Tile").TileSourceEvent
 */
abstract class UrlTileSource extends TileSource {
  private generateTileUrlFunction_: boolean;
  protected tileLoadFunction: TileLoadFunction;
  protected urls?: string[];
  private tileLoadingKeys_: { [key: string]: boolean };
  /**
   * @param {Options} options Image tile options.
   */
  protected constructor(options: UrlTileOptions) {
    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      opaque: options.opaque,
      projection: options.projection,
      state: options.state,
      tileGrid: options.tileGrid,
      tilePixelRatio: options.tilePixelRatio,
      wrapX: options.wrapX,
      transition: options.transition,
      interpolate: options.interpolate,
      key: options.key,
      attributionsCollapsible: options.attributionsCollapsible,
      zDirection: options.zDirection,
    });

    /**
     * @private
     * @type {boolean}
     */
    this.generateTileUrlFunction_ =
      this.tileUrlFunction === UrlTileSource.prototype.tileUrlFunction;

    /**
     * @protected
     * @type {LoadFunction}
     */
    this.tileLoadFunction = options.tileLoadFunction;

    if (options.tileUrlFunction) {
      this.tileUrlFunction = options.tileUrlFunction;
    }

    /**
     * @protected
     * @type {!Array<string>|null}
     */
    this.urls = null;

    if (options.urls) {
      this.setUrls(options.urls);
    } else if (options.url) {
      this.setUrl(options.url);
    }

    /**
     * @private
     * @type {!Object<string, boolean>}
     */
    this.tileLoadingKeys_ = {};
  }

  /**
   * Return the tile load function of the source.
   * @return {LoadFunction} TileLoadFunction
   * @api
   */
  public getTileLoadFunction(): TileLoadFunction {
    return this.tileLoadFunction;
  }

  /**
   * Return the tile URL function of the source.
   * @return {UrlFunction} TileUrlFunction
   * @api
   */
  public getTileUrlFunction(): UrlFunction {
    return Object.getPrototypeOf(this).tileUrlFunction === this.tileUrlFunction
      ? this.tileUrlFunction.bind(this)
      : this.tileUrlFunction;
  }

  /**
   * Return the URLs used for this source.
   * When a tileUrlFunction is used instead of url or urls,
   * null will be returned.
   * @return {!Array<string>|null} URLs.
   * @api
   */
  public getUrls(): string[] {
    return this.urls;
  }

  /**
   * Handle tile change events.
   * @param {import("../events/Event").default} event Event.
   * @protected
   */
  protected handleTileChange(event: BaseEvent): void {
    const tile = (<Tile>event.target);
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
    if (type != undefined) {
      this.dispatchEvent(new TileSourceEvent(type, tile));
    }
  }

  /**
   * Set the tile load function of the source.
   * @param {LoadFunction} tileLoadFunction Tile load function.
   * @api
   */
  public setTileLoadFunction(tileLoadFunction: TileLoadFunction): void {
    this.tileCache.clear();
    this.tileLoadFunction = tileLoadFunction;
    this.changed();
  }

  /**
   * Set the tile URL function of the source.
   * @param {UrlFunction} tileUrlFunction Tile URL function.
   * @param {string} [key] Optional new tile key for the source.
   * @api
   */
  public setTileUrlFunction(tileUrlFunction: UrlFunction, key?: string): void {
    this.tileUrlFunction = tileUrlFunction;
    this.tileCache.pruneExceptNewestZ();
    if (typeof key !== 'undefined') {
      this.setKey(key);
    } else {
      this.changed();
    }
  }

  /**
   * Set the URL to use for requests.
   * @param {string} url URL.
   * @api
   */
  public setUrl(url: string): void {
    const urls = expandUrl(url);
    this.urls = urls;
    this.setUrls(urls);
  }

  /**
   * Set the URLs to use for requests.
   * @param {Array<string>} urls URLs.
   * @api
   */
  public setUrls(urls: string[]): void {
    this.urls = urls;
    const key = urls.join('\n');
    if (this.generateTileUrlFunction_) {
      this.setTileUrlFunction(createFromTemplates(urls, this.tileGrid), key);
    } else {
      this.setKey(key);
    }
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {string|undefined} Tile URL.
   */
  public tileUrlFunction(tileCoord: TileCoord, pixelRatio: number, projection: Projection): string | undefined {
    return undefined;
  }

  /**
   * Marks a tile coord as being used, without triggering a load.
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   */
  public useTile(z: number, x: number, y: number): void {
    const tileCoordKey = getKeyZXY(z, x, y);
    if (this.tileCache.containsKey(tileCoordKey)) {
      this.tileCache.get(tileCoordKey);
    }
  }
}

export default UrlTileSource;
