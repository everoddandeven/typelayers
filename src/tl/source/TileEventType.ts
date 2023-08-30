/**
 * @module tl/source/TileEventType
 */

/**
 * @enum {string}
 */
export enum TileEventType {
  /**
   * Triggered when a tile starts loading.
   * @event module:tl/source/Tile.TileSourceEvent#tileloadstart
   * @api
   */
  TILELOADSTART= 'tileloadstart',

  /**
   * Triggered when a tile finishes loading, either when its data is loaded,
   * or when loading was aborted because the tile is no longer needed.
   * @event module:tl/source/Tile.TileSourceEvent#tileloadend
   * @api
   */
  TILELOADEND = 'tileloadend',

  /**
   * Triggered if tile loading results in an error. Note that this is not the
   * right place to re-fetch tiles. See {@link module:tl/ImageTile~ImageTile#load}
   * for details.
   * @event module:tl/source/Tile.TileSourceEvent#tileloaderror
   * @api
   */
  TILELOADERROR = 'tileloaderror',
}

export default TileEventType;

export type TileSourceEventTypes = 'tileloadstart' | 'tileloadend' | 'tileloaderror';
