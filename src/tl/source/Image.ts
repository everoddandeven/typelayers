/**
 * @module tl/source/Image
 */
import Event from '../events/Event';
import ImageState from '../ImageState';
import ReprojImage from '../reproj/Image';
import Source, {AttributionLike, SourceState} from './Source';
import {equals} from '../extent';
import {equivalent, ProjectionLike} from '../proj';
import {linearFindNearest} from '../array';
import {Extent} from "../extent/Extent";
import Projection from "../proj/Projection";
import {EventsKey} from "../events";
import {ImageBase} from "../index";

/**
 * @enum {string}
 */
export enum ImageSourceEventType {
  /**
   * Triggered when an image starts loading.
   * @event module:tl/source/Image.ImageSourceEvent#imageloadstart
   * @api
   */
  IMAGELOADSTART = 'imageloadstart',

  /**
   * Triggered when an image finishes loading.
   * @event module:tl/source/Image.ImageSourceEvent#imageloadend
   * @api
   */
  IMAGELOADEND = 'imageloadend',

  /**
   * Triggered if image loading results in an error.
   * @event module:tl/source/Image.ImageSourceEvent#imageloaderror
   * @api
   */
  IMAGELOADERROR = 'imageloaderror'
}

export type ImageSourceEventTypes = 'imageloadend'|'imageloaderror'|'imageloadstart';

/**
 * @typedef {'imageloadend'|'imageloaderror'|'imageloadstart'} ImageSourceEventTypes
 */

/**
 * @classdesc
 * Events emitted by {@link module:tl/source/Image~ImageSource} instances are instances of this
 * type.
 */
export class ImageSourceEvent extends Event {
  /**
   * @param {string} type Type.
   * @param {import("../Image").default} image The image.
   */

  public image: Image;

  constructor(type: string, image: Image) {
    super(type);

    /**
     * The image related to the event.
     * @type {import("../Image").default}
     * @api
     */
    this.image = image;
  }
}

/***
 * @template Return
 * @typedef {import("../Observable").OnSignature<import("../Observable").EventTypes, import("../events/Event").default, Return> &
 *   import("../Observable").OnSignature<import("../ObjectEventType").Types, import("../Object").ObjectEvent, Return> &
 *   import("../Observable").OnSignature<ImageSourceEventTypes, ImageSourceEvent, Return> &
 *   import("../Observable").CombinedOnSignature<import("../Observable").EventTypes|import("../ObjectEventType").Types
 *     |ImageSourceEventTypes, Return>} ImageSourceOnSignature
 */



/**
 * @typedef {Object} Options
 * @property {import("./Source").AttributionLike} [attributions] Attributions.
 * @property {boolean} [interpolate=true] Use interpolated values when resampling.  By default,
 * linear interpolation is used when resampling.  Set to false to use the nearest neighbor instead.
 * @property {import("../proj").ProjectionLike} [projection] Projection.
 * @property {Array<number>} [resolutions] Resolutions.
 * @property {import("./Source").SourceState} [state] SourceState.
 */

export interface ImageSourceOptions
{
  attributions?: AttributionLike,
  interpolate?: boolean,
  projection?: ProjectionLike,
  resolution?: number[],
  state?: SourceState
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for sources providing a single image.
 * @abstract
 * @fires module:tl/source/Image.ImageSourceEvent
 * @api
 */
export default abstract class ImageSource extends Source {
  /**
   * @param {Options} options Single image source options.
   */

  private resolutions_?: number[];
  private reprojectedImage_?: any;
  private reprojectedRevision_: number;

  public on: EventsKey;
  public once: EventsKey;
  public un: ImageSourceOnSignature<void>;


  protected constructor(options: ImageSourceOptions) {
    super({
      attributions: options.attributions,
      projection: options.projection,
      state: options.state,
      interpolate:
        options.interpolate !== undefined ? options.interpolate : true,
    });

    /***
     * @type {ImageSourceOnSignature<import("../events").EventsKey>}
     */
    this.on;

    /***
     * @type {ImageSourceOnSignature<import("../events").EventsKey>}
     */
    this.once;

    /***
     * @type {ImageSourceOnSignature<void>}
     */
    this.un;

    /**
     * @private
     * @type {Array<number>|null}
     */
    this.resolutions_ =
      options.resolutions !== undefined ? options.resolutions : null;

    /**
     * @private
     * @type {import("../reproj/Image").default}
     */
    this.reprojectedImage_ = null;

    /**
     * @private
     * @type {number}
     */
    this.reprojectedRevision_ = 0;
  }

  /**
   * @return {Array<number>|null} Resolutions.
   */
  public getResolutions(): number[] | null {
    return this.resolutions_;
  }

  /**
   * @param {Array<number>|null} resolutions Resolutions.
   */
  public setResolutions(resolutions?: number[]): void {
    this.resolutions_ = resolutions;
  }

  /**
   * @protected
   * @param {number} resolution Resolution.
   * @return {number} Resolution.
   */
  protected findNearestResolution(resolution: number): number {
    const resolutions: number[] = this.getResolutions();

    if (resolutions) {
      const idx: number = linearFindNearest(resolutions, resolution, 0);
      resolution = resolutions[idx];
    }

    return resolution;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../ImageBase").default} Single image.
   */
  public getImage(extent: Extent, resolution: number, pixelRatio: number, projection: Projection) {
    const sourceProjection: Projection = this.getProjection();
    if (
      !sourceProjection ||
      !projection ||
      equivalent(sourceProjection, projection)
    ) {
      if (sourceProjection) {
        projection = sourceProjection;
      }
      return this.getImageInternal(extent, resolution, pixelRatio, projection);
    }
    if (this.reprojectedImage_) {
      if (
        this.reprojectedRevision_ == this.getRevision() &&
        equivalent(this.reprojectedImage_.getProjection(), projection) &&
        this.reprojectedImage_.getResolution() == resolution &&
        equals(this.reprojectedImage_.getExtent(), extent)
      ) {
        return this.reprojectedImage_;
      }
      this.reprojectedImage_.dispose();
      this.reprojectedImage_ = null;
    }

    this.reprojectedImage_ = new ReprojImage(
      sourceProjection,
      projection,
      extent,
      resolution,
      pixelRatio,
      (extent, resolution, pixelRatio) =>
        this.getImageInternal(extent, resolution, pixelRatio, sourceProjection),
      this.getInterpolate()
    );
    this.reprojectedRevision_ = this.getRevision();

    return this.reprojectedImage_;
  }

  /**
   * @abstract
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../ImageBase").default} Single image.
   * @protected
   */
  protected abstract getImageInternal(extent: Extent, resolution: number, pixelRatio: number, projection: ProjectionLike): ImageBase;

  /**
   * Handle image change events.
   * @param {import("../events/Event").default} event Event.
   * @protected
   */
  public handleImageChange(event: Event): void {
    const image = /** @type {import("../Image").default} */ (event.target);
    let type: ImageSourceEventType;
    switch (image.getState()) {
      case ImageState.LOADING:
        this.loading = true;
        type = ImageSourceEventType.IMAGELOADSTART;
        break;
      case ImageState.LOADED:
        this.loading = false;
        type = ImageSourceEventType.IMAGELOADEND;
        break;
      case ImageState.ERROR:
        this.loading = false;
        type = ImageSourceEventType.IMAGELOADERROR;
        break;
      default:
        return;
    }
    if (this.hasListener(type)) {
      this.dispatchEvent(new ImageSourceEvent(type, image));
    }
  }
}

/**
 * Default image load function for image sources that use import("../Image").Image image
 * instances.
 * @param {import("../Image").default} image Image.
 * @param {string} src Source.
 */

export type ImageLoadFunction = (image: Image, src: string) => void;

export function defaultImageLoadFunction(image: Image, src: string): void {
  /** @type {HTMLImageElement|HTMLVideoElement} */ (image.getImage()).src = src;
}