/**
 * @module tl/format/filter/EqualTo
 */
import ComparisonBinary from './ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsEqualTo>` comparison operator.
 * @api
 */
class EqualTo extends ComparisonBinary {
  /**
   * @param {!string} propertyName Name of the context property to compare.
   * @param {!(string|number)} expression The value to compare.
   * @param {boolean} [matchCase] Case-sensitive?
   */
  constructor(propertyName: string, expression: string | number, matchCase: boolean = false) {
    super('PropertyIsEqualTo', propertyName, expression, matchCase);
  }
}

export default EqualTo;
