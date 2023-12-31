/**
 * @module tl/events/EventType
 */

/**
 * @enum {string}
 * @const
 */
export enum EventType {
  /**
   * Generic change event. Triggered when the revision counter is increased.
   * @event module =tl/events/Event~BaseEvent#change
   * @api
   */
  CHANGE = 'change',

  /**
   * Generic error event. Triggered when an error occurs.
   * @event module =tl/events/Event~BaseEvent#error
   * @api
   */
  ERROR = 'error',

  BLUR = 'blur',
  CLEAR = 'clear',
  CONTEXTMENU = 'contextmenu',
  CLICK = 'click',
  DBLCLICK = 'dblclick',
  DRAGENTER = 'dragenter',
  DRAGOVER = 'dragover',
  DROP = 'drop',
  FOCUS = 'focus',
  KEYDOWN = 'keydown',
  KEYPRESS = 'keypress',
  LOAD = 'load',
  RESIZE = 'resize',
  TOUCHMOVE = 'touchmove',
  WHEEL = 'wheel',
}

export default EventType;
