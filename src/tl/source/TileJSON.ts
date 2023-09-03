/**
 * @module tl/source/TileJSON
 */
// FIXME check order of async callbacks

/**
 * See https://mapbox.com/developers/api/.
 */

import TileImageSource from './TileImageSource';
import {applyTransform, Extent, intersects} from '../extent';
import {assert} from '../asserts';
import {createFromTemplates} from '../tileurlfunction';
import {createXYZ, extentFromProjection} from '../tilegrid';
import {get as getProjection, getTransformFromProjections} from '../proj';
import {jsonp as requestJSONP} from '../net';
import {NearestDirectionFunction} from "../array";
import {Size} from "../size";
import {TileLoadFunction} from "../Tile";
import {AttributionLike} from "./Source";

export interface TileJSONConfig {
  name?: string;
  description?: string;
  version?: string;
  attribution?: string;
  template?: string;
  legend?: string;
  scheme?: string;
  tiles: Array<string>;
  grids?: Array<string>;
  minzoom?: number;
  maxzoom?: number;
  bounds?: Array<number>;
  center?: Array<number>;
}

export interface TileJSONOptions {
  attributions?: AttributionLike;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  jsonp?: boolean;
  reprojectionErrorThreshold?: number;
  tileJSON?: TileJSONConfig;
  tileLoadFunction?: TileLoadFunction;
  tileSize?: number | Size;
  url?: string;
  wrapX?: boolean;
  transition?: number;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for tile data in TileJSON format.
 * @api
 */
class TileJSON extends TileImageSource {
  private tileJSON_: TileJSONConfig;
  private tileSize_: number | Size;
  /**
   * @param {Options} options TileJSON options.
   */
  constructor(options: TileJSONOptions) {
    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      projection: getProjection('EPSG:3857'),
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      state: 'loading',
      tileLoadFunction: options.tileLoadFunction,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      transition: options.transition,
      zDirection: options.zDirection,
    });

    /**
     * @type {TileJSONConfig}
     * @private
     */
    this.tileJSON_ = null;

    /**
     * @type {number|import("../size").Size}
     * @private
     */
    this.tileSize_ = options.tileSize;

    if (options.url) {
      if (optionsonp) {
        requestJSONP(
          options.url,
          this.handleTileJSONResponse.bind(this),
          this.handleTileJSONError.bind(this)
        );
      } else {
        const client = new XMLHttpRequest();
        client.addEventListener('load', this.onXHRLoad_.bind(this));
        client.addEventListener('error', this.onXHRError_.bind(this));
        client.open('GET', options.url);
        client.send();
      }
    } else if (options.tileJSON) {
      this.handleTileJSONResponse(options.tileJSON);
    } else {
      assert(false, 51); // Either `url` or `tileJSON` options must be provided
    }
  }

  /**
   * @private
   * @param {Event} event The load event.
   */
  private onXHRLoad_(event: Event): void {
    const client = /** @type {XMLHttpRequest} */ (<XMLHttpRequest>event.target);
    // status will be 0 for file:// urls
    if (!client.status || (client.status >= 200 && client.status < 300)) {
      let response: TileJSONConfig;
      try {
        response = /** @type {TileJSONConfig} */ (<TileJSONConfig>JSON.parse(client.responseText));
      } catch (err) {
        this.handleTileJSONError();
        return;
      }
      this.handleTileJSONResponse(response);
    } else {
      this.handleTileJSONError();
    }
  }

  /**
   * @private
   * @param {Event} event The error event.
   */
  private onXHRError_(event: Event): void {
    this.handleTileJSONError();
  }

  /**
   * @return {TileJSONConfig} The tile json object.
   * @api
   */
  public getTileJSON(): TileJSONConfig {
    return this.tileJSON_;
  }

  /**
   * @protected
   * @param {TileJSONConfig} tileJSON Tile JSON.
   */
  protected handleTileJSONResponse(tileJSON: TileJSONConfig): void {
    const epsg4326Projection = getProjection('EPSG:4326');

    const sourceProjection = this.getProjection();
    let extent: Extent;
    if (tileJSON['bounds'] !== undefined) {
      const transform = getTransformFromProjections(
        epsg4326Projection,
        sourceProjection
      );
      extent = applyTransform(<Extent>tileJSON['bounds'], transform);
    }

    const gridExtent = extentFromProjection(sourceProjection);
    const minZoom = tileJSON['minzoom'] || 0;
    const maxZoom = tileJSON['maxzoom'] || 22;
    const tileGrid = createXYZ({
      extent: gridExtent,
      maxZoom: maxZoom,
      minZoom: minZoom,
      tileSize: this.tileSize_,
    });
    this.tileGrid = tileGrid;

    this.tileUrlFunction = createFromTemplates(tileJSON['tiles'], tileGrid);

    if (tileJSON['attribution'] && !this.getAttributions()) {
      const attributionExtent = extent !== undefined ? extent : gridExtent;
      this.setAttributions(function (frameState) {
        if (intersects(attributionExtent, frameState.extent)) {
          return [tileJSON['attribution']];
        }
        return null;
      });
    }
    this.tileJSON_ = tileJSON;
    this.setState('ready');
  }

  /**
   * @protected
   */
  protected handleTileJSONError(): void {
    this.setState('error');
  }
}

export default TileJSON;
