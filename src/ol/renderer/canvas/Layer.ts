/**
 * @module ol/renderer/canvas/Layer
 */
import LayerRenderer from '../Layer';
import RenderEvent from '../../render/Event';
import RenderEventType from '../../render/EventType';
import {
  apply as applyTransform,
  compose as composeTransform,
  create as createTransform, Transform,
} from '../../transform';
import {asArray} from '../../color';
import {createCanvasContext2D} from '../../dom';
import {equals} from '../../array';
import {
  getBottomLeft,
  getBottomRight,
  getTopLeft,
  getTopRight,
} from '../../extent';
import Layer from "../../layer/Layer";
import {FrameState} from "../../Map";

/**
 * @type {Array<HTMLCanvasElement>}
 */
export const canvasPool: HTMLCanvasElement[] = [];

/**
 * @type {CanvasRenderingContext2D}
 */
let pixelContext: CanvasRenderingContext2D = null;

export function createPixelContext(): void {
  pixelContext = <CanvasRenderingContext2D>createCanvasContext2D(1, 1, undefined, {
    willReadFrequently: true,
  });
}

/**
 * @abstract
 * @template {import("../../layer/Layer").default} LayerType
 * @extends {LayerRenderer<LayerType>}
 */
abstract class CanvasLayerRenderer<LayerType extends Layer> extends LayerRenderer<LayerType> {
  private pixelContext_: CanvasRenderingContext2D;

  protected container: HTMLElement;
  protected renderedResolution: number;
  protected tempTransform: Transform;
  protected pixelTransform: Transform;
  protected inversePixelTransform: Transform;
  protected frameState: FrameState;

  public context: CanvasRenderingContext2D;
  public containerReused: boolean;
  /**
   * @param {LayerType} layer Layer.
   */
  protected constructor(layer: LayerType) {
    super(layer);

    /**
     * @protected
     * @type {HTMLElement}
     */
    this.container = null;

    /**
     * @protected
     * @type {number}
     */
    this.renderedResolution;

    /**
     * A temporary transform.  The values in this transform should only be used in a
     * function that sets the values.
     * @protected
     * @type {import("../../transform").Transform}
     */
    this.tempTransform = createTransform();

    /**
     * The transform for rendered pixels to viewport CSS pixels.  This transform must
     * be set when rendering a frame and may be used by other functions after rendering.
     * @protected
     * @type {import("../../transform").Transform}
     */
    this.pixelTransform = createTransform();

    /**
     * The transform for viewport CSS pixels to rendered pixels.  This transform must
     * be set when rendering a frame and may be used by other functions after rendering.
     * @protected
     * @type {import("../../transform").Transform}
     */
    this.inversePixelTransform = createTransform();

    /**
     * @type {CanvasRenderingContext2D}
     */
    this.context = null;

    /**
     * @type {boolean}
     */
    this.containerReused = false;

    /**
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.pixelContext_ = null;

    /**
     * @protected
     * @type {import("../../Map").FrameState|null}
     */
    this.frameState = null;
  }

  /**
   * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} image Image.
   * @param {number} col The column index.
   * @param {number} row The row index.
   * @return {Uint8ClampedArray|null} The image data.
   */
  getImageData(image, col, row) {
    if (!pixelContext) {
      createPixelContext();
    }
    pixelContext.clearRect(0, 0, 1, 1);

    let data;
    try {
      pixelContext.drawImage(image, col, row, 1, 1, 0, 0, 1, 1);
      data = pixelContext.getImageData(0, 0, 1, 1).data;
    } catch (err) {
      pixelContext = null;
      return null;
    }
    return data;
  }

  /**
   * @param {import('../../Map').FrameState} frameState Frame state.
   * @return {string} Background color.
   */
  getBackground(frameState) {
    const layer = this.getLayer();
    let background = layer.getBackground();
    if (typeof background === 'function') {
      background = background(frameState.viewState.resolution);
    }
    return background || undefined;
  }

  /**
   * Get a rendering container from an existing target, if compatible.
   * @param {HTMLElement} target Potential render target.
   * @param {string} transform CSS Transform.
   * @param {string} [backgroundColor] Background color.
   */
  useContainer(target, transform, backgroundColor) {
    const layerClassName = this.getLayer().getClassName();
    let container, context;
    if (
      target &&
      target.className === layerClassName &&
      (!backgroundColor ||
        (target &&
          target.style.backgroundColor &&
          equals(
            asArray(target.style.backgroundColor),
            asArray(backgroundColor)
          )))
    ) {
      const canvas = target.firstElementChild;
      if (canvas instanceof HTMLCanvasElement) {
        context = canvas.getContext('2d');
      }
    }
    if (context && context.canvas.style.transform === transform) {
      // Container of the previous layer renderer can be used.
      this.container = target;
      this.context = context;
      this.containerReused = true;
    } else if (this.containerReused) {
      // Previously reused container cannot be used any more.
      this.container = null;
      this.context = null;
      this.containerReused = false;
    } else if (this.container) {
      this.container.style.backgroundColor = null;
    }
    if (!this.container) {
      container = document.createElement('div');
      container.className = layerClassName;
      let style = container.style;
      style.position = 'absolute';
      style.width = '100%';
      style.height = '100%';
      context = <CanvasRenderingContext2D>createCanvasContext2D();
      const canvas = context.canvas;
      container.appendChild(canvas);
      style = canvas.style;
      style.position = 'absolute';
      style.left = '0';
      style.transformOrigin = 'top left';
      this.container = container;
      this.context = context;
    }
    if (
      !this.containerReused &&
      backgroundColor &&
      !this.container.style.backgroundColor
    ) {
      this.container.style.backgroundColor = backgroundColor;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @param {import("../../extent").Extent} extent Clip extent.
   * @protected
   */
  clipUnrotated(context, frameState, extent) {
    const topLeft = getTopLeft(extent);
    const topRight = getTopRight(extent);
    const bottomRight = getBottomRight(extent);
    const bottomLeft = getBottomLeft(extent);

    applyTransform(frameState.coordinateToPixelTransform, topLeft);
    applyTransform(frameState.coordinateToPixelTransform, topRight);
    applyTransform(frameState.coordinateToPixelTransform, bottomRight);
    applyTransform(frameState.coordinateToPixelTransform, bottomLeft);

    const inverted = this.inversePixelTransform;
    applyTransform(inverted, topLeft);
    applyTransform(inverted, topRight);
    applyTransform(inverted, bottomRight);
    applyTransform(inverted, bottomLeft);

    context.save();
    context.beginPath();
    context.moveTo(Math.round(topLeft[0]), Math.round(topLeft[1]));
    context.lineTo(Math.round(topRight[0]), Math.round(topRight[1]));
    context.lineTo(Math.round(bottomRight[0]), Math.round(bottomRight[1]));
    context.lineTo(Math.round(bottomLeft[0]), Math.round(bottomLeft[1]));
    context.clip();
  }

  /**
   * @param {import("../../render/EventType").default} type Event type.
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @private
   */
  dispatchRenderEvent_(type, context, frameState) {
    const layer = this.getLayer();
    if (layer.hasListener(type)) {
      const event = new RenderEvent(
        type,
        this.inversePixelTransform,
        frameState,
        context
      );
      layer.dispatchEvent(event);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @protected
   */
  preRender(context, frameState) {
    this.frameState = frameState;
    this.dispatchRenderEvent_(RenderEventType.PRERENDER, context, frameState);
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @protected
   */
  postRender(context, frameState) {
    this.dispatchRenderEvent_(RenderEventType.POSTRENDER, context, frameState);
  }

  /**
   * Creates a transform for rendering to an element that will be rotated after rendering.
   * @param {import("../../coordinate").Coordinate} center Center.
   * @param {number} resolution Resolution.
   * @param {number} rotation Rotation.
   * @param {number} pixelRatio Pixel ratio.
   * @param {number} width Width of the rendered element (in pixels).
   * @param {number} height Height of the rendered element (in pixels).
   * @param {number} offsetX Offset on the x-axis in view coordinates.
   * @protected
   * @return {!import("../../transform").Transform} Transform.
   */
  getRenderTransform(
    center,
    resolution,
    rotation,
    pixelRatio,
    width,
    height,
    offsetX
  ) {
    const dx1 = width / 2;
    const dy1 = height / 2;
    const sx = pixelRatio / resolution;
    const sy = -sx;
    const dx2 = -center[0] + offsetX;
    const dy2 = -center[1];
    return composeTransform(
      this.tempTransform,
      dx1,
      dy1,
      sx,
      sy,
      -rotation,
      dx2,
      dy2
    );
  }

  /**
   * Clean up.
   */
  disposeInternal() {
    delete this.frameState;
    super.disposeInternal();
  }
}

export default CanvasLayerRenderer;
