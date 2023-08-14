/**
 * @module ol/format/filter/And
 */
import LogicalNary from './LogicalNary';
import Filter from "./Filter";

/**
 * @classdesc
 * Represents a logical `<And>` operator between two or more filter conditions.
 *
 * @abstract
 */
abstract class And extends LogicalNary {
  /**
   * @param {...import("./Filter").default} conditions Conditions.
   */
  protected constructor(conditions: Filter[] = []) {
    super('And', conditions);
    //super('And', Array.prototype.slice.call(arguments));
  }
}

export default And;
