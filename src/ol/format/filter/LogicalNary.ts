/**
 * @module ol/format/filter/LogicalNary
 */
import Filter from './Filter';
import {assert} from '../../asserts';

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Base class for WFS GetFeature n-ary logical filters.
 *
 * @abstract
 */
abstract class LogicalNary extends Filter {
  /**
   * @param {!string} tagName The XML tag name for this filter.
   * @param {Array<import("./Filter").default>} conditions Conditions.
   */

  public conditions: Filter[];

  protected constructor(tagName: string, conditions: Filter[] = []) {
    super(tagName);

    /**
     * @type {Array<import("./Filter").default>}
     */
    this.conditions = conditions;
    assert(this.conditions.length >= 2, 57); // At least 2 conditions are required.
  }
}

export default LogicalNary;
