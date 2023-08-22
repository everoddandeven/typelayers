/**
 * @module tl/renderer/webgl/Layer
 */
import LayerProperty from '../../layer/Property';
import LayerRenderer from '../Layer';
import RenderEvent from '../../render/Event';
import RenderEventType from '../../render/EventType';
import WebGLHelper, {UniformValue} from '../../webgl/Helper';
import {
  compose as composeTransform,
  create as createTransform, Transform,
} from '../../transform';
import Layer from "../../layer/Layer";
import { FeatureLike } from '../../Feature';
import { FrameState } from '../../Map';
import { Coordinate } from '../../coordinate';
import { Pixel } from '../../pixel';

export interface PostProcessesOptions {
  scaleRatio?: number;
  vertexShader?: string;
  fragmentShader?: string;
  uniforms?: { [key: string]: UniformValue }
}

export interface WebGLLayerRendererOptions {
  uniforms?: { [key: string]: UniformValue };
  postProcesses?: PostProcessesOptions[];
}

/**
 * @classdesc
 * Base WebGL renderer class.
 * Holds all logic related to data manipulation & some common rendering logic
 * @template {import("../../layer/Layer").default} LayerType
 * @extends {LayerRenderer<LayerType>}
 */
class WebGLLayerRenderer<LayerType extends Layer<any, any>> extends LayerRenderer<LayerType> {
  private inversePixelTransform_: Transform;
  private pixelContext_: CanvasRenderingContext2D;
  private postProcesses_: PostProcessesOptions[];
  private uniforms_: { [p: string]: UniformValue };

  protected helper: WebGLHelper;

  /**
   * @param {LayerType} layer Layer.
   * @param {Options} [options] Options.
   */
  constructor(layer: LayerType, options?: WebGLLayerRendererOptions) {
    super(layer);

    options = options || {};

    /**
     * The transform for viewport CSS pixels to rendered pixels.  This transform is only
     * set before dispatching rendering events.
     * @private
     * @type {import("../../transform").Transform}
     */
    this.inversePixelTransform_ = createTransform();

    /**
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.pixelContext_ = null;

    /**
     * @private
     */
    this.postProcesses_ = options.postProcesses;

    /**
     * @private
     */
    this.uniforms_ = options.uniforms;

    /**
     * @type {WebGLHelper}
     * @protected
     */
    this.helper;

    layer.addChangeListener(LayerProperty.MAP, this.removeHelper.bind(this));

    this.dispatchPreComposeEvent = this.dispatchPreComposeEvent.bind(this);
    this.dispatchPostComposeEvent = this.dispatchPostComposeEvent.bind(this);
  }

  /**
   * @param {WebGLRenderingContext} context The WebGL rendering context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @protected
   */
  protected dispatchPreComposeEvent(context: WebGLRenderingContext, frameState: FrameState): void {
    const layer = this.getLayer();
    if (layer.hasListener(RenderEventType.PRECOMPOSE)) {
      const event = new RenderEvent(
        RenderEventType.PRECOMPOSE,
        undefined,
        frameState,
        context
      );
      layer.dispatchEvent(event);
    }
  }

  /**
   * @param {WebGLRenderingContext} context The WebGL rendering context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @protected
   */
  protected dispatchPostComposeEvent(context: WebGLRenderingContext, frameState: FrameState): void {
    const layer = this.getLayer();
    if (layer.hasListener(RenderEventType.POSTCOMPOSE)) {
      const event = new RenderEvent(
        RenderEventType.POSTCOMPOSE,
        undefined,
        frameState,
        context
      );
      layer.dispatchEvent(event);
    }
  }

  /**
   * Reset options (only handles uniforms).
   * @param {Options} options Options.
   */
  public reset(options: WebGLLayerRendererOptions): void {
    this.uniforms_ = options.uniforms;
    if (this.helper) {
      this.helper.setUniforms(this.uniforms_);
    }
  }

  /**
   * @protected
   */
  protected removeHelper(): void {
    if (this.helper) {
      this.helper.dispose();
      delete this.helper;
    }
  }

  /**
   * Determine whether renderFrame should be called.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {boolean} Layer is ready to be rendered.
   */
  public prepareFrame(frameState: FrameState): boolean {
    if (this.getLayer().getRenderSource()) {
      let incrementGroup = true;
      let groupNumber = -1;
      let className: string;
      for (let i = 0, ii = frameState.layerStatesArray.length; i < ii; i++) {
        const layer = <Layer<any, any>>frameState.layerStatesArray[i].layer;
        const renderer = layer.getRenderer();
        if (!(renderer instanceof WebGLLayerRenderer)) {
          incrementGroup = true;
          continue;
        }
        const layerClassName = layer.getClassName();
        if (incrementGroup || layerClassName !== className) {
          groupNumber += 1;
          incrementGroup = false;
        }
        className = layerClassName;
        if (renderer === this) {
          break;
        }
      }

      const canvasCacheKey =
        'map/' + frameState.mapId + '/group/' + groupNumber;

      if (!this.helper || !this.helper.canvasCacheKeyMatches(canvasCacheKey)) {
        this.removeHelper();

        this.helper = new WebGLHelper({
          postProcesses: this.postProcesses_,
          uniforms: this.uniforms_,
          canvasCacheKey: canvasCacheKey,
        });

        if (className) {
          this.helper.getCanvas().className = className;
        }

        this.afterHelperCreated();
      }
    }

    return this.prepareFrameInternal(frameState);
  }

  /**
   * @protected
   */
  protected afterHelperCreated(): void {}

  /**
   * Determine whether renderFrame should be called.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {boolean} Layer is ready to be rendered.
   * @protected
   */
  protected prepareFrameInternal(frameState: FrameState): boolean {
    return true;
  }

  /**
   * Clean up.
   */
  public disposeInternal(): void {
    this.removeHelper();
    super.disposeInternal();
  }

  /**
   * @param {import("../../render/EventType").default} type Event type.
   * @param {WebGLRenderingContext} context The rendering context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @private
   */
  private dispatchRenderEvent_(type: RenderEventType, context: WebGLRenderingContext, frameState: FrameState): void {
    const layer = this.getLayer();
    if (layer.hasListener(type)) {
      composeTransform(
        this.inversePixelTransform_,
        0,
        0,
        frameState.pixelRatio,
        -frameState.pixelRatio,
        0,
        0,
        -frameState.size[1]
      );

      const event = new RenderEvent(
        type,
        this.inversePixelTransform_,
        frameState,
        context
      );
      layer.dispatchEvent(event);
    }
  }

  /**
   * @param {WebGLRenderingContext} context The rendering context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @protected
   */
  protected preRender(context: WebGLRenderingContext, frameState: FrameState): void {
    this.dispatchRenderEvent_(RenderEventType.PRERENDER, context, frameState);
  }

  /**
   * @param {WebGLRenderingContext} context The rendering context.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @protected
   */
  protected postRender(context: WebGLRenderingContext, frameState: FrameState): void {
    this.dispatchRenderEvent_(RenderEventType.POSTRENDER, context, frameState);
  }

  public getFeatures(pixel: Pixel): Promise<FeatureLike[]> {
    throw new Error('Method not implemented.');
  }
  public renderFrame(frameState: FrameState, target: HTMLElement): HTMLElement {
    throw new Error('Method not implemented.');
  }
  public forEachFeatureAtCoordinate(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: any, matches: any[]) {
    throw new Error('Method not implemented.');
  }
  public handleFontsChanged(): void {
    throw new Error('Method not implemented.');
  }

}

export default WebGLLayerRenderer;
