/**
 * @module tl/source/XYZ
 */

import TileImageSource from './TileImageSource';
import {createXYZ, extentFromProjection} from '../tilegrid';
import {AttributionLike} from "./Source";
import {ProjectionLike} from "../proj";
import {TileLoadFunction, UrlFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";
import {Size} from "../size";
import TileGrid from "../tilegrid/TileGrid";

interface XYZOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  opaque?: boolean;
  projection?: ProjectionLike;
  reprojectionErrorThreshold?: number;
  maxZoom?: number;
  minZoom?: number;
  maxResolution?: number;
  tileGrid?: TileGrid;
  tileLoadFunction?: TileLoadFunction;
  tilePixelRatio?: number;
  tileSize?: number | Size;
  gutter?: number;
  tileUrlFunction?: UrlFunction;
  url?: string;
  urls?: Array<string>;
  wrapX?: boolean;
  transition?: number;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for tile data with URLs in a set XYZ format that are
 * defined in a URL template. By default, this follows the widely-used
 * Google grid where `x` 0 and `y` 0 are in the top left. Grids like
 * TMS where `x` 0 and `y` 0 are in the bottom left can be used by
 * using the `{-y}` placeholder in the URL template, so long as the
 * source does not have a custom tile grid. In this case
 * a `tileUrlFunction` can be used, such as:
 * ```js
 *  tileUrlFunction: function(coordinate) {
 *    return 'http://mapserver.com/' + coordinate[0] + '/' +
 *      coordinate[1] + '/' + (-coordinate[2] - 1) + '.png';
 *  }
 * ```
 * @api
 */
class XYZ extends TileImageSource {
  private gutter_: number;
  /**
   * @param {Options} [options] XYZ options.
   */
  constructor(options?: XYZOptions) {
    options = options || {};

    const projection =
      options.projection !== undefined ? options.projection : 'EPSG:3857';

    const tileGrid =
      options.tileGrid !== undefined
        ? options.tileGrid
        : createXYZ({
            extent: extentFromProjection(projection),
            maxResolution: options.maxResolution,
            maxZoom: options.maxZoom,
            minZoom: options.minZoom,
            tileSize: options.tileSize,
          });

    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      opaque: options.opaque,
      projection: projection,
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      tileGrid: tileGrid,
      tileLoadFunction: options.tileLoadFunction,
      tilePixelRatio: options.tilePixelRatio,
      tileUrlFunction: options.tileUrlFunction,
      url: options.url,
      urls: options.urls,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      transition: options.transition,
      attributionsCollapsible: options.attributionsCollapsible,
      zDirection: options.zDirection,
    });

    /**
     * @private
     * @type {number}
     */
    this.gutter_ = options.gutter !== undefined ? options.gutter : 0;
  }

  /**
   * @return {number} Gutter.
   */
  public getGutter(): number {
    return this.gutter_;
  }
}

export default XYZ;
