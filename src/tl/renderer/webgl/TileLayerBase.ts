/**
 * @module tl/renderer/webgl/TileLayerBase
 */
import LRUCache from '../../structs/LRUCache';
import ReprojDataTile from '../../reproj/DataTile';
import ReprojTile from '../../reproj/Tile';
import TileRange from '../../TileRange';
import TileState from '../../TileState';
import WebGLLayerRenderer from './Layer';
import {abstract, getUid} from '../../util';
import {create as createMat4} from '../../vec/mat4';
import {
  createOrUpdate as createTileCoord,
  getKey as getTileCoordKey, TileCoord,
} from '../../tilecoord';
import {
  create as createTransform,
  reset as resetTransform,
  rotate as rotateTransform,
  scale as scaleTransform, Transform,
  translate as translateTransform,
} from '../../transform';
import {descending} from '../../array';
import {fromUserExtent} from '../../proj';
import {Extent, getIntersection, isEmpty} from '../../extent';
import {Size, toSize} from '../../size';
import BaseTileRepresentation from "../../webgl/BaseTileRepresentation";
import Tile from "../../Tile";
import {FrameState} from "../../Map";
import TileSource from "../../source/Tile";
import {UniformValue} from "../../webgl/Helper";
import BaseTileLayer from "../../layer/BaseTile";
import Projection from "../../proj/Projection";
import TileGrid from "../../tilegrid/TileGrid";
import {Coordinate} from "../../coordinate";

export const Uniforms = {
  TILE_TRANSFORM: 'u_tileTransform',
  TRANSITION_ALPHA: 'u_transitionAlpha',
  DEPTH: 'u_depth',
  RENDER_EXTENT: 'u_renderExtent', // intersection of layer, source, and view extent
  RESOLUTION: 'u_resolution',
  ZOOM: 'u_zoom',
  GLOBAL_ALPHA: 'u_globalAlpha',
  PROJECTION_MATRIX: 'u_projectionMatrix',
  SCREEN_TO_WORLD_MATRIX: 'u_screenToWorldMatrix',
};

/**
 * @type {Object<string, boolean>}
 */
const empty: {[key: string]: boolean} = {};

/**
 * Transform a zoom level into a depth value ranging from -1 to 1.
 * @param {number} z A zoom level.
 * @return {number} A depth value.
 */
function depthForZ(z: number): number {
  return 1 / (z + 2);
}

export type AbstractTileRepresentation = BaseTileRepresentation<Tile>;

export interface TileRepresentationLookup {
  tileIds: Set<string>;
  representationsByZ: {[key: number]: Set<AbstractTileRepresentation>};
}

/**
 * @return {TileRepresentationLookup} A new tile representation lookup.
 */
export function newTileRepresentationLookup(): TileRepresentationLookup {
  return {tileIds: new Set(), representationsByZ: {}};
}

/**
 * Check if a tile is already in the tile representation lookup.
 * @param {TileRepresentationLookup} tileRepresentationLookup Lookup of tile representations by zoom level.
 * @param {import("../../Tile").default} tile A tile.
 * @return {boolean} The tile is already in the lookup.
 */
function lookupHasTile(tileRepresentationLookup: TileRepresentationLookup, tile: Tile): boolean {
  return tileRepresentationLookup.tileIds.has(getUid(tile));
}

/**
 * Add a tile representation to the lookup.
 * @param {TileRepresentationLookup} tileRepresentationLookup Lookup of tile representations by zoom level.
 * @param {AbstractTileRepresentation} tileRepresentation A tile representation.
 * @param {number} z The zoom level.
 */
function addTileRepresentationToLookup(
  tileRepresentationLookup: TileRepresentationLookup,
  tileRepresentation: AbstractTileRepresentation,
  z: number
): void {
  const representationsByZ = tileRepresentationLookup.representationsByZ;
  if (!(z in representationsByZ)) {
    representationsByZ[z] = new Set();
  }
  representationsByZ[z].add(tileRepresentation);
  tileRepresentationLookup.tileIds.add(getUid(tileRepresentation.tile));
}

/**
 * @param {import("../../Map").FrameState} frameState Frame state.
 * @param {import("../../extent").Extent} extent The frame extent.
 * @return {import("../../extent").Extent} Frame extent intersected with layer extents.
 */
function getRenderExtent(frameState: FrameState, extent: Extent): Extent {
  const layerState = frameState.layerStatesArray[frameState.layerIndex];
  if (layerState.extent) {
    extent = getIntersection(
      extent,
      fromUserExtent(layerState.extent, frameState.viewState.projection)
    );
  }
  const source = /** @type {import("../../source/Tile").default} */ (
    <TileSource>layerState.layer.getRenderSource()
  );
  if (!source.getWrapX()) {
    const gridExtent = source
      .getTileGridForProjection(frameState.viewState.projection)
      .getExtent();
    if (gridExtent) {
      extent = getIntersection(extent, gridExtent);
    }
  }
  return extent;
}

export function getCacheKey(source: TileSource, tileCoord: TileCoord): string {
  return `${source.getKey()},${getTileCoordKey(tileCoord)}`;
}

export interface WebGLBaseTileLayerRendererOptions {
  uniforms?: {[key: string]: UniformValue};
  cacheSize?: number;
  postProcesses?: Array<import('./Layer').PostProcessesOptions>;
}

/**
 * @typedef {import("../../layer/BaseTile").default} BaseLayerType
 */

export type BaseLayerType = BaseTileLayer;

/**
 * @classdesc
 * Base WebGL renderer for tile layers.
 * @template {BaseLayerType} LayerType
 * @template {import("../../Tile").default} TileType
 * @template {import("../../webgl/BaseTileRepresentation").default<TileType>} TileRepresentation
 * @extends {WebGLLayerRenderer<LayerType>}
 */
abstract class WebGLBaseTileLayerRenderer<
    LayerType extends BaseLayerType = BaseLayerType,
    TileType extends Tile = Tile,
    TileRepresentation extends BaseTileRepresentation = BaseTileRepresentation
> extends WebGLLayerRenderer<LayerType> {
  public renderComplete: boolean;
  private tileTransform_: Transform;
  protected tempMat4: number[];
  private tempTileRange_: TileRange;
  private tempTileCoord_: TileCoord;
  private tempSize_: Size;
  protected tileRepresentationCache: LRUCache<any>;
  protected frameState: FrameState;
  private projection_: Projection;
  /**
   * @param {LayerType} tileLayer Tile layer.
   * @param {Options} options Options.
   */
  constructor(tileLayer: LayerType, options: WebGLBaseTileLayerRendererOptions) {
    super(tileLayer, {
      uniforms: options.uniforms,
      postProcesses: options.postProcesses,
    });

    /**
     * The last call to `renderFrame` was completed with all tiles loaded
     * @type {boolean}
     */
    this.renderComplete = false;

    /**
     * This transform converts representation coordinates to screen coordinates.
     * @type {import("../../transform").Transform}
     * @private
     */
    this.tileTransform_ = createTransform();

    /**
     * @type {Array<number>}
     * @protected
     */
    this.tempMat4 = createMat4();

    /**
     * @type {import("../../TileRange").default}
     * @private
     */
    this.tempTileRange_ = new TileRange(0, 0, 0, 0);

    /**
     * @type {import("../../tilecoord").TileCoord}
     * @private
     */
    this.tempTileCoord_ = createTileCoord(0, 0, 0);

    /**
     * @type {import("../../size").Size}
     * @private
     */
    this.tempSize_ = [0, 0];

    const cacheSize = options.cacheSize !== undefined ? options.cacheSize : 512;
    /**
     * @type {import("../../structs/LRUCache").default<TileRepresentation>}
     * @protected
     */
    this.tileRepresentationCache = new LRUCache(cacheSize);

    /**
     * @protected
     * @type {import("../../Map").FrameState|null}
     */
    this.frameState = null;

    /**
     * @private
     * @type {import("../../proj/Projection").default}
     */
    this.projection_ = undefined;
  }

  /**
   * @param {Options} options Options.
   */
  public reset(options: WebGLBaseTileLayerRendererOptions): void {
    super.reset({
      uniforms: options.uniforms,
    });
  }

  /**
   * @param {TileType} tile Tile.
   * @return {boolean} Tile is drawable.
   * @private
   */
  private isDrawableTile_(tile: TileType): boolean {
    const tileLayer = this.getLayer();
    const tileState = tile.getState();
    const useInterimTilesOnError = tileLayer.getUseInterimTilesOnError();
    return (
      tileState == TileState.LOADED ||
      tileState == TileState.EMPTY ||
      (tileState == TileState.ERROR && !useInterimTilesOnError)
    );
  }

  /**
   * Determine whether renderFrame should be called.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {boolean} Layer is ready to be rendered.
   */
  protected prepareFrameInternal(frameState: FrameState): boolean {
    if (!this.projection_) {
      this.projection_ = frameState.viewState.projection;
    } else if (frameState.viewState.projection !== this.projection_) {
      this.clearCache();
      this.projection_ = frameState.viewState.projection;
    }

    const layer = this.getLayer();
    const source = layer.getRenderSource();
    if (!source) {
      return false;
    }

    if (isEmpty(getRenderExtent(frameState, frameState.extent))) {
      return false;
    }
    return source.getState() === 'ready';
  }

  /**
   * @abstract
   * @param {import("../../webgl/BaseTileRepresentation").TileRepresentationOptions<TileType>} options tile representation options
   * @return {TileRepresentation} A new tile representation
   * @protected
   */
  protected abstract createTileRepresentation(options: BaseTileRepresentation<TileType>): TileRepresentation;

  /**
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @param {import("../../extent").Extent} extent The extent to be rendered.
   * @param {number} initialZ The zoom level.
   * @param {TileRepresentationLookup} tileRepresentationLookup The zoom level.
   * @param {number} preload Number of additional levels to load.
   */
  public enqueueTiles(
    frameState: FrameState,
    extent: Extent,
    initialZ: number,
    tileRepresentationLookup: TileRepresentationLookup,
    preload: number
  ): void {
    const viewState = frameState.viewState;
    const tileLayer = this.getLayer();
    const tileSource = <TileSource>tileLayer.getRenderSource();
    const tileGrid = tileSource.getTileGridForProjection(viewState.projection);
    const gutter = tileSource.getGutterForProjection(viewState.projection);

    const tileSourceKey = getUid(tileSource);
    if (!(tileSourceKey in frameState.wantedTiles)) {
      frameState.wantedTiles[tileSourceKey] = {};
    }

    const wantedTiles = frameState.wantedTiles[tileSourceKey];
    const tileRepresentationCache = this.tileRepresentationCache;

    const map = tileLayer.getMap();
    const minZ = Math.max(
      initialZ - preload,
      tileGrid.getMinZoom(),
      tileGrid.getZForResolution(
        Math.min(
          tileLayer.getMaxResolution(),
          map
            ? map
                .getView()
                .getResolutionForZoom(Math.max(tileLayer.getMinZoom(), 0))
            : tileGrid.getResolution(0)
        ),
        tileSource.zDirection
      )
    );
    for (let z = initialZ; z >= minZ; --z) {
      const tileRange = tileGrid.getTileRangeForExtentAndZ(
        extent,
        z,
        this.tempTileRange_
      );

      const tileResolution = tileGrid.getResolution(z);

      for (let x = tileRange.minX; x <= tileRange.maxX; ++x) {
        for (let y = tileRange.minY; y <= tileRange.maxY; ++y) {
          const tileCoord = createTileCoord(z, x, y, this.tempTileCoord_);
          const cacheKey = getCacheKey(tileSource, tileCoord);

          /** @type {TileRepresentation} */
          let tileRepresentation;

          /** @type {TileType} */
          let tile;

          if (tileRepresentationCache.containsKey(cacheKey)) {
            tileRepresentation = tileRepresentationCache.get(cacheKey);
            tile = tileRepresentation.tile;
          }
          if (
            !tileRepresentation ||
            tileRepresentation.tile.key !== tileSource.getKey()
          ) {
            tile = tileSource.getTile(
              z,
              x,
              y,
              frameState.pixelRatio,
              viewState.projection
            );
          }

          if (lookupHasTile(tileRepresentationLookup, tile)) {
            continue;
          }

          if (!tileRepresentation) {
            tileRepresentation = this.createTileRepresentation({
              tile: tile,
              grid: tileGrid,
              helper: this.helper,
              gutter: gutter,
            });
            tileRepresentationCache.set(cacheKey, tileRepresentation);
          } else {
            if (this.isDrawableTile_(tile)) {
              tileRepresentation.setTile(tile);
            } else {
              const interimTile = /** @type {TileType} */ (
                tile.getInterimTile()
              );
              tileRepresentation.setTile(interimTile);
            }
          }

          addTileRepresentationToLookup(
            tileRepresentationLookup,
            tileRepresentation,
            z
          );

          const tileQueueKey = tile.getKey();
          wantedTiles[tileQueueKey] = true;

          if (tile.getState() === TileState.IDLE) {
            if (!frameState.tileQueue.isKeyQueued(tileQueueKey)) {
              frameState.tileQueue.enqueue([
                tile,
                tileSourceKey,
                tileGrid.getTileCoordCenter(tileCoord),
                tileResolution,
              ]);
            }
          }
        }
      }
    }
  }

  /**
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @param {boolean} tilesWithAlpha True if at least one of the rendered tiles has alpha
   * @protected
   */
  beforeTilesRender(frameState, tilesWithAlpha) {
    this.helper.prepareDraw(this.frameState, !tilesWithAlpha, true);
  }

  /**
   * @param {TileRepresentation} tileRepresentation Tile representation
   * @param {import("../../transform").Transform} tileTransform Tile transform
   * @param {import("../../Map").FrameState} frameState Frame state
   * @param {import("../../extent").Extent} renderExtent Render extent
   * @param {number} tileResolution Tile resolution
   * @param {import("../../size").Size} tileSize Tile size
   * @param {import("../../coordinate").Coordinate} tileOrigin Tile origin
   * @param {import("../../extent").Extent} tileExtent tile Extent
   * @param {number} depth Depth
   * @param {number} gutter Gutter
   * @param {number} alpha Alpha
   * @protected
   */
  protected abstract renderTile(
    tileRepresentation: TileRepresentation,
    tileTransform: Transform,
    frameState: FrameState,
    renderExtent: Extent,
    tileResolution: number,
    tileSize: Size,
    tileOrigin: Coordinate,
    tileExtent: Extent,
    depth: number,
    gutter: number,
    alpha: number
  ): void;

  private drawTile_(
    frameState: FrameState,
    tileRepresentation: TileRepresentation,
    tileZ: number,
    gutter: number,
    extent: Extent,
    alphaLookup: TileRepresentationLookup,
    tileGrid: TileGrid
  ): void {
    if (!tileRepresentation.loaded) {
      return;
    }
    const tile = tileRepresentation.tile;
    const tileCoord = tile.tileCoord;
    const tileCoordKey = getTileCoordKey(tileCoord);
    const alpha = tileCoordKey in alphaLookup ? alphaLookup[tileCoordKey] : 1;

    const tileResolution = tileGrid.getResolution(tileZ);
    const tileSize = toSize(tileGrid.getTileSize(tileZ), this.tempSize_);
    const tileOrigin = tileGrid.getOrigin(tileZ);
    const tileExtent = tileGrid.getTileCoordExtent(tileCoord);
    // tiles with alpha are rendered last to allow blending
    const depth = alpha < 1 ? -1 : depthForZ(tileZ);
    if (alpha < 1) {
      frameState.animate = true;
    }

    const viewState = frameState.viewState;
    const centerX = viewState.center[0];
    const centerY = viewState.center[1];

    const tileWidthWithGutter = tileSize[0] + 2 * gutter;
    const tileHeightWithGutter = tileSize[1] + 2 * gutter;

    const aspectRatio = tileWidthWithGutter / tileHeightWithGutter;

    const centerI = (centerX - tileOrigin[0]) / (tileSize[0] * tileResolution);
    const centerJ = (tileOrigin[1] - centerY) / (tileSize[1] * tileResolution);

    const tileScale = viewState.resolution / tileResolution;

    const tileCenterI = tileCoord[1];
    const tileCenterJ = tileCoord[2];

    resetTransform(this.tileTransform_);
    scaleTransform(
      this.tileTransform_,
      2 / ((frameState.size[0] * tileScale) / tileWidthWithGutter),
      -2 / ((frameState.size[1] * tileScale) / tileWidthWithGutter)
    );
    rotateTransform(this.tileTransform_, viewState.rotation);
    scaleTransform(this.tileTransform_, 1, 1 / aspectRatio);
    translateTransform(
      this.tileTransform_,
      (tileSize[0] * (tileCenterI - centerI) - gutter) / tileWidthWithGutter,
      (tileSize[1] * (tileCenterJ - centerJ) - gutter) / tileHeightWithGutter
    );

    this.renderTile(
      /** @type {TileRepresentation} */ (tileRepresentation),
      this.tileTransform_,
      frameState,
      extent,
      tileResolution,
      tileSize,
      tileOrigin,
      tileExtent,
      depth,
      gutter,
      alpha
    );
  }

  /**
   * Render the layer.
   * @param {import("../../Map").FrameState} frameState Frame state.
   * @return {HTMLElement} The rendered element.
   */
  public renderFrame(frameState: FrameState): HTMLElement {
    this.frameState = frameState;
    this.renderComplete = true;
    const gl = this.helper.getGL();
    this.preRender(gl, frameState);

    const viewState = frameState.viewState;
    const tileLayer = this.getLayer();
    const tileSource = <TileSource>tileLayer.getRenderSource();
    const tileGrid = tileSource.getTileGridForProjection(viewState.projection);
    const gutter = tileSource.getGutterForProjection(viewState.projection);
    const extent = getRenderExtent(frameState, frameState.extent);
    const z = tileGrid.getZForResolution(
      viewState.resolution,
      tileSource.zDirection
    );

    /**
     * @type {TileRepresentationLookup}
     */
    const tileRepresentationLookup = newTileRepresentationLookup();

    const preload = tileLayer.getPreload();
    if (frameState.nextExtent) {
      const targetZ = tileGrid.getZForResolution(
        viewState.nextResolution,
        tileSource.zDirection
      );
      const nextExtent = getRenderExtent(frameState, frameState.nextExtent);
      this.enqueueTiles(
        frameState,
        nextExtent,
        targetZ,
        tileRepresentationLookup,
        preload
      );
    }

    this.enqueueTiles(frameState, extent, z, tileRepresentationLookup, 0);
    if (preload > 0) {
      setTimeout(() => {
        this.enqueueTiles(
          frameState,
          extent,
          z - 1,
          tileRepresentationLookup,
          preload - 1
        );
      }, 0);
    }

    /**
     * A lookup of alpha values for tiles at the target rendering resolution
     * for tiles that are in transition.  If a tile coord key is absent from
     * this lookup, the tile should be rendered at alpha 1.
     * @type {Object<string, number>}
     */
    const alphaLookup = {};

    const uid = getUid(this);
    const time = frameState.time;
    let blend = false;

    // look for cached tiles to use if a target tile is not ready
    for (const tileRepresentation of tileRepresentationLookup
      .representationsByZ[z]) {
      const tile = tileRepresentation.tile;
      if (
        (tile instanceof ReprojTile || tile instanceof ReprojDataTile) &&
        tile.getState() === TileState.EMPTY
      ) {
        continue;
      }
      const tileCoord = tile.tileCoord;

      if (tileRepresentation.loaded) {
        const alpha = tile.getAlpha(uid, time);
        if (alpha === 1) {
          // no need to look for alt tiles
          tile.endTransition(uid);
          continue;
        }
        blend = true;
        const tileCoordKey = getTileCoordKey(tileCoord);
        alphaLookup[tileCoordKey] = alpha;
      }
      this.renderComplete = false;

      // first look for child tiles (at z + 1)
      const coveredByChildren = this.findAltTiles_(
        tileGrid,
        tileCoord,
        z + 1,
        tileRepresentationLookup
      );

      if (coveredByChildren) {
        continue;
      }

      // next look for parent tiles
      const minZoom = tileGrid.getMinZoom();
      for (let parentZ = z - 1; parentZ >= minZoom; --parentZ) {
        const coveredByParent = this.findAltTiles_(
          tileGrid,
          tileCoord,
          parentZ,
          tileRepresentationLookup
        );

        if (coveredByParent) {
          break;
        }
      }
    }

    this.beforeTilesRender(frameState, blend);

    const representationsByZ = tileRepresentationLookup.representationsByZ;
    const zs = Object.keys(representationsByZ).map(Number).sort(descending);
    for (let j = 0, jj = zs.length; j < jj; ++j) {
      const tileZ = zs[j];
      for (const tileRepresentation of representationsByZ[tileZ]) {
        const tileCoord = tileRepresentation.tile.tileCoord;
        const tileCoordKey = getTileCoordKey(tileCoord);
        if (tileCoordKey in alphaLookup) {
          continue;
        }

        this.drawTile_(
          frameState,
          tileRepresentation,
          tileZ,
          gutter,
          extent,
          alphaLookup,
          tileGrid
        );
      }
    }

    for (const tileRepresentation of representationsByZ[z]) {
      const tileCoord = tileRepresentation.tile.tileCoord;
      const tileCoordKey = getTileCoordKey(tileCoord);
      if (tileCoordKey in alphaLookup) {
        this.drawTile_(
          frameState,
          tileRepresentation,
          z,
          gutter,
          extent,
          alphaLookup,
          tileGrid
        );
      }
    }

    this.helper.finalizeDraw(
      frameState,
      this.dispatchPreComposeEvent,
      this.dispatchPostComposeEvent
    );

    const canvas = this.helper.getCanvas();

    const tileRepresentationCache = this.tileRepresentationCache;
    while (tileRepresentationCache.canExpireCache()) {
      const tileRepresentation = tileRepresentationCache.pop();
      tileRepresentation.dispose();
    }

    // TODO: let the renderers manage their own cache instead of managing the source cache
    /**
     * Here we unconditionally expire the source cache since the renderer maintains
     * its own cache.
     * @param {import("../../Map").default} map Map.
     * @param {import("../../Map").FrameState} frameState Frame state.
     */
    const postRenderFunction = function (map, frameState) {
      tileSource.updateCacheSize(0.1, frameState.viewState.projection);
      tileSource.expireCache(frameState.viewState.projection, empty);
    };

    frameState.postRenderFunctions.push(postRenderFunction);

    this.postRender(gl, frameState);
    return canvas;
  }

  /**
   * Look for tiles covering the provided tile coordinate at an alternate
   * zoom level.  Loaded tiles will be added to the provided tile representation lookup.
   * @param {import("../../tilegrid/TileGrid").default} tileGrid The tile grid.
   * @param {import("../../tilecoord").TileCoord} tileCoord The target tile coordinate.
   * @param {number} altZ The alternate zoom level.
   * @param {TileRepresentationLookup} tileRepresentationLookup Lookup of
   * tile representations by zoom level.
   * @return {boolean} The tile coordinate is covered by loaded tiles at the alternate zoom level.
   * @private
   */
  private findAltTiles_(tileGrid: TileGrid, tileCoord: TileCoord, altZ: number, tileRepresentationLookup: TileRepresentationLookup): boolean {
    const tileRange = tileGrid.getTileRangeForTileCoordAndZ(
      tileCoord,
      altZ,
      this.tempTileRange_
    );

    if (!tileRange) {
      return false;
    }

    let covered = true;
    const tileRepresentationCache = this.tileRepresentationCache;
    const source = <TileSource>this.getLayer().getRenderSource();
    for (let x = tileRange.minX; x <= tileRange.maxX; ++x) {
      for (let y = tileRange.minY; y <= tileRange.maxY; ++y) {
        const cacheKey = getCacheKey(source, [altZ, x, y]);
        let loaded = false;
        if (tileRepresentationCache.containsKey(cacheKey)) {
          const tileRepresentation = tileRepresentationCache.get(cacheKey);
          if (
            tileRepresentation.loaded &&
            !lookupHasTile(tileRepresentationLookup, tileRepresentation.tile)
          ) {
            addTileRepresentationToLookup(
              tileRepresentationLookup,
              tileRepresentation,
              altZ
            );
            loaded = true;
          }
        }
        if (!loaded) {
          covered = false;
        }
      }
    }
    return covered;
  }

  public clearCache(): void {
    const tileRepresentationCache = this.tileRepresentationCache;
    tileRepresentationCache.forEach((tileRepresentation) =>
      tileRepresentation.dispose()
    );
    tileRepresentationCache.clear();
  }

  public removeHelper(): void {
    if (this.helper) {
      this.clearCache();
    }

    super.removeHelper();
  }

  /**
   * Clean up.
   */
  protected disposeInternal(): void {
    super.disposeInternal();
    delete this.frameState;
  }
}

export default WebGLBaseTileLayerRenderer;
