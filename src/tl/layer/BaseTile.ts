/**
 * @module tl/layer/BaseTile
 */
import Layer, {LayerEventType} from './Layer';
import TileProperty from './TileProperty';
import BaseEvent from "../events/Event";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import {BaseLayerObjectEventTypes} from "./Base";
import {ObjectEvent} from "../Object";
import RenderEvent from "../render/Event";
import {LayerRenderEventTypes} from "../render/EventType";
import TileSource from "../source/Tile";
import {EventsKey} from "../events";
import {Pixel} from "../pixel";
import {Extent} from "../extent/Extent";
import LayerRenderer from "../renderer/Layer";

export type BaseTileLayerOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<BaseLayerObjectEventTypes | LayerEventType | 'change:preload' | 'change:useInterimTilesOnError', ObjectEvent, Return> &
    OnSignature<LayerRenderEventTypes, RenderEvent, Return> &
    CombinedOnSignature<EventTypes | BaseLayerObjectEventTypes | LayerEventType | 'change:preload' | 'change:useInterimTilesOnError' | LayerRenderEventTypes, Return>;

interface BaseTileLayerOptions<TileSourceType extends TileSource = TileSource> {
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  preload?: number;
  source?: TileSourceType;
  map?: import("../Map").default;
  useInterimTilesOnError?: boolean;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * For layer sources that provide pre-rendered, tiled images in grids that are
 * organized by zoom levels for specific resolutions.
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Tile").default} TileSourceType
 * @template {import("../renderer/Layer").default} RendererType
 * @extends {Layer<TileSourceType, RendererType>}
 * @api
 */
class BaseTileLayer<TileSourceType extends TileSource = TileSource, RendererType extends LayerRenderer = LayerRenderer> extends Layer<TileSourceType, RendererType> {
  /**
   * @param {Options<TileSourceType>} [options] Tile layer options.
   */

  public on: BaseTileLayerOnSignature<EventsKey>;
  public once: BaseTileLayerOnSignature<EventsKey>;
  public un: BaseTileLayerOnSignature<void>;

  constructor(options?: BaseTileLayerOptions<TileSourceType>) {
    options = options ? options : {};

    const baseOptions = Object.assign({}, options);

    delete baseOptions.preload;
    delete baseOptions.useInterimTilesOnError;
    super(baseOptions);

    this.setPreload(options.preload !== undefined ? options.preload : 0);
    this.setUseInterimTilesOnError(
      options.useInterimTilesOnError !== undefined
        ? options.useInterimTilesOnError
        : true
    );
  }

  /**
   * Return the level as number to which we will preload tiles up to.
   * @return {number} The level to preload tiles up to.
   * @observable
   * @api
   */
  public getPreload(): number {
    return /** @type {number} */ <number>(this.get(TileProperty.PRELOAD));
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
   * Set whether we use interim tiles on error.
   * @param {boolean} useInterimTilesOnError Use interim tiles on error.
   * @observable
   * @api
   */
  public setUseInterimTilesOnError(useInterimTilesOnError: boolean): void {
    this.set(TileProperty.USE_INTERIM_TILES_ON_ERROR, useInterimTilesOnError);
  }

  /**
   * Get data for a pixel location.  The return type depends on the source data.  For image tiles,
   * a four element RGBA array will be returned.  For data tiles, the array length will match the
   * number of bands in the dataset.  For requests outside the layer extent, `null` will be returned.
   * Data for an image tiles can only be retrieved if the source's `crossOrigin` property is set.
   *
   * ```js
   * // display layer data on every pointer move
   * map.on('pointermove', (event) => {
   *   console.log(layer.getData(event.pixel));
   * });
   * ```
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Uint8ClampedArray|Uint8Array|Float32Array|DataView|null} Pixel data.
   * @api
   */
  public getData(pixel: Pixel): Uint8ClampedArray | Uint8Array | Float32Array | DataView | null {
    return super.getData(pixel);
  }
}

export default BaseTileLayer;
