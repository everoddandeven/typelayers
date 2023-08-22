/**
 * @module tl/featureloader
 */
import {VOID} from './functions';
import Feature from "./Feature";
import Projection from "./proj/Projection";
import {Extent} from "./extent/Extent";
import Vector from "./source/Vector";
import VectorTile from "./VectorTile";

/**
 *
 * @type {boolean}
 * @private
 */
let withCredentials = false;

/**
 * {@link module:tl/source/Vector~VectorSource} sources use a function of this type to
 * load features.
 *
 * This function takes up to 5 arguments. These are an {@link module:tl/extent~Extent} representing
 * the area to be loaded, a `{number}` representing the resolution (map units per pixel), an
 * {@link module:tl/proj/Projection~Projection} for the projection, an optional success callback that should get
 * the loaded features passed as an argument and an optional failure callback with no arguments. If
 * the callbacks are not used, the corresponding vector source will not fire `'featuresloadend'` and
 * `'featuresloaderror'` events. `this` within the function is bound to the
 * {@link module:tl/source/Vector~VectorSource} it's called from.
 *
 * The function is responsible for loading the features and adding them to the
 * source.
 * @typedef {function(this:(import("./source/Vector").default|import("./VectorTile").default),
 *           import("./extent").Extent,
 *           number,
 *           import("./proj/Projection").default,
 *           function(Array<import("./Feature").default>): void=,
 *           function(): void=): void} FeatureLoader
 * @api
 */

export type FeatureLoader = (
    extent: Extent,
    resolution: number,
    projection: Projection,
    success?: (features: Feature[]) => void,
    error?: () => void
) => void;

/**
 * {@link module:tl/source/Vector~VectorSource} sources use a function of this type to
 * get the url to load features from.
 *
 * This function takes an {@link module:tl/extent~Extent} representing the area
 * to be loaded, a `{number}` representing the resolution (map units per pixel)
 * and an {@link module:tl/proj/Projection~Projection} for the projection  as
 * arguments and returns a `{string}` representing the URL.
 * @typedef {function(import("./extent").Extent, number, import("./proj/Projection").default): string} FeatureUrlFunction
 * @api
 */

export type FeatureUrlFunction = (extent: Extent, mapUnitsPerPixel: number, projection: Projection) => string;

/**
 * @param {string|FeatureUrlFunction} url Feature URL service.
 * @param {import("./format/Feature").default} format Feature format.
 * @param {import("./extent").Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @param {import("./proj/Projection").default} projection Projection.
 * @param {function(Array<import("./Feature").default>, import("./proj/Projection").default): void} success Success
 *      Function called with the loaded features and optionally with the data projection.
 * @param {function(): void} failure Failure
 *      Function called when loading failed.
 */
export function loadFeaturesXhr(
  url: string | FeatureUrlFunction,
  format,
  extent: Extent,
  resolution: number,
  projection: Projection,
  success: (features: Feature[], projection: Projection) => void,
  failure: () => void = (): void => {}
) {
  const xhr = new XMLHttpRequest();
  xhr.open(
    'GET',
    typeof url === 'function' ? url(extent, resolution, projection) : url,
    true
  );
  if (format.getType() == 'arraybuffer') {
    xhr.responseType = 'arraybuffer';
  }
  xhr.withCredentials = withCredentials;
  /**
   * @param {Event} event Event.
   * @private
   */
  xhr.onload = function (event): void {
    // status will be 0 for file:// urls
    if (!xhr.status || (xhr.status >= 200 && xhr.status < 300)) {
      const type = format.getType();
      /** @type {Document|Node|Object|string|undefined} */
      let source: Document | Node | Object | string | undefined;
      if (type == 'json' || type == 'text') {
        source = xhr.responseText;
      } else if (type == 'xml') {
        source = xhr.responseXML;
        if (!source) {
          source = new DOMParser().parseFromString(
            xhr.responseText,
            'application/xml'
          );
        }
      } else if (type == 'arraybuffer') {
        source = /** @type {ArrayBuffer} */ (xhr.response);
      }
      if (source) {
        success(
          /** @type {Array<import("./Feature").default>} */
          (
            format.readFeatures(source, {
              extent: extent,
              featureProjection: projection,
            })
          ),
          format.readProjection(source)
        );
      } else {
        failure();
      }
    } else {
      failure();
    }
  };
  /**
   * @private
   */
  xhr.onerror = failure;
  xhr.send();
}

/**
 * Create an XHR feature loader for a `url` and `format`. The feature loader
 * loads features (with XHR), parses the features, and adds them to the
 * vector source.
 * @param {string|FeatureUrlFunction} url Feature URL service.
 * @param {import("./format/Feature").default} format Feature format.
 * @return {FeatureLoader} The feature loader.
 * @api
 */
export function xhr(url: string | FeatureUrlFunction, format) {
  /**
   * @param {import("./extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {import("./proj/Projection").default} projection Projection.
   * @param {function(Array<import("./Feature").default>): void} [success] Success
   *      Function called when loading succeeded.
   * @param {function(): void} [failure] Failure
   *      Function called when loading failed.
   */
  return function (
      extent: Extent,
      resolution: number,
      projection: Projection,
      success: (features: Feature[]) => void,
      failure: () => void = (): void => {}
  ): void {
    const source = /** @type {import("./source/Vector").default} */ (this);
    loadFeaturesXhr(
      url,
      format,
      extent,
      resolution,
      projection,
      /**
       * @param {Array<import("./Feature").default>} features The loaded features.
       * @param {import("./proj/Projection").default} dataProjection Data
       * projection.
       */
      function (features: Feature[], dataProjection: Projection): void {
        source.addFeatures(features);
        if (success !== undefined) {
          success(features);
        }
      },
      /* FIXME handle error */ failure ? failure : VOID
    );
  };
}

/**
 * Setter for the withCredentials configuration for the XHR.
 *
 * @param {boolean} xhrWithCredentials The value of withCredentials to set.
 * Compare https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/
 * @api
 */
export function setWithCredentials(xhrWithCredentials: boolean): void {
  withCredentials = xhrWithCredentials;
}
