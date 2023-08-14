/**
 * @module ol/TileState
 */

/**
 * @enum {number}
 */
export enum TileState {
  IDLE = 0,
  LOADING = 1,
  LOADED = 2,
  ERROR = 3,
  EMPTY = 4,
}

export default TileState;