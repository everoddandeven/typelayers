/**
 * @module tl/interaction/DoubleClickZoom
 */
import Interaction, {zoomByDelta} from './Interaction';
import MapBrowserEventType from '../MapBrowserEventType';
import {MapBrowserEvent} from "../index";

export interface DoubleClickZoomOptions {
  duration?: number;
  delta?: number;
}

/**
 * @classdesc
 * Allows the user to zoom by double-clicking on the map.
 * @api
 */
class DoubleClickZoom extends Interaction {
  private delta_: number;
  private duration_: number;

  /**
   * @param {Options} [options] Options.
   */
  constructor(options?: DoubleClickZoomOptions) {
    super();

    options = options ? options : {};

    /**
     * @private
     * @type {number}
     */
    this.delta_ = options.delta ? options.delta : 1;

    /**
     * @private
     * @type {number}
     */
    this.duration_ = options.duration !== undefined ? options.duration : 250;
  }

  /**
   * Handles the {@link module:tl/MapBrowserEvent~MapBrowserEvent map browser event} (if it was a
   * double click) and eventually zooms the map.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Map browser event.
   * @return {boolean} `false` to stop event propagation.
   */
  public handleEvent(mapBrowserEvent: MapBrowserEvent): boolean {
    let stopEvent = false;
    if (mapBrowserEvent.type == MapBrowserEventType.DBLCLICK) {
      const browserEvent = /** @type {MouseEvent} */ (
        <MouseEvent>mapBrowserEvent.originalEvent
      );
      const map = mapBrowserEvent.map;
      const anchor = mapBrowserEvent.coordinate;
      const delta = browserEvent.shiftKey ? -this.delta_ : this.delta_;
      const view = map.getView();
      zoomByDelta(view, delta, anchor, this.duration_);
      browserEvent.preventDefault();
      stopEvent = true;
    }
    return !stopEvent;
  }
}

export default DoubleClickZoom;
