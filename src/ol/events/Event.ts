/**
 * @module ol/events/Event
 */

/**
 * @classdesc
 * Stripped down implementation of the W3C DOM Level 2 Event interface.
 * See https://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-interface.
 *
 * This implementation only provides `type` and `target` properties, and
 * `stopPropagation` and `preventDefault` methods. It is meant as base class
 * for higher level events defined in the library, and works with
 * {@link module:ol/events/Target~Target}.
 */
export default class BaseEvent {
  /**
   * @param {string} type Type.
   */

  public propagationStopped: boolean;
  public defaultPrevented: boolean;
  public type: string;
  public target?: Object;

  constructor(type: string) {
    /**
     * @type {boolean}
     */
    this.propagationStopped = false;

    /**
     * @type {boolean}
     */
    this.defaultPrevented = false;

    /**
     * The event type.
     * @type {string}
     * @api
     */
    this.type = type;

    /**
     * The event target.
     * @type {Object}
     * @api
     */
    this.target = null;
  }

  /**
   * Prevent default. This means that no emulated `click`, `singleclick` or `doubleclick` events
   * will be fired.
   * @api
   */
  public preventDefault(): void {
    this.defaultPrevented = true;
  }

  /**
   * Stop event propagation.
   * @api
   */
  public stopPropagation(): void {
    this.propagationStopped = true;
  }
}

/**
 * @param {Event|import("./Event").default} evt Event
 */
export function stopPropagation(evt: Event | BaseEvent): void {
  evt.stopPropagation();
}

/**
 * @param {Event|import("./Event").default} evt Event
 */
export function preventDefault(evt: Event | BaseEvent): void {
  evt.preventDefault();
}