/**
 * @module tl/style/IconImage
 */

import EventTarget from '../events/Target';
import EventType from '../events/EventType';
import ImageState from '../ImageState';
import {asString, Color} from '../color';
import {createCanvasContext2D} from '../dom';
import {shared as iconImageCache} from './IconImageCache';
import {listenImage} from '../Image';
import {Size} from "../size";

/**
 * @type {CanvasRenderingContext2D}
 */
let taintedTestContext: CanvasRenderingContext2D = null;

class IconImage extends EventTarget {
  private hitDetectionImage_?: HTMLImageElement | HTMLCanvasElement;
  private image_: HTMLImageElement | HTMLCanvasElement;
  private canvas_: {[key: number]: HTMLCanvasElement};
  private color_: Color;
  private unlisten_?: () => void;
  private imageState_: ImageState;
  private crossOrigin_?: string;
  private size_: Size;
  private src_?: string;
  private tainted_: any;

  /**
   * @param {HTMLImageElement|HTMLCanvasElement} image Image.
   * @param {string|undefined} src Src.
   * @param {import("../size").Size} size Size.
   * @param {?string} crossOrigin Cross origin.
   * @param {import("../ImageState").default} imageState Image state.
   * @param {import("../color").Color} color Color.
   */
  constructor(
      image: HTMLImageElement | HTMLCanvasElement,
      src: string,
      size: Size,
      crossOrigin: string,
      imageState: ImageState,
      color: Color
  ) {
    super();

    /**
     * @private
     * @type {HTMLImageElement|HTMLCanvasElement}
     */
    this.hitDetectionImage_ = null;

    /**
     * @private
     * @type {HTMLImageElement|HTMLCanvasElement}
     */
    this.image_ = image;

    /**
     * @private
     * @type {string|null}
     */
    this.crossOrigin_ = crossOrigin;

    /**
     * @private
     * @type {Object<number, HTMLCanvasElement>}
     */
    this.canvas_ = {};

    /**
     * @private
     * @type {import("../color").Color}
     */
    this.color_ = color;

    /**
     * @private
     * @type {?function():void}
     */
    this.unlisten_ = null;

    /**
     * @private
     * @type {import("../ImageState").default}
     */
    this.imageState_ = imageState;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.size_ = size;

    /**
     * @private
     * @type {string|undefined}
     */
    this.src_ = src;

    /**
     * @private
     */
    this.tainted_ = null;
  }

  /**
   * @private
   */
  private initializeImage_(): void {
    this.image_ = new Image();
    if (this.crossOrigin_ !== null) {
      this.image_.crossOrigin = this.crossOrigin_;
    }
  }

  /**
   * @private
   * @return {boolean} The image canvas is tainted.
   */
  private isTainted_(): boolean {
    if (this.tainted_ === undefined && this.imageState_ === ImageState.LOADED) {
      if (!taintedTestContext) {
        taintedTestContext = <CanvasRenderingContext2D>createCanvasContext2D(1, 1, undefined, {
          willReadFrequently: true,
        });
      }
      taintedTestContext.drawImage(this.image_, 0, 0);
      try {
        taintedTestContext.getImageData(0, 0, 1, 1);
        this.tainted_ = false;
      } catch (e) {
        taintedTestContext = null;
        this.tainted_ = true;
      }
    }
    return this.tainted_ === true;
  }

  /**
   * @private
   */
  private dispatchChangeEvent_(): void {
    this.dispatchEvent(EventType.CHANGE);
  }

  /**
   * @private
   */
  private handleImageError_(): void {
    this.imageState_ = ImageState.ERROR;
    this.unlistenImage_();
    this.dispatchChangeEvent_();
  }

  /**
   * @private
   */
  private handleImageLoad_(): void {
    this.imageState_ = ImageState.LOADED;
    if (this.size_) {
      this.image_.width = this.size_[0];
      this.image_.height = this.size_[1];
    } else {
      this.size_ = [this.image_.width, this.image_.height];
    }
    this.unlistenImage_();
    this.dispatchChangeEvent_();
  }

  /**
   * @param {number} pixelRatio Pixel ratio.
   * @return {HTMLImageElement|HTMLCanvasElement} Image or Canvas element.
   */
  public getImage(pixelRatio: number): HTMLImageElement | HTMLCanvasElement {
    if (!this.image_) {
      this.initializeImage_();
    }
    this.replaceColor_(pixelRatio);
    return this.canvas_[pixelRatio] ? this.canvas_[pixelRatio] : this.image_;
  }

  /**
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} Image or Canvas element.
   */
  public getPixelRatio(pixelRatio: number): number {
    this.replaceColor_(pixelRatio);
    return this.canvas_[pixelRatio] ? pixelRatio : 1;
  }

  /**
   * @return {import("../ImageState").default} Image state.
   */
  public getImageState(): ImageState {
    return this.imageState_;
  }

  /**
   * @return {HTMLImageElement|HTMLCanvasElement} Image element.
   */
  public getHitDetectionImage(): HTMLImageElement | HTMLCanvasElement {
    if (!this.image_) {
      this.initializeImage_();
    }
    if (!this.hitDetectionImage_) {
      if (this.isTainted_()) {
        const width = this.size_[0];
        const height = this.size_[1];
        const context = createCanvasContext2D(width, height);
        context.fillRect(0, 0, width, height);
        this.hitDetectionImage_ = <HTMLCanvasElement>context.canvas;
      } else {
        this.hitDetectionImage_ = this.image_;
      }
    }
    return this.hitDetectionImage_;
  }

  /**
   * Get the size of the icon (in pixels).
   * @return {import("../size").Size} Image size.
   */
  public getSize(): Size {
    return this.size_;
  }

  /**
   * @return {string|undefined} Image src.
   */
  public getSrc(): string {
    return this.src_;
  }

  /**
   * Load not yet loaded URI.
   */
  public load(): void {
    if (this.imageState_ !== ImageState.IDLE) {
      return;
    }
    if (!this.image_) {
      this.initializeImage_();
    }

    this.imageState_ = ImageState.LOADING;
    try {
      (<HTMLImageElement>this.image_).src = this.src_;
    } catch (e) {
      this.handleImageError_();
    }
    this.unlisten_ = listenImage(
      this.image_,
      this.handleImageLoad_.bind(this),
      this.handleImageError_.bind(this)
    );
  }

  /**
   * @param {number} pixelRatio Pixel ratio.
   * @private
   */
  private replaceColor_(pixelRatio: number): void {
    if (
      !this.color_ ||
      this.canvas_[pixelRatio] ||
      this.imageState_ !== ImageState.LOADED
    ) {
      return;
    }

    const image = this.image_;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(image.width * pixelRatio);
    canvas.height = Math.ceil(image.height * pixelRatio);

    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.drawImage(image, 0, 0);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = asString(this.color_);
    ctx.fillRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, 0, 0);

    this.canvas_[pixelRatio] = canvas;
  }

  /**
   * Discards event handlers which listen for load completion or errors.
   *
   * @private
   */
  private unlistenImage_(): void {
    if (this.unlisten_) {
      this.unlisten_();
      this.unlisten_ = null;
    }
  }
}

/**
 * @param {HTMLImageElement|HTMLCanvasElement} image Image.
 * @param {string} src Src.
 * @param {import("../size").Size} size Size.
 * @param {?string} crossOrigin Cross origin.
 * @param {import("../ImageState").default} imageState Image state.
 * @param {import("../color").Color} color Color.
 * @return {IconImage} Icon image.
 */
export function get(image: HTMLImageElement | HTMLCanvasElement, src: string, size: Size, crossOrigin: string, imageState: ImageState, color: Color): IconImage {
  let iconImage = iconImageCache.get(src, crossOrigin, color);
  if (!iconImage) {
    iconImage = new IconImage(image, src, size, crossOrigin, imageState, color);
    iconImageCache.set(src, crossOrigin, color, iconImage);
  }
  return iconImage;
}

export default IconImage;
