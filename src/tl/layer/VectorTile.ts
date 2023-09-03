/**
 * @module tl/layer/VectorTile
 */
import BaseVectorLayer, {BaseVectorLayerOptions} from './BaseVector';
import CanvasVectorTileLayerRenderer from '../renderer/canvas/VectorTileLayer';
import TileProperty from './TileProperty';
import {assert} from '../asserts';
import {Extent} from "../extent";
import {RenderOrderFunction} from "../render";
import VectorTileSource from "../source/VectorTile";
import {StyleLike} from "../style/Style";
import {BackgroundColor} from "./Base";
import Map from "../Map";
import {Pixel} from "../pixel";
import {FeatureLike} from "../Feature";

export type VectorTileLayerOnSignature<Return> =
    import("../Observable").OnSignature<import("../Observable").EventTypes, import("../events/Event").default, Return>
    &
    import("../Observable").OnSignature<import("./Base").BaseLayerObjectEventTypes |
        import("./Layer").LayerEventType | 'change:preload' | 'change:useInterimTilesOnError', import("../Object").ObjectEvent, Return>
    &
    import("../Observable").OnSignature<import("../render/EventType").LayerRenderEventTypes, import("../render/Event").default, Return>
    &
    import("../Observable").CombinedOnSignature<import("../Observable").EventTypes | import("./Base").BaseLayerObjectEventTypes |
        import("./Layer").LayerEventType | 'change:preload' | 'change:useInterimTilesOnError' | import("../render/EventType").LayerRenderEventTypes, Return>;

export type VectorTileRenderType = 'hybrid' | 'vector';

export interface VectorTileLayerOptions {
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
  renderMode?: VectorTileRenderType;
  source?: VectorTileSource;
  map?: Map;
  declutter?: boolean;
  style?: StyleLike | null;
  background?: BackgroundColor | false;
  updateWhileAnimating?: boolean;
  updateWhileInteracting?: boolean;
  preload?: number;
  useInterimTilesOnError?: boolean;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * Layer for vector tile data that is rendered client-side.
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @param {Options} [options] Options.
 * @extends {BaseVectorLayer<import("../source/VectorTile").default, CanvasVectorTileLayerRenderer>}
 * @api
 */
class VectorTileLayer extends BaseVectorLayer<VectorTileSource, CanvasVectorTileLayerRenderer>{
  private renderMode_: VectorTileRenderType;
  /**
   * @param {Options} [options] Options.
   */
  constructor(options?: VectorTileLayerOptions) {
    options = options ? options : {};

    const baseOptions = /** @type {Object} */ (Object.assign({}, options));
    delete baseOptions.preload;
    delete baseOptions.useInterimTilesOnError;

    super(
      /** @type {import("./BaseVector").Options<import("../source/VectorTile").default>} */ (
          <BaseVectorLayerOptions<VectorTileSource>>
        baseOptions
      )
    );

    /***
     * @type {VectorTileLayerOnSignature<import("../events").EventsKey>}
     */
    this.on;

    /***
     * @type {VectorTileLayerOnSignature<import("../events").EventsKey>}
     */
    this.once;

    /***
     * @type {VectorTileLayerOnSignature<void>}
     */
    this.un;

    const renderMode = options.renderMode || 'hybrid';
    // `renderMode` must be `'hybrid'` or `'vector'`.
    assert(renderMode == 'hybrid' || renderMode == 'vector', 28);

    /**
     * @private
     * @type {VectorTileRenderType}
     */
    this.renderMode_ = renderMode;

    this.setPreload(options.preload ? options.preload : 0);
    this.setUseInterimTilesOnError(
      options.useInterimTilesOnError !== undefined
        ? options.useInterimTilesOnError
        : true
    );

    /**
     * @return {import("./Base").BackgroundColor} Background color.
     * @function
     * @api
     */
    this.getBackground;

    /**
     * @param {import("./Base").BackgroundColor} background Background color.
     * @function
     * @api
     */
    this.setBackground;
  }

  createRenderer() {
    return new CanvasVectorTileLayerRenderer(this);
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
  public getFeatures(pixel: Pixel): Promise<FeatureLike[]> {
    return super.getFeatures(pixel);
  }

  /**
   * @return {VectorTileRenderType} The render mode.
   */
  public getRenderMode(): VectorTileRenderType {
    return this.renderMode_;
  }

  /**
   * Return the level as number to which we will preload tiles up to.
   * @return {number} The level to preload tiles up to.
   * @observable
   * @api
   */
  public getPreload(): number {
    return /** @type {number} */ (this.get(TileProperty.PRELOAD));
  }

  /**
   * Whether we use interim tiles on error.
   * @return {boolean} Use interim tiles on error.
   * @observable
   * @api
   */
  public getUseInterimTilesOnError(): boolean {
    return /** @type {boolean} */ (
      this.get(TileProperty.USE_INTERIM_TILES_ON_ERROR)
    );
  }

  /**
   * Set the level as number to which we will preload tiles up to.
   * @param {number} preload The level to preload tiles up to.
   * @observable
   * @api
   */
  public setPreload(preload: number): void {
    this.set(TileProperty.PRELOAD, preload);
  }

  /**
   * Set whether we use interim tiles on error.
   * @param {boolean} useInterimTilesOnError Use interim tiles on error.
   * @observable
   * @api
   */
  public setUseInterimTilesOnError(useInterimTilesOnError: boolean): void {
    this.set(TileProperty.USE_INTERIM_TILES_ON_ERROR, useInterimTilesOnError);
  }
}

export default VectorTileLayer;
