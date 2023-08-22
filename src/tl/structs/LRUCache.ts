/**
 * @module tl/structs/LRUCache
 */

import {assert} from '../asserts';
import {Size} from "../size";

export interface Entry {
  key_: string;
  newer: Entry;
  older: Entry;
  value_: any;
}

/**
 * @classdesc
 * Implements a Least-Recently-Used cache where the keys do not conflict with
 * Object's properties (e.g. 'hasOwnProperty' is not allowed as a key). Expiring
 * items from the cache is the responsibility of the user.
 *
 * @fires import("../events/Event").default
 * @template T
 */
class LRUCache<T> {
  public highWaterMark: any;
  private count_: number;
  private entries_: { [key: string]: Entry };
  private oldest_: Entry;
  private newest_: Entry;
  /**
   * @param {number} [highWaterMark] High watermark.
   */
  constructor(highWaterMark?: number) {
    /**
     * Desired max cache size after expireCache(). If set to 0, no cache entries
     * will be pruned at all.
     * @type {number}
     */
    this.highWaterMark = highWaterMark !== undefined ? highWaterMark : 2048;

    /**
     * @private
     * @type {number}
     */
    this.count_ = 0;

    /**
     * @private
     * @type {!Object<string, Entry>}
     */
    this.entries_ = {};

    /**
     * @private
     * @type {?Entry}
     */
    this.oldest_ = null;

    /**
     * @private
     * @type {?Entry}
     */
    this.newest_ = null;
  }

  /**
   * @return {boolean} Can expire cache.
   */
  public canExpireCache(): boolean {
    return this.highWaterMark > 0 && this.getCount() > this.highWaterMark;
  }

  /**
   * Expire the cache.
   * @param {!Object<string, boolean>} [keep] Keys to keep. To be implemented by subclasses.
   */
  public expireCache(keep: { [key: string]: boolean } = {}) {
    while (this.canExpireCache()) {
      this.pop();
    }
  }

  /**
   * FIXME empty description for jsdoc
   */
  public clear(): void {
    this.count_ = 0;
    this.entries_ = {};
    this.oldest_ = null;
    this.newest_ = null;
  }

  /**
   * @param {string} key Key.
   * @return {boolean} Contains key.
   */
  public containsKey(key: string): boolean {
    return this.entries_.hasOwnProperty(key);
  }

  /**
   * @param {function(T, string, LRUCache<T>): ?} f The function
   *     to call for every entry from the oldest to the newer. This function takes
   *     3 arguments (the entry value, the entry key and the LRUCache object).
   *     The return value is ignored.
   */
  public forEach(f: (value: T, key: string, cache: LRUCache<T>) => void) {
    let entry = this.oldest_;
    while (entry) {
      f(entry.value_, entry.key_, this);
      entry = entry.newer;
    }
  }

  /**
   * @param {string} key Key.
   * @param {*} [options] Options (reserved for subclasses).
   * @return {T} Value.
   */
  public get(key: string, options?: any): T {
    const entry = this.entries_[key];
    assert(entry !== undefined, 15); // Tried to get a value for a key that does not exist in the cache
    if (entry === this.newest_) {
      return entry.value_;
    }
    if (entry === this.oldest_) {
      this.oldest_ = /** @type {Entry} */ (this.oldest_.newer);
      this.oldest_.older = null;
    } else {
      entry.newer.older = entry.older;
      entry.older.newer = entry.newer;
    }
    entry.newer = null;
    entry.older = this.newest_;
    this.newest_.newer = entry;
    this.newest_ = entry;
    return entry.value_;
  }

  /**
   * Remove an entry from the cache.
   * @param {string} key The entry key.
   * @return {T} The removed entry.
   */
  public remove(key: string): T {
    const entry = this.entries_[key];
    assert(entry !== undefined, 15); // Tried to get a value for a key that does not exist in the cache
    if (entry === this.newest_) {
      this.newest_ = /** @type {Entry} */ (entry.older);
      if (this.newest_) {
        this.newest_.newer = null;
      }
    } else if (entry === this.oldest_) {
      this.oldest_ = /** @type {Entry} */ (entry.newer);
      if (this.oldest_) {
        this.oldest_.older = null;
      }
    } else {
      entry.newer.older = entry.older;
      entry.older.newer = entry.newer;
    }
    delete this.entries_[key];
    --this.count_;
    return entry.value_;
  }

  /**
   * @return {number} Count.
   */
  public getCount(): number {
    return this.count_;
  }

  /**
   * @return {Array<string>} Keys.
   */
  public getKeys(): string[] {
    const keys = new Array(this.count_);
    let i = 0;
    let entry;
    for (entry = this.newest_; entry; entry = entry.older) {
      keys[i++] = entry.key_;
    }
    return keys;
  }

  /**
   * @return {Array<T>} Values.
   */
  public getValues(): T[] {
    const values = new Array(this.count_);
    let i = 0;
    let entry: Entry;
    for (entry = this.newest_; entry; entry = entry.older) {
      values[i++] = entry.value_;
    }
    return values;
  }

  /**
   * @return {T} Last value.
   */
  public peekLast(): T {
    return this.oldest_.value_;
  }

  /**
   * @return {string} Last key.
   */
  public peekLastKey(): string {
    return this.oldest_.key_;
  }

  /**
   * Get the key of the newest item in the cache.  Throws if the cache is empty.
   * @return {string} The newest key.
   */
  public peekFirstKey(): string {
    return this.newest_.key_;
  }

  /**
   * Return an entry without updating least recently used time.
   * @param {string} key Key.
   * @return {T} Value.
   */
  public peek(key: string): T {
    if (!this.containsKey(key)) {
      return undefined;
    }
    return this.entries_[key].value_;
  }

  /**
   * @return {T} value Value.
   */
  public pop(): T {
    const entry = this.oldest_;
    delete this.entries_[entry.key_];
    if (entry.newer) {
      entry.newer.older = null;
    }
    this.oldest_ = /** @type {Entry} */ (entry.newer);
    if (!this.oldest_) {
      this.newest_ = null;
    }
    --this.count_;
    return entry.value_;
  }

  /**
   * @param {string} key Key.
   * @param {T} value Value.
   */
  public replace(key: string, value: T): void {
    this.get(key); // update `newest_`
    this.entries_[key].value_ = value;
  }

  /**
   * @param {string} key Key.
   * @param {T} value Value.
   */
  public set(key: string, value: T): void {
    assert(!(key in this.entries_), 16); // Tried to set a value for a key that is used already
    const entry = {
      key_: key,
      newer: null,
      older: this.newest_,
      value_: value,
    };
    if (!this.newest_) {
      this.oldest_ = entry;
    } else {
      this.newest_.newer = entry;
    }
    this.newest_ = entry;
    this.entries_[key] = entry;
    ++this.count_;
  }

  /**
   * Set a maximum number of entries for the cache.
   * @param {number} size Cache size.
   * @api
   */
  setSize(size: Size): void {
    this.highWaterMark = size;
  }
}

export default LRUCache;
