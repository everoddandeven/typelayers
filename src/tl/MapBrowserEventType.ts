/**
 * @module tl/MapBrowserEventType
 */
import EventType from './events/EventType';

/**
 * Constants for event names.
 * @enum {string}
 */
export enum MapBrowserEventType {
  /**
   * A true single click with no dragging and no double click. Note that this
   * event is delayed by 250 ms to ensure that it is not a double click.
   * @event module =tl/MapBrowserEvent~MapBrowserEvent#singleclick
   * @api
   */
  SINGLECLICK = 'singleclick',

  /**
   * A click with no dragging. A double click will fire two of this.
   * @event module =tl/MapBrowserEvent~MapBrowserEvent#click
   * @api
   */
  CLICK = EventType.CLICK,

  /**
   * A true double click, with no dragging.
   * @event module =tl/MapBrowserEvent~MapBrowserEvent#dblclick
   * @api
   */
  DBLCLICK = EventType.DBLCLICK,

  /**
   * Triggered when a pointer is dragged.
   * @event module =tl/MapBrowserEvent~MapBrowserEvent#pointerdrag
   * @api
   */
  POINTERDRAG = 'pointerdrag',

  /**
   * Triggered when a pointer is moved. Note that on touch devices this is
   * triggered when the map is panned, so is not the same as mousemove.
   * @event module =tl/MapBrowserEvent~MapBrowserEvent#pointermove
   * @api
   */
  POINTERMOVE = 'pointermove',

  POINTERDOWN = 'pointerdown',
  POINTERUP = 'pointerup',
  POINTEROVER = 'pointerover',
  POINTEROUT = 'pointerout',
  POINTERENTER = 'pointerenter',
  POINTERLEAVE = 'pointerleave',
  POINTERCANCEL = 'pointercancel',
}

export default MapBrowserEventType;

export type MapBrowserEventTypes = 'singleclick' | 'click' | 'dblclick' | 'pointerdrag' | 'pointermove';
