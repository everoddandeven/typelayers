/**
 * @module ol/Collection
 */
import AssertionError from './AssertionError';
import BaseObject from './Object';
import CollectionEventType from './CollectionEventType';
import Event from './events/Event';
import {CombinedOnSignature, EventTypes, OnSignature} from "./Observable";
import BaseEvent from "./events/Event";
import ObjectEventType from "./ObjectEventType";
import {EventsKey} from "./events";

/**
 * @enum {string}
 * @private
 */
enum Property {
  LENGTH = 'length',
}

/**
 * @classdesc
 * Events emitted by {@link module:ol/Collection~Collection} instances are instances of this
 * type.
 * @template T
 */
export class CollectionEvent<T> extends Event {
  /**
   * @param {import("./CollectionEventType").default} type Type.
   * @param {T} element Element.
   * @param {number} index The index of the added or removed element.
   */

  public element: T;
  public index: number;

  constructor(type: CollectionEventType, element: T, index: number) {
    super(type);

    /**
     * The element that is added to or removed from the collection.
     * @type {T}
     * @api
     */
    this.element = element;

    /**
     * The index of the added or removed element.
     * @type {number}
     * @api
     */
    this.index = index;
  }
}

export type CollectionOnSignature<T, Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<'add' | 'remove', CollectionEvent<T>, Return> &
    CombinedOnSignature<EventTypes | ObjectEventType | 'change:length' | 'add' | 'remove', Return>;

interface CollectionOptions {
  unique?: boolean;
}

/**
 * @classdesc
 * An expanded version of standard JS Array, adding convenience methods for
 * manipulation. Add and remove changes to the Collection trigger a Collection
 * event. Note that this does not cover changes to the objects _within_ the
 * Collection; they trigger events on the appropriate object, not on the
 * Collection as a whole.
 *
 * @fires CollectionEvent
 *
 * @template T
 * @api
 */
class Collection<T> extends BaseObject {
  /**
   * @param {Array<T>} [array] Array.
   * @param {Options} [options] Collection options.
   */

  public on: CollectionOnSignature<T, EventsKey>;
  public once: CollectionOnSignature<T, EventsKey>;
  public un: CollectionOnSignature<T, void>;
  private unique_: boolean;
  private array_: T[];


  constructor(array: T[] = [], options?: CollectionOptions) {
    super();

    options = options || {};

    /**
     * @private
     * @type {boolean}
     */
    this.unique_ = !!options.unique;

    /**
     * @private
     * @type {!Array<T>}
     */
    this.array_ = array ? array : [];

    if (this.unique_) {
      for (let i = 0, ii = this.array_.length; i < ii; ++i) {
        this.assertUnique_(this.array_[i], i);
      }
    }

    this.updateLength_();
  }

  /**
   * Remove all elements from the collection.
   * @api
   */
  public clear(): void {
    while (this.getLength() > 0) {
      this.pop();
    }
  }

  /**
   * Add elements to the collection.  This pushes each item in the provided array
   * to the end of the collection.
   * @param {!Array<T>} arr Array.
   * @return {Collection<T>} This collection.
   * @api
   */
  public extend(arr: T[]): Collection<T> {
    for (let i = 0, ii = arr.length; i < ii; ++i) {
      this.push(arr[i]);
    }
    return this;
  }

  /**
   * Iterate over each element, calling the provided callback.
   * @param {function(T, number, Array<T>): *} f The function to call
   *     for every element. This function takes 3 arguments (the element, the
   *     index and the array). The return value is ignored.
   * @api
   */
  public forEach(f: (elem: T, index: number, array: T[]) => void): void {
    const array = this.array_;
    for (let i = 0, ii = array.length; i < ii; ++i) {
      f(array[i], i, array);
    }
  }

  /**
   * Get a reference to the underlying Array object. Warning: if the array
   * is mutated, no events will be dispatched by the collection, and the
   * collection's "length" property won't be in sync with the actual length
   * of the array.
   * @return {!Array<T>} Array.
   * @api
   */
  public getArray(): T[] {
    return this.array_;
  }

  /**
   * Get the element at the provided index.
   * @param {number} index Index.
   * @return {T} Element.
   * @api
   */
  public item(index: number): T {
    return this.array_[index];
  }

  /**
   * Get the length of this collection.
   * @return {number} The length of the array.
   * @observable
   * @api
   */
  public getLength(): number {
    return this.get(Property.LENGTH);
  }

  /**
   * Insert an element at the provided index.
   * @param {number} index Index.
   * @param {T} elem Element.
   * @api
   */
  public insertAt(index: number, elem: T): void {
    if (index < 0 || index > this.getLength()) {
      throw new Error('Index out of bounds: ' + index);
    }
    if (this.unique_) {
      this.assertUnique_(elem);
    }
    this.array_.splice(index, 0, elem);
    this.updateLength_();
    this.dispatchEvent(
      new CollectionEvent(CollectionEventType.ADD, elem, index)
    );
  }

  /**
   * Remove the last element of the collection and return it.
   * Return `undefined` if the collection is empty.
   * @return {T|undefined} Element.
   * @api
   */
  public pop(): T | undefined {
    return this.removeAt(this.getLength() - 1);
  }

  /**
   * Insert the provided element at the end of the collection.
   * @param {T} elem Element.
   * @return {number} New length of the collection.
   * @api
   */
  public push(elem: T): number {
    if (this.unique_) {
      this.assertUnique_(elem);
    }
    const n = this.getLength();
    this.insertAt(n, elem);
    return this.getLength();
  }

  /**
   * Remove the first occurrence of an element from the collection.
   * @param {T} elem Element.
   * @return {T|undefined} The removed element or undefined if none found.
   * @api
   */
  public remove(elem: T): T | undefined {
    const arr = this.array_;
    for (let i = 0, ii = arr.length; i < ii; ++i) {
      if (arr[i] === elem) {
        return this.removeAt(i);
      }
    }
    return undefined;
  }

  /**
   * Remove the element at the provided index and return it.
   * Return `undefined` if the collection does not contain this index.
   * @param {number} index Index.
   * @return {T|undefined} Value.
   * @api
   */
  public removeAt(index: number): T | undefined {
    if (index < 0 || index >= this.getLength()) {
      return undefined;
    }
    const prev = this.array_[index];
    this.array_.splice(index, 1);
    this.updateLength_();
    this.dispatchEvent(
        new CollectionEvent<T>(CollectionEventType.REMOVE, prev, index)
    );
    return prev;
  }

  /**
   * Set the element at the provided index.
   * @param {number} index Index.
   * @param {T} elem Element.
   * @api
   */
  public setAt(index: number, elem: T): void {
    const n = this.getLength();
    if (index >= n) {
      this.insertAt(index, elem);
      return;
    }
    if (index < 0) {
      throw new Error('Index out of bounds: ' + index);
    }
    if (this.unique_) {
      this.assertUnique_(elem, index);
    }
    const prev = this.array_[index];
    this.array_[index] = elem;
    this.dispatchEvent(
        new CollectionEvent<T>(CollectionEventType.REMOVE, prev, index)
    );
    this.dispatchEvent(
        new CollectionEvent<T>(CollectionEventType.ADD, elem, index)
    );
  }

  /**
   * @private
   */
  private updateLength_(): void {
    this.set(Property.LENGTH, this.array_.length);
  }

  /**
   * @private
   * @param {T} elem Element.
   * @param {number} [except] Optional index to ignore.
   */
  private assertUnique_(elem: T, except?: number): void {
    for (let i = 0, ii = this.array_.length; i < ii; ++i) {
      if (this.array_[i] === elem && i !== except) {
        throw new AssertionError(58);
      }
    }
  }
}

export default Collection;
