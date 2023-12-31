/**
 * @module tl/format/filter/LessThan
 */
import ComparisonBinary from './ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsLessThan>` comparison operator.
 * @api
 */
class LessThan extends ComparisonBinary {
  /**
   * @param {!string} propertyName Name of the context property to compare.
   * @param {!number} expression The value to compare.
   */
  constructor(propertyName: string, expression: number) {
    super('PropertyIsLessThan', propertyName, expression);
  }
}

export default LessThan;
