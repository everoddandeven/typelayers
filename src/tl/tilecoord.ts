/**
 * @module tl/tilecoord
 */
import TileGrid from "./tilegrid/TileGrid";

export type TileCoord = [number, number, number];

/**
 * @param {number} z Z.
 * @param {number} x X.
 * @param {number} y Y.
 * @param {TileCoord} [tileCoord] Tile coordinate.
 * @return {TileCoord} Tile coordinate.
 */
export function createOrUpdate(z: number, x: number, y: number, tileCoord?: TileCoord): TileCoord {
  if (tileCoord !== undefined) {
    tileCoord[0] = z;
    tileCoord[1] = x;
    tileCoord[2] = y;
    return tileCoord;
  }
  return [z, x, y];
}

/**
 * @param {number} z Z.
 * @param {number} x X.
 * @param {number} y Y.
 * @return {string} Key.
 */
export function getKeyZXY(z: number, x: number, y: number): string {
  return z + '/' + x + '/' + y;
}

/**
 * Get the key for a tile coord.
 * @param {TileCoord} tileCoord The tile coord.
 * @return {string} Key.
 */
export function getKey(tileCoord: TileCoord): string {
  return getKeyZXY(tileCoord[0], tileCoord[1], tileCoord[2]);
}

/**
 * Get the tile cache key for a tile key obtained through `tile.getKey()`.
 * @param {string} tileKey The tile key.
 * @return {string} The cache key.
 */
export function getCacheKeyForTileKey(tileKey: string): string {
  const [z, x, y] = tileKey
    .substring(tileKey.lastIndexOf('/') + 1, tileKey.length)
    .split(',')
    .map(Number);
  return getKeyZXY(z, x, y);
}

/**
 * Get a tile coord given a key.
 * @param {string} key The tile coord key.
 * @return {TileCoord} The tile coord.
 */
export function fromKey(key: string): TileCoord {
  return <TileCoord>key.split('/').map(Number);
}

/**
 * @param {TileCoord} tileCoord Tile coord.
 * @return {number} Hash.
 */
export function hash(tileCoord: TileCoord): number {
  return (tileCoord[1] << tileCoord[0]) + tileCoord[2];
}

/**
 * @param {TileCoord} tileCoord Tile coordinate.
 * @param {!import("./tilegrid/TileGrid").default} tileGrid Tile grid.
 * @return {boolean} Tile coordinate is within extent and zoom level range.
 */
export function withinExtentAndZ(tileCoord: TileCoord, tileGrid: TileGrid): boolean {
  const z = tileCoord[0];
  const x = tileCoord[1];
  const y = tileCoord[2];

  if (tileGrid.getMinZoom() > z || z > tileGrid.getMaxZoom()) {
    return false;
  }
  const tileRange = tileGrid.getFullTileRange(z);
  if (!tileRange) {
    return true;
  }
  return tileRange.containsXY(x, y);
}
