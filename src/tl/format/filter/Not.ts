/**
 * @module tl/format/filter/Not
 */
import Filter from './Filter';

/**
 * @classdesc
 * Represents a logical `<Not>` operator for a filter condition.
 * @api
 */
class Not extends Filter {
  /**
   * @param {!import("./Filter").default} condition Filter condition.
   */

  public condition: Filter;

  constructor(condition: Filter) {
    super('Not');

    /**
     * @type {!import("./Filter").default}
     */
    this.condition = condition;
  }
}

export default Not;
