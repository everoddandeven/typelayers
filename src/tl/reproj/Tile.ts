/**
 * @module tl/reproj/Tile
 */
import {ERROR_THRESHOLD} from './common';

import EventType from '../events/EventType';
import Tile from '../Tile';
import TileState from '../TileState';
import Triangulation from './Triangulation';
import {
  calculateSourceExtentResolution,
  canvasPool,
  render as renderReprojected,
} from '../reproj';
import {clamp} from '../math';
import {getArea, getIntersection} from '../extent';
import {EventsKey, listen, unlistenByKey} from '../events';
import {releaseCanvas} from '../dom';
import ImageTile from "../ImageTile";
import Projection from "../proj/Projection";
import TileGrid from "../tilegrid/TileGrid";
import {TileCoord} from "../tilecoord";

/**
 * @typedef {function(number, number, number, number) : (import("../ImageTile").default)} FunctionType
 */

export type TileFunctionType = (a: number, b: number, c: number, d: number) => ImageTile;

/**
 * @classdesc
 * Class encapsulating single reprojected tile.
 * See {@link module:tl/source/TileImage~TileImageSource}.
 *
 */
class ReprojTile extends Tile {
  /**
   * @param {import("../proj/Projection").default} sourceProj Source projection.
   * @param {import("../tilegrid/TileGrid").default} sourceTileGrid Source tile grid.
   * @param {import("../proj/Projection").default} targetProj Target projection.
   * @param {import("../tilegrid/TileGrid").default} targetTileGrid Target tile grid.
   * @param {import("../tilecoord").TileCoord} tileCoord Coordinate of the tile.
   * @param {import("../tilecoord").TileCoord} wrappedTileCoord Coordinate of the tile wrapped in X.
   * @param {number} pixelRatio Pixel ratio.
   * @param {number} gutter Gutter of the source tiles.
   * @param {FunctionType} getTileFunction
   *     Function returning source tiles (z, x, y, pixelRatio).
   * @param {number} [errorThreshold] Acceptable reprojection error (in px).
   * @param {boolean} [renderEdges] Render reprojection edges.
   * @param {boolean} [interpolate] Use linear interpolation when resampling.
   */

  private renderEdges_: boolean;
  private pixelRatio_: number;
  private gutter_: number;
  private canvas_: HTMLCanvasElement;
  private sourceTileGrid_: TileGrid;
  private targetTileGrid_: TileGrid;
  private wrappedTileCoord_: TileCoord;
  private sourceTiles_: ImageTile[];
  private sourcesListenerKeys_: EventsKey[];
  private sourceZ_: number;
  private triangulation_: Triangulation;

  constructor(
    sourceProj: Projection,
    sourceTileGrid: TileGrid,
    targetProj: Projection,
    targetTileGrid: TileGrid,
    tileCoord: TileCoord,
    wrappedTileCoord: TileCoord,
    pixelRatio: number,
    gutter: number,
    getTileFunction: TileFunctionType,
    errorThreshold?: number,
    renderEdges?: boolean,
    interpolate?: boolean
  ) {
    super(tileCoord, TileState.IDLE, {interpolate: !!interpolate});

    /**
     * @private
     * @type {boolean}
     */
    this.renderEdges_ = renderEdges !== undefined ? renderEdges : false;

    /**
     * @private
     * @type {number}
     */
    this.pixelRatio_ = pixelRatio;

    /**
     * @private
     * @type {number}
     */
    this.gutter_ = gutter;

    /**
     * @private
     * @type {HTMLCanvasElement}
     */
    this.canvas_ = null;

    /**
     * @private
     * @type {import("../tilegrid/TileGrid").default}
     */
    this.sourceTileGrid_ = sourceTileGrid;

    /**
     * @private
     * @type {import("../tilegrid/TileGrid").default}
     */
    this.targetTileGrid_ = targetTileGrid;

    /**
     * @private
     * @type {import("../tilecoord").TileCoord}
     */
    this.wrappedTileCoord_ = wrappedTileCoord ? wrappedTileCoord : tileCoord;

    /**
     * @private
     * @type {!Array<import("../ImageTile").default>}
     */
    this.sourceTiles_ = [];

    /**
     * @private
     * @type {?Array<import("../events").EventsKey>}
     */
    this.sourcesListenerKeys_ = null;

    /**
     * @private
     * @type {number}
     */
    this.sourceZ_ = 0;

    const targetExtent = targetTileGrid.getTileCoordExtent(
      this.wrappedTileCoord_
    );
    const maxTargetExtent = this.targetTileGrid_.getExtent();
    let maxSourceExtent = this.sourceTileGrid_.getExtent();

    const limitedTargetExtent = maxTargetExtent
      ? getIntersection(targetExtent, maxTargetExtent)
      : targetExtent;

    if (getArea(limitedTargetExtent) === 0) {
      // Tile is completely outside range -> EMPTY
      // TODO: is it actually correct that the source even creates the tile ?
      this.state = TileState.EMPTY;
      return;
    }

    const sourceProjExtent = sourceProj.getExtent();
    if (sourceProjExtent) {
      if (!maxSourceExtent) {
        maxSourceExtent = sourceProjExtent;
      } else {
        maxSourceExtent = getIntersection(maxSourceExtent, sourceProjExtent);
      }
    }

    const targetResolution = targetTileGrid.getResolution(
      this.wrappedTileCoord_[0]
    );

    const sourceResolution = calculateSourceExtentResolution(
      sourceProj,
      targetProj,
      limitedTargetExtent,
      targetResolution
    );

    if (!isFinite(sourceResolution) || sourceResolution <= 0) {
      // invalid sourceResolution -> EMPTY
      // probably edges of the projections when no extent is defined
      this.state = TileState.EMPTY;
      return;
    }

    const errorThresholdInPixels =
      errorThreshold !== undefined ? errorThreshold : ERROR_THRESHOLD;

    /**
     * @private
     * @type {!import("./Triangulation").default}
     */
    this.triangulation_ = new Triangulation(
      sourceProj,
      targetProj,
      limitedTargetExtent,
      maxSourceExtent,
      sourceResolution * errorThresholdInPixels,
      targetResolution
    );

    if (this.triangulation_.getTriangles().length === 0) {
      // no valid triangles -> EMPTY
      this.state = TileState.EMPTY;
      return;
    }

    this.sourceZ_ = sourceTileGrid.getZForResolution(sourceResolution);
    let sourceExtent = this.triangulation_.calculateSourceExtent();

    if (maxSourceExtent) {
      if (sourceProj.canWrapX()) {
        sourceExtent[1] = clamp(
          sourceExtent[1],
          maxSourceExtent[1],
          maxSourceExtent[3]
        );
        sourceExtent[3] = clamp(
          sourceExtent[3],
          maxSourceExtent[1],
          maxSourceExtent[3]
        );
      } else {
        sourceExtent = getIntersection(sourceExtent, maxSourceExtent);
      }
    }

    if (!getArea(sourceExtent)) {
      this.state = TileState.EMPTY;
    } else {
      const sourceRange = sourceTileGrid.getTileRangeForExtentAndZ(
        sourceExtent,
        this.sourceZ_
      );

      for (let srcX = sourceRange.minX; srcX <= sourceRange.maxX; srcX++) {
        for (let srcY = sourceRange.minY; srcY <= sourceRange.maxY; srcY++) {
          const tile = getTileFunction(this.sourceZ_, srcX, srcY, pixelRatio);
          if (tile) {
            this.sourceTiles_.push(tile);
          }
        }
      }

      if (this.sourceTiles_.length === 0) {
        this.state = TileState.EMPTY;
      }
    }
  }

  /**
   * Get the HTML Canvas element for this tile.
   * @return {HTMLCanvasElement} Canvas.
   */
  public getImage(): HTMLCanvasElement {
    return this.canvas_;
  }

  /**
   * @private
   */
  private reproject_(): void {
    const sources = [];
    this.sourceTiles_.forEach((tile) => {
      if (tile && tile.getState() == TileState.LOADED) {
        sources.push({
          extent: this.sourceTileGrid_.getTileCoordExtent(tile.tileCoord),
          image: tile.getImage(),
        });
      }
    });
    this.sourceTiles_.length = 0;

    if (sources.length === 0) {
      this.state = TileState.ERROR;
    } else {
      const z = this.wrappedTileCoord_[0];
      const size = this.targetTileGrid_.getTileSize(z);
      const width = typeof size === 'number' ? size : size[0];
      const height = typeof size === 'number' ? size : size[1];
      const targetResolution = this.targetTileGrid_.getResolution(z);
      const sourceResolution = this.sourceTileGrid_.getResolution(
        this.sourceZ_
      );

      const targetExtent = this.targetTileGrid_.getTileCoordExtent(
        this.wrappedTileCoord_
      );

      this.canvas_ = <HTMLCanvasElement>renderReprojected(
        width,
        height,
        this.pixelRatio_,
        sourceResolution,
        this.sourceTileGrid_.getExtent(),
        targetResolution,
        targetExtent,
        this.triangulation_,
        sources,
        this.gutter_,
        this.renderEdges_,
        this.interpolate
      );

      this.state = TileState.LOADED;
    }
    this.changed();
  }

  /**
   * Load not yet loaded URI.
   */
  public load(): void {
    if (this.state == TileState.IDLE) {
      this.state = TileState.LOADING;
      this.changed();

      let leftToLoad = 0;

      this.sourcesListenerKeys_ = [];
      this.sourceTiles_.forEach((tile) => {
        const state = tile.getState();
        if (state == TileState.IDLE || state == TileState.LOADING) {
          leftToLoad++;

          const sourceListenKey = listen(
            tile,
            EventType.CHANGE,
            function (e) {
              const state = tile.getState();
              if (
                state == TileState.LOADED ||
                state == TileState.ERROR ||
                state == TileState.EMPTY
              ) {
                unlistenByKey(sourceListenKey);
                leftToLoad--;
                if (leftToLoad === 0) {
                  this.unlistenSources_();
                  this.reproject_();
                }
              }
            },
            this
          );
          this.sourcesListenerKeys_.push(sourceListenKey);
        }
      });

      if (leftToLoad === 0) {
        setTimeout(this.reproject_.bind(this), 0);
      } else {
        this.sourceTiles_.forEach(function (tile, i, arr) {
          const state = tile.getState();
          if (state == TileState.IDLE) {
            tile.load();
          }
        });
      }
    }
  }

  /**
   * @private
   */
  private unlistenSources_(): void {
    this.sourcesListenerKeys_.forEach(unlistenByKey);
    this.sourcesListenerKeys_ = null;
  }

  /**
   * Remove from the cache due to expiry
   */
  public release(): void {
    if (this.canvas_) {
      releaseCanvas(this.canvas_.getContext('2d'));
      canvasPool.push(this.canvas_);
      this.canvas_ = null;
    }
    super.release();
  }
}

export default ReprojTile;
