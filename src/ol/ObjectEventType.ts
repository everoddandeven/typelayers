/**
 * @module ol/ObjectEventType
 */

/**
 * @enum {string}
 */
export enum ObjectEventType {
  /**
   * Triggered when a property is changed.
   * @event module:ol/Object.ObjectEvent#propertychange
   * @api
   */
  PROPERTYCHANGE = 'propertychange',
}

export default ObjectEventType;

export type Types = 'propertychange';
