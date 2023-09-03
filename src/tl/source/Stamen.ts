/**
 * @module tl/source/Stamen
 */

import XYZ from './XYZ';
import {ATTRIBUTION as OSM_ATTRIBUTION} from './OSM';
import {TileLoadFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";

/**
 * @const
 * @type {Array<string>}
 */
const ATTRIBUTIONS: string[] = [
  'Map tiles by <a href="https://stamen.com/" target="_blank">Stamen Design</a>, ' +
    'under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank">CC BY' +
    ' 3.0</a>.',
  OSM_ATTRIBUTION,
];

/**
 * @type {Object<string, {extension: string, opaque: boolean}>}
 */
const LayerConfig: {[key: string]: { extension: string, opaque: boolean }} = {
  'terrain': {
    extension: 'png',
    opaque: true,
  },
  'terrain-background': {
    extension: 'png',
    opaque: true,
  },
  'terrain-labels': {
    extension: 'png',
    opaque: false,
  },
  'terrain-lines': {
    extension: 'png',
    opaque: false,
  },
  'toner-background': {
    extension: 'png',
    opaque: true,
  },
  'toner': {
    extension: 'png',
    opaque: true,
  },
  'toner-hybrid': {
    extension: 'png',
    opaque: false,
  },
  'toner-labels': {
    extension: 'png',
    opaque: false,
  },
  'toner-lines': {
    extension: 'png',
    opaque: false,
  },
  'toner-lite': {
    extension: 'png',
    opaque: true,
  },
  'watercolor': {
    extension: 'jpg',
    opaque: true,
  },
};

/**
 * @type {Object<string, {minZoom: number, maxZoom: number}>}
 */
const ProviderConfig: {[key: string]: { minZoom: number, maxZoom: number }} = {
  'terrain': {
    minZoom: 0,
    maxZoom: 18,
  },
  'toner': {
    minZoom: 0,
    maxZoom: 20,
  },
  'watercolor': {
    minZoom: 0,
    maxZoom: 18,
  },
};

export interface StamenOptions {
  cacheSize?: number;
  interpolate?: boolean;
  layer: string;
  minZoom?: number;
  maxZoom?: number;
  reprojectionErrorThreshold?: number;
  tileLoadFunction?: TileLoadFunction;
  transition?: number;
  url?: string;
  wrapX?: boolean;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for the Stamen tile server.
 * @api
 */
class Stamen extends XYZ {
  /**
   * @param {Options} options Stamen options.
   */
  constructor(options: StamenOptions) {
    const i = options.layer.indexOf('-');
    const provider = i == -1 ? options.layer : options.layer.slice(0, i);
    const providerConfig = ProviderConfig[provider];

    const layerConfig = LayerConfig[options.layer];

    const url: string =
      options.url !== undefined
        ? options.url
        : 'https://stamen-tiles-{a-d}.a.ssl.fastly.net/' +
          options.layer +
          '/{z}/{x}/{y}.' +
          layerConfig.extension;

    super({
      attributions: ATTRIBUTIONS,
      cacheSize: options.cacheSize,
      crossOrigin: 'anonymous',
      interpolate: options.interpolate,
      maxZoom:
        options.maxZoom != undefined ? options.maxZoom : providerConfig.maxZoom,
      minZoom:
        options.minZoom != undefined ? options.minZoom : providerConfig.minZoom,
      opaque: layerConfig.opaque,
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      tileLoadFunction: options.tileLoadFunction,
      transition: options.transition,
      url: url,
      wrapX: options.wrapX,
      zDirection: options.zDirection,
    });
  }
}

export default Stamen;
