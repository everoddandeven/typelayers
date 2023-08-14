/**
 * @module ol/render
 */
import CanvasImmediateRenderer from './render/canvas/Immediate';
import {DEVICE_PIXEL_RATIO} from './has';
import {
  apply as applyTransform,
  create as createTransform,
  multiply as multiplyTransform,
  scale as scaleTransform, Transform,
} from './transform';
import {getSquaredTolerance} from './renderer/vector';
import {getTransformFromProjections, getUserProjection} from './proj';
import {Extent} from "./extent/Extent";
import {FeatureLike} from "./Feature";
import {SimpleGeometry} from "./geom";
import {Size} from "./size";
import RenderEvent from "./render/Event";
import {Pixel} from "./pixel";

export interface RenderState {
  context: CanvasRenderingContext2D;
  feature: FeatureLike;
  geometry: SimpleGeometry;
  pixelRatio: number;
  resolution: number;
  rotation: number;
}

/**
 * A function to be used when sorting features before rendering.
 * It takes two instances of {@link module:ol/Feature~Feature} or
 * {@link module:ol/render/Feature~RenderFeature} and returns a `{number}`.
 *
 * @typedef {function(import("./Feature").FeatureLike, import("./Feature").FeatureLike):number} OrderFunction
 */

export type RenderOrderFunction = (a: FeatureLike, b: FeatureLike) => number;

export interface ToContextOptions {
  size?: Size;
  pixelRatio?: number;
}

/**
 * Binds a Canvas Immediate API to a canvas context, to allow drawing geometries
 * to the context's canvas.
 *
 * The units for geometry coordinates are css pixels relative to the top left
 * corner of the canvas element.
 * ```js
 * import {toContext} from 'ol/render';
 * import Fill from 'ol/style/Fill';
 * import Polygon from 'ol/geom/Polygon';
 *
 * const canvas = document.createElement('canvas');
 * const render = toContext(
 *     canvas.getContext('2d'),
 *     {size: [100, 100]}
 * );
 * render.setFillStrokeStyle(new Fill({ color: blue }));
 * render.drawPolygon(
 *     new Polygon([[[0, 0], [100, 100], [100, 0], [0, 0]]])
 * );
 * ```
 *
 * @param {CanvasRenderingContext2D} context Canvas context.
 * @param {ToContextOptions} [options] Options.
 * @return {CanvasImmediateRenderer} Canvas Immediate.
 * @api
 */
export function toContext(context: CanvasRenderingContext2D, options: ToContextOptions): CanvasImmediateRenderer {
  const canvas = context.canvas;
  options = options ? options : {};
  const pixelRatio = options.pixelRatio || DEVICE_PIXEL_RATIO;
  const size = options.size;
  if (size) {
    canvas.width = size[0] * pixelRatio;
    canvas.height = size[1] * pixelRatio;
    canvas.style.width = size[0] + 'px';
    canvas.style.height = size[1] + 'px';
  }
  const extent: Extent = [0, 0, canvas.width, canvas.height];
  const transform: Transform = scaleTransform(createTransform(), pixelRatio, pixelRatio);
  return new CanvasImmediateRenderer(context, pixelRatio, extent, transform, 0);
}

/**
 * Gets a vector context for drawing to the event's canvas.
 * @param {import("./render/Event").default} event Render event.
 * @return {CanvasImmediateRenderer} Vector context.
 * @api
 */
export function getVectorContext(event: RenderEvent): CanvasImmediateRenderer {
  if (!(event.context instanceof CanvasRenderingContext2D)) {
    throw new Error('Only works for render events from Canvas 2D layers');
  }

  // canvas may be at a different pixel ratio than frameState.pixelRatio
  const a = event.inversePixelTransform[0];
  const b = event.inversePixelTransform[1];
  const canvasPixelRatio = Math.sqrt(a * a + b * b);
  const frameState = event.frameState;
  const transform = multiplyTransform(
    <Transform>event.inversePixelTransform.slice(),
    frameState.coordinateToPixelTransform
  );
  const squaredTolerance = getSquaredTolerance(
    frameState.viewState.resolution,
    canvasPixelRatio
  );
  let userTransform;
  const userProjection = getUserProjection();
  if (userProjection) {
    userTransform = getTransformFromProjections(
      userProjection,
      frameState.viewState.projection
    );
  }

  return new CanvasImmediateRenderer(
    event.context,
    canvasPixelRatio,
    frameState.extent,
    transform,
    frameState.viewState.rotation,
    squaredTolerance,
    userTransform
  );
}

/**
 * Gets the pixel of the event's canvas context from the map viewport's CSS pixel.
 * @param {import("./render/Event").default} event Render event.
 * @param {import("./pixel").Pixel} pixel CSS pixel relative to the top-left
 * corner of the map viewport.
 * @return {import("./pixel").Pixel} Pixel on the event's canvas context.
 * @api
 */
export function getRenderPixel(event: RenderEvent, pixel: Pixel): Pixel {
  return applyTransform(event.inversePixelTransform, pixel.slice(0));
}
