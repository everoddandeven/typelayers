/**
 * @module ol/format/filter/During
 */
import Comparison from './Comparison';

/**
 * @classdesc
 * Represents a `<During>` comparison operator.
 * @api
 */
class During extends Comparison {
  /**
   * @param {!string} propertyName Name of the context property to compare.
   * @param {!string} begin The begin date in ISO-8601 format.
   * @param {!string} end The end date in ISO-8601 format.
   */

  public begin: string;
  public end: string;

  constructor(propertyName: string, begin: string, end: string) {
    super('During', propertyName);

    /**
     * @type {!string}
     */
    this.begin = begin;

    /**
     * @type {!string}
     */
    this.end = end;
  }
}

export default During;
