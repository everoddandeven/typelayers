/**
 * @module tl/MapEventType
 */

/**
 * @enum {string}
 */
export enum MapEventType {
  /**
   * Triggered after a map frame is rendered.
   * @event module =tl/MapEvent~MapEvent#postrender
   * @api
   */
  POSTRENDER = 'postrender',

  /**
   * Triggered when the map starts moving.
   * @event module =tl/MapEvent~MapEvent#movestart
   * @api
   */
  MOVESTART = 'movestart',

  /**
   * Triggered after the map is moved.
   * @event module =tl/MapEvent~MapEvent#moveend
   * @api
   */
  MOVEEND = 'moveend',

  /**
   * Triggered when loading of additional map data (tiles, images, features) starts.
   * @event module =tl/MapEvent~MapEvent#loadstart
   * @api
   */
  LOADSTART = 'loadstart',

  /**
   * Triggered when loading of additional map data has completed.
   * @event module =tl/MapEvent~MapEvent#loadend
   * @api
   */
  LOADEND = 'loadend',
};

export default MapEventType;

export type MapEventTypes = 'postrender' | 'movestart' | 'moveend' | 'loadstart' | 'loadend';
