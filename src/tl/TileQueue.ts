/**
 * @module tl/TileQueue
 */
import EventType from './events/EventType';
import PriorityQueue, {DROP} from './structs/PriorityQueue';
import TileState from './TileState';
import Tile from "./Tile";
import {Coordinate} from "./coordinate";
import BaseEvent from "./events/Event";
import {FrameState} from "./Map";

export type PriorityFunction = (tile: Tile, tileSourceKey :string, tileCenter: Coordinate, tileResolution: number) => number;

class TileQueue extends PriorityQueue {
  private boundHandleTileChange_: any;
  private tileChangeCallback_: () => void;
  private tilesLoading_: number;
  private tilesLoadingKeys_: { [key: string]: boolean };
  /**
   * @param {PriorityFunction} tilePriorityFunction Tile priority function.
   * @param {function(): ?} tileChangeCallback Function called on each tile change event.
   */
  constructor(tilePriorityFunction: PriorityFunction, tileChangeCallback: () => void) {
    super(
      /**
       * @param {Array} element Element.
       * @return {number} Priority.
       */
      function (element: any[]): number {
        return tilePriorityFunction.apply(null, element);
      },
      /**
       * @param {Array} element Element.
       * @return {string} Key.
       */
      function (element: any[]): string {
        return /** @type {import("./Tile").default} */ (element[0]).getKey();
      }
    );

    /** @private */
    this.boundHandleTileChange_ = this.handleTileChange.bind(this);

    /**
     * @private
     * @type {function(): ?}
     */
    this.tileChangeCallback_ = tileChangeCallback;

    /**
     * @private
     * @type {number}
     */
    this.tilesLoading_ = 0;

    /**
     * @private
     * @type {!Object<string,boolean>}
     */
    this.tilesLoadingKeys_ = {};
  }

  /**
   * @param {Array} element Element.
   * @return {boolean} The element was added to the queue.
   */
  public enqueue(element: any[]): boolean {
    const added = super.enqueue(element);
    if (added) {
      const tile = element[0];
      tile.addEventListener(EventType.CHANGE, this.boundHandleTileChange_);
    }
    return added;
  }

  /**
   * @return {number} Number of tiles loading.
   */
  public getTilesLoading(): number {
    return this.tilesLoading_;
  }

  /**
   * @param {import("./events/Event").default} event Event.
   * @protected
   */
  protected handleTileChange(event: BaseEvent): void {
    const tile = /** @type {import("./Tile").default} */ (event.target);
    const state = tile.getState();
    if (
      state === TileState.LOADED ||
      state === TileState.ERROR ||
      state === TileState.EMPTY
    ) {
      if (state !== TileState.ERROR) {
        tile.removeEventListener(EventType.CHANGE, this.boundHandleTileChange_);
      }
      const tileKey = tile.getKey();
      if (tileKey in this.tilesLoadingKeys_) {
        delete this.tilesLoadingKeys_[tileKey];
        --this.tilesLoading_;
      }
      this.tileChangeCallback_();
    }
  }

  /**
   * @param {number} maxTotalLoading Maximum number tiles to load simultaneously.
   * @param {number} maxNewLoads Maximum number of new tiles to load.
   */
  public loadMoreTiles(maxTotalLoading: number, maxNewLoads: number): void {
    let newLoads = 0;
    let state, tile, tileKey;
    while (
      this.tilesLoading_ < maxTotalLoading &&
      newLoads < maxNewLoads &&
      this.getCount() > 0
    ) {
      tile = /** @type {import("./Tile").default} */ (this.dequeue()[0]);
      tileKey = tile.getKey();
      state = tile.getState();
      if (state === TileState.IDLE && !(tileKey in this.tilesLoadingKeys_)) {
        this.tilesLoadingKeys_[tileKey] = true;
        ++this.tilesLoading_;
        ++newLoads;
        tile.load();
      }
    }
  }
}

export default TileQueue;

/**
 * @param {import('./Map').FrameState} frameState Frame state.
 * @param {import("./Tile").default} tile Tile.
 * @param {string} tileSourceKey Tile source key.
 * @param {import("./coordinate").Coordinate} tileCenter Tile center.
 * @param {number} tileResolution Tile resolution.
 * @return {number} Tile priority.
 */
export function getTilePriority(
  frameState: FrameState,
  tile: Tile,
  tileSourceKey: string,
  tileCenter: Coordinate,
  tileResolution: number
): number {
  // Filter out tiles at higher zoom levels than the current zoom level, or that
  // are outside the visible extent.
  if (!frameState || !(tileSourceKey in frameState.wantedTiles)) {
    return DROP;
  }
  if (!frameState.wantedTiles[tileSourceKey][tile.getKey()]) {
    return DROP;
  }
  // Prioritize the highest zoom level tiles closest to the focus.
  // Tiles at higher zoom levels are prioritized using Math.log(tileResolution).
  // Within a zoom level, tiles are prioritized by the distance in pixels between
  // the center of the tile and the center of the viewport.  The factor of 65536
  // means that the prioritization should behave as desired for tiles up to
  // 65536 * Math.log(2) = 45426 pixels from the focus.
  const center = frameState.viewState.center;
  const deltaX = tileCenter[0] - center[0];
  const deltaY = tileCenter[1] - center[1];
  return (
    65536 * Math.log(tileResolution) +
    Math.sqrt(deltaX * deltaX + deltaY * deltaY) / tileResolution
  );
}
