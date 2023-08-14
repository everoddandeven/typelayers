/**
 * @module ol/format/filter/LessThanOrEqualTo
 */
import ComparisonBinary from './ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsLessThanOrEqualTo>` comparison operator.
 * @api
 */
class LessThanOrEqualTo extends ComparisonBinary {
  /**
   * @param {!string} propertyName Name of the context property to compare.
   * @param {!number} expression The value to compare.
   */
  constructor(propertyName: string, expression: number) {
    super('PropertyIsLessThanOrEqualTo', propertyName, expression);
  }
}

export default LessThanOrEqualTo;
