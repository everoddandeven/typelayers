/**
 * @module tl/source/ImageQGISRest
 */

import EventType from '../events/EventType';
import ImageSource, {defaultImageLoadFunction, ImageLoadFunction, ImageSourceOptions} from './Image';
import ImageWrapper from '../Image';
import {assert} from '../asserts';
import {containsExtent, Extent, getHeight, getWidth} from '../extent';
import {createCanvasContext2D} from '../dom';
import {AttributionLike, SourceOptions} from "./Source";
import {LoadFunction} from "../Image";
import {ProjectionLike} from "../proj";
import {Size} from "../size";
import Projection from "../proj/Projection";
import {appendParams} from "../uri";

interface ImageQGISRestOptions {
  attributions?: AttributionLike;
  crossOrigin?: null | string;
  hidpi?: boolean;
  imageLoadFunction?: LoadFunction;
  interpolate?: boolean;
  params?: {[key:string]: any};
  projection?: ProjectionLike;
  ratio?: number;
  resolutions?: number[];
  url?: string;
}

/**
 * @classdesc
 * Source for data from QGIS Rest services providing single, untiled images.
 * Useful when underlying map service has labels.
 *
 * If underlying map service is not using labels,
 * take advantage of tl image caching and use
 * {@link module:tl/source/TileQGISRest~TileQGISRest} data source.
 *
 * @fires module:tl/source/Image.ImageSourceEvent
 * @api
 */



class ImageQGISRest extends ImageSource {
  /**
   * @param {Options} [options] Image QGIS Rest Options.
   */

  private context_: CanvasRenderingContext2D;
  private crossOrigin_?: string;
  private hidpi_: boolean;
  private url_?: string;
  private imageLoadFunction_: LoadFunction;
  private params_:{[key: string]: any};
  private image_: ImageWrapper
  private imageSize_: Size;
  private renderedRevision_: number;
  private ratio_: number;

  constructor(options: ImageQGISRestOptions) {
    options = options ? options : {};

    super(<ImageSourceOptions>{
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
     * @type {boolean}
     */
    this.hidpi_ = options.hidpi !== undefined ? options.hidpi : true;

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
    this.params_ = options.params || {};

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
    pixelRatio = this.hidpi_ ? pixelRatio : 1;

    const image: ImageWrapper = this.image_;
    if (
      image &&
      this.renderedRevision_ == this.getRevision() &&
      image.getResolution() == resolution &&
      image.getPixelRatio() == pixelRatio &&
      containsExtent(image.getExtent(), extent)
    ) {
      return image;
    }

    const params = {
      'F': 'image',
      'FORMAT': 'PNG32',
      'TRANSPARENT': true,
    };
    Object.assign(params, this.params_);

    extent = <Extent>extent.slice();
    const centerX = (extent[0] + extent[2]) / 2;
    const centerY = (extent[1] + extent[3]) / 2;
    if (this.ratio_ != 1) {
      const halfWidth = (this.ratio_ * getWidth(extent)) / 2;
      const halfHeight = (this.ratio_ * getHeight(extent)) / 2;
      extent[0] = centerX - halfWidth;
      extent[1] = centerY - halfHeight;
      extent[2] = centerX + halfWidth;
      extent[3] = centerY + halfHeight;
    }

    const imageResolution = resolution / pixelRatio;

    // Compute an integer width and height.
    const width = Math.ceil(getWidth(extent) / imageResolution);
    const height = Math.ceil(getHeight(extent) / imageResolution);

    // Modify the extent to match the integer width and height.
    extent[0] = centerX - (imageResolution * width) / 2;
    extent[2] = centerX + (imageResolution * width) / 2;
    extent[1] = centerY - (imageResolution * height) / 2;
    extent[3] = centerY + (imageResolution * height) / 2;

    this.imageSize_[0] = width;
    this.imageSize_[1] = height;

    const url = this.getRequestUrl_(
      extent,
      this.imageSize_,
      pixelRatio,
      projection,
      params
    );

    this.image_ = new ImageWrapper(
      extent,
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
  private getRequestUrl_(extent: Extent, size: Size, pixelRatio: number, projection: Projection, params: {[param: string]: any}): string {
    // QGIS Server only wants the numeric portion of the projection ID.
    // (if there is no numeric portion the entire projection code must
    // form a valid QGIS SpatialReference definition).
    const srid = projection
      .getCode()
      .split(/:(?=\d+$)/)
      .pop();

    params['SIZE'] = size[0] + ',' + size[1];
    params['BBOX'] = extent.join(',');
    params['BBOXSR'] = srid;
    params['IMAGESR'] = srid;
    params['DPI'] = Math.round(90 * pixelRatio);

    const url = this.url_;

    const modifiedUrl = url
      .replace(/MapServer\/?$/, 'MapServer/export')
      .replace(/ImageServer\/?$/, 'ImageServer/exportImage');
    if (modifiedUrl == url) {
      assert(false, 50); // `options.featureTypes` should be an Array
    }
    return appendParams(modifiedUrl, params);
  }

  /**
   * Return the URL used for this QGIS source.
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
  public updateParams(params: {[param: string]: any}): void {
    Object.assign(this.params_, params);
    this.image_ = null;
    this.changed();
  }
}

export default ImageQGISRest;
