/**
 * @module tl/ObjectEventType
 */

/**
 * @enum {string}
 */
export enum ObjectEventType {
  /**
   * Triggered when a property is changed.
   * @event module:tl/Object.ObjectEvent#propertychange
   * @api
   */
  PROPERTYCHANGE = 'propertychange',
}

export default ObjectEventType;

export type Types = 'propertychange';
