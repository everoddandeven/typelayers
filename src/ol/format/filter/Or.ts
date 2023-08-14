/**
 * @module ol/format/filter/Or
 */
import LogicalNary from './LogicalNary';
import Filter from "./Filter";

/**
 * @classdesc
 * Represents a logical `<Or>` operator between two or more filter conditions.
 * @api
 */
class Or extends LogicalNary {
  /**
   * @param {...import("./Filter").default} conditions Conditions.
   */
  constructor(conditions: Filter) {
    super('Or', Array.prototype.slice.call(arguments));

    this.conditions = [conditions];
  }
}

export default Or;
