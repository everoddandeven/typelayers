/**
 * @module ol/layer/BaseVector
 */
import Layer from './Layer';
import RBush from 'rbush';
import Style, {
  createDefaultStyle, StyleLike,
  toFunction as toStyleFunction,
} from '../style/Style';
import {FlatStyleLike, toStyle} from '../style/flat';
import VectorSource from "../source/Vector";
import {VectorTile} from "../source";
import {Extent} from "../extent/Extent";
import {RenderOrderFunction} from "../render";

export interface BaseVectorLayerOptions<VectorSourceType = VectorSource | VectorTile> {
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  renderOrder?: RenderOrderFunction;
  renderBuffer?: number;
  source?: VectorSourceType;
  map?: import("../Map").default;
  declutter?: boolean;
  style?: StyleLike | FlatStyleLike | null;
  background?: import("./Base").BackgroundColor;
  updateWhileAnimating?: boolean;
  updateWhileInteracting?: boolean;
  properties?: {[key: string]: any};
}


/**
 * @enum {string}
 * @private
 */
enum Property {
  RENDER_ORDER = 'renderOrder',
}

/**
 * @classdesc
 * Vector data that is rendered client-side.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Vector").default|import("../source/VectorTile").default} VectorSourceType
 * @template {import("../renderer/canvas/VectorLayer").default|import("../renderer/canvas/VectorTileLayer").default|import("../renderer/canvas/VectorImageLayer").default|import("../renderer/webgl/PointsLayer").default} RendererType
 * @extends {Layer<VectorSourceType, RendererType>}
 * @api
 */
class BaseVectorLayer<VectorSourceType = VectorSource | VectorTile, RendererType = VectorLayer> extends Layer<VectorSourceType, RendererType> {
  /**
   * @param {Options<VectorSourceType>} [options] Options.
   */
  constructor(options) {
    options = options ? options : {};

    const baseOptions = Object.assign({}, options);

    delete baseOptions.style;
    delete baseOptions.renderBuffer;
    delete baseOptions.updateWhileAnimating;
    delete baseOptions.updateWhileInteracting;
    super(baseOptions);

    /**
     * @private
     * @type {boolean}
     */
    this.declutter_ =
      options.declutter !== undefined ? options.declutter : false;

    /**
     * @type {number}
     * @private
     */
    this.renderBuffer_ =
      options.renderBuffer !== undefined ? options.renderBuffer : 100;

    /**
     * User provided style.
     * @type {import("../style/Style").StyleLike}
     * @private
     */
    this.style_ = null;

    /**
     * Style function for use within the library.
     * @type {import("../style/Style").StyleFunction|undefined}
     * @private
     */
    this.styleFunction_ = undefined;

    this.setStyle(options.style);

    /**
     * @type {boolean}
     * @private
     */
    this.updateWhileAnimating_ =
      options.updateWhileAnimating !== undefined
        ? options.updateWhileAnimating
        : false;

    /**
     * @type {boolean}
     * @private
     */
    this.updateWhileInteracting_ =
      options.updateWhileInteracting !== undefined
        ? options.updateWhileInteracting
        : false;
  }

  /**
   * @return {boolean} Declutter.
   */
  getDeclutter() {
    return this.declutter_;
  }

  /**
   * Get the topmost feature that intersects the given pixel on the viewport. Returns a promise
   * that resolves with an array of features. The array will either contain the topmost feature
   * when a hit was detected, or it will be empty.
   *
   * The hit detection algorithm used for this method is optimized for performance, but is less
   * accurate than the one used in [map.getFeaturesAtPixel()]{@link import("../Map").default#getFeaturesAtPixel}.
   * Text is not considered, and icons are only represented by their bounding box instead of the exact
   * image.
   *
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Promise<Array<import("../Feature").FeatureLike>>} Promise that resolves with an array of features.
   * @api
   */
  getFeatures(pixel) {
    return super.getFeatures(pixel);
  }

  /**
   * @return {number|undefined} Render buffer.
   */
  getRenderBuffer() {
    return this.renderBuffer_;
  }

  /**
   * @return {function(import("../Feature").default, import("../Feature").default): number|null|undefined} Render
   *     order.
   */
  getRenderOrder() {
    return /** @type {import("../render").OrderFunction|null|undefined} */ (
      this.get(Property.RENDER_ORDER)
    );
  }

  /**
   * Get the style for features.  This returns whatever was passed to the `style`
   * option at construction or to the `setStyle` method.
   * @return {import("../style/Style").StyleLike|null|undefined} Layer style.
   * @api
   */
  getStyle() {
    return this.style_;
  }

  /**
   * Get the style function.
   * @return {import("../style/Style").StyleFunction|undefined} Layer style function.
   * @api
   */
  getStyleFunction() {
    return this.styleFunction_;
  }

  /**
   * @return {boolean} Whether the rendered layer should be updated while
   *     animating.
   */
  getUpdateWhileAnimating() {
    return this.updateWhileAnimating_;
  }

  /**
   * @return {boolean} Whether the rendered layer should be updated while
   *     interacting.
   */
  getUpdateWhileInteracting() {
    return this.updateWhileInteracting_;
  }

  /**
   * Render declutter items for this layer
   * @param {import("../Map").FrameState} frameState Frame state.
   */
  renderDeclutter(frameState) {
    if (!frameState.declutterTree) {
      frameState.declutterTree = new RBush(9);
    }
    /** @type {*} */ (this.getRenderer()).renderDeclutter(frameState);
  }

  /**
   * @param {import("../render").RenderOrderFunction|null|undefined} renderOrder
   *     Render order.
   */
  setRenderOrder(renderOrder) {
    this.set(Property.RENDER_ORDER, renderOrder);
  }

  /**
   * Set the style for features.  This can be a single style object, an array
   * of styles, or a function that takes a feature and resolution and returns
   * an array of styles. If set to `null`, the layer has no style (a `null` style),
   * so only features that have their own styles will be rendered in the layer. Call
   * `setStyle()` without arguments to reset to the default style. See
   * [the ol/style/Style module]{@link module:ol/style/Style~Style} for information on the default style.
   *
   * If your layer has a static style, you can use [flat style]{@link module:ol/style/flat~FlatStyle} object
   * literals instead of using the `Style` and symbolizer constructors (`Fill`, `Stroke`, etc.):
   * ```js
   * vectorLayer.setStyle({
   *   "fill-color": "yellow",
   *   "stroke-color": "black",
   *   "stroke-width": 4
   * })
   * ```
   *
   * @param {import("../style/Style").StyleLike|import("../style/flat").FlatStyleLike|null} [style] Layer style.
   * @api
   */
  setStyle(style) {
    /**
     * @type {import("../style/Style").StyleLike|null}
     */
    let styleLike;

    if (style === undefined) {
      styleLike = createDefaultStyle;
    } else if (style === null) {
      styleLike = null;
    } else if (typeof style === 'function') {
      styleLike = style;
    } else if (style instanceof Style) {
      styleLike = style;
    } else if (Array.isArray(style)) {
      const len = style.length;

      /**
       * @type {Array<Style>}
       */
      const styles = new Array(len);

      for (let i = 0; i < len; ++i) {
        const s = style[i];
        if (s instanceof Style) {
          styles[i] = s;
        } else {
          styles[i] = toStyle(s);
        }
      }
      styleLike = styles;
    } else {
      styleLike = toStyle(style);
    }

    this.style_ = styleLike;
    this.styleFunction_ =
      style === null ? undefined : toStyleFunction(this.style_);
    this.changed();
  }
}

export default BaseVectorLayer;
