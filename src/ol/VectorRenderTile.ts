/**
 * @module ol/VectorRenderTile
 */
import Tile from './Tile';
import {createCanvasContext2D, releaseCanvas} from './dom';
import {getUid} from './util';
import {RenderOrderFunction} from "./render";
import {TileCoord} from "./tilecoord";
import TileState from "./TileState";
import {VectorTile} from "./index";
import ExecutorGroup from "./render/canvas/ExecutorGroup";
import Layer from "./layer/Layer";

export interface ReplayState {
  dirty: boolean;
  renderedRenderOrder: null | RenderOrderFunction;
  renderedTileRevision: number;
  renderedResolution: number;
  renderedRevision: number;
  renderedTileResolution: number;
  renderedTileZ: number;
}

/**
 * @type {Array<HTMLCanvasElement>}
 */
const canvasPool: HTMLCanvasElement[] = [];

export type GetSourceTileFunction = (tile: VectorRenderTile) => Array<VectorTile>;

class VectorRenderTile extends Tile {
  private context_: {[key: string]: CanvasRenderingContext2D};
  private replayState_: {[key: string]: ReplayState};
  
  public executorGroups: {[key: string]: ExecutorGroup[]};
  public declutterExecutorGroups: {[key: string]: ExecutorGroup[]};
  public loadingSourceTiles: number;
  public hitDetectionImageData: { [key: number]: ImageData };
  public sourceTiles: VectorTile[];
  public errorTileKeys: {[key: string]: boolean};
  public wantedResolution: number;
  public getSourceTiles: () => VectorTile[];
  public wrappedTileCoord: TileCoord;


  /**
   * @param {import("./tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {import("./TileState").default} state SourceState.
   * @param {import("./tilecoord").TileCoord} urlTileCoord Wrapped tile coordinate for source urls.
   * @param {function(VectorRenderTile):Array<import("./VectorTile").default>} getSourceTiles Function
   * to get source tiles for this tile.
   */
  constructor(tileCoord: TileCoord, state: TileState, urlTileCoord: TileCoord, getSourceTiles: GetSourceTileFunction) {
    super(tileCoord, state, {transition: 0});

    /**
     * @private
     * @type {!Object<string, CanvasRenderingContext2D>}
     */
    this.context_ = {};

    /**
     * Executor groups by layer uid. Entries are read/written by the renderer.
     * @type {Object<string, Array<import("./render/canvas/ExecutorGroup").default>>}
     */
    this.executorGroups = {};

    /**
     * Executor groups for decluttering, by layer uid. Entries are read/written by the renderer.
     * @type {Object<string, Array<import("./render/canvas/ExecutorGroup").default>>}
     */
    this.declutterExecutorGroups = {};

    /**
     * Number of loading source tiles. Read/written by the source.
     * @type {number}
     */
    this.loadingSourceTiles = 0;

    /**
     * @type {Object<number, ImageData>}
     */
    this.hitDetectionImageData = {};

    /**
     * @private
     * @type {!Object<string, ReplayState>}
     */
    this.replayState_ = {};

    /**
     * @type {Array<import("./VectorTile").default>}
     */
    this.sourceTiles = [];

    /**
     * @type {Object<string, boolean>}
     */
    this.errorTileKeys = {};

    /**
     * @type {number}
     */
    this.wantedResolution = null;

    /**
     * @type {!function():Array<import("./VectorTile").default>}
     */
    this.getSourceTiles = getSourceTiles.bind(undefined, this);

    /**
     * @type {import("./tilecoord").TileCoord}
     */
    this.wrappedTileCoord = urlTileCoord;
  }

  /**
   * @param {import("./layer/Layer").default} layer Layer.
   * @return {CanvasRenderingContext2D} The rendering context.
   */
  public getContext(layer: Layer): CanvasRenderingContext2D {
    const key = getUid(layer);
    if (!(key in this.context_)) {
      this.context_[key] = <CanvasRenderingContext2D>createCanvasContext2D(1, 1, canvasPool);
    }
    return this.context_[key];
  }

  /**
   * @param {import("./layer/Layer").default} layer Layer.
   * @return {boolean} Tile has a rendering context for the given layer.
   */
  public hasContext(layer: Layer): boolean {
    return getUid(layer) in this.context_;
  }

  /**
   * Get the Canvas for this tile.
   * @param {import("./layer/Layer").default} layer Layer.
   * @return {HTMLCanvasElement} Canvas.
   */
  public getImage(layer: Layer): HTMLCanvasElement {
    return this.hasContext(layer) ? this.getContext(layer).canvas : null;
  }

  /**
   * @param {import("./layer/Layer").default} layer Layer.
   * @return {ReplayState} The replay state.
   */
  public getReplayState(layer: Layer): ReplayState {
    const key = getUid(layer);
    if (!(key in this.replayState_)) {
      this.replayState_[key] = {
        dirty: false,
        renderedRenderOrder: null,
        renderedResolution: NaN,
        renderedRevision: -1,
        renderedTileResolution: NaN,
        renderedTileRevision: -1,
        renderedTileZ: -1,
      };
    }
    return this.replayState_[key];
  }

  /**
   * Load the tile.
   */
  public load(): void {
    this.getSourceTiles();
  }

  /**
   * Remove from the cache due to expiry
   */
  public release(): void {
    for (const key in this.context_) {
      const context = this.context_[key];
      releaseCanvas(context);
      canvasPool.push(context.canvas);
      delete this.context_[key];
    }
    super.release();
  }
}

export default VectorRenderTile;
