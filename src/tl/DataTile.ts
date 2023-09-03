/**
 * @module tl/DataTile
 */
import Tile from './Tile';
import TileState from './TileState';
import {createCanvasContext2D} from './dom';
import {Size} from "./size";
import {TileCoord} from "./tilecoord";

export type ImageLike = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

export type ArrayLike = Uint8Array | Uint8ClampedArray | Float32Array | DataView;

export type Data = ArrayLike | ImageLike;

/**
 * @param {Data} data Tile data.
 * @return {ImageLike|null} The image-like data.
 */
export function asImageLike(data: Data): ImageLike | null {
  return data instanceof Image ||
    data instanceof HTMLCanvasElement ||
    data instanceof HTMLVideoElement
    ? data
    : null;
}

/**
 * @param {Data} data Tile data.
 * @return {ArrayLike|null} The array-like data.
 */
export function asArrayLike(data: Data): ArrayLike | null {
  return data instanceof Uint8Array ||
    data instanceof Uint8ClampedArray ||
    data instanceof Float32Array ||
    data instanceof DataView
    ? data
    : null;
}

/**
 * @type {CanvasRenderingContext2D|null}
 */
let sharedContext: CanvasRenderingContext2D = null;

/**
 * @param {ImageLike} image The image.
 * @return {Uint8ClampedArray} The data.
 */
export function toArray(image: ImageLike): Uint8ClampedArray {
  if (!sharedContext) {
    sharedContext = <CanvasRenderingContext2D>createCanvasContext2D(
      image.width,
      image.height,
      undefined,
      {willReadFrequently: true}
    );
  }
  const canvas = sharedContext.canvas;
  const width = image.width;
  if (canvas.width !== width) {
    canvas.width = width;
  }
  const height = image.height;
  if (canvas.height !== height) {
    canvas.height = height;
  }
  sharedContext.clearRect(0, 0, width, height);
  sharedContext.drawImage(image, 0, 0);
  return sharedContext.getImageData(0, 0, width, height).data;
}

/**
 * @type {import('./size').Size}
 */
const defaultSize: Size = [256, 256];

export interface DataTileOptions
{
  tileCoord: TileCoord,
  loader: () => Promise<Data>;
  transition?: number,
  interpolate?: boolean,
  size?: Size
}

class DataTile extends Tile {
  private loader_: () => Promise<Data>;
  private data_: Data;
  private error_: Error;
  private size_: Size;

  constructor(options: DataTileOptions) {
    const state = TileState.IDLE;

    super(options.tileCoord, state, {
      transition: options.transition,
      interpolate: options.interpolate,
    });

    /**
     * @type {function(): Promise<Data>}
     * @private
     */
    this.loader_ = options.loader;

    /**
     * @type {Data}
     * @private
     */
    this.data_ = null;

    /**
     * @type {Error}
     * @private
     */
    this.error_ = null;

    /**
     * @type {import('./size').Size|null}
     * @private
     */
    this.size_ = options.size || null;
  }

  /**
   * Get the tile size.
   * @return {import('./size').Size} Tile size.
   */
  public getSize(): Size {
    if (this.size_) {
      return this.size_;
    }
    const imageData = asImageLike(this.data_);
    if (imageData) {
      return [imageData.width, imageData.height];
    }
    return defaultSize;
  }

  /**
   * Get the data for the tile.
   * @return {Data} Tile data.
   * @api
   */
  public getData(): Data {
    return this.data_;
  }

  /**
   * Get any loading error.
   * @return {Error} Loading error.
   * @api
   */
  public getError(): Error {
    return this.error_;
  }

  /**
   * Load not yet loaded URI.
   * @api
   */
  public load(): void {
    if (this.state !== TileState.IDLE && this.state !== TileState.ERROR) {
      return;
    }
    this.state = TileState.LOADING;
    this.changed();

    const self = this;
    this.loader_()
      .then(function (data) {
        self.data_ = data;
        self.state = TileState.LOADED;
        self.changed();
      })
      .catch(function (error) {
        self.error_ = error;
        self.state = TileState.ERROR;
        self.changed();
      });
  }
}

export default DataTile;
