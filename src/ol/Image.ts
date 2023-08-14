/**
 * @module ol/Image
 */
import EventType from './events/EventType';
import ImageBase from './ImageBase';
import ImageState from './ImageState';
import {IMAGE_DECODE} from './has';
import {getHeight} from './extent';
import {EventsKey, listenOnce, unlistenByKey} from './events';
import {Extent} from "./extent/Extent";

/**
 * A function that takes an {@link module:ol/Image~ImageWrapper} for the image and a
 * `{string}` for the src as arguments. It is supposed to make it so the
 * underlying image {@link module:ol/Image~ImageWrapper#getImage} is assigned the
 * content specified by the src. If not specified, the default is
 *
 *     function(image, src) {
 *       image.getImage().src = src;
 *     }
 *
 * Providing a custom `imageLoadFunction` can be useful to load images with
 * post requests or - in general - through XHR requests, where the src of the
 * image element would be set to a data URI when the content is loaded.
 *
 * @typedef {function(ImageWrapper, string): void} LoadFunction
 * @api
 */

export type LoadFunction = (img: ImageWrapper, src: string) => void;

export default class ImageWrapper extends ImageBase {
  /**
   * @param {import("./extent").Extent} extent Extent.
   * @param {number|undefined} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {string} src Image source URI.
   * @param {?string} crossOrigin Cross origin.
   * @param {LoadFunction} imageLoadFunction Image load function.
   * @param {CanvasRenderingContext2D} [context] Canvas context. When provided, the image will be
   *    drawn into the context's canvas, and `getImage()` will return the canvas once the image
   *    has finished loading.
   */

  private src_: string;
  private image_: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;
  private context_: CanvasRenderingContext2D;
  private unlisten_: () => void;
  imageLoadFunction_: LoadFunction;

  constructor(
    extent: Extent,
    resolution: number | null,
    pixelRatio: number,
    src: string,
    crossOrigin: string | null,
    imageLoadFunction: LoadFunction,
    context: CanvasRenderingContext2D
  ) {
    super(extent, resolution, pixelRatio, ImageState.IDLE);

    this.src_ = src;

    this.image_ = new Image();
    if (crossOrigin !== null) {
      this.image_.crossOrigin = crossOrigin;
    }

    this.context_ = context;

    /**
     * @private
     * @type {?function():void}
     */
    this.unlisten_ = null;

    /**
     * @protected
     * @type {import("./ImageState").default}
     */
    this.state = ImageState.IDLE;

    /**
     * @private
     * @type {LoadFunction}
     */
    this.imageLoadFunction_ = imageLoadFunction;
  }

  /**
   * @return {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} Image.
   * @api
   */
  public getImage(): HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
  {
    if (
      this.state == ImageState.LOADED &&
      this.context_ &&
      !(this.image_ instanceof HTMLCanvasElement)
    ) {
      const canvas: HTMLCanvasElement = this.context_.canvas;
      canvas.width = this.image_.width;
      canvas.height = this.image_.height;
      this.context_.drawImage(this.image_, 0, 0);
      this.image_ = this.context_.canvas;
    }
    return this.image_;
  }

  /**
   * Tracks loading or read errors.
   *
   * @private
   */
  private handleImageError_(): void {
    this.state = ImageState.ERROR;
    this.unlistenImage_();
    this.changed();
  }

  /**
   * Tracks successful image load.
   *
   * @private
   */
  private handleImageLoad_(): void {
    if (this.resolution === undefined) {
      this.resolution = getHeight(this.extent) / this.image_.height;
    }
    this.state = ImageState.LOADED;
    this.unlistenImage_();
    this.changed();
  }

  /**
   * Load the image or retry if loading previously failed.
   * Loading is taken care of by the tile queue, and calling this method is
   * only needed for preloading or for reloading in case of an error.
   * @api
   */
  public load(): void {
    if (this.state == ImageState.IDLE || this.state == ImageState.ERROR) {
      this.state = ImageState.LOADING;
      this.changed();
      this.imageLoadFunction_(this, this.src_);
      this.unlisten_ = listenImage(
        this.image_,
        this.handleImageLoad_.bind(this),
        this.handleImageError_.bind(this)
      );
    }
  }

  /**
   * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} image Image.
   */
  public setImage(image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement) {
    this.image_ = image;
    this.resolution = getHeight(this.extent) / this.image_.height;
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
 * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} image Image element.
 * @param {function():any} loadHandler Load callback function.
 * @param {function():any} errorHandler Error callback function.
 * @return {function():void} Callback to stop listening.
 */
export function listenImage(
    image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    loadHandler: () => any,
    errorHandler: () => any
): () => any {
  const img: HTMLImageElement = <HTMLImageElement>image;
  let listening: boolean = true;
  let decoding: boolean = false;
  let loaded: boolean = false;

  const listenerKeys: EventsKey[] = [
    listenOnce(img, EventType.LOAD, function () {
      loaded = true;
      if (!decoding) {
        loadHandler();
      }
    }),
  ];

  if (img.src && IMAGE_DECODE) {
    decoding = true;
    img
      .decode()
      .then(function () {
        if (listening) {
          loadHandler();
        }
      })
      .catch(function (error) {
        if (listening) {
          if (loaded) {
            loadHandler();
          } else {
            errorHandler();
          }
        }
      });
  } else {
    listenerKeys.push(listenOnce(img, EventType.ERROR, errorHandler));
  }

  return function unlisten() {
    listening = false;
    listenerKeys.forEach(unlistenByKey);
  };
}