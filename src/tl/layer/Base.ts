/**
 * @module tl/layer/Base
 */
import BaseObject, {ObjectEvent} from '../Object';
import LayerProperty from './Property';
import {assert} from '../asserts';
import {clamp} from '../math';
import {Extent} from "../extent/Extent";
import Layer, {LayerState} from "./Layer";
import {SourceState} from "../source/Source";
import {ObjectEventTypes} from "../ObjectEventType";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import BaseEvent from "../events/Event";
import {EventsKey} from "../events";


export type BackgroundFunction = (num: number) => string ;
export type BackgroundColor = string | BackgroundFunction;

export type BaseLayerObjectEventTypes =
    ObjectEventTypes
    | 'change:extent'
    | 'change:maxResolution'
    | 'change:maxZoom'
    |
    'change:minResolution'
    | 'change:minZoom'
    | 'change:opacity'
    | 'change:visible'
    | 'change:zIndex';

/***
 * @template Return
 * @typedef {import("../Observable").OnSignature<import("../Observable").EventTypes, import("../events/Event").default, Return> &
 *   import("../Observable").OnSignature<BaseLayerObjectEventTypes, import("../Object").ObjectEvent, Return> &
 *   import("../Observable").CombinedOnSignature<import("../Observable").EventTypes|BaseLayerObjectEventTypes, Return>} BaseLayerOnSignature
 */

export type BaseLayerOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<BaseLayerObjectEventTypes, ObjectEvent, Return> &
    CombinedOnSignature<EventTypes, Return>;

export interface BaseLayerOptions
{
  className?: string,
  opacity?: number,
  visible?: boolean,
  extent?: Extent,
  zIndex?: number,
  minResolution?: number,
  maxResolution?: number,
  minZoom?: number,
  maxZoom?: number,
  background?: BackgroundColor,
  properties?: {[key: string]: any}
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Note that with {@link module:tl/layer/Base~BaseLayer} and all its subclasses, any property set in
 * the options is set as a {@link module:tl/Object~BaseObject} property on the layer object, so
 * is observable, and has get/set accessors.
 *
 * @api
 */
export default abstract class BaseLayer extends BaseObject {
  /**
   * @param {Options} options Layer options.
   */

  private background_: BackgroundColor | false;
  private className_: string;
  private state_: LayerState

  public on: BaseLayerOnSignature<EventsKey>;
  public once: BaseLayerOnSignature<EventsKey>;
  public un: BaseLayerOnSignature<void>;

  protected constructor(options: BaseLayerOptions) {
    super();

    /**
     * @type {BackgroundColor|false}
     * @private
     */
    this.background_ = options.background;

    /**
     * @type {Object<string, *>}
     */
    const properties: BaseLayerOptions = Object.assign({}, options);
    if (typeof options.properties === 'object') {
      delete properties.properties;
      Object.assign(properties, options.properties);
    }

    properties[LayerProperty.OPACITY] =
      options.opacity !== undefined ? options.opacity : 1;
    assert(typeof properties[LayerProperty.OPACITY] === 'number', 64); // Layer opacity must be a number

    properties[LayerProperty.VISIBLE] =
      options.visible !== undefined ? options.visible : true;
    properties[LayerProperty.Z_INDEX] = options.zIndex;
    properties[LayerProperty.MAX_RESOLUTION] =
      options.maxResolution !== undefined ? options.maxResolution : Infinity;
    properties[LayerProperty.MIN_RESOLUTION] =
      options.minResolution !== undefined ? options.minResolution : 0;
    properties[LayerProperty.MIN_ZOOM] =
      options.minZoom !== undefined ? options.minZoom : -Infinity;
    properties[LayerProperty.MAX_ZOOM] =
      options.maxZoom !== undefined ? options.maxZoom : Infinity;

    /**
     * @type {string}
     * @private
     */
    this.className_ =
      properties.className !== undefined ? properties.className : 'tl-layer';
    delete properties.className;

    this.setProperties(properties);

    /**
     * @type {import("./Layer").State}
     * @private
     */
    this.state_ = null;
  }

  /**
   * Get the background for this layer.
   * @return {BackgroundColor|false} Layer background.
   */
  public getBackground(): BackgroundColor | false {
    return this.background_;
  }

  /**
   * @return {string} CSS class name.
   */
  public getClassName(): string {
    return this.className_;
  }

  /**
   * This method is not meant to be called by layers or layer renderers because the state
   * is incorrect if the layer is included in a layer group.
   *
   * @param {boolean} [managed] Layer is managed.
   * @return {import("./Layer").State} Layer state.
   */
  public getLayerState(managed?: boolean): LayerState {
    /** @type {import("./Layer").State} */
    const state: LayerState =
      this.state_ ||
      <LayerState>{
        layer: this,
        managed: managed === undefined ? true : managed,
        opacity: null,
        visible: null,
        extent: null,
        zIndex: null,
        maxResolution: null,
        minResolution: null,
        minZoom: null,
        maxZoom: null
      };
    const zIndex = this.getZIndex();
    state.opacity = clamp(Math.round(this.getOpacity() * 100) / 100, 0, 1);
    state.visible = this.getVisible();
    state.extent = this.getExtent();
    state.zIndex = zIndex === undefined && !state.managed ? Infinity : zIndex;
    state.maxResolution = this.getMaxResolution();
    state.minResolution = Math.max(this.getMinResolution(), 0);
    state.minZoom = this.getMinZoom();
    state.maxZoom = this.getMaxZoom();
    this.state_ = state;

    return state;
  }

  /**
   * @abstract
   * @param {Array<import("./Layer").default>} [array] Array of layers (to be
   *     modified in place).
   * @return {Array<import("./Layer").default>} Array of layers.
   */
  public abstract getLayersArray(array: Layer[]): Layer[];

  /**
   * @abstract
   * @param {Array<import("./Layer").State>} [states] Optional list of layer
   *     states (to be modified in place).
   * @return {Array<import("./Layer").State>} List of layer states.
   */
  public abstract getLayerStatesArray(states: LayerState[]): LayerState[];

  /**
   * Return the {@link module:tl/extent~Extent extent} of the layer or `undefined` if it
   * will be visible regardless of extent.
   * @return {import("../extent").Extent|undefined} The layer extent.
   * @observable
   * @api
   */
  public getExtent(): Extent {
    return /** @type {import("../extent").Extent|undefined} */ (
      this.get(LayerProperty.EXTENT)
    );
  }

  /**
   * Return the maximum resolution of the layer.
   * @return {number} The maximum resolution of the layer.
   * @observable
   * @api
   */
  public getMaxResolution(): number {
    return /** @type {number} */ (this.get(LayerProperty.MAX_RESOLUTION));
  }

  /**
   * Return the minimum resolution of the layer.
   * @return {number} The minimum resolution of the layer.
   * @observable
   * @api
   */
  public getMinResolution(): number {
    return /** @type {number} */ (this.get(LayerProperty.MIN_RESOLUTION));
  }

  /**
   * Return the minimum zoom level of the layer.
   * @return {number} The minimum zoom level of the layer.
   * @observable
   * @api
   */
  public getMinZoom(): number {
    return /** @type {number} */ (this.get(LayerProperty.MIN_ZOOM));
  }

  /**
   * Return the maximum zoom level of the layer.
   * @return {number} The maximum zoom level of the layer.
   * @observable
   * @api
   */
  public getMaxZoom(): number {
    return /** @type {number} */ (this.get(LayerProperty.MAX_ZOOM));
  }

  /**
   * Return the opacity of the layer (between 0 and 1).
   * @return {number} The opacity of the layer.
   * @observable
   * @api
   */
  public getOpacity(): number {
    return /** @type {number} */ (this.get(LayerProperty.OPACITY));
  }

  /**
   * @abstract
   * @return {import("../source/Source").SourceState} Source state.
   */
  public abstract getSourceState(): SourceState;

  /**
   * Return the value of this layer's `visible` property. To find out whether the layer
   * is visible on a map, use `isVisible()` instead.
   * @return {boolean} The value of the `visible` property of the layer.
   * @observable
   * @api
   */
  public getVisible(): boolean {
    return /** @type {boolean} */ (this.get(LayerProperty.VISIBLE));
  }

  /**
   * Return the Z-index of the layer, which is used to order layers before
   * rendering. The default Z-index is 0.
   * @return {number} The Z-index of the layer.
   * @observable
   * @api
   */
  public getZIndex(): number {
    return /** @type {number} */ (this.get(LayerProperty.Z_INDEX));
  }

  /**
   * Sets the background color.
   * @param {BackgroundColor} [background] Background color.
   */
  public setBackground(background: BackgroundColor): void {
    this.background_ = background;
    this.changed();
  }

  /**
   * Set the extent at which the layer is visible.  If `undefined`, the layer
   * will be visible at all extents.
   * @param {import("../extent").Extent|undefined} extent The extent of the layer.
   * @observable
   * @api
   */
  public setExtent(extent: Extent): void {
    this.set(LayerProperty.EXTENT, extent);
  }

  /**
   * Set the maximum resolution at which the layer is visible.
   * @param {number} maxResolution The maximum resolution of the layer.
   * @observable
   * @api
   */
  public setMaxResolution(maxResolution: number): void {
    this.set(LayerProperty.MAX_RESOLUTION, maxResolution);
  }

  /**
   * Set the minimum resolution at which the layer is visible.
   * @param {number} minResolution The minimum resolution of the layer.
   * @observable
   * @api
   */
  public setMinResolution(minResolution: number): void {
    this.set(LayerProperty.MIN_RESOLUTION, minResolution);
  }

  /**
   * Set the maximum zoom (exclusive) at which the layer is visible.
   * Note that the zoom levels for layer visibility are based on the
   * view zoom level, which may be different from a tile source zoom level.
   * @param {number} maxZoom The maximum zoom of the layer.
   * @observable
   * @api
   */
  public setMaxZoom(maxZoom: number): void {
    this.set(LayerProperty.MAX_ZOOM, maxZoom);
  }

  /**
   * Set the minimum zoom (inclusive) at which the layer is visible.
   * Note that the zoom levels for layer visibility are based on the
   * view zoom level, which may be different from a tile source zoom level.
   * @param {number} minZoom The minimum zoom of the layer.
   * @observable
   * @api
   */
  public setMinZoom(minZoom: number): void {
    this.set(LayerProperty.MIN_ZOOM, minZoom);
  }

  /**
   * Set the opacity of the layer, allowed values range from 0 to 1.
   * @param {number} opacity The opacity of the layer.
   * @observable
   * @api
   */
  public setOpacity(opacity: number): void {
    assert(typeof opacity === 'number', 64); // Layer opacity must be a number
    this.set(LayerProperty.OPACITY, opacity);
  }

  /**
   * Set the visibility of the layer (`true` or `false`).
   * @param {boolean} visible The visibility of the layer.
   * @observable
   * @api
   */
  public setVisible(visible: boolean): void {
    this.set(LayerProperty.VISIBLE, visible);
  }

  /**
   * Set Z-index of the layer, which is used to order layers before rendering.
   * The default Z-index is 0.
   * @param {number} zindex The z-index of the layer.
   * @observable
   * @api
   */
  public setZIndex(zindex: number): void {
    this.set(LayerProperty.Z_INDEX, zindex);
  }

  /**
   * Clean up.
   */
  protected disposeInternal() {
    if (this.state_) {
      this.state_.layer = null;
      this.state_ = null;
    }
    super.disposeInternal();
  }
}