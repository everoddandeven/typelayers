/**
 * @module ol/tilegrid/TileGrid
 */
import TileRange, {
  createOrUpdate as createOrUpdateTileRange,
} from '../TileRange';
import {DEFAULT_TILE_SIZE} from './common';
import {assert} from '../asserts';
import {ceil, clamp, floor} from '../math';
import {createOrUpdate, Extent, getTopLeft} from '../extent';
import {createOrUpdate as createOrUpdateTileCoord, TileCoord} from '../tilecoord';
import {intersectsLinearRing} from '../geom/flat/intersectsextent';
import {isSorted, linearFindNearest} from '../array';
import {Size, toSize} from '../size';
import {Coordinate, Coordinates} from "../coordinate";

/**
 * @private
 * @type {import("../tilecoord").TileCoord}
 */
export const tmpTileCoord: TileCoord = [0, 0, 0];

/**
 * Number of decimal digits to consider in integer values when rounding.
 * @type {number}
 */
export const DECIMALS: number = 5;

export interface TileGridOptions {
  extent?: Extent;
  minZoom?: number;
  origin?: Coordinate;
  origins?: Coordinates;
  resolutions: number[];
  sizes?: Size[];
  tileSize?: number | Size;
  tileSizes?: (number | Size)[];
}

/**
 * @classdesc
 * Base class for setting the grid pattern for sources accessing tiled-image
 * servers.
 * @api
 */
class TileGrid {
  /**
   * @param {Options} options Tile grid options.
   */

  private resolutions_: number[];
  private zoomFactor_: number;
  private origin_?: Coordinate;
  private origins_?: Coordinates;
  private tileSize_?: number | Size;
  private tileSizes_?: (number | Size)[];
  private extent_?: Extent;
  private fullTileRanges_: TileRange[];
  private tmpSize_: Size;
  private tmpExtent_: Extent;

  protected minZoom: number;
  protected maxZoom: number;


  constructor(options: TileGridOptions) {
    /**
     * @protected
     * @type {number}
     */
    this.minZoom = options.minZoom !== undefined ? options.minZoom : 0;

    /**
     * @private
     * @type {!Array<number>}
     */
    this.resolutions_ = options.resolutions;
    assert(
      isSorted(
        this.resolutions_,
        function (a, b) {
          return b - a;
        },
        true
      ),
      17
    ); // `resolutions` must be sorted in descending order

    // check if we've got a consistent zoom factor and origin
    let zoomFactor;
    if (!options.origins) {
      for (let i = 0, ii = this.resolutions_.length - 1; i < ii; ++i) {
        if (!zoomFactor) {
          zoomFactor = this.resolutions_[i] / this.resolutions_[i + 1];
        } else {
          if (this.resolutions_[i] / this.resolutions_[i + 1] !== zoomFactor) {
            zoomFactor = undefined;
            break;
          }
        }
      }
    }

    /**
     * @private
     * @type {number|undefined}
     */
    this.zoomFactor_ = zoomFactor;

    /**
     * @protected
     * @type {number}
     */
    this.maxZoom = this.resolutions_.length - 1;

    /**
     * @private
     * @type {import("../coordinate").Coordinate|null}
     */
    this.origin_ = options.origin !== undefined ? options.origin : null;

    /**
     * @private
     * @type {Array<import("../coordinate").Coordinate>}
     */
    this.origins_ = null;
    if (options.origins !== undefined) {
      this.origins_ = options.origins;
      assert(this.origins_.length == this.resolutions_.length, 20); // Number of `origins` and `resolutions` must be equal
    }

    const extent = options.extent;

    if (extent !== undefined && !this.origin_ && !this.origins_) {
      this.origin_ = getTopLeft(extent);
    }

    assert(
      (!this.origin_ && this.origins_) || (this.origin_ && !this.origins_),
      18
    ); // Either `origin` or `origins` must be configured, never both

    /**
     * @private
     * @type {Array<number|import("../size").Size>}
     */
    this.tileSizes_ = null;
    if (options.tileSizes !== undefined) {
      this.tileSizes_ = options.tileSizes;
      assert(this.tileSizes_.length == this.resolutions_.length, 19); // Number of `tileSizes` and `resolutions` must be equal
    }

    /**
     * @private
     * @type {number|import("../size").Size}
     */
    this.tileSize_ =
      options.tileSize !== undefined
        ? options.tileSize
        : !this.tileSizes_
        ? DEFAULT_TILE_SIZE
        : null;
    assert(
      (!this.tileSize_ && this.tileSizes_) ||
        (this.tileSize_ && !this.tileSizes_),
      22
    ); // Either `tileSize` or `tileSizes` must be configured, never both

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.extent_ = extent !== undefined ? extent : null;

    /**
     * @private
     * @type {Array<import("../TileRange").default>}
     */
    this.fullTileRanges_ = null;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.tmpSize_ = [0, 0];

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.tmpExtent_ = [0, 0, 0, 0];

    if (options.sizes !== undefined) {
      this.fullTileRanges_ = options.sizes.map(function (size, z) {
        const tileRange = new TileRange(
          Math.min(0, size[0]),
          Math.max(size[0] - 1, -1),
          Math.min(0, size[1]),
          Math.max(size[1] - 1, -1)
        );
        if (extent) {
          const restrictedTileRange = this.getTileRangeForExtentAndZ(extent, z);
          tileRange.minX = Math.max(restrictedTileRange.minX, tileRange.minX);
          tileRange.maxX = Math.min(restrictedTileRange.maxX, tileRange.maxX);
          tileRange.minY = Math.max(restrictedTileRange.minY, tileRange.minY);
          tileRange.maxY = Math.min(restrictedTileRange.maxY, tileRange.maxY);
        }
        return tileRange;
      }, this);
    } else if (extent) {
      this.calculateTileRanges_(extent);
    }
  }

  /**
   * Call a function with each tile coordinate for a given extent and zoom level.
   *
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} zoom Integer zoom level.
   * @param {function(import("../tilecoord").TileCoord): void} callback Function called with each tile coordinate.
   * @api
   */
  forEachTileCoord(extent, zoom, callback) {
    const tileRange = this.getTileRangeForExtentAndZ(extent, zoom);
    for (let i = tileRange.minX, ii = tileRange.maxX; i <= ii; ++i) {
      for (let j = tileRange.minY, jj = tileRange.maxY; j <= jj; ++j) {
        callback([zoom, i, j]);
      }
    }
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {function(number, import("../TileRange").default): boolean} callback Callback.
   * @param {import("../TileRange").default} [tempTileRange] Temporary import("../TileRange").default object.
   * @param {import("../extent").Extent} [tempExtent] Temporary import("../extent").Extent object.
   * @return {boolean} Callback succeeded.
   */
  forEachTileCoordParentTileRange(
    tileCoord,
    callback,
    tempTileRange,
    tempExtent
  ) {
    let tileRange, x, y;
    let tileCoordExtent = null;
    let z = tileCoord[0] - 1;
    if (this.zoomFactor_ === 2) {
      x = tileCoord[1];
      y = tileCoord[2];
    } else {
      tileCoordExtent = this.getTileCoordExtent(tileCoord, tempExtent);
    }
    while (z >= this.minZoom) {
      if (this.zoomFactor_ === 2) {
        x = Math.floor(x / 2);
        y = Math.floor(y / 2);
        tileRange = createOrUpdateTileRange(x, x, y, y, tempTileRange);
      } else {
        tileRange = this.getTileRangeForExtentAndZ(
          tileCoordExtent,
          z,
          tempTileRange
        );
      }
      if (callback(z, tileRange)) {
        return true;
      }
      --z;
    }
    return false;
  }

  /**
   * Get the extent for this tile grid, if it was configured.
   * @return {import("../extent").Extent} Extent.
   * @api
   */
  getExtent() {
    return this.extent_;
  }

  /**
   * Get the maximum zoom level for the grid.
   * @return {number} Max zoom.
   * @api
   */
  getMaxZoom() {
    return this.maxZoom;
  }

  /**
   * Get the minimum zoom level for the grid.
   * @return {number} Min zoom.
   * @api
   */
  getMinZoom() {
    return this.minZoom;
  }

  /**
   * Get the origin for the grid at the given zoom level.
   * @param {number} z Integer zoom level.
   * @return {import("../coordinate").Coordinate} Origin.
   * @api
   */
  getOrigin(z) {
    if (this.origin_) {
      return this.origin_;
    }
    return this.origins_[z];
  }

  /**
   * Get the resolution for the given zoom level.
   * @param {number} z Integer zoom level.
   * @return {number} Resolution.
   * @api
   */
  getResolution(z) {
    return this.resolutions_[z];
  }

  /**
   * Get the list of resolutions for the tile grid.
   * @return {Array<number>} Resolutions.
   * @api
   */
  getResolutions() {
    return this.resolutions_;
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {import("../TileRange").default} [tempTileRange] Temporary import("../TileRange").default object.
   * @param {import("../extent").Extent} [tempExtent] Temporary import("../extent").Extent object.
   * @return {import("../TileRange").default|null} Tile range.
   */
  getTileCoordChildTileRange(tileCoord, tempTileRange, tempExtent) {
    if (tileCoord[0] < this.maxZoom) {
      if (this.zoomFactor_ === 2) {
        const minX = tileCoord[1] * 2;
        const minY = tileCoord[2] * 2;
        return createOrUpdateTileRange(
          minX,
          minX + 1,
          minY,
          minY + 1,
          tempTileRange
        );
      }
      const tileCoordExtent = this.getTileCoordExtent(
        tileCoord,
        tempExtent || this.tmpExtent_
      );
      return this.getTileRangeForExtentAndZ(
        tileCoordExtent,
        tileCoord[0] + 1,
        tempTileRange
      );
    }
    return null;
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {number} z Integer zoom level.
   * @param {import("../TileRange").default} [tempTileRange] Temporary import("../TileRange").default object.
   * @return {import("../TileRange").default|null} Tile range.
   */
  getTileRangeForTileCoordAndZ(tileCoord, z, tempTileRange) {
    if (z > this.maxZoom || z < this.minZoom) {
      return null;
    }

    const tileCoordZ = tileCoord[0];
    const tileCoordX = tileCoord[1];
    const tileCoordY = tileCoord[2];

    if (z === tileCoordZ) {
      return createOrUpdateTileRange(
        tileCoordX,
        tileCoordY,
        tileCoordX,
        tileCoordY,
        tempTileRange
      );
    }

    if (this.zoomFactor_) {
      const factor = Math.pow(this.zoomFactor_, z - tileCoordZ);
      const minX = Math.floor(tileCoordX * factor);
      const minY = Math.floor(tileCoordY * factor);
      if (z < tileCoordZ) {
        return createOrUpdateTileRange(minX, minX, minY, minY, tempTileRange);
      }

      const maxX = Math.floor(factor * (tileCoordX + 1)) - 1;
      const maxY = Math.floor(factor * (tileCoordY + 1)) - 1;
      return createOrUpdateTileRange(minX, maxX, minY, maxY, tempTileRange);
    }

    const tileCoordExtent = this.getTileCoordExtent(tileCoord, this.tmpExtent_);
    return this.getTileRangeForExtentAndZ(tileCoordExtent, z, tempTileRange);
  }

  /**
   * Get a tile range for the given extent and integer zoom level.
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} z Integer zoom level.
   * @param {import("../TileRange").default} [tempTileRange] Temporary tile range object.
   * @return {import("../TileRange").default} Tile range.
   */
  getTileRangeForExtentAndZ(extent, z, tempTileRange?) {
    this.getTileCoordForXYAndZ_(extent[0], extent[3], z, false, tmpTileCoord);
    const minX = tmpTileCoord[1];
    const minY = tmpTileCoord[2];
    this.getTileCoordForXYAndZ_(extent[2], extent[1], z, true, tmpTileCoord);
    const maxX = tmpTileCoord[1];
    const maxY = tmpTileCoord[2];
    return createOrUpdateTileRange(minX, maxX, minY, maxY, tempTileRange);
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @return {import("../coordinate").Coordinate} Tile center.
   */
  getTileCoordCenter(tileCoord) {
    const origin = this.getOrigin(tileCoord[0]);
    const resolution = this.getResolution(tileCoord[0]);
    const tileSize = toSize(this.getTileSize(tileCoord[0]), this.tmpSize_);
    return [
      origin[0] + (tileCoord[1] + 0.5) * tileSize[0] * resolution,
      origin[1] - (tileCoord[2] + 0.5) * tileSize[1] * resolution,
    ];
  }

  /**
   * Get the extent of a tile coordinate.
   *
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {import("../extent").Extent} [tempExtent] Temporary extent object.
   * @return {import("../extent").Extent} Extent.
   * @api
   */
  getTileCoordExtent(tileCoord, tempExtent?) {
    const origin = this.getOrigin(tileCoord[0]);
    const resolution = this.getResolution(tileCoord[0]);
    const tileSize = toSize(this.getTileSize(tileCoord[0]), this.tmpSize_);
    const minX = origin[0] + tileCoord[1] * tileSize[0] * resolution;
    const minY = origin[1] - (tileCoord[2] + 1) * tileSize[1] * resolution;
    const maxX = minX + tileSize[0] * resolution;
    const maxY = minY + tileSize[1] * resolution;
    return createOrUpdate(minX, minY, maxX, maxY, tempExtent);
  }

  /**
   * Get the tile coordinate for the given map coordinate and resolution.  This
   * method considers that coordinates that intersect tile boundaries should be
   * assigned the higher tile coordinate.
   *
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {number} resolution Resolution.
   * @param {import("../tilecoord").TileCoord} [opt_tileCoord] Destination import("../tilecoord").TileCoord object.
   * @return {import("../tilecoord").TileCoord} Tile coordinate.
   * @api
   */
  getTileCoordForCoordAndResolution(coordinate, resolution, opt_tileCoord) {
    return this.getTileCoordForXYAndResolution_(
      coordinate[0],
      coordinate[1],
      resolution,
      false,
      opt_tileCoord
    );
  }

  /**
   * Note that this method should not be called for resolutions that correspond
   * to an integer zoom level.  Instead call the `getTileCoordForXYAndZ_` method.
   * @param {number} x X.
   * @param {number} y Y.
   * @param {number} resolution Resolution (for a non-integer zoom level).
   * @param {boolean} reverseIntersectionPolicy Instead of letting edge
   *     intersections go to the higher tile coordinate, let edge intersections
   *     go to the lower tile coordinate.
   * @param {import("../tilecoord").TileCoord} [opt_tileCoord] Temporary import("../tilecoord").TileCoord object.
   * @return {import("../tilecoord").TileCoord} Tile coordinate.
   * @private
   */
  getTileCoordForXYAndResolution_(
    x,
    y,
    resolution,
    reverseIntersectionPolicy,
    opt_tileCoord
  ) {
    const z = this.getZForResolution(resolution);
    const scale = resolution / this.getResolution(z);
    const origin = this.getOrigin(z);
    const tileSize = toSize(this.getTileSize(z), this.tmpSize_);

    let tileCoordX = (scale * (x - origin[0])) / resolution / tileSize[0];
    let tileCoordY = (scale * (origin[1] - y)) / resolution / tileSize[1];

    if (reverseIntersectionPolicy) {
      tileCoordX = ceil(tileCoordX, DECIMALS) - 1;
      tileCoordY = ceil(tileCoordY, DECIMALS) - 1;
    } else {
      tileCoordX = floor(tileCoordX, DECIMALS);
      tileCoordY = floor(tileCoordY, DECIMALS);
    }

    return createOrUpdateTileCoord(z, tileCoordX, tileCoordY, opt_tileCoord);
  }

  /**
   * Although there is repetition between this method and `getTileCoordForXYAndResolution_`,
   * they should have separate implementations.  This method is for integer zoom
   * levels.  The other method should only be called for resolutions corresponding
   * to non-integer zoom levels.
   * @param {number} x Map x coordinate.
   * @param {number} y Map y coordinate.
   * @param {number} z Integer zoom level.
   * @param {boolean} reverseIntersectionPolicy Instead of letting edge
   *     intersections go to the higher tile coordinate, let edge intersections
   *     go to the lower tile coordinate.
   * @param {import("../tilecoord").TileCoord} [opt_tileCoord] Temporary import("../tilecoord").TileCoord object.
   * @return {import("../tilecoord").TileCoord} Tile coordinate.
   * @private
   */
  getTileCoordForXYAndZ_(x, y, z, reverseIntersectionPolicy, opt_tileCoord) {
    const origin = this.getOrigin(z);
    const resolution = this.getResolution(z);
    const tileSize = toSize(this.getTileSize(z), this.tmpSize_);

    let tileCoordX = (x - origin[0]) / resolution / tileSize[0];
    let tileCoordY = (origin[1] - y) / resolution / tileSize[1];

    if (reverseIntersectionPolicy) {
      tileCoordX = ceil(tileCoordX, DECIMALS) - 1;
      tileCoordY = ceil(tileCoordY, DECIMALS) - 1;
    } else {
      tileCoordX = floor(tileCoordX, DECIMALS);
      tileCoordY = floor(tileCoordY, DECIMALS);
    }

    return createOrUpdateTileCoord(z, tileCoordX, tileCoordY, opt_tileCoord);
  }

  /**
   * Get a tile coordinate given a map coordinate and zoom level.
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {number} z Zoom level.
   * @param {import("../tilecoord").TileCoord} [opt_tileCoord] Destination import("../tilecoord").TileCoord object.
   * @return {import("../tilecoord").TileCoord} Tile coordinate.
   * @api
   */
  getTileCoordForCoordAndZ(coordinate, z, opt_tileCoord) {
    return this.getTileCoordForXYAndZ_(
      coordinate[0],
      coordinate[1],
      z,
      false,
      opt_tileCoord
    );
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @return {number} Tile resolution.
   */
  getTileCoordResolution(tileCoord) {
    return this.resolutions_[tileCoord[0]];
  }

  /**
   * Get the tile size for a zoom level. The type of the return value matches the
   * `tileSize` or `tileSizes` that the tile grid was configured with. To always
   * get an {@link import("../size").Size}, run the result through {@link module:ol/size.toSize}.
   * @param {number} z Z.
   * @return {number|import("../size").Size} Tile size.
   * @api
   */
  getTileSize(z) {
    if (this.tileSize_) {
      return this.tileSize_;
    }
    return this.tileSizes_[z];
  }

  /**
   * @param {number} z Zoom level.
   * @return {import("../TileRange").default} Extent tile range for the specified zoom level.
   */
  getFullTileRange(z) {
    if (!this.fullTileRanges_) {
      return this.extent_
        ? this.getTileRangeForExtentAndZ(this.extent_, z)
        : null;
    }
    return this.fullTileRanges_[z];
  }

  /**
   * @param {number} resolution Resolution.
   * @param {number|import("../array").NearestDirectionFunction} [opt_direction]
   *     If 0, the nearest resolution will be used.
   *     If 1, the nearest higher resolution (lower Z) will be used. If -1, the
   *     nearest lower resolution (higher Z) will be used. Default is 0.
   *     Use a {@link module:ol/array~NearestDirectionFunction} for more precise control.
   *
   * For example to change tile Z at the midpoint of zoom levels
   * ```js
   * function(value, high, low) {
   *   return value - low * Math.sqrt(high / low);
   * }
   * ```
   * @return {number} Z.
   * @api
   */
  getZForResolution(resolution, opt_direction?) {
    const z = linearFindNearest(
      this.resolutions_,
      resolution,
      opt_direction || 0
    );
    return clamp(z, this.minZoom, this.maxZoom);
  }

  /**
   * The tile with the provided tile coordinate intersects the given viewport.
   * @param {import('../tilecoord').TileCoord} tileCoord Tile coordinate.
   * @param {Array<number>} viewport Viewport as returned from {@link module:ol/extent.getRotatedViewport}.
   * @return {boolean} The tile with the provided tile coordinate intersects the given viewport.
   */
  tileCoordIntersectsViewport(tileCoord, viewport) {
    return intersectsLinearRing(
      viewport,
      0,
      viewport.length,
      2,
      this.getTileCoordExtent(tileCoord)
    );
  }

  /**
   * @param {!import("../extent").Extent} extent Extent for this tile grid.
   * @private
   */
  calculateTileRanges_(extent) {
    const length = this.resolutions_.length;
    const fullTileRanges = new Array(length);
    for (let z = this.minZoom; z < length; ++z) {
      fullTileRanges[z] = this.getTileRangeForExtentAndZ(extent, z);
    }
    this.fullTileRanges_ = fullTileRanges;
  }
}

export default TileGrid;
