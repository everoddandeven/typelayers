/**
 * @module ol/source/ImageCanvas
 */

import ImageCanvas from '../ImageCanvas';
import ImageSource from './Image';
import {
  containsExtent, Extent,
  getHeight,
  getWidth,
  scaleFromCenter,
} from '../extent';
import Projection from "../proj/Projection";
import {AttributionLike, SourceState} from "./Source";
import {ProjectionLike} from "../proj";

/**
 * A function returning the canvas element (`{HTMLCanvasElement}`)
 * used by the source as an image. The arguments passed to the function are:
 * {@link module:ol/extent~Extent} the image extent, `{number}` the image resolution,
 * `{number}` the pixel ratio of the map, {@link module:ol/size~Size} the image size,
 * and {@link module:ol/proj/Projection~Projection} the image projection. The canvas returned by
 * this function is cached by the source. The this keyword inside the function
 * references the {@link module:ol/source/ImageCanvas~ImageCanvasSource}.
 *
 * @typedef {function(this:import("../ImageCanvas").default, import("../extent").Extent, number,
 *     number, import("../size").Size, import("../proj/Projection").default): HTMLCanvasElement} FunctionType
 */

export type FunctionType = (
    imageCanvas: ImageCanvas,
    extent: Extent,
    resolution: number,
    pixelRation: number,
    projection: Projection
) => HTMLCanvasElement

interface ImageCanvasOptions {
  attributions?: AttributionLike;
  canvasFunction?: FunctionType;
  interpolate?: boolean;
  projection?: ProjectionLike;
  ratio?: number;
  resolutions?: Array<number>;
  state?: SourceState;
}

/**
 * @classdesc
 * Base class for image sources where a canvas element is the image.
 * @api
 */
class ImageCanvasSource extends ImageSource {
  /**
   * @param {Options} [options] ImageCanvas options.
   */
  private canvasFunction_: FunctionType;
  private canvas_: ImageCanvas;
  private renderedRevision_: number;
  private ratio_: number;

  constructor(options?: ImageCanvasOptions) {
    options = options ? options : {};

    super({
      attributions: options.attributions,
      interpolate: options.interpolate,
      projection: options.projection,
      resolutions: options.resolutions,
      state: options.state,
    });

    /**
     * @private
     * @type {FunctionType}
     */
    this.canvasFunction_ = options.canvasFunction;

    /**
     * @private
     * @type {import("../ImageCanvas").default}
     */
    this.canvas_ = null;

    /**
     * @private
     * @type {number}
     */
    this.renderedRevision_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.ratio_ = options.ratio !== undefined ? options.ratio : 1.5;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../ImageCanvas").default} Single image.
   */
  public getImageInternal(extent: Extent, resolution: number, pixelRatio: number, projection: Projection): ImageCanvas {
    resolution = this.findNearestResolution(resolution);

    let canvas = this.canvas_;
    if (
      canvas &&
      this.renderedRevision_ == this.getRevision() &&
      canvas.getResolution() == resolution &&
      canvas.getPixelRatio() == pixelRatio &&
      containsExtent(canvas.getExtent(), extent)
    ) {
      return canvas;
    }

    extent = <Extent>extent.slice();
    scaleFromCenter(extent, this.ratio_);
    const width = getWidth(extent) / resolution;
    const height = getHeight(extent) / resolution;
    const size = [width * pixelRatio, height * pixelRatio];

    const canvasElement = this.canvasFunction_.call(
      this,
      extent,
      resolution,
      pixelRatio,
      size,
      projection
    );
    if (canvasElement) {
      canvas = new ImageCanvas(extent, resolution, pixelRatio, canvasElement);
    }
    this.canvas_ = canvas;
    this.renderedRevision_ = this.getRevision();

    return canvas;
  }
}

export default ImageCanvasSource;
