/**
 * @module tl/reproj/Image
 */
import {ERROR_THRESHOLD} from './common';

import EventType from '../events/EventType';
import ImageBase from '../ImageBase';
import ImageState from '../ImageState';
import Triangulation from './Triangulation';
import {
  calculateSourceResolution,
  render as renderReprojected,
} from '../reproj';
import {
  Extent,
  getCenter,
  getHeight,
  getIntersection,
  getWidth,
  isEmpty,
} from '../extent';
import {EventsKey, listen, unlistenByKey} from '../events';
import Projection from "../proj/Projection";

/**
 * @typedef {function(import("../extent").Extent, number, number) : import("../ImageBase").default} FunctionType
 */

export type ImageFunctionType = (extent: Extent, resolution: number, pixelRatio: number) => ImageBase;

/**
 * @classdesc
 * Class encapsulating single reprojected image.
 * See {module:tl/source/Image~ImageSource}.
 */
class ReprojImage extends ImageBase {
  /**
   * @param {import("../proj/Projection").default} sourceProj Source projection (of the data).
   * @param {import("../proj/Projection").default} targetProj Target projection.
   * @param {import("../extent").Extent} targetExtent Target extent.
   * @param {number} targetResolution Target resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {FunctionType} getImageFunction
   *     Function returning source images (extent, resolution, pixelRatio).
   * @param {boolean} interpolate Use linear interpolation when resampling.
   */

  private targetProj_: Projection;
  private maxSourceExtent_: Extent;
  private triangulation_: Triangulation;
  private targetResolution_: number;
  private targetExtent_: Extent;
  private sourceImage_: ImageBase;
  private sourcePixelRatio_: number;
  private interpolate_: boolean;
  private canvas_: HTMLCanvasElement;
  private sourceListenerKey_?: EventsKey;

  constructor(
    sourceProj: Projection,
    targetProj: Projection,
    targetExtent: Extent,
    targetResolution: number,
    pixelRatio: number,
    getImageFunction: ImageFunctionType,
    interpolate: boolean
  ) {
    let maxSourceExtent = sourceProj.getExtent();
    if (maxSourceExtent && sourceProj.canWrapX()) {
      maxSourceExtent = <Extent>maxSourceExtent.slice();
      maxSourceExtent[0] = -Infinity;
      maxSourceExtent[2] = Infinity;
    }
    let maxTargetExtent = targetProj.getExtent();
    if (maxTargetExtent && targetProj.canWrapX()) {
      maxTargetExtent = <Extent>maxTargetExtent.slice();
      maxTargetExtent[0] = -Infinity;
      maxTargetExtent[2] = Infinity;
    }

    const limitedTargetExtent = maxTargetExtent
      ? getIntersection(targetExtent, maxTargetExtent)
      : targetExtent;

    const targetCenter = getCenter(limitedTargetExtent);
    const sourceResolution = calculateSourceResolution(
      sourceProj,
      targetProj,
      targetCenter,
      targetResolution
    );

    const errorThresholdInPixels: number = ERROR_THRESHOLD;

    const triangulation = new Triangulation(
      sourceProj,
      targetProj,
      limitedTargetExtent,
      maxSourceExtent,
      sourceResolution * errorThresholdInPixels,
      targetResolution
    );

    const sourceExtent = triangulation.calculateSourceExtent();
    const sourceImage = isEmpty(sourceExtent)
      ? null
      : getImageFunction(sourceExtent, sourceResolution, pixelRatio);
    const state = sourceImage ? ImageState.IDLE : ImageState.EMPTY;
    const sourcePixelRatio = sourceImage ? sourceImage.getPixelRatio() : 1;

    super(targetExtent, targetResolution, sourcePixelRatio, state);


    /**
     * @private
     * @type {import("../proj/Projection").default}
     */
    this.targetProj_ = targetProj;

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.maxSourceExtent_ = maxSourceExtent;

    /**
     * @private
     * @type {!import("./Triangulation").default}
     */
    this.triangulation_ = triangulation;

    /**
     * @private
     * @type {number}
     */
    this.targetResolution_ = targetResolution;

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.targetExtent_ = targetExtent;

    /**
     * @private
     * @type {import("../ImageBase").default}
     */
    this.sourceImage_ = sourceImage;

    /**
     * @private
     * @type {number}
     */
    this.sourcePixelRatio_ = sourcePixelRatio;

    /**
     * @private
     * @type {boolean}
     */
    this.interpolate_ = interpolate;

    /**
     * @private
     * @type {HTMLCanvasElement}
     */
    this.canvas_ = null;

    /**
     * @private
     * @type {?import("../events").EventsKey}
     */
    this.sourceListenerKey_ = null;
  }

  /**
   * Clean up.
   */
  protected disposeInternal(): void {
    if (this.state == ImageState.LOADING) {
      this.unlistenSource_();
    }
    super.disposeInternal();
  }

  /**
   * @return {HTMLCanvasElement} Image.
   */
  public getImage(): HTMLCanvasElement {
    return this.canvas_;
  }

  /**
   * @return {import("../proj/Projection").default} Projection.
   */
  public getProjection(): Projection {
    return this.targetProj_;
  }

  /**
   * @private
   */
  private reproject_(): void {
    const sourceState = this.sourceImage_.getState();
    if (sourceState == ImageState.LOADED) {
      const width = getWidth(this.targetExtent_) / this.targetResolution_;
      const height = getHeight(this.targetExtent_) / this.targetResolution_;

      this.canvas_ = <HTMLCanvasElement>renderReprojected(
        width,
        height,
        this.sourcePixelRatio_,
        this.sourceImage_.getResolution(),
        this.maxSourceExtent_,
        this.targetResolution_,
        this.targetExtent_,
        this.triangulation_,
        [
          {
            extent: this.sourceImage_.getExtent(),
            image: this.sourceImage_.getImage(),
          },
        ],
        0,
        undefined,
        this.interpolate_
      );
    }
    this.state = sourceState;
    this.changed();
  }

  /**
   * Load not yet loaded URI.
   */
  public load(): void {
    if (this.state == ImageState.IDLE) {
      this.state = ImageState.LOADING;
      this.changed();

      const sourceState = this.sourceImage_.getState();
      if (sourceState == ImageState.LOADED || sourceState == ImageState.ERROR) {
        this.reproject_();
      } else {
        this.sourceListenerKey_ = listen(
          this.sourceImage_,
          EventType.CHANGE,
          function (e) {
            const sourceState = this.sourceImage_.getState();
            if (
              sourceState == ImageState.LOADED ||
              sourceState == ImageState.ERROR
            ) {
              this.unlistenSource_();
              this.reproject_();
            }
          },
          this
        );
        this.sourceImage_.load();
      }
    }
  }

  /**
   * @private
   */
  private unlistenSource_(): void {
    unlistenByKey(
      /** @type {!import("../events").EventsKey} */ (this.sourceListenerKey_)
    );
    this.sourceListenerKey_ = null;
  }
}

export default ReprojImage;
