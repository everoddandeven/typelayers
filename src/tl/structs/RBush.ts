/**
 * @module tl/structs/RBush
 */
import RBush_ from 'rbush';
import {createOrUpdate, equals, Extent} from '../extent';
import {getUid} from '../util';
import {isEmpty} from '../obj';

export interface Entry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  value?: Object;
}

/**
 * @classdesc
 * Wrapper around the RBush by Vladimir Agafonkin.
 * See https://github.com/mourner/rbush.
 *
 * @template T
 */
class RBush<T> {
  /**
   * @param {number} [maxEntries] Max entries.
   */
  private rbush_: any;
  private items_: {[key: string]: Entry};

  constructor(maxEntries?: number) {
    /**
     * @private
     */
    this.rbush_ = new RBush_(maxEntries);

    /**
     * A mapping between the objects added to this rbush wrapper
     * and the objects that are actually added to the internal rbush.
     * @private
     * @type {Object<string, Entry>}
     */
    this.items_ = {};
  }

  /**
   * Insert a value into the RBush.
   * @param {import("../extent").Extent} extent Extent.
   * @param {T} value Value.
   */
  public insert(extent: Extent, value: T): void {
    const item = <Entry>{
      minX: extent[0],
      minY: extent[1],
      maxX: extent[2],
      maxY: extent[3],
      value: value,
    };

    this.rbush_.insert(item);
    this.items_[getUid(value)] = item;
  }

  /**
   * Bulk-insert values into the RBush.
   * @param {Array<import("../extent").Extent>} extents Extents.
   * @param {Array<T>} values Values.
   */
  public load(extents: Extent[], values: T[]): void {
    const items = new Array(values.length);
    for (let i = 0, l = values.length; i < l; i++) {
      const extent = extents[i];
      const value = values[i];

      const item = <Entry>{
        minX: extent[0],
        minY: extent[1],
        maxX: extent[2],
        maxY: extent[3],
        value: value,
      };
      items[i] = item;
      this.items_[getUid(value)] = item;
    }
    this.rbush_.load(items);
  }

  /**
   * Remove a value from the RBush.
   * @param {T} value Value.
   * @return {boolean} Removed.
   */
  public remove(value: T): boolean {
    const uid = getUid(value);

    // get the object in which the value was wrapped when adding to the
    // internal rbush. then use that object to do the removal.
    const item = this.items_[uid];
    delete this.items_[uid];
    return this.rbush_.remove(item) !== null;
  }

  /**
   * Update the extent of a value in the RBush.
   * @param {import("../extent").Extent} extent Extent.
   * @param {T} value Value.
   */
  public update(extent: Extent, value: T): void {
    const item = this.items_[getUid(value)];
    const bbox: Extent = [item.minX, item.minY, item.maxX, item.maxY];
    if (!equals(bbox, extent)) {
      this.remove(value);
      this.insert(extent, value);
    }
  }

  /**
   * Return all values in the RBush.
   * @return {Array<T>} All.
   */
  public getAll(): T[] {
    const items = this.rbush_.all();
    return items.map(function (item: any) {
      return item.value;
    });
  }

  /**
   * Return all values in the given extent.
   * @param {import("../extent").Extent} extent Extent.
   * @return {Array<T>} All in extent.
   */
  public getInExtent(extent: Extent): T[] {

    const bbox = <Entry>{
      minX: extent[0],
      minY: extent[1],
      maxX: extent[2],
      maxY: extent[3],
    };
    const items = this.rbush_.search(bbox);
    return items.map(function (item: any) {
      return item.value;
    });
  }

  /**
   * Calls a callback function with each value in the tree.
   * If the callback returns a truthy value, this value is returned without
   * checking the rest of the tree.
   * @param {function(T): *} callback Callback.
   * @return {*} Callback return value.
   */
  public forEach(callback: (obj: T) => any): any {
    return this.forEach_(this.getAll(), callback);
  }

  /**
   * Calls a callback function with each value in the provided extent.
   * @param {import("../extent").Extent} extent Extent.
   * @param {function(T): *} callback Callback.
   * @return {*} Callback return value.
   */
  public forEachInExtent(extent: Extent, callback: (obj: T) => any): any {
    return this.forEach_(this.getInExtent(extent), callback);
  }

  /**
   * @param {Array<T>} values Values.
   * @param {function(T): *} callback Callback.
   * @private
   * @return {*} Callback return value.
   */
  private forEach_(values: T[], callback: (obj: T) => any): any {
    let result: any;
    for (let i = 0, l = values.length; i < l; i++) {
      result = callback(values[i]);
      if (result) {
        return result;
      }
    }
    return result;
  }

  /**
   * @return {boolean} Is empty.
   */
  public isEmpty(): boolean {
    return isEmpty(this.items_);
  }

  /**
   * Remove all values from the RBush.
   */
  public clear(): void {
    this.rbush_.clear();
    this.items_ = {};
  }

  /**
   * @param {import("../extent").Extent} [extent] Extent.
   * @return {import("../extent").Extent} Extent.
   */
  public getExtent(extent: Extent): Extent {
    const data = this.rbush_.toJSON();
    return createOrUpdate(data.minX, data.minY, data.maxX, data.maxY, extent);
  }

  /**
   * @param {RBush} rbush R-Tree.
   */
  public concat(rbush: RBush<T>): void {
    this.rbush_.load(rbush.rbush_.all());
    for (const i in rbush.items_) {
      this.items_[i] = rbush.items_[i];
    }
  }
}

export default RBush;
