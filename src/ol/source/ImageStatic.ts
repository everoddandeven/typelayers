/**
 * @module ol/source/ImageStatic
 */

import EventType from '../events/EventType';
import ImageSource, {defaultImageLoadFunction, ImageLoadFunction} from './Image';
import ImageState from '../ImageState';
import ImageWrapper from '../Image';
import {createCanvasContext2D} from '../dom';
import {Extent, getHeight, getWidth, intersects} from '../extent';
import {get as getProjection, ProjectionLike} from '../proj';
import {AttributionLike} from "./Source";
import {Size} from "../size";
import Projection from "../proj/Projection";
import BaseEvent from "../events/Event";

export interface StaticOptions {
  attributions?: AttributionLike;
  crossOrigin?: null | string;
  imageExtent?: Extent;
  imageLoadFunction?: ImageLoadFunction;
  interpolate?: boolean;
  projection?: ProjectionLike;
  imageSize?: Size;
  url: string;
}

/**
 * @classdesc
 * A layer source for displaying a single, static image.
 * @api
 */
class Static extends ImageSource {
  private url_: string;
  private imageExtent_: Extent;
  private image_: ImageWrapper;
  private imageSize_?: Size;

  /**
   * @param {Options} options ImageStatic options.
   */
  constructor(options: StaticOptions) {
    const crossOrigin =
      options.crossOrigin !== undefined ? options.crossOrigin : null;

    const imageLoadFunction =
        options.imageLoadFunction !== undefined
          ? options.imageLoadFunction
          : defaultImageLoadFunction;

    super({
      attributions: options.attributions,
      interpolate: options.interpolate,
      projection: getProjection(options.projection),
    });

    /**
     * @private
     * @type {string}
     */
    this.url_ = options.url;

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.imageExtent_ = options.imageExtent;

    /**
     * @private
     * @type {import("../Image").default}
     */
    this.image_ = new ImageWrapper(
      this.imageExtent_,
      undefined,
      1,
      this.url_,
      crossOrigin,
      imageLoadFunction,
      <CanvasRenderingContext2D>createCanvasContext2D(1, 1)
    );

    /**
     * @private
     * @type {import("../size").Size|null}
     */
    this.imageSize_ = options.imageSize ? options.imageSize : null;

    this.image_.addEventListener(
      EventType.CHANGE,
      this.handleImageChange.bind(this)
    );
  }

  /**
   * Returns the image extent
   * @return {import("../extent").Extent} image extent.
   * @api
   */
  public getImageExtent(): Extent {
    return this.imageExtent_;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../Image").default} Single image.
   */
  public getImageInternal(extent: Extent, resolution: number, pixelRatio: number, projection: Projection): ImageWrapper {
    if (intersects(extent, this.image_.getExtent())) {
      return this.image_;
    }
    return null;
  }

  /**
   * Return the URL used for this image source.
   * @return {string} URL.
   * @api
   */
  public getUrl(): string {
    return this.url_;
  }

  /**
   * @param {import("../events/Event").default} evt Event.
   */
  public handleImageChange(evt: BaseEvent): void {
    if (this.image_.getState() == ImageState.LOADED) {
      const imageExtent = this.image_.getExtent();
      const image = this.image_.getImage();
      let imageWidth: number, imageHeight: number;
      if (this.imageSize_) {
        imageWidth = this.imageSize_[0];
        imageHeight = this.imageSize_[1];
      } else {
        imageWidth = image.width;
        imageHeight = image.height;
      }
      const extentWidth = getWidth(imageExtent);
      const extentHeight = getHeight(imageExtent);
      const xResolution = extentWidth / imageWidth;
      const yResolution = extentHeight / imageHeight;
      let targetWidth = imageWidth;
      let targetHeight = imageHeight;
      if (xResolution > yResolution) {
        targetWidth = Math.round(extentWidth / yResolution);
      } else {
        targetHeight = Math.round(extentHeight / xResolution);
      }
      if (targetWidth !== imageWidth || targetHeight !== imageHeight) {
        const context = createCanvasContext2D(targetWidth, targetHeight);
        if (!this.getInterpolate()) {
          context.imageSmoothingEnabled = false;
        }
        const canvas = <HTMLCanvasElement>context.canvas;
        context.drawImage(
          image,
          0,
          0,
          imageWidth,
          imageHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
        this.image_.setImage(canvas);
      }
    }
    super.handleImageChange(evt);
  }
}

export default Static;
