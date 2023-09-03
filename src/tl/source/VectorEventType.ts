/**
 * @module tl/source/VectorEventType
 */

/**
 * @enum {string}
 */
export enum VectorEventType {
  /**
   * Triggered when a feature is added to the source.
   * @event module:tl/source/Vector.VectorSourceEvent#addfeature
   * @api
   */
  ADDFEATURE = 'addfeature',

  /**
   * Triggered when a feature is updated.
   * @event module:tl/source/Vector.VectorSourceEvent#changefeature
   * @api
   */
  CHANGEFEATURE = 'changefeature',

  /**
   * Triggered when the clear method is called on the source.
   * @event module:tl/source/Vector.VectorSourceEvent#clear
   * @api
   */
  CLEAR = 'clear',

  /**
   * Triggered when a feature is removed from the source.
   * See {@link module:tl/source/Vector~VectorSource#clear source.clear()} for exceptions.
   * @event module:tl/source/Vector.VectorSourceEvent#removefeature
   * @api
   */
  REMOVEFEATURE = 'removefeature',

  /**
   * Triggered when features starts loading.
   * @event module:tl/source/Vector.VectorSourceEvent#featuresloadstart
   * @api
   */
  FEATURESLOADSTART = 'featuresloadstart',

  /**
   * Triggered when features finishes loading.
   * @event module:tl/source/Vector.VectorSourceEvent#featuresloadend
   * @api
   */
  FEATURESLOADEND = 'featuresloadend',

  /**
   * Triggered if feature loading results in an error.
   * @event module:tl/source/Vector.VectorSourceEvent#featuresloaderror
   * @api
   */
  FEATURESLOADERROR = 'featuresloaderror',
}

export type VectorSourceEventTypes =
    'addfeature'
    | 'changefeature'
    | 'clear'
    | 'removefeature'
    | 'featuresloadstart'
    | 'featuresloadend'
    | 'featuresloaderror';

export default VectorEventType;