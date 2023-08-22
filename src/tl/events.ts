/**
 * @module tl/events
 */
import {clear} from './obj';
import BaseEvent from './events/Event'
import {EventTargetLike} from "./events/Target";

/**
 * Key to use with {@link module:tl/Observable.unByKey}.
 * @typedef {Object} EventsKey
 * @property {ListenerFunction} listener Listener.
 * @property {import("./events/Target").EventTargetLike} target Target.
 * @property {string} type Type.
 * @api
 */

export type ListenerFunction = (evt: Event | BaseEvent) => void | boolean;
export interface ListenerObject
{
  handleEvent: ListenerFunction
}

export type Listener = ListenerFunction | ListenerObject;

export interface EventsKey
{
  listener: ListenerFunction,
  target: EventTargetLike,
  type: string
}

/**
 * Listener function. This function is called with an event object as argument.
 * When the function returns `false`, event propagation will stop.
 *
 * @typedef {function((Event|import("./events/Event").default)): (void|boolean)} ListenerFunction
 * @api
 */

/**
 * @typedef {Object} ListenerObject
 * @property {ListenerFunction} handleEvent HandleEvent listener function.
 */

/**
 * @typedef {ListenerFunction|ListenerObject} Listener
 */

/**
 * Registers an event listener on an event target. Inspired by
 * https://google.github.io/closure-library/api/source/closure/goog/events/events.src.html
 *
 * This function efficiently binds a `listener` to a `this` object, and returns
 * a key for use with {@link module:tl/events.unlistenByKey}.
 *
 * @param {import("./events/Target").EventTargetLike} target Event target.
 * @param {string} type Event type.
 * @param {ListenerFunction} listener Listener.
 * @param {Object} [thisArg] Object referenced by the `this` keyword in the
 *     listener. Default is the `target`.
 * @param {boolean} [once] If true, add the listener as one-off listener.
 * @return {EventsKey} Unique key for the listener.
 */
export function listen(target, type, listener, thisArg?, once: boolean = false): EventsKey {
  if (thisArg && thisArg !== target) {
    listener = listener.bind(thisArg);
  }
  if (once) {
    const originalListener = listener;
    listener = function () {
      target.removeEventListener(type, listener);
      originalListener.apply(this, arguments);
    };
  }
  const eventsKey = {
    target: target,
    type: type,
    listener: listener,
  };
  target.addEventListener(type, listener);
  return eventsKey;
}

/**
 * Registers a one-off event listener on an event target. Inspired by
 * https://google.github.io/closure-library/api/source/closure/goog/events/events.src.html
 *
 * This function efficiently binds a `listener` as self-unregistering listener
 * to a `this` object, and returns a key for use with
 * {@link module:tl/events.unlistenByKey} in case the listener needs to be
 * unregistered before it is called.
 *
 * When {@link module:tl/events.listen} is called with the same arguments after this
 * function, the self-unregistering listener will be turned into a permanent
 * listener.
 *
 * @param {import("./events/Target").EventTargetLike} target Event target.
 * @param {string} type Event type.
 * @param {ListenerFunction} listener Listener.
 * @param {Object} [thisArg] Object referenced by the `this` keyword in the
 *     listener. Default is the `target`.
 * @return {EventsKey} Key for unlistenByKey.
 */
export function listenOnce(target: EventTargetLike, type: string, listener: ListenerFunction, thisArg?: any): EventsKey {
  return listen(target, type, listener, thisArg, true);
}

/**
 * Unregisters event listeners on an event target. Inspired by
 * https://google.github.io/closure-library/api/source/closure/goog/events/events.src.html
 *
 * The argument passed to this function is the key returned from
 * {@link module:tl/events.listen} or {@link module:tl/events.listenOnce}.
 *
 * @param {EventsKey} key The key.
 */
export function unlistenByKey(key) {
  if (key && key.target) {
    key.target.removeEventListener(key.type, key.listener);
    clear(key);
  }
}
