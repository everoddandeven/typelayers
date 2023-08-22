/**
 * @module tl/source/OSM
 */

import XYZ from './XYZ';
import {TileLoadFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";
import {AttributionLike} from "./Source";

/**
 * The attribution containing a link to the OpenStreetMap Copyright and License
 * page.
 * @const
 * @type {string}
 * @api
 */
export const ATTRIBUTION: string =
  '&#169; ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> ' +
  'contributors.';

interface OSMOptions {
  attributions?: AttributionLike;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  maxZoom?: number;
  opaque?: boolean;
  reprojectionErrorThreshold?: number;
  tileLoadFunction?: TileLoadFunction;
  transition?: number;
  url?: string;
  wrapX?: boolean;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for the OpenStreetMap tile server.
 * @api
 */
class OSM extends XYZ {
  /**
   * @param {Options} [options] Open Street Map options.
   */
  constructor(options?: OSMOptions) {
    options = options || {};

    let attributions: AttributionLike
    if (options.attributions !== undefined) {
      attributions = options.attributions;
    } else {
      attributions = [ATTRIBUTION];
    }

    const crossOrigin: string =
      options.crossOrigin !== undefined ? options.crossOrigin : 'anonymous';

    const url : string =
      options.url !== undefined
        ? options.url
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    super({
      attributions: attributions,
      attributionsCollapsible: false,
      cacheSize: options.cacheSize,
      crossOrigin: crossOrigin,
      interpolate: options.interpolate,
      maxZoom: options.maxZoom !== undefined ? options.maxZoom : 19,
      opaque: options.opaque !== undefined ? options.opaque : true,
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      tileLoadFunction: options.tileLoadFunction,
      transition: options.transition,
      url: url,
      wrapX: options.wrapX,
      zDirection: options.zDirection,
    });
  }
}

export default OSM;
