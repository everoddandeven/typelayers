/**
 * @module tl/webgl/BaseTileRepresentation
 */

import EventTarget from '../events/Target';
import EventType from '../events/EventType';
import ImageTile from '../ImageTile';
import TileState from '../TileState';
import Tile from "../Tile";
import Helper from "./Helper";

type BaseTileType = Tile;

interface TileRepresentationOptions {
  tile: BaseTileType;
  grid: import("../tilegrid/TileGrid").default;
  helper: import("./Helper").default;
  gutter?: number;
}

/**
 * @classdesc
 * Base class for representing a tile in a webgl context
 * @template {import("../Tile").default} TileType
 * @abstract
 */
abstract class BaseTileRepresentation extends EventTarget {
  /**
   * @param {TileRepresentationOptions<TileType>} options The tile representation options.
   */

  public tile: BaseTileType;

  protected gutter_: number;
  protected helper_: Helper;

  public loaded: boolean;
  public ready: boolean;

  protected constructor(options?: TileRepresentationOptions) {
    super();

    /**
     * @type {TileType}
     */
    this.tile;
    this.handleTileChange_ = this.handleTileChange_.bind(this);

    /**
     * @type {number}
     * @protected
     */
    this.gutter_ = options.gutter || 0;

    /**
     * @type {import("./Helper").default}
     * @protected
     */
    this.helper_ = options.helper;

    this.loaded = false;
    this.ready = false;
  }

  /**
   * @param {TileType} tile Tile.
   */
  public setTile(tile: BaseTileType): void {
    if (tile !== this.tile) {
      if (this.tile) {
        this.tile.removeEventListener(EventType.CHANGE, this.handleTileChange_);
      }
      this.tile = tile;
      this.loaded = tile.getState() === TileState.LOADED;
      if (this.loaded) {
        this.uploadTile();
      } else {
        if (tile instanceof ImageTile) {
          const image = tile.getImage();
          if (image instanceof Image && !image.crossOrigin) {
            image.crossOrigin = 'anonymous';
          }
        }
        tile.addEventListener(EventType.CHANGE, this.handleTileChange_);
      }
    }
  }

  /**
   * @abstract
   * @protected
   */
  protected abstract uploadTile(): void;

  public setReady(): void {
    this.ready = true;
    this.dispatchEvent(EventType.CHANGE);
  }

  private handleTileChange_(): void {
    if (this.tile.getState() === TileState.LOADED) {
      this.loaded = true;
      this.uploadTile();
    }
  }

  protected disposeInternal(): void {
    this.tile.removeEventListener(EventType.CHANGE, this.handleTileChange_);
  }
}

export default BaseTileRepresentation;
