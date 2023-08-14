/**
 * @module ol/ImageBase
 */
import EventTarget from './events/Target';
import EventType from './events/EventType';
import {Extent} from "./extent/Extent";
import ImageState from "./ImageState";

/**
 * @abstract
 */
export default abstract class ImageBase extends EventTarget {
  /**
   * @param {import("./extent").Extent} extent Extent.
   * @param {number|undefined} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("./ImageState").default} state SourceState.
   */

  private pixelRatio_: number;

  protected extent: Extent;
  protected resolution?: number;
  protected state: ImageState;


  protected constructor(extent: Extent, resolution: number | null, pixelRatio: number, state: ImageState) {
    super();

    /**
     * @protected
     * @type {import("./extent").Extent}
     */
    this.extent = extent;

    /**
     * @private
     * @type {number}
     */
    this.pixelRatio_ = pixelRatio;

    /**
     * @protected
     * @type {number|undefined}
     */
    this.resolution = resolution;

    /**
     * @protected
     * @type {import("./ImageState").default}
     */
    this.state = state;
  }

  /**
   * @protected
   */
  public changed(): void {
    this.dispatchEvent(EventType.CHANGE);
  }

  /**
   * @return {import("./extent").Extent} Extent.
   */
  public getExtent(): Extent {
    return this.extent;
  }

  /**
   * @abstract
   * @return {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} Image.
   */
  public abstract getImage(): HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

  /**
   * @return {number} PixelRatio.
   */
  public getPixelRatio(): number {
    return this.pixelRatio_;
  }

  /**
   * @return {number} Resolution.
   */
  public getResolution(): number {
    return /** @type {number} */ (this.resolution);
  }

  /**
   * @return {import("./ImageState").default} SourceState.
   */
  public getState(): ImageState {
    return this.state;
  }

  /**
   * Load not yet loaded URI.
   * @abstract
   */
  public abstract load(): void;

}