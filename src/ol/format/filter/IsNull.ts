/**
 * @module ol/format/filter/IsNull
 */
import Comparison from './Comparison';

/**
 * @classdesc
 * Represents a `<PropertyIsNull>` comparison operator.
 * @api
 */
class IsNull extends Comparison {
  /**
   * @param {!string} propertyName Name of the context property to compare.
   */
  constructor(propertyName: string) {
    super('PropertyIsNull', propertyName);
  }
}

export default IsNull;
