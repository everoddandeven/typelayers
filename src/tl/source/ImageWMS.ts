/**
 * @module tl/source/ImageWMS
 */

import EventType from '../events/EventType';
import ImageSource, {defaultImageLoadFunction, ImageLoadFunction} from './Image';
import ImageWrapper from '../Image';
import {DEFAULT_VERSION, ServerType} from './wms';
import {appendParams} from '../uri';
import {assert} from '../asserts';
import {calculateSourceResolution} from '../reproj';
import {ceil, floor, round} from '../math';
import {compareVersions} from '../string';
import {
  containsExtent, Extent,
  getCenter,
  getForViewAndSize,
  getHeight,
  getWidth,
} from '../extent';
import {createCanvasContext2D} from '../dom';
import {get as getProjection, transform} from '../proj';
import {Size} from "../size";
import Projection from "../proj/Projection";
import {Coordinate} from "../coordinate";

/**
 * Number of decimal digits to consider in integer values when rounding.
 * @type {number}
 */
const DECIMALS: number = 4;

/**
 * @const
 * @type {import("../size").Size}
 */
const GETFEATUREINFO_IMAGE_SIZE: [number, number] = [101, 101];

export interface ImageWMSOptions {
  attributions?: import("./Source").AttributionLike;
  crossOrigin?: null | string;
  hidpi?: boolean;
  serverType?: import("./wms").ServerType;
  imageLoadFunction?: import("../Image").LoadFunction;
  interpolate?: boolean;
  params?: {[p: string]: any};
  projection?: import("../proj").ProjectionLike;
  ratio?: number;
  resolutions?: Array<number>;
  url?: string;
}

/**
 * @classdesc
 * Source for WMS servers providing single, untiled images.
 *
 * @fires module:tl/source/Image.ImageSourceEvent
 * @api
 */
class ImageWMS extends ImageSource {
  /**
   * @param {Options} [options] ImageWMS options.
   */

  private context_: CanvasRenderingContext2D;
  private crossOrigin_?: string;
  private url_?: string;
  private imageLoadFunction_: ImageLoadFunction;
  private params_?: {[p: string]: any};
  private v13_: boolean;
  private serverType_: ServerType;
  private hidpi_: boolean;
  private image_?: ImageWrapper;
  private imageSize_?: Size;
  private renderedRevision_: number;
  private ratio_: number;

  constructor(options?: ImageWMSOptions) {
    options = options ? options : {};

    super({
      attributions: options.attributions,
      interpolate: options.interpolate,
      projection: options.projection,
      resolutions: options.resolutions,
    });

    /**
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.context_ = <CanvasRenderingContext2D>createCanvasContext2D(1, 1);

    /**
     * @private
     * @type {?string}
     */
    this.crossOrigin_ =
      options.crossOrigin !== undefined ? options.crossOrigin : null;

    /**
     * @private
     * @type {string|undefined}
     */
    this.url_ = options.url;

    /**
     * @private
     * @type {import("../Image").LoadFunction}
     */
    this.imageLoadFunction_ =
      options.imageLoadFunction !== undefined
        ? options.imageLoadFunction
        : defaultImageLoadFunction;

    /**
     * @private
     * @type {!Object}
     */
    this.params_ = Object.assign({}, options.params);

    /**
     * @private
     * @type {boolean}
     */
    this.v13_ = true;
    this.updateV13_();

    /**
     * @private
     * @type {import("./wms").ServerType}
     */
    this.serverType_ = options.serverType;

    /**
     * @private
     * @type {boolean}
     */
    this.hidpi_ = options.hidpi !== undefined ? options.hidpi : true;

    /**
     * @private
     * @type {import("../Image").default}
     */
    this.image_ = null;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.imageSize_ = [0, 0];

    /**
     * @private
     * @type {number}
     */
    this.renderedRevision_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.ratio_ = options.ratio !== undefined ? options.ratio : 1.5;
  }

  /**
   * Return the GetFeatureInfo URL for the passed coordinate, resolution, and
   * projection. Return `undefined` if the GetFeatureInfo URL cannot be
   * constructed.
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {number} resolution Resolution.
   * @param {import("../proj").ProjectionLike} projection Projection.
   * @param {!Object} params GetFeatureInfo params. `INFO_FORMAT` at least should
   *     be provided. If `QUERY_LAYERS` is not provided then the layers specified
   *     in the `LAYERS` parameter will be used. `VERSION` should not be
   *     specified here.
   * @return {string|undefined} GetFeatureInfo URL.
   * @api
   */
  public getFeatureInfoUrl(coordinate: Coordinate, resolution: number, projection: Projection, params: {[p: string]: any}): string {
    if (this.url_ === undefined) {
      return undefined;
    }
    const projectionObj = getProjection(projection);
    const sourceProjectionObj = this.getProjection();

    if (sourceProjectionObj && sourceProjectionObj !== projectionObj) {
      resolution = calculateSourceResolution(
        sourceProjectionObj,
        projectionObj,
        coordinate,
        resolution
      );
      coordinate = transform(coordinate, projectionObj, sourceProjectionObj);
    }

    const extent = getForViewAndSize(
      coordinate,
      resolution,
      0,
      GETFEATUREINFO_IMAGE_SIZE
    );

    const baseParams = {
      'SERVICE': 'WMS',
      'VERSION': DEFAULT_VERSION,
      'REQUEST': 'GetFeatureInfo',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'QUERY_LAYERS': this.params_['LAYERS'],
    };
    Object.assign(baseParams, this.params_, params);

    const x = floor((coordinate[0] - extent[0]) / resolution, DECIMALS);
    const y = floor((extent[3] - coordinate[1]) / resolution, DECIMALS);
    baseParams[this.v13_ ? 'I' : 'X'] = x;
    baseParams[this.v13_ ? 'J' : 'Y'] = y;

    return this.getRequestUrl_(
      extent,
      GETFEATUREINFO_IMAGE_SIZE,
      1,
      sourceProjectionObj || projectionObj,
      baseParams
    );
  }

  /**
   * Return the GetLegendGraphic URL, optionally optimized for the passed
   * resolution and possibly including any passed specific parameters. Returns
   * `undefined` if the GetLegendGraphic URL cannot be constructed.
   *
   * @param {number} [resolution] Resolution. If set to undefined, `SCALE`
   *     will not be calculated and included in URL.
   * @param {Object} [params] GetLegendGraphic params. If `LAYER` is set, the
   *     request is generated for this wms layer, else it will try to use the
   *     configured wms layer. Default `FORMAT` is `image/png`.
   *     `VERSION` should not be specified here.
   * @return {string|undefined} GetLegendGraphic URL.
   * @api
   */
  public getLegendUrl(resolution?: number, params?: {[p: string]: any}): string {
    if (this.url_ === undefined) {
      return undefined;
    }

    const baseParams = {
      'SERVICE': 'WMS',
      'VERSION': DEFAULT_VERSION,
      'REQUEST': 'GetLegendGraphic',
      'FORMAT': 'image/png',
    };

    if (params === undefined || params['LAYER'] === undefined) {
      const layers = this.params_.LAYERS;
      const isSingleLayer = !Array.isArray(layers) || layers.length === 1;
      if (!isSingleLayer) {
        return undefined;
      }
      baseParams['LAYER'] = layers;
    }

    if (resolution !== undefined) {
      const mpu = this.getProjection()
        ? this.getProjection().getMetersPerUnit()
        : 1;
      const pixelSize = 0.00028;
      baseParams['SCALE'] = (resolution * mpu) / pixelSize;
    }

    Object.assign(baseParams, params);

    return appendParams(/** @type {string} */ (this.url_), baseParams);
  }

  /**
   * Get the user-provided params, i.e. those passed to the constructor through
   * the "params" option, and possibly updated using the updateParams method.
   * @return {Object} Params.
   * @api
   */
  public getParams(): {[p: string]: any} {
    return this.params_;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../Image").default} Single image.
   */
  protected getImageInternal(extent: Extent, resolution: number, pixelRatio: number, projection: Projection): ImageWrapper {
    if (this.url_ === undefined) {
      return null;
    }

    resolution = this.findNearestResolution(resolution);

    if (pixelRatio != 1 && (!this.hidpi_ || this.serverType_ === undefined)) {
      pixelRatio = 1;
    }

    const imageResolution = resolution / pixelRatio;

    const center = getCenter(extent);
    const viewWidth = ceil(getWidth(extent) / imageResolution, DECIMALS);
    const viewHeight = ceil(getHeight(extent) / imageResolution, DECIMALS);
    const viewExtent = getForViewAndSize(center, imageResolution, 0, [
      viewWidth,
      viewHeight,
    ]);
    const marginWidth = ceil(((this.ratio_ - 1) * viewWidth) / 2, DECIMALS);
    const requestWidth = viewWidth + 2 * marginWidth;
    const marginHeight = ceil(((this.ratio_ - 1) * viewHeight) / 2, DECIMALS);
    const requestHeight = viewHeight + 2 * marginHeight;
    const requestExtent = getForViewAndSize(center, imageResolution, 0, [
      requestWidth,
      requestHeight,
    ]);

    const image = this.image_;
    if (
      image &&
      this.renderedRevision_ == this.getRevision() &&
      image.getResolution() == resolution &&
      image.getPixelRatio() == pixelRatio &&
      containsExtent(image.getExtent(), viewExtent)
    ) {
      return image;
    }

    const params = {
      'SERVICE': 'WMS',
      'VERSION': DEFAULT_VERSION,
      'REQUEST': 'GetMap',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
    };
    Object.assign(params, this.params_);

    this.imageSize_[0] = round(
      getWidth(requestExtent) / imageResolution,
      DECIMALS
    );
    this.imageSize_[1] = round(
      getHeight(requestExtent) / imageResolution,
      DECIMALS
    );

    const url = this.getRequestUrl_(
      requestExtent,
      this.imageSize_,
      pixelRatio,
      projection,
      params
    );

    this.image_ = new ImageWrapper(
      requestExtent,
      resolution,
      pixelRatio,
      url,
      this.crossOrigin_,
      this.imageLoadFunction_,
      this.context_
    );

    this.renderedRevision_ = this.getRevision();

    this.image_.addEventListener(
      EventType.CHANGE,
      this.handleImageChange.bind(this)
    );

    return this.image_;
  }

  /**
   * Return the image load function of the source.
   * @return {import("../Image").LoadFunction} The image load function.
   * @api
   */
  public getImageLoadFunction(): ImageLoadFunction {
    return this.imageLoadFunction_;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {import("../size").Size} size Size.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {Object} params Params.
   * @return {string} Request URL.
   * @private
   */
  private getRequestUrl_(extent: Extent, size: Size, pixelRatio: number, projection: Projection, params: {[p: string]: any}): string {
    assert(this.url_ !== undefined, 9); // `url` must be configured or set using `#setUrl()`

    params[this.v13_ ? 'CRS' : 'SRS'] = projection.getCode();

    if (!('STYLES' in this.params_)) {
      params['STYLES'] = '';
    }

    if (pixelRatio != 1) {
      switch (this.serverType_) {
        case 'geoserver':
          const dpi = (90 * pixelRatio + 0.5) | 0;
          if ('FORMAT_OPTIONS' in params) {
            params['FORMAT_OPTIONS'] += ';dpi:' + dpi;
          } else {
            params['FORMAT_OPTIONS'] = 'dpi:' + dpi;
          }
          break;
        case 'mapserver':
          params['MAP_RESOLUTION'] = 90 * pixelRatio;
          break;
        case 'carmentaserver':
        case 'qgis':
          params['DPI'] = 90 * pixelRatio;
          break;
        default: // Unknown `serverType` configured
          assert(false, 8);
          break;
      }
    }

    params['WIDTH'] = size[0];
    params['HEIGHT'] = size[1];

    const axisOrientation = projection.getAxisOrientation();
    let bbox: Extent;
    if (this.v13_ && axisOrientation.substr(0, 2) == 'ne') {
      bbox = [extent[1], extent[0], extent[3], extent[2]];
    } else {
      bbox = extent;
    }
    params['BBOX'] = bbox.join(',');

    return appendParams(/** @type {string} */ (this.url_), params);
  }

  /**
   * Return the URL used for this WMS source.
   * @return {string|undefined} URL.
   * @api
   */
  public getUrl(): string {
    return this.url_;
  }

  /**
   * Set the image load function of the source.
   * @param {import("../Image").LoadFunction} imageLoadFunction Image load function.
   * @api
   */
  public setImageLoadFunction(imageLoadFunction: ImageLoadFunction): void {
    this.image_ = null;
    this.imageLoadFunction_ = imageLoadFunction;
    this.changed();
  }

  /**
   * Set the URL to use for requests.
   * @param {string|undefined} url URL.
   * @api
   */
  public setUrl(url: string): void {
    if (url != this.url_) {
      this.url_ = url;
      this.image_ = null;
      this.changed();
    }
  }

  /**
   * Update the user-provided params.
   * @param {Object} params Params.
   * @api
   */
  public updateParams(params: {[p: string]: any}): void {
    Object.assign(this.params_, params);
    this.updateV13_();
    this.image_ = null;
    this.changed();
  }

  /**
   * @private
   */
  private updateV13_(): void {
    const version = this.params_['VERSION'] || DEFAULT_VERSION;
    this.v13_ = compareVersions(version, '1.3') >= 0;
  }
}

export default ImageWMS;
