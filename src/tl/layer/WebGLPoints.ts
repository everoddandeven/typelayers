/**
 * @module tl/layer/WebGLPoints
 */
import Layer from './Layer';
import WebGLPointsLayerRenderer from '../renderer/webgl/PointsLayer';
import {parseLiteralStyle, StyleParseResult} from '../webgl/styleparser';
import VectorSource from "../source/Vector";
import {Point} from "../geom";
import {Extent} from "../extent";
import {LiteralStyle} from "../style/literal";

export interface WebGLPointsLayerOptions<VectorSourceType extends VectorSource<Point> = VectorSource<Point>> {
  style: LiteralStyle;
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  source?: VectorSourceType;
  disableHitDetection?: boolean;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * Layer optimized for rendering large point datasets. Takes a `style` property which
 * is a serializable JSON object describing how the layer should be rendered.
 *
 * Here are a few samples of literal style objects:
 * ```js
 * const style = {
 *   symbol: {
 *     symbolType: 'circle',
 *     size: 8,
 *     color: '#33AAFF',
 *     opacity: 0.9
 *   }
 * }
 * ```
 *
 * ```js
 * const style = {
 *   symbol: {
 *     symbolType: 'image',
 *     offset: [0, 12],
 *     size: [4, 8],
 *     src: '../static/exclamation-mark.png'
 *   }
 * }
 * ```
 *
 * **Important: a `WebGLPoints` layer must be manually disposed when removed, otherwise the underlying WebGL context
 * will not be garbage collected.**
 *
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Vector").default<import("../geom/Point").default>} VectorSourceType
 * @extends {Layer<VectorSourceType, WebGLPointsLayerRenderer>}
 * @fires import("../render/Event").RenderEvent
 */
class WebGLPointsLayer<VectorSourceType extends VectorSource<Point> = VectorSource<Point>> extends Layer<VectorSourceType, WebGLPointsLayerRenderer> {
  private parseResult_: StyleParseResult;
  private styleVariables_: { [p: string]: number | number[] | string | boolean };
  private hitDetectionDisabled_: boolean;
  /**
   * @param {Options<VectorSourceType>} options Options.
   */
  constructor(options: WebGLPointsLayerOptions<VectorSourceType>) {
    const baseOptions = Object.assign({}, options);

    super(baseOptions);

    /**
     * @private
     * @type {import('../webgl/styleparser').StyleParseResult}
     */
    this.parseResult_ = parseLiteralStyle(options.style);

    /**
     * @type {Object<string, (string|number|Array<number>|boolean)>}
     * @private
     */
    this.styleVariables_ = options.style.variables || {};

    /**
     * @private
     * @type {boolean}
     */
    this.hitDetectionDisabled_ = !!options.disableHitDetection;
  }

  public createRenderer(): WebGLPointsLayerRenderer {
    const attributes = Object.keys(this.parseResult_.attributes).map(
      (name) => ({
        name,
        ...this.parseResult_.attributes[name],
      })
    );
    return new WebGLPointsLayerRenderer(this, {
      vertexShader: this.parseResult_.builder.getSymbolVertexShader(),
      fragmentShader: this.parseResult_.builder.getSymbolFragmentShader(),
      hitDetectionEnabled: !this.hitDetectionDisabled_,
      uniforms: this.parseResult_.uniforms,
      attributes:
        /** @type {Array<import('../renderer/webgl/PointsLayer').CustomAttribute>} */ (
          attributes
        ),
    });
  }

  /**
   * Update any variables used by the layer style and trigger a re-render.
   * @param {Object<string, number>} variables Variables to update.
   */
  public updateStyleVariables(variables: {[key: string]: number}): void {
    Object.assign(this.styleVariables_, variables);
    this.changed();
  }
}

export default WebGLPointsLayer;
