/**
 * @module tl/tilegrid
 */
import TileGrid from './tilegrid/TileGrid';
import {DEFAULT_MAX_ZOOM, DEFAULT_TILE_SIZE} from './tilegrid/common';
import {METERS_PER_UNIT, get as getProjection, ProjectionLike} from './proj';
import {
  containsCoordinate, Corner,
  createOrUpdate,
  getCorner,
  getHeight,
  getWidth,
} from './extent';
import {Size, toSize} from './size';
import Projection from "./proj/Projection";
import {TileCoord} from "./tilecoord";
import {Extent} from "./extent/Extent";

/**
 * @param {import("./proj/Projection").default} projection Projection.
 * @return {!TileGrid} Default tile grid for the
 * passed projection.
 */
export function getForProjection(projection: Projection): TileGrid {
  let tileGrid = projection.getDefaultTileGrid();
  if (!tileGrid) {
    tileGrid = createForProjection(projection);
    projection.setDefaultTileGrid(tileGrid);
  }
  return tileGrid;
}

/**
 * @param {TileGrid} tileGrid Tile grid.
 * @param {import("./tilecoord").TileCoord} tileCoord Tile coordinate.
 * @param {import("./proj/Projection").default} projection Projection.
 * @return {import("./tilecoord").TileCoord} Tile coordinate.
 */
export function wrapX(tileGrid: TileGrid, tileCoord: TileCoord, projection: Projection): TileCoord {
  const z = tileCoord[0];
  const center = tileGrid.getTileCoordCenter(tileCoord);
  const projectionExtent = extentFromProjection(projection);
  if (!containsCoordinate(projectionExtent, center)) {
    const worldWidth = getWidth(projectionExtent);
    const worldsAway = Math.ceil(
      (projectionExtent[0] - center[0]) / worldWidth
    );
    center[0] += worldWidth * worldsAway;
    return tileGrid.getTileCoordForCoordAndZ(center, z);
  }
  return tileCoord;
}

/**
 * @param {import("./extent").Extent} extent Extent.
 * @param {number} [maxZoom] Maximum zoom level (default is
 *     DEFAULT_MAX_ZOOM).
 * @param {number|import("./size").Size} [tileSize] Tile size (default uses
 *     DEFAULT_TILE_SIZE).
 * @param {import("./extent").Corner} [corner] Extent corner (default is `'top-left'`).
 * @return {!TileGrid} TileGrid instance.
 */
export function createForExtent(extent: Extent, maxZoom: number, tileSize: number | Size, corner: Corner): TileGrid {
  corner = corner !== undefined ? corner : 'top-left';

  const resolutions = resolutionsFromExtent(extent, maxZoom, tileSize);

  return new TileGrid({
    extent: extent,
    origin: getCorner(extent, corner),
    resolutions: resolutions,
    tileSize: tileSize,
  });
}

export interface XYZOptions
{
  extent?: Extent,
  maxResolution?: number,
  maxZoom?: number,
  minZoom?: number,
  tileSize?: Size | number
}

/**
 * Creates a tile grid with a standard XYZ tiling scheme.
 * @param {XYZOptions} [options] Tile grid options.
 * @return {!TileGrid} Tile grid instance.
 * @api
 */
export function createXYZ(options: XYZOptions): TileGrid {
  const xyzOptions = options || {
    extent: null,
    maxResolution: null,
    maxZoom: 42,
    minZoom: 0,
    tileSize: [256, 256]
  };

  const extent = xyzOptions.extent || getProjection('EPSG:3857').getExtent();

  const gridOptions = {
    extent: extent,
    minZoom: xyzOptions.minZoom,
    tileSize: xyzOptions.tileSize,
    resolutions: resolutionsFromExtent(
      extent,
      xyzOptions.maxZoom,
      xyzOptions.tileSize,
      xyzOptions.maxResolution
    ),
  };
  return new TileGrid(gridOptions);
}

/**
 * Create a resolutions array from an extent.  A zoom factor of 2 is assumed.
 * @param {import("./extent").Extent} extent Extent.
 * @param {number} [maxZoom] Maximum zoom level (default is
 *     DEFAULT_MAX_ZOOM).
 * @param {number|import("./size").Size} [tileSize] Tile size (default uses
 *     DEFAULT_TILE_SIZE).
 * @param {number} [maxResolution] Resolution at level zero.
 * @return {!Array<number>} Resolutions array.
 */
function resolutionsFromExtent(extent: Extent, maxZoom: number, tileSize?: number | Size, maxResolution?: number): number[] {
  maxZoom = maxZoom !== undefined ? maxZoom : DEFAULT_MAX_ZOOM;
  tileSize = toSize(tileSize !== undefined ? tileSize : DEFAULT_TILE_SIZE);

  const height = getHeight(extent);
  const width = getWidth(extent);

  maxResolution =
    maxResolution > 0
      ? maxResolution
      : Math.max(width / tileSize[0], height / tileSize[1]);

  const length: number = maxZoom + 1;
  const resolutions: number[] = new Array<number>(length);
  for (let z: number = 0; z < length; ++z) {
    resolutions[z] = maxResolution / Math.pow(2, z);
  }
  return resolutions;
}

/**
 * @param {import("./proj").ProjectionLike} projection Projection.
 * @param {number} [maxZoom] Maximum zoom level (default is
 *     DEFAULT_MAX_ZOOM).
 * @param {number|import("./size").Size} [tileSize] Tile size (default uses
 *     DEFAULT_TILE_SIZE).
 * @param {import("./extent").Corner} [corner] Extent corner (default is `'top-left'`).
 * @return {!TileGrid} TileGrid instance.
 */
export function createForProjection(
    projection: Projection,
    maxZoom: number = DEFAULT_MAX_ZOOM,
    tileSize: number | Size = DEFAULT_TILE_SIZE,
    corner: Corner = 'top-left'): TileGrid
{
  const extent = extentFromProjection(projection);
  return createForExtent(extent, maxZoom, tileSize, corner);
}

/**
 * Generate a tile grid extent from a projection.  If the projection has an
 * extent, it is used.  If not, a global extent is assumed.
 * @param {import("./proj").ProjectionLike} projection Projection.
 * @return {import("./extent").Extent} Extent.
 */
export function extentFromProjection(projection: ProjectionLike): Extent {
  projection = getProjection(projection);
  let extent = projection.getExtent();
  if (!extent) {
    const half =
      (180 * METERS_PER_UNIT.degrees) / projection.getMetersPerUnit();
    extent = createOrUpdate(-half, -half, half, half, null);
  }
  return extent;
}
