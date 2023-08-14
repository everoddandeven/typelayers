/**
 * @module ol/style/Icon
 */
import EventType from '../events/EventType';
import ImageState from '../ImageState';
import ImageStyle from './Image';
import IconImage from "./IconImage";
import {asArray, Color} from '../color';
import {assert} from '../asserts';
import {get as getIconImage} from './IconImage';
import {getUid} from '../util';
import {Size} from "../size";

/**
 * @typedef {'fraction' | 'pixels'} IconAnchorUnits
 * Anchor unit can be either a fraction of the icon size or in pixels.
 */

export type IconAnchorUnits = 'fraction' | 'pixels';

export type IconOrigin = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';


interface IconOptions {
  anchor?: number[];
  anchorOrigin?: IconOrigin;
  anchorXUnits?: IconAnchorUnits;
  anchorYUnits?: IconAnchorUnits;
  color?: Color | string;
  crossOrigin?: null | string;
  img?: HTMLImageElement | HTMLCanvasElement;
  imgSize?: Size;
  displacement?: number[];
  opacity?: number;
  width?: number;
  height?: number;
  scale?: number | Size;
  rotateWithView?: boolean;
  rotation?: number;
  offset?: number[];
  offsetOrigin?: IconOrigin;
  size?: Size;
  src?: string;
  declutterMode?: "declutter" | "obstacle" | "none" | undefined;
}

/**
 * @param {number} width The width.
 * @param {number} height The height.
 * @param {number|undefined} wantedWidth The wanted width.
 * @param {number|undefined} wantedHeight The wanted height.
 * @return {number|Array<number>} The scale.
 */
function calculateScale(width: number, height: number, wantedWidth?: number, wantedHeight?: number): number | number[] {
  if (wantedWidth !== undefined && wantedHeight !== undefined) {
    return [wantedWidth / width, wantedHeight / height];
  }
  if (wantedWidth !== undefined) {
    return wantedWidth / width;
  }
  if (wantedHeight !== undefined) {
    return wantedHeight / height;
  }
  return 1;
}

/**
 * @classdesc
 * Set icon style for vector features.
 * @api
 */
class Icon extends ImageStyle {
  private anchor_: number[];
  private normalizedAnchor_?: number[];
  private anchorOrigin_: IconOrigin;
  private anchorXUnits_: IconAnchorUnits;
  private anchorYUnits_: IconAnchorUnits;
  private crossOrigin_?: string;
  private imgSize_?: Size;
  private color_: Color;
  private iconImage_: IconImage;
  private offset_: number[];
  private offsetOrigin_: IconOrigin;
  private origin_?: number[];
  private size_?: Size;
  private initialOptions_?: IconOptions;
  /**
   * @param {Options} [options] Options.
   */
  constructor(options?: IconOptions) {
    options = options || {};

    /**
     * @type {number}
     */
    const opacity = options.opacity !== undefined ? options.opacity : 1;

    /**
     * @type {number}
     */
    const rotation = options.rotation !== undefined ? options.rotation : 0;

    /**
     * @type {number|import("../size").Size}
     */
    const scale = options.scale !== undefined ? options.scale : 1;

    /**
     * @type {boolean}
     */
    const rotateWithView =
      options.rotateWithView !== undefined ? options.rotateWithView : false;

    super({
      opacity: opacity,
      rotation: rotation,
      scale: scale,
      displacement:
        options.displacement !== undefined ? options.displacement : [0, 0],
      rotateWithView: rotateWithView,
      declutterMode: options.declutterMode,
    });

    /**
     * @private
     * @type {Array<number>}
     */
    this.anchor_ = options.anchor !== undefined ? options.anchor : [0.5, 0.5];

    /**
     * @private
     * @type {Array<number>}
     */
    this.normalizedAnchor_ = null;

    /**
     * @private
     * @type {IconOrigin}
     */
    this.anchorOrigin_ =
      options.anchorOrigin !== undefined ? options.anchorOrigin : 'top-left';

    /**
     * @private
     * @type {IconAnchorUnits}
     */
    this.anchorXUnits_ =
      options.anchorXUnits !== undefined ? options.anchorXUnits : 'fraction';

    /**
     * @private
     * @type {IconAnchorUnits}
     */
    this.anchorYUnits_ =
      options.anchorYUnits !== undefined ? options.anchorYUnits : 'fraction';

    /**
     * @private
     * @type {?string}
     */
    this.crossOrigin_ =
      options.crossOrigin !== undefined ? options.crossOrigin : null;

    /**
     * @type {HTMLImageElement|HTMLCanvasElement}
     */
    const image = options.img !== undefined ? options.img : null;

    /**
     * @private
     * @type {import("../size").Size|undefined}
     */
    this.imgSize_ = options.imgSize;

    /**
     * @type {string|undefined}
     */
    let src = options.src;

    assert(!(src !== undefined && image), 4); // `image` and `src` cannot be provided at the same time
    assert(!image || (image && this.imgSize_), 5); // `imgSize` must be set when `image` is provided

    if ((src === undefined || src.length === 0) && image) {
      src = (<HTMLImageElement>image).src || getUid(image);
    }
    assert(src !== undefined && src.length > 0, 6); // A defined and non-empty `src` or `image` must be provided

    // `width` or `height` cannot be provided together with `scale`
    assert(
      !(
        (options.width !== undefined || options.height !== undefined) &&
        options.scale !== undefined
      ),
      69
    );

    /**
     * @type {import("../ImageState").default}
     */
    const imageState =
      options.src !== undefined ? ImageState.IDLE : ImageState.LOADED;

    /**
     * @private
     * @type {import("../color").Color}
     */
    this.color_ = options.color !== undefined ? asArray(options.color) : null;

    /**
     * @private
     * @type {import("./IconImage").default}
     */
    this.iconImage_ = getIconImage(
      image,
      /** @type {string} */ (src),
      this.imgSize_ !== undefined ? this.imgSize_ : null,
      this.crossOrigin_,
      imageState,
      this.color_
    );

    /**
     * @private
     * @type {Array<number>}
     */
    this.offset_ = options.offset !== undefined ? options.offset : [0, 0];
    /**
     * @private
     * @type {IconOrigin}
     */
    this.offsetOrigin_ =
      options.offsetOrigin !== undefined ? options.offsetOrigin : 'top-left';

    /**
     * @private
     * @type {Array<number>}
     */
    this.origin_ = null;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.size_ = options.size !== undefined ? options.size : null;

    /**
     * Calculate the scale if width or height were given.
     */
    if (options.width !== undefined || options.height !== undefined) {
      let width, height;
      if (options.size) {
        [width, height] = options.size;
      } else {
        const image = this.getImage(1);
        if (
          image instanceof HTMLCanvasElement ||
          (image.src && image.complete)
        ) {
          width = image.width;
          height = image.height;
        } else {
          this.initialOptions_ = options;
          const onload = () => {
            this.unlistenImageChange(onload);
            if (!this.initialOptions_) {
              return;
            }
            const imageSize = this.iconImage_.getSize();
            this.setScale(
              calculateScale(
                imageSize[0],
                imageSize[1],
                options.width,
                options.height
              )
            );
          };
          this.listenImageChange(onload);
          return;
        }
      }
      if (width !== undefined) {
        this.setScale(
          calculateScale(width, height, options.width, options.height)
        );
      }
    }
  }

  /**
   * Clones the style. The underlying Image/HTMLCanvasElement is not cloned.
   * @return {Icon} The cloned style.
   * @api
   */
  public clone(): Icon {
    let scale, width, height;
    if (this.initialOptions_) {
      width = this.initialOptions_.width;
      height = this.initialOptions_.height;
    } else {
      scale = this.getScale();
      scale = Array.isArray(scale) ? scale.slice() : scale;
    }
    const clone = new Icon({
      anchor: this.anchor_.slice(),
      anchorOrigin: this.anchorOrigin_,
      anchorXUnits: this.anchorXUnits_,
      anchorYUnits: this.anchorYUnits_,
      color:
        this.color_ && this.color_.slice
          ? <Color>this.color_.slice()
          : this.color_ || undefined,
      crossOrigin: this.crossOrigin_,
      imgSize: this.imgSize_,
      offset: this.offset_.slice(),
      offsetOrigin: this.offsetOrigin_,
      opacity: this.getOpacity(),
      rotateWithView: this.getRotateWithView(),
      rotation: this.getRotation(),
      scale,
      width,
      height,
      size: this.size_ !== null ? <Size>this.size_.slice() : undefined,
      src: this.getSrc(),
      displacement: this.getDisplacement().slice(),
      declutterMode: this.getDeclutterMode(),
    });
    return clone;
  }

  /**
   * Get the anchor point in pixels. The anchor determines the center point for the
   * symbolizer.
   * @return {Array<number>} Anchor.
   * @api
   */
  public getAnchor(): number[] {
    let anchor = this.normalizedAnchor_;
    if (!anchor) {
      anchor = this.anchor_;
      const size = this.getSize();
      if (
        this.anchorXUnits_ == 'fraction' ||
        this.anchorYUnits_ == 'fraction'
      ) {
        if (!size) {
          return null;
        }
        anchor = this.anchor_.slice();
        if (this.anchorXUnits_ == 'fraction') {
          anchor[0] *= size[0];
        }
        if (this.anchorYUnits_ == 'fraction') {
          anchor[1] *= size[1];
        }
      }

      if (this.anchorOrigin_ != 'top-left') {
        if (!size) {
          return null;
        }
        if (anchor === this.anchor_) {
          anchor = this.anchor_.slice();
        }
        if (
          this.anchorOrigin_ == 'top-right' ||
          this.anchorOrigin_ == 'bottom-right'
        ) {
          anchor[0] = -anchor[0] + size[0];
        }
        if (
          this.anchorOrigin_ == 'bottom-left' ||
          this.anchorOrigin_ == 'bottom-right'
        ) {
          anchor[1] = -anchor[1] + size[1];
        }
      }
      this.normalizedAnchor_ = anchor;
    }
    const displacement = this.getDisplacement();
    const scale = this.getScaleArray();
    // anchor is scaled by renderer but displacement should not be scaled
    // so divide by scale here
    return [
      anchor[0] - displacement[0] / scale[0],
      anchor[1] + displacement[1] / scale[1],
    ];
  }

  /**
   * Set the anchor point. The anchor determines the center point for the
   * symbolizer.
   *
   * @param {Array<number>} anchor Anchor.
   * @api
   */
  public setAnchor(anchor: number[]): void {
    this.anchor_ = anchor;
    this.normalizedAnchor_ = null;
  }

  /**
   * Get the icon color.
   * @return {import("../color").Color} Color.
   * @api
   */
  public getColor(): Color {
    return this.color_;
  }

  /**
   * Get the image icon.
   * @param {number} pixelRatio Pixel ratio.
   * @return {HTMLImageElement|HTMLCanvasElement} Image or Canvas element.
   * @api
   */
  public getImage(pixelRatio: number): HTMLImageElement | HTMLCanvasElement {
    return this.iconImage_.getImage(pixelRatio);
  }

  /**
   * Get the pixel ratio.
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} The pixel ratio of the image.
   * @api
   */
  getPixelRatio(pixelRatio) {
    return this.iconImage_.getPixelRatio(pixelRatio);
  }

  /**
   * @return {import("../size").Size} Image size.
   */
  getImageSize() {
    return this.iconImage_.getSize();
  }

  /**
   * @return {import("../ImageState").default} Image state.
   */
  getImageState() {
    return this.iconImage_.getImageState();
  }

  /**
   * @return {HTMLImageElement|HTMLCanvasElement} Image element.
   */
  getHitDetectionImage() {
    return this.iconImage_.getHitDetectionImage();
  }

  /**
   * Get the origin of the symbolizer.
   * @return {Array<number>} Origin.
   * @api
   */
  getOrigin() {
    if (this.origin_) {
      return this.origin_;
    }
    let offset = this.offset_;

    if (this.offsetOrigin_ != 'top-left') {
      const size = this.getSize();
      const iconImageSize = this.iconImage_.getSize();
      if (!size || !iconImageSize) {
        return null;
      }
      offset = offset.slice();
      if (
        this.offsetOrigin_ == 'top-right' ||
        this.offsetOrigin_ == 'bottom-right'
      ) {
        offset[0] = iconImageSize[0] - size[0] - offset[0];
      }
      if (
        this.offsetOrigin_ == 'bottom-left' ||
        this.offsetOrigin_ == 'bottom-right'
      ) {
        offset[1] = iconImageSize[1] - size[1] - offset[1];
      }
    }
    this.origin_ = offset;
    return this.origin_;
  }

  /**
   * Get the image URL.
   * @return {string|undefined} Image src.
   * @api
   */
  getSrc() {
    return this.iconImage_.getSrc();
  }

  /**
   * Get the size of the icon (in pixels).
   * @return {import("../size").Size} Image size.
   * @api
   */
  getSize() {
    return !this.size_ ? this.iconImage_.getSize() : this.size_;
  }

  /**
   * Get the width of the icon (in pixels). Will return undefined when the icon image is not yet loaded.
   * @return {number} Icon width (in pixels).
   * @api
   */
  getWidth() {
    const scale = this.getScaleArray();
    if (this.size_) {
      return this.size_[0] * scale[0];
    }
    if (this.iconImage_.getImageState() == ImageState.LOADED) {
      return this.iconImage_.getSize()[0] * scale[0];
    }
    return undefined;
  }

  /**
   * Get the height of the icon (in pixels). Will return undefined when the icon image is not yet loaded.
   * @return {number} Icon height (in pixels).
   * @api
   */
  getHeight() {
    const scale = this.getScaleArray();
    if (this.size_) {
      return this.size_[1] * scale[1];
    }
    if (this.iconImage_.getImageState() == ImageState.LOADED) {
      return this.iconImage_.getSize()[1] * scale[1];
    }
    return undefined;
  }

  /**
   * Set the scale.
   *
   * @param {number|import("../size").Size} scale Scale.
   * @api
   */
  setScale(scale) {
    delete this.initialOptions_;
    super.setScale(scale);
  }

  /**
   * @param {function(import("../events/Event").default): void} listener Listener function.
   */
  listenImageChange(listener) {
    this.iconImage_.addEventListener(EventType.CHANGE, listener);
  }

  /**
   * Load not yet loaded URI.
   * When rendering a feature with an icon style, the vector renderer will
   * automatically call this method. However, you might want to call this
   * method yourself for preloading or other purposes.
   * @api
   */
  load() {
    this.iconImage_.load();
  }

  /**
   * @param {function(import("../events/Event").default): void} listener Listener function.
   */
  unlistenImageChange(listener) {
    this.iconImage_.removeEventListener(EventType.CHANGE, listener);
  }
}

export default Icon;
