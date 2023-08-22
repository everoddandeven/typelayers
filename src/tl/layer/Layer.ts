/**
 * @module tl/layer/Layer
 */
import BaseLayer, {BaseLayerObjectEventTypes} from './Base';
import EventType from '../events/EventType';
import LayerProperty from './Property';
import EventType, {LayerRenderEventTypes} from '../render/EventType';
import View, {ViewState, ViewStateLayerStateExtent} from '../View';
import {assert} from '../asserts';
import {intersects} from '../extent';
import {EventsKey, listen, unlistenByKey} from '../events';
import {Extent} from "../extent/Extent";
import {FrameState} from "../Map";
import BaseEvent from "../events/Event";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import {ObjectEvent} from "../Object";
import RenderEvent from "../render/Event";
import Source, {SourceState} from "../source/Source";
import Map from '../Map';
import LayerRenderer from "../renderer/Layer";
import {Pixel} from "../pixel";
import {FeatureLike} from "../Feature";

export type RenderFunction = (state: FrameState) => HTMLElement;
export type LayerEventType = 'sourceready' | 'change:source';

export type LayerOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<BaseLayerObjectEventTypes | LayerEventType, ObjectEvent, Return> &
    OnSignature<LayerRenderEventTypes, RenderEvent, Return> &
    CombinedOnSignature<EventTypes | BaseLayerObjectEventTypes | LayerEventType | LayerRenderEventTypes, Return>;


export interface LayerOptions<SourceType extends Source = Source> {
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  source?: SourceType;
  map?: Map | null;
  render?: RenderFunction;
  properties?: {[key: string]: any};
}

export interface LayerState
{
  layer?: Layer,
  opacity?: number;
  visible?: boolean,
  managed?: boolean,
  extent?: Extent,
  zIndex?: number,
  maxResolution?: number,
  minResolution?: number,
  minZoom?: number,
  maxZoom?: number
}

/**
 * @classdesc
 * Base class from which all layer types are derived. This should only be instantiated
 * in the case where a custom layer is added to the map with a custom `render` function.
 * Such a function can be specified in the `options` object, and is expected to return an HTML element.
 *
 * A visual representation of raster or vector map data.
 * Layers group together those properties that pertain to how the data is to be
 * displayed, irrespective of the source of that data.
 *
 * Layers are usually added to a map with [map.addLayer()]{@link import("../Map").default#addLayer}.
 * Components like {@link module:tl/interaction/Draw~Draw} use unmanaged layers
 * internally. These unmanaged layers are associated with the map using
 * [layer.setMap()]{@link module:tl/layer/Layer~Layer#setMap} instead.
 *
 * A generic `change` event is fired when the state of the source changes.
 * A `sourceready` event is fired when the layer's source is ready.
 *
 * @fires import("../render/Event").RenderEvent#prerender
 * @fires import("../render/Event").RenderEvent#postrender
 * @fires import("../events/Event").BaseEvent#sourceready
 *
 * @template {import("../source/Source").default} [SourceType=import("../source/Source").default]
 * @template {import("../renderer/Layer").default} [RendererType=import("../renderer/Layer").default]
 * @api
 */
class Layer<SourceType extends Source = Source, RenderType extends LayerRenderer = LayerRenderer> extends BaseLayer {
  private mapPrecomposeKey_: EventsKey;
  private mapRenderKey_: EventsKey;
  private sourceChangeKey_: EventsKey;
  private sourceReady_: boolean;
  private renderer_: RenderType; // RenderType
  protected rendered: boolean;
  /**
   * @param {Options<SourceType>} options Layer options.
   */
  constructor(options: LayerOptions<SourceType>) {
    const baseOptions = Object.assign({}, options);
    delete baseOptions.source;

    super(baseOptions);

    /***
     * @type {LayerOnSignature<import("../events").EventsKey>}
     */
    this.on;

    /***
     * @type {LayerOnSignature<import("../events").EventsKey>}
     */
    this.once;

    /***
     * @type {LayerOnSignature<void>}
     */
    this.un;

    /**
     * @private
     * @type {?import("../events").EventsKey}
     */
    this.mapPrecomposeKey_ = null;

    /**
     * @private
     * @type {?import("../events").EventsKey}
     */
    this.mapRenderKey_ = null;

    /**
     * @private
     * @type {?import("../events").EventsKey}
     */
    this.sourceChangeKey_ = null;

    /**
     * @private
     * @type {LayerRendererType}
     */
    this.renderer_ = null;

    /**
     * @private
     * @type {boolean}
     */
    this.sourceReady_ = false;

    /**
     * @protected
     * @type {boolean}
     */
    this.rendered = false;

    // Overwrite default render method with a custom one
    if (options.render) {
      this.render = options.render;
    }

    if (options.map) {
      this.setMap(options.map);
    }

    this.addChangeListener(
      LayerProperty.SOURCE,
      this.handleSourcePropertyChange_
    );

    const source = options.source
      ? /** @type {SourceType} */ (options.source)
      : null;
    this.setSource(source);
  }

  /**
   * @param {Array<import("./Layer").default>} [array] Array of layers (to be modified in place).
   * @return {Array<import("./Layer").default>} Array of layers.
   */
  public getLayersArray(array: Layer<SourceType, RenderType>[]): Layer<SourceType, RenderType>[] {
    array = array ? array : [];
    array.push(this);
    return array;
  }

  /**
   * @param {Array<import("./Layer").State>} [states] Optional list of layer states (to be modified in place).
   * @return {Array<import("./Layer").State>} List of layer states.
   */
  public getLayerStatesArray(states?: LayerState[]): LayerState[] {
    states = states ? states : [];
    states.push(this.getLayerState());
    return states;
  }

  /**
   * Get the layer source.
   * @return {SourceType|null} The layer source (or `null` if not yet set).
   * @observable
   * @api
   */
  public getSource(): Source | null {
    return /** @type {SourceType} */ (<Source>this.get(LayerProperty.SOURCE)) || null;
  }

  /**
   * @return {SourceType|null} The source being rendered.
   */
  public getRenderSource(): Source | null {
    return this.getSource();
  }

  /**
   * @return {import("../source/Source").SourceState} Source state.
   */
  public getSourceState(): SourceState {
    const source = this.getSource();
    return !source ? 'undefined' : (<Source>source).getState();
  }

  /**
   * @private
   */
  private handleSourceChange_(): void {
    this.changed();
    if (this.sourceReady_ || this.getSource().getState() !== 'ready') {
      return;
    }
    this.sourceReady_ = true;
    this.dispatchEvent('sourceready');
  }

  /**
   * @private
   */
  private handleSourcePropertyChange_(): void {
    if (this.sourceChangeKey_) {
      unlistenByKey(this.sourceChangeKey_);
      this.sourceChangeKey_ = null;
    }
    this.sourceReady_ = false;
    const source = this.getSource();
    if (source) {
      this.sourceChangeKey_ = listen(
        source,
        EventType.CHANGE,
        this.handleSourceChange_,
        this
      );
      if (source.getState() === 'ready') {
        this.sourceReady_ = true;
        setTimeout(() => {
          this.dispatchEvent('sourceready');
        }, 0);
      }
    }
    this.changed();
  }

  /**
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Promise<Array<import("../Feature").FeatureLike>>} Promise that resolves with
   * an array of features.
   */
  public getFeatures(pixel: Pixel): Promise<FeatureLike[]> {
    if (!this.renderer_) {
      return Promise.resolve([]);
    }
    return (this.renderer_).getFeatures(pixel);
  }

  /**
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Uint8ClampedArray|Uint8Array|Float32Array|DataView|null} Pixel data.
   */
  public getData(pixel: Pixel): Uint8ClampedArray | Uint8Array | Float32Array | DataView | null {
    if (!this.renderer_ || !this.rendered) {
      return null;
    }
    return (this.renderer_).getData(pixel);
  }

  /**
   * The layer is visible on the map view, i.e. within its min/max resolution or zoom and
   * extent, not set to `visible: false`, and not inside a layer group that is set
   * to `visible: false`.
   * @param {View|import("../View").ViewStateLayerStateExtent} [view] View or {@link import("../Map").FrameState}.
   * Only required when the layer is not added to a map.
   * @return {boolean} The layer is visible in the map view.
   * @api
   */
  public isVisible(view?: FrameState | ViewStateLayerStateExtent): boolean {
    let frameState;
    const map = this.getMapInternal();
    if (!view && map) {
      view = map.getView();
    }
    if (view instanceof View) {
      frameState = {
        viewState: view.getState(),
        extent: view.calculateExtent(),
      };
    } else {
      frameState = view;
    }
    if (!frameState.layerStatesArray && map) {
      frameState.layerStatesArray = map.getLayerGroup().getLayerStatesArray();
    }
    let layerState;
    if (frameState.layerStatesArray) {
      layerState = frameState.layerStatesArray.find(
        (layerState) => layerState.layer === this
      );
    } else {
      layerState = this.getLayerState();
    }

    const layerExtent = this.getExtent();

    return (
      inView(layerState, frameState.viewState) &&
      (!layerExtent || intersects(layerExtent, frameState.extent))
    );
  }

  /**
   * Get the attributions of the source of this layer for the given view.
   * @param {View|import("../View").ViewStateLayerStateExtent} [view] View or {@link import("../Map").FrameState}.
   * Only required when the layer is not added to a map.
   * @return {Array<string>} Attributions for this layer at the given view.
   * @api
   */
  public getAttributions(view) {
    if (!this.isVisible(view)) {
      return [];
    }
    let getAttributions;
    const source = this.getSource();
    if (source) {
      getAttributions = source.getAttributions();
    }
    if (!getAttributions) {
      return [];
    }
    const frameState =
      view instanceof View ? view.getViewStateAndExtent() : view;
    let attributions = getAttributions(frameState);
    if (!Array.isArray(attributions)) {
      attributions = [attributions];
    }
    return attributions;
  }

  /**
   * In charge to manage the rendering of the layer. One layer type is
   * bounded with one layer renderer.
   * @param {?import("../Map").FrameState} frameState Frame state.
   * @param {HTMLElement} target Target which the renderer may (but need not) use
   * for rendering its content.
   * @return {HTMLElement|null} The rendered element.
   */
  public render(frameState: FrameState, target: HTMLElement): HTMLElement | null {
    const layerRenderer = this.getRenderer();

    if (layerRenderer.prepareFrame(frameState)) {
      this.rendered = true;
      return layerRenderer.renderFrame(frameState, target);
    }
    return null;
  }

  /**
   * Called when a layer is not visible during a map render.
   */
  unrender() {
    this.rendered = false;
  }

  /**
   * For use inside the library only.
   * @param {import("../Map").default|null} map Map.
   */
  setMapInternal(map) {
    if (!map) {
      this.unrender();
    }
    this.set(LayerProperty.MAP, map);
  }

  /**
   * For use inside the library only.
   * @return {import("../Map").default|null} Map.
   */
  getMapInternal() {
    return this.get(LayerProperty.MAP);
  }

  /**
   * Sets the layer to be rendered on top of other layers on a map. The map will
   * not manage this layer in its layers collection. This
   * is useful for temporary layers. To remove an unmanaged layer from the map,
   * use `#setMap(null)`.
   *
   * To add the layer to a map and have it managed by the map, use
   * {@link module:tl/Map~Map#addLayer} instead.
   * @param {import("../Map").default|null} map Map.
   * @api
   */
  setMap(map) {
    if (this.mapPrecomposeKey_) {
      unlistenByKey(this.mapPrecomposeKey_);
      this.mapPrecomposeKey_ = null;
    }
    if (!map) {
      this.changed();
    }
    if (this.mapRenderKey_) {
      unlistenByKey(this.mapRenderKey_);
      this.mapRenderKey_ = null;
    }
    if (map) {
      this.mapPrecomposeKey_ = listen(
        map,
        EventType.PRECOMPOSE,
        function (evt) {
          const renderEvent =
            /** @type {import("../render/Event").default} */ (evt);
          const layerStatesArray = renderEvent.frameState.layerStatesArray;
          const layerState = this.getLayerState(false);
          // A layer can only be added to the map once. Use either `layer.setMap()` or `map.addLayer()`, not both.
          assert(
            !layerStatesArray.some(function (arrayLayerState) {
              return arrayLayerState.layer === layerState.layer;
            }),
            67
          );
          layerStatesArray.push(layerState);
        },
        this
      );
      this.mapRenderKey_ = listen(this, EventType.CHANGE, map.render, map);
      this.changed();
    }
  }

  /**
   * Set the layer source.
   * @param {SourceType|null} source The layer source.
   * @observable
   * @api
   */
  setSource(source) {
    this.set(LayerProperty.SOURCE, source);
  }

  /**
   * Get the renderer for this layer.
   * @return {LayerRendererType|null} The layer renderer.
   */
  public getRenderer(): RenderType {
    if (!this.renderer_) {
      this.renderer_ = this.createRenderer();
    }

    return this.renderer_;
  }

  /**
   * @return {boolean} The layer has a renderer.
   */
  hasRenderer() {
    return !!this.renderer_;
  }

  /**
   * Create a renderer for this layer.
   * @return {LayerRendererType} A layer renderer.
   * @protected
   */
  createRenderer() {
    return null;
  }

  /**
   * Clean up.
   */
  protected disposeInternal() {
    if (this.renderer_) {
      (this.renderer_).dispose();
      delete this.renderer_;
    }

    this.setSource(null);
    super.disposeInternal();
  }
}

/**
 * Return `true` if the layer is visible and if the provided view state
 * has resolution and zoom levels that are in range of the layer's min/max.
 * @param {State} layerState Layer state.
 * @param {import("../View").State} viewState View state.
 * @return {boolean} The layer is visible at the given view state.
 */
export function inView(layerState: LayerState, viewState: ViewState): boolean {
  if (!layerState.visible) {
    return false;
  }
  const resolution = viewState.resolution;
  if (
    resolution < layerState.minResolution ||
    resolution >= layerState.maxResolution
  ) {
    return false;
  }
  const zoom = viewState.zoom;
  return zoom > layerState.minZoom && zoom <= layerState.maxZoom;
}

export default Layer;
