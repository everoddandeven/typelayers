/**
 * @module tl/renderer/Composite
 */
import Map, {FrameState} from '../Map';
import MapRenderer from './Map';
import ObjectEventType from '../ObjectEventType';
import RenderEvent from '../render/Event';
import EventType from '../render/EventType';
import {CLASS_UNSELECTABLE} from '../css';
import {checkedFonts} from '../render/canvas';
import {inView} from '../layer/Layer';
import {EventsKey, listen, unlistenByKey} from '../events';
import {replaceChildren} from '../dom';
import BaseVectorLayer from "../layer/BaseVector";


/**
 * @classdesc
 * Canvas map renderer.
 * @api
 */
class CompositeMapRenderer extends MapRenderer {
  /**
   * @param {import("../Map").default} map Map.
   */

  private fontChangeListenerKey_: EventsKey;
  private element_: HTMLDivElement;
  private children_: HTMLDivElement[];
  private renderedVisible_: boolean;

  constructor(map: Map) {
    super(map);

    /**
     * @type {import("../events").EventsKey}
     */
    this.fontChangeListenerKey_ = listen(
      checkedFonts,
      ObjectEventType.PROPERTYCHANGE,
      map.redrawText.bind(map)
    );

    /**
     * @private
     * @type {HTMLDivElement}
     */
    this.element_ = document.createElement('div');
    const style = this.element_.style;
    style.position = 'absolute';
    style.width = '100%';
    style.height = '100%';
    style.zIndex = '0';

    this.element_.className = CLASS_UNSELECTABLE + ' tl-layers';

    const container = map.getViewport();
    container.insertBefore(this.element_, container.firstChild || null);

    /**
     * @private
     * @type {Array<HTMLElement>}
     */
    this.children_ = [];

    /**
     * @private
     * @type {boolean}
     */
    this.renderedVisible_ = true;
  }

  /**
   * @param {import("../render/EventType").default} type Event type.
   * @param {import("../Map").FrameState} frameState Frame state.
   */
  public dispatchRenderEvent(type: EventType, frameState: FrameState): void {
    const map = this.getMap();
    if (map.hasListener(type)) {
      const event = new RenderEvent(type, undefined, frameState);
      map.dispatchEvent(event);
    }
  }

  protected disposeInternal(): void {
    unlistenByKey(this.fontChangeListenerKey_);
    this.element_.parentNode.removeChild(this.element_);
    super.disposeInternal();
  }

  /**
   * Render.
   * @param {?import("../Map").FrameState} frameState Frame state.
   */
  public renderFrame(frameState: FrameState): void {
    if (!frameState) {
      if (this.renderedVisible_) {
        this.element_.style.display = 'none';
        this.renderedVisible_ = false;
      }
      return;
    }

    this.calculateMatrices2D(frameState);
    this.dispatchRenderEvent(EventType.PRECOMPOSE, frameState);

    const layerStatesArray = frameState.layerStatesArray.sort(function (a, b) {
      return a.zIndex - b.zIndex;
    });
    const viewState = frameState.viewState;

    this.children_.length = 0;
    /**
     * @type {Array<import("../layer/BaseVector").default>}
     */
    const declutterLayers: BaseVectorLayer[] = [];
    let previousElement = null;
    for (let i = 0, ii = layerStatesArray.length; i < ii; ++i) {
      const layerState = layerStatesArray[i];
      frameState.layerIndex = i;

      const layer = layerState.layer;
      const sourceState = layer.getSourceState();
      if (
        !inView(layerState, viewState) ||
        (sourceState != 'ready' && sourceState != 'undefined')
      ) {
        layer.unrender();
        continue;
      }

      const element = layer.render(frameState, previousElement);
      if (!element) {
        continue;
      }
      if (element !== previousElement) {
        this.children_.push(<HTMLDivElement>element);
        previousElement = element;
      }
      if ('getDeclutter' in layer) {
        declutterLayers.push(
          /** @type {import("../layer/BaseVector").default} */ (<BaseVectorLayer>layer)
        );
      }
    }
    for (let i = declutterLayers.length - 1; i >= 0; --i) {
      declutterLayers[i].renderDeclutter(frameState);
    }

    replaceChildren(this.element_, this.children_);

    this.dispatchRenderEvent(EventType.POSTCOMPOSE, frameState);

    if (!this.renderedVisible_) {
      this.element_.style.display = '';
      this.renderedVisible_ = true;
    }

    this.scheduleExpireIconCache(frameState);
  }
}

export default CompositeMapRenderer;
