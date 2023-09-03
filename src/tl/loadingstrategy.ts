/**
 * @module tl/loadingstrategy
 */

import {fromUserExtent, fromUserResolution, toUserExtent} from './proj';
import {Extent} from "./extent/Extent";
import TileGrid from "./tilegrid/TileGrid";
import {LoadingStrategy} from "./source/Vector";
import {TileCoord} from "./tilecoord";
import Projection from "./proj/Projection";

/**
 * Strategy function for loading all features with a single request.
 * @param {import("./extent").Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @return {Array<import("./extent").Extent>} Extents.
 * @api
 */
export function all(extent: Extent, resolution: number): Extent[] {
  return [[-Infinity, -Infinity, Infinity, Infinity]];
}

/**
 * Strategy function for loading features based on the view's extent and
 * resolution.
 * @param {import("./extent").Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @return {Array<import("./extent").Extent>} Extents.
 * @api
 */
export function bbox(extent: Extent, resolution: number): Extent[] {
  return [extent];
}

/**
 * Creates a strategy function for loading features based on a tile grid.
 * @param {import("./tilegrid/TileGrid").default} tileGrid Tile grid.
 * @return {function(import("./extent").Extent, number, import("./proj").Projection): Array<import("./extent").Extent>} Loading strategy.
 * @api
 */
export function tile(tileGrid: TileGrid): LoadingStrategy {
  return (
    /**
     * @param {import("./extent").Extent} extent Extent.
     * @param {number} resolution Resolution.
     * @param {import("./proj").Projection} projection Projection.
     * @return {Array<import("./extent").Extent>} Extents.
     */
    function (extent: Extent, resolution: number, projection: Projection): Extent[] {
      const z = tileGrid.getZForResolution(
        fromUserResolution(resolution, projection)
      );
      const tileRange = tileGrid.getTileRangeForExtentAndZ(
        fromUserExtent(extent, projection),
        z
      );
      /** @type {Array<import("./extent").Extent>} */
      const extents: Extent[] = [];
      /** @type {import("./tilecoord").TileCoord} */
      const tileCoord: TileCoord = [z, 0, 0];
      for (
        tileCoord[1] = tileRange.minX;
        tileCoord[1] <= tileRange.maxX;
        ++tileCoord[1]
      ) {
        for (
          tileCoord[2] = tileRange.minY;
          tileCoord[2] <= tileRange.maxY;
          ++tileCoord[2]
        ) {
          extents.push(
            toUserExtent(tileGrid.getTileCoordExtent(tileCoord), projection)
          );
        }
      }
      return extents;
    }
  );
}
