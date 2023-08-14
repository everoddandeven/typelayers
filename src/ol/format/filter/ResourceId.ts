/**
 * @module ol/format/filter/ResourceId
 */
import Filter from './Filter';

/**
 * @classdesc
 *
 * @abstract
 */
class ResourceId extends Filter {
  /**
   * @param {!string} rid Resource ID.
   */

  public rid: string;

  constructor(rid: string) {
    super('ResourceId');

    /**
     * @type {!string}
     */
    this.rid = rid;
  }
}

export default ResourceId;
