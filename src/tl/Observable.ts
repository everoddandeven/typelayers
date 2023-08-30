/**
 * @module tl/Observable
 */
import EventTarget from './events/Target';
import EventType from './events/EventType';
import {EventsKey, listen, listenOnce, unlistenByKey} from './events';
import BaseEvent from "./events/Event";
import event from "./render/Event";

/***
 * @template {string} Type
 * @template {Event|import("./events/Event").default} EventClass
 * @template Return
 * @typedef {(type: Type, listener: (event: EventClass) => ?) => Return} OnSignature
 */

export type EventClass = Event | BaseEvent;
//export type OnSignature = (type: any, listener: (event: EventClass) => any) => any;
// @typedef {(type: Type[], listener: (event: Event|import("./events/Event").default) => ?) => Return extends void ? void : Return[]} CombinedOnSignature
export type OnSignature<Type, EventClass, Return> = (type: Type, listener: (event: EventClass) => any) => Return;
//export type CombinedOnSignature = (type: any[], listener: (event: Event | BaseEvent) => any) => any | any[];
export type CombinedOnSignature<Type, Return> = (type: Type, listener: (event: Event | BaseEvent) => any) => Return extends void ? void: Return[];

export type EventTypes = 'change' | 'error';
export type ObservableEventTypes = EventTypes;
/***
 * @template Return
 * @typedef {OnSignature<EventTypes, import("./events/Event").default, Return> & CombinedOnSignature<EventTypes, Return>} ObservableOnSignature
 */


export type ObservableOnSignature<Return> = OnSignature<EventTypes, BaseEvent, Return> & CombinedOnSignature<EventTypes, Return>;

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * An event target providing convenient methods for listener registration
 * and unregistration. A generic `change` event is always available through
 * {@link module:tl/Observable~Observable#changed}.
 *
 * @fires import("./events/Event").default
 * @api
 */
abstract class Observable extends EventTarget {

  private revision_: number;

  public on?: ObservableOnSignature<EventsKey>;
  public once?: ObservableOnSignature<EventsKey>;
  public un?: ObservableOnSignature<void>;

  protected constructor() {
    super();

    this.on =
      /** @type {ObservableOnSignature<import("./events").EventsKey>} */ (
        <ObservableOnSignature<EventsKey>>this.onInternal
      );

    this.once =
      /** @type {ObservableOnSignature<import("./events").EventsKey>} */ (
        <ObservableOnSignature<EventsKey>>this.onceInternal
      );

    this.un = /** @type {ObservableOnSignature<void>} */ (this.unInternal);

    /**
     * @private
     * @type {number}
     */
    this.revision_ = 0;
  }

  /**
   * Increases the revision counter and dispatches a 'change' event.
   * @api
   */
  public changed(): void {
    ++this.revision_;
    this.dispatchEvent(EventType.CHANGE);
  }

  /**
   * Get the version number for this object.  Each time the object is modified,
   * its version number will be incremented.
   * @return {number} Revision.
   * @api
   */
  public getRevision(): number {
    return this.revision_;
  }

  /**
   * @param {string|Array<string>} type Type.
   * @param {function((Event|import("./events/Event").default)): ?} listener Listener.
   * @return {import("./events").EventsKey|Array<import("./events").EventsKey>} Event key.
   * @protected
   */
  protected onInternal(type: string | string[], listener: (event: BaseEvent) => any): EventsKey | EventsKey[] {
    if (Array.isArray(type)) {
      const len = type.length;
      const keys = new Array(len);
      for (let i = 0; i < len; ++i) {
        keys[i] = listen(this, type[i], listener);
      }
      return keys;
    }
    return listen(this, /** @type {string} */ (type), listener);
  }

  /**
   * @param {string|Array<string>} type Type.
   * @param {function((Event|import("./events/Event").default)): ?} listener Listener.
   * @return {import("./events").EventsKey|Array<import("./events").EventsKey>} Event key.
   * @protected
   */
  protected onceInternal(type: string | string[], listener: (event: BaseEvent) => any): EventsKey | EventsKey[] {
    let key;
    if (Array.isArray(type)) {
      const len = type.length;
      key = new Array(len);
      for (let i = 0; i < len; ++i) {
        key[i] = listenOnce(this, type[i], listener);
      }
    } else {
      key = listenOnce(this, /** @type {string} */ (type), listener);
    }
    /** @type {Object} */ (<any>listener).ol_key = key;
    return key;
  }

  /**
   * Unlisten for a certain type of event.
   * @param {string|Array<string>} type Type.
   * @param {function((Event|import("./events/Event").default)): ?} listener Listener.
   * @protected
   */
  protected unInternal(type: string | string[], listener: (event: BaseEvent) => any): void {
    const key = /** @type {Object} */ (<any>listener).ol_key;
    if (key) {
      unByKey(key);
    } else if (Array.isArray(type)) {
      for (let i = 0, ii = type.length; i < ii; ++i) {
        this.removeEventListener(type[i], listener);
      }
    } else {
      this.removeEventListener(type, listener);
    }
  }
}

/**
 * Listen for a certain type of event.
 * @function
 * @param {string|Array<string>} type The event type or array of event types.
 * @param {function((Event|import("./events/Event").default)): ?} listener The listener function.
 * @return {import("./events").EventsKey|Array<import("./events").EventsKey>} Unique key for the listener. If
 *     called with an array of event types as the first argument, the return
 *     will be an array of keys.
 * @api
 */
//Observable.prototype.on;

/**
 * Listen once for a certain type of event.
 * @function
 * @param {string|Array<string>} type The event type or array of event types.
 * @param {function((Event|import("./events/Event").default)): ?} listener The listener function.
 * @return {import("./events").EventsKey|Array<import("./events").EventsKey>} Unique key for the listener. If
 *     called with an array of event types as the first argument, the return
 *     will be an array of keys.
 * @api
 */
//Observable.prototype.once;

/**
 * Unlisten for a certain type of event.
 * @function
 * @param {string|Array<string>} type The event type or array of event types.
 * @param {function((Event|import("./events/Event").default)): ?} listener The listener function.
 * @api
 */
//Observable.prototype.un;

/**
 * Removes an event listener using the key returned by `on()` or `once()`.
 * @param {import("./events").EventsKey|Array<import("./events").EventsKey>} key The key returned by `on()`
 *     or `once()` (or an array of keys).
 * @api
 */
export function unByKey(key: EventsKey | EventsKey[]): void {
  if (Array.isArray(key)) {
    for (let i = 0, ii = key.length; i < ii; ++i) {
      unlistenByKey(key[i]);
    }
  } else {
    unlistenByKey(/** @type {import("./events").EventsKey} */ (key));
  }
}

export default Observable;
