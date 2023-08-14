/**
 * @module ol/tilegrid/WMTS
 */

import TileGrid from './TileGrid';
import {get as getProjection} from '../proj';
import {Extent} from "../extent/Extent";
import {Coordinate, Coordinates} from "../coordinate";
import {Size} from "../size";

export interface WMTSOptions {
  extent?: Extent;
  origin?: Coordinate;
  origins?: Coordinates;
  resolutions?: number[];
  matrixIds?: string[];
  sizes?: Size[];
  tileSize?: number | Size;
  tileSizes?: (number | Size)[];
}

/**
 * @classdesc
 * Set the grid pattern for sources accessing WMTS tiled-image servers.
 * @api
 */
class WMTSTileGrid extends TileGrid {
  /**
   * @param {Options} options WMTS options.
   */

  private matrixIds_?: string[];

  constructor(options: WMTSOptions) {
    super({
      extent: options.extent,
      origin: options.origin,
      origins: options.origins,
      resolutions: options.resolutions,
      tileSize: options.tileSize,
      tileSizes: options.tileSizes,
      sizes: options.sizes,
    });

    /**
     * @private
     * @type {!Array<string>}
     */
    this.matrixIds_ = options.matrixIds;
  }

  /**
   * @param {number} z Z.
   * @return {string} MatrixId..
   */
  public getMatrixId(z: number): string {
    return this.matrixIds_[z];
  }

  /**
   * Get the list of matrix identifiers.
   * @return {Array<string>} MatrixIds.
   * @api
   */
  public getMatrixIds(): string[] {
    return this.matrixIds_;
  }
}

export default WMTSTileGrid;

/**
 * Create a tile grid from a WMTS capabilities matrix set and an
 * optional TileMatrixSetLimits.
 * @param {Object} matrixSet An object representing a matrixSet in the
 *     capabilities document.
 * @param {import("../extent").Extent} [extent] An optional extent to restrict the tile
 *     ranges the server provides.
 * @param {Array<Object>} [matrixLimits] An optional object representing
 *     the available matrices for tileGrid.
 * @return {WMTSTileGrid} WMTS tileGrid instance.
 * @api
 */
export function createFromCapabilitiesMatrixSet(
  matrixSet: {[key: string]: any},
  extent?: Extent,
  matrixLimits?: {[key: string]: any}[]
): WMTSTileGrid {
  /** @type {!Array<number>} */
  const resolutions: number[] = [];
  /** @type {!Array<string>} */
  const matrixIds: string[] = [];
  /** @type {!Array<import("../coordinate").Coordinate>} */
  const origins: Coordinates = [];
  /** @type {!Array<number|import("../size").Size>} */
  const tileSizes: (number | Size)[] = [];
  /** @type {!Array<import("../size").Size>} */
  const sizes: Size[] = [];

  matrixLimits = matrixLimits !== undefined ? matrixLimits : [];

  const supportedCRSPropName = 'SupportedCRS';
  const matrixIdsPropName = 'TileMatrix';
  const identifierPropName = 'Identifier';
  const scaleDenominatorPropName = 'ScaleDenominator';
  const topLeftCornerPropName = 'TopLeftCorner';
  const tileWidthPropName = 'TileWidth';
  const tileHeightPropName = 'TileHeight';

  const code = matrixSet[supportedCRSPropName];
  const projection = getProjection(code);
  const metersPerUnit = projection.getMetersPerUnit();
  // swap origin x and y coordinates if axis orientation is lat/long
  const switchOriginXY = projection.getAxisOrientation().substr(0, 2) == 'ne';

  matrixSet[matrixIdsPropName].sort(function (a, b) {
    return b[scaleDenominatorPropName] - a[scaleDenominatorPropName];
  });

  matrixSet[matrixIdsPropName].forEach(function (elt) {
    let matrixAvailable;
    // use of matrixLimits to filter TileMatrices from GetCapabilities
    // TileMatrixSet from unavailable matrix levels.
    if (matrixLimits.length > 0) {
      matrixAvailable = matrixLimits.find(function (elt_ml) {
        if (elt[identifierPropName] == elt_ml[matrixIdsPropName]) {
          return true;
        }
        // Fallback for tileMatrix identifiers that don't get prefixed
        // by their tileMatrixSet identifiers.
        if (!elt[identifierPropName].includes(':')) {
          return (
            matrixSet[identifierPropName] + ':' + elt[identifierPropName] ===
            elt_ml[matrixIdsPropName]
          );
        }
        return false;
      });
    } else {
      matrixAvailable = true;
    }

    if (matrixAvailable) {
      matrixIds.push(elt[identifierPropName]);
      const resolution =
        (elt[scaleDenominatorPropName] * 0.28e-3) / metersPerUnit;
      const tileWidth = elt[tileWidthPropName];
      const tileHeight = elt[tileHeightPropName];
      if (switchOriginXY) {
        origins.push([
          elt[topLeftCornerPropName][1],
          elt[topLeftCornerPropName][0],
        ]);
      } else {
        origins.push(elt[topLeftCornerPropName]);
      }
      resolutions.push(resolution);
      tileSizes.push(
        tileWidth == tileHeight ? tileWidth : [tileWidth, tileHeight]
      );
      sizes.push([elt['MatrixWidth'], elt['MatrixHeight']]);
    }
  });

  return new WMTSTileGrid({
    extent: extent,
    origins: origins,
    resolutions: resolutions,
    matrixIds: matrixIds,
    tileSizes: tileSizes,
    sizes: sizes,
  });
}
