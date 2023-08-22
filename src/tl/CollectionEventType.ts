/**
 * @module tl/CollectionEventType
 */

/**
 * @enum {string}
 */
export enum CollectionEventType {
  /**
   * Triggered when an item is added to the collection.
   * @event module:tl/Collection.CollectionEvent#add
   * @api
   */
  ADD = 'add',
  /**
   * Triggered when an item is removed from the collection.
   * @event module:tl/Collection.CollectionEvent#remove
   * @api
   */
  REMOVE = 'remove',
}

export default CollectionEventType;