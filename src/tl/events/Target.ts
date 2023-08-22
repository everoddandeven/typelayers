/**
 * @module tl/events/Target
 */
import Disposable from '../Disposable';
import Event from './Event';
import {VOID} from '../functions';
import {clear} from '../obj';
import {Listener, ListenerFunction, ListenerObject} from "../events";

export type EventTargetLike = EventTarget | Target;

/**
 * @classdesc
 * A simplified implementation of the W3C DOM Level 2 EventTarget interface.
 * See https://www.w3.org/TR/2000/REC-DOM-Level-2-Events-20001113/events.html#Events-EventTarget.
 *
 * There are two important simplifications compared to the specification:
 *
 * 1. The handling of `useCapture` in `addEventListener` and
 *    `removeEventListener`. There is no real capture model.
 * 2. The handling of `stopPropagation` and `preventDefault` on `dispatchEvent`.
 *    There is no event target hierarchy. When a listener calls
 *    `stopPropagation` or `preventDefault` on an event object, it means that no
 *    more listeners after this one will be called. Same as when the listener
 *    returns false.
 */
class Target extends Disposable {
  /**
   * @param {*} [target] Default event target for dispatched events.
   */

  private eventTarget_: any;
  private pendingRemovals_: {[key: string]: number};
  private dispatching_: {[key: string]: number};
  private listeners_: {[key: string]: Listener[]};

  constructor(target?: any) {
    super();

    /**
     * @private
     * @type {*}
     */
    this.eventTarget_ = target;

    /**
     * @private
     * @type {Object<string, number>}
     */
    this.pendingRemovals_ = null;

    /**
     * @private
     * @type {Object<string, number>}
     */
    this.dispatching_ = null;

    /**
     * @private
     * @type {Object<string, Array<import("../events").Listener>>}
     */
    this.listeners_ = null;
  }

  /**
   * @param {string} type Type.
   * @param {import("../events").Listener} listener Listener.
   */
  public addEventListener(type: string, listener: Listener): void {
    if (!type || !listener) {
      return;
    }
    const listeners = this.listeners_ || (this.listeners_ = {});
    const listenersForType = listeners[type] || (listeners[type] = []);
    if (!listenersForType.includes(listener)) {
      listenersForType.push(listener);
    }
  }

  /**
   * Dispatches an event and calls all listeners listening for events
   * of this type. The event parameter can either be a string or an
   * Object with a `type` property.
   *
   * @param {import("./Event").default|string} event Event object.
   * @return {boolean|undefined} `false` if anyone called preventDefault on the
   *     event object or if any of the listeners returned false.
   * @api
   */
  public dispatchEvent(event: Event | string): boolean | null {
    const isString = typeof event === 'string';
    const type = isString ? event : event.type;
    const listeners = this.listeners_ && this.listeners_[type];
    if (!listeners) {
      return;
    }

    const evt = isString ? new Event(event) : /** @type {Event} */ (event);
    if (!evt.target) {
      evt.target = this.eventTarget_ || this;
    }
    const dispatching = this.dispatching_ || (this.dispatching_ = {});
    const pendingRemovals =
      this.pendingRemovals_ || (this.pendingRemovals_ = {});
    if (!(type in dispatching)) {
      dispatching[type] = 0;
      pendingRemovals[type] = 0;
    }
    ++dispatching[type];
    let propagate;
    for (let i = 0, ii = listeners.length; i < ii; ++i) {
      if ('handleEvent' in listeners[i]) {
        propagate = /** @type {import("../events").ListenerObject} */ (<ListenerObject>listeners[i]).handleEvent(evt);
      } else {
        propagate = /** @type {import("../events").ListenerFunction} */ (
            <ListenerFunction>
          listeners[i]
        ).call(this, evt);
      }
      if (propagate === false || evt.propagationStopped) {
        propagate = false;
        break;
      }
    }
    if (--dispatching[type] === 0) {
      let pr = pendingRemovals[type];
      delete pendingRemovals[type];
      while (pr--) {
        this.removeEventListener(type, VOID);
      }
      delete dispatching[type];
    }
    return propagate;
  }

  /**
   * Clean up.
   */
  public disposeInternal(): void {
    this.listeners_ && clear(this.listeners_);
  }

  /**
   * Get the listeners for a specified event type. Listeners are returned in the
   * order that they will be called in.
   *
   * @param {string} type Type.
   * @return {Array<import("../events").Listener>|undefined} Listeners.
   */
  public getListeners(type: string): Listener[] | null {
    return (this.listeners_ && this.listeners_[type]) || undefined;
  }

  /**
   * @param {string} [type] Type. If not provided,
   *     `true` will be returned if this event target has any listeners.
   * @return {boolean} Has listeners.
   */
  public hasListener(type?: string): boolean {
    if (!this.listeners_) {
      return false;
    }
    return type
      ? type in this.listeners_
      : Object.keys(this.listeners_).length > 0;
  }

  /**
   * @param {string} type Type.
   * @param {import("../events").Listener} listener Listener.
   */
  public removeEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners_ && this.listeners_[type];
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        if (this.pendingRemovals_ && type in this.pendingRemovals_) {
          // make listener a no-op, and remove later in #dispatchEvent()
          listeners[index] = VOID;
          ++this.pendingRemovals_[type];
        } else {
          listeners.splice(index, 1);
          if (listeners.length === 0) {
            delete this.listeners_[type];
          }
        }
      }
    }
  }
}

export default Target;
