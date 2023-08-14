/**
 * @module ol/style/Image
 */
import {Size, toSize} from '../size';
import ImageState from "../ImageState";
import BaseEvent from "../events/Event";

export interface ImageStyleOptions {
  opacity: number;
  rotateWithView: boolean;
  rotation: number;
  scale: number | import("../size").Size;
  displacement: Array<number>;
  declutterMode: "declutter" | "obstacle" | "none" | undefined;
}

/**
 * @classdesc
 * A base class used for creating subclasses and not instantiated in
 * apps. Base class for {@link module:ol/style/Icon~Icon}, {@link module:ol/style/Circle~CircleStyle} and
 * {@link module:ol/style/RegularShape~RegularShape}.
 * @abstract
 * @api
 */
abstract class ImageStyle {
  /**
   * @param {Options} options Options.
   */

  private opacity_: number;
  private rotateWithView_: boolean;
  private rotation_: number;
  private scale_: number | Size;
  private scaleArray_: Size;
  private displacement_: number[]
  private declutterMode_: "declutter" | "obstacle" | "none" | undefined;

  protected constructor(options: ImageStyleOptions) {
    /**
     * @private
     * @type {number}
     */
    this.opacity_ = options.opacity;

    /**
     * @private
     * @type {boolean}
     */
    this.rotateWithView_ = options.rotateWithView;

    /**
     * @private
     * @type {number}
     */
    this.rotation_ = options.rotation;

    /**
     * @private
     * @type {number|import("../size").Size}
     */
    this.scale_ = options.scale;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.scaleArray_ = toSize(options.scale);

    /**
     * @private
     * @type {Array<number>}
     */
    this.displacement_ = options.displacement;

    /**
     * @private
     * @type {"declutter"|"obstacle"|"none"|undefined}
     */
    this.declutterMode_ = options.declutterMode;
  }

  /**
   * Clones the style.
   * @return {ImageStyle} The cloned style.
   * @api

  clone() {
    const scale = this.getScale();
    return new ImageStyle({
      opacity: this.getOpacity(),
      scale: Array.isArray(scale) ? <Size>scale.slice() : scale,
      rotation: this.getRotation(),
      rotateWithView: this.getRotateWithView(),
      displacement: this.getDisplacement().slice(),
      declutterMode: this.getDeclutterMode(),
    });
  }
  */

  public abstract clone(): ImageStyle;

  /**
   * Get the symbolizer opacity.
   * @return {number} Opacity.
   * @api
   */
  public getOpacity(): number {
    return this.opacity_;
  }

  /**
   * Determine whether the symbolizer rotates with the map.
   * @return {boolean} Rotate with map.
   * @api
   */
  public getRotateWithView(): boolean {
    return this.rotateWithView_;
  }

  /**
   * Get the symbolizer rotation.
   * @return {number} Rotation.
   * @api
   */
  public getRotation(): number {
    return this.rotation_;
  }

  /**
   * Get the symbolizer scale.
   * @return {number|import("../size").Size} Scale.
   * @api
   */
  public getScale(): number | Size {
    return this.scale_;
  }

  /**
   * Get the symbolizer scale array.
   * @return {import("../size").Size} Scale array.
   */
  public getScaleArray(): Size {
    return this.scaleArray_;
  }

  /**
   * Get the displacement of the shape
   * @return {Array<number>} Shape's center displacement
   * @api
   */
  public getDisplacement(): number[] {
    return this.displacement_;
  }

  /**
   * Get the declutter mode of the shape
   * @return {"declutter"|"obstacle"|"none"|undefined} Shape's declutter mode
   * @api
   */
  public getDeclutterMode(): "declutter" | "obstacle" | "none" | undefined {
    return this.declutterMode_;
  }

  /**
   * Get the anchor point in pixels. The anchor determines the center point for the
   * symbolizer.
   * @abstract
   * @return {Array<number>} Anchor.
   */
  public abstract getAnchor(): number[];

  /**
   * Get the image element for the symbolizer.
   * @abstract
   * @param {number} pixelRatio Pixel ratio.
   * @return {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} Image element.
   */
  public abstract getImage(pixelRatio: number): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;

  /**
   * @abstract
   * @return {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} Image element.
   */
  public abstract getHitDetectionImage(): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;

  /**
   * Get the image pixel ratio.
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} Pixel ratio.
   */
  public getPixelRatio(pixelRatio: number): number {
    return 1;
  }

  /**
   * @abstract
   * @return {import("../ImageState").default} Image state.
   */
  public abstract getImageState(): ImageState;

  /**
   * @abstract
   * @return {import("../size").Size} Image size.
   */
  public abstract getImageSize(): Size;

  /**
   * Get the origin of the symbolizer.
   * @abstract
   * @return {Array<number>} Origin.
   */
  public abstract getOrigin(): number[];

  /**
   * Get the size of the symbolizer (in pixels).
   * @abstract
   * @return {import("../size").Size} Size.
   */
  public abstract getSize(): Size;

  /**
   * Set the displacement.
   *
   * @param {Array<number>} displacement Displacement.
   * @api
   */
  public setDisplacement(displacement: number[]): void {
    this.displacement_ = displacement;
  }

  /**
   * Set the opacity.
   *
   * @param {number} opacity Opacity.
   * @api
   */
  public setOpacity(opacity: number): void {
    this.opacity_ = opacity;
  }

  /**
   * Set whether to rotate the style with the view.
   *
   * @param {boolean} rotateWithView Rotate with map.
   * @api
   */
  public setRotateWithView(rotateWithView: boolean): void {
    this.rotateWithView_ = rotateWithView;
  }

  /**
   * Set the rotation.
   *
   * @param {number} rotation Rotation.
   * @api
   */
  public setRotation(rotation: number): void {
    this.rotation_ = rotation;
  }

  /**
   * Set the scale.
   *
   * @param {number|import("../size").Size} scale Scale.
   * @api
   */
  public setScale(scale: Size): void {
    this.scale_ = scale;
    this.scaleArray_ = toSize(scale);
  }

  /**
   * @abstract
   * @param {function(import("../events/Event").default): void} listener Listener function.
   */
  public abstract listenImageChange(listener: (event: BaseEvent) => void): void;

  /**
   * Load not yet loaded URI.
   * @abstract
   */
  public abstract load(): void;

  /**
   * @abstract
   * @param {function(import("../events/Event").default): void} listener Listener function.
   */
  public abstract unlistenImageChange(listener: (event: BaseEvent) => void): void;
}

export default ImageStyle;
