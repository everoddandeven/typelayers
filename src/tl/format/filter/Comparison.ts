/**
 * @module tl/format/filter/Comparison
 */
import Filter from './Filter';

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Base class for WFS GetFeature property comparison filters.
 *
 * @abstract
 */
class Comparison extends Filter {
  /**
   * @param {!string} tagName The XML tag name for this filter.
   * @param {!string} propertyName Name of the context property to compare.
   */

  public propertyName: string;

  constructor(tagName: string, propertyName: string) {
    super(tagName);

    /**
     * @type {!string}
     */
    this.propertyName = propertyName;
  }
}

export default Comparison;
