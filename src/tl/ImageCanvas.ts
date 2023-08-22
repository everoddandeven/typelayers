/**
 * @module tl/ImageCanvas
 */
import ImageBase from './ImageBase';
import ImageState from './ImageState';
import {Extent} from "./extent/Extent";

/**
 * A function that is called to trigger asynchronous canvas drawing.  It is
 * called with a "done" callback that should be called when drawing is done.
 * If any error occurs during drawing, the "done" callback should be called with
 * that error.
 *
 * @typedef {function(function(Error=): void): void} Loader
 */

export type Loader = (err: (error: Error) => void) => void;

export default class ImageCanvas extends ImageBase {
  /**
   * @param {import("./extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {HTMLCanvasElement} canvas Canvas.
   * @param {Loader} [loader] Optional loader function to
   *     support asynchronous canvas drawing.
   */

  private loader_?: Loader;
  private canvas_: HTMLCanvasElement;
  private error_?: Error;

  constructor(extent: Extent, resolution: number, pixelRatio: number, canvas: HTMLCanvasElement, loader?: Loader) {
    const state = loader !== undefined ? ImageState.IDLE : ImageState.LOADED;

    super(extent, resolution, pixelRatio, state);

    /**
     * Optional canvas loader function.
     * @type {?Loader}
     * @private
     */
    this.loader_ = loader !== undefined ? loader : null;

    /**
     * @private
     * @type {HTMLCanvasElement}
     */
    this.canvas_ = canvas;

    /**
     * @private
     * @type {?Error}
     */
    this.error_ = null;
  }

  /**
   * Get any error associated with asynchronous rendering.
   * @return {?Error} Any error that occurred during rendering.
   */
  public getError(): Error {
    return this.error_;
  }

  /**
   * Handle async drawing complete.
   * @param {Error} [err] Any error during drawing.
   * @private
   */
  private handleLoad_(err: Error): void {
    if (err) {
      this.error_ = err;
      this.state = ImageState.ERROR;
    } else {
      this.state = ImageState.LOADED;
    }
    this.changed();
  }

  /**
   * Load not yet loaded URI.
   */
  public load(): void {
    if (this.state == ImageState.IDLE) {
      this.state = ImageState.LOADING;
      this.changed();
      this.loader_(this.handleLoad_.bind(this));
    }
  }

  /**
   * @return {HTMLCanvasElement} Canvas element.
   */
  public getImage(): HTMLCanvasElement {
    return this.canvas_;
  }
}
