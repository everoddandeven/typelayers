/**
 * @module tl/proj/Projection
 */
import {METERS_PER_UNIT, Units} from './Units';
import {Extent} from "../extent/Extent";
import {Coordinate} from "../coordinate";
import TileGrid from "../tilegrid/TileGrid";

export type PointResolutionFunction = (resolution: number, coord: Coordinate) => number;

interface ProjectionOptions {
  code: string;
  units?: Units;
  extent?: Extent;
  axisOrientation?: string;
  global?: boolean;
  metersPerUnit?: number;
  worldExtent?: Extent;
  getPointResolution?: PointResolutionFunction;
}

/**
 * @classdesc
 * Projection definition class. One of these is created for each projection
 * supported in the application and stored in the {@link module:tl/proj} namespace.
 * You can use these in applications, but this is not required, as API params
 * and options use {@link module:tl/proj~ProjectionLike} which means the simple string
 * code will suffice.
 *
 * You can use {@link module:tl/proj.get} to retrieve the object for a particular
 * projection.
 *
 * The library includes definitions for `EPSG:4326` and `EPSG:3857`, together
 * with the following aliases:
 * * `EPSG:4326`: CRS:84, urn:ogc:def:crs:EPSG:6.6:4326,
 *     urn:ogc:def:crs:OGC:1.3:CRS84, urn:ogc:def:crs:OGC:2:84,
 *     http://www.opengis.net/gml/srs/epsg.xml#4326,
 *     urn:x-ogc:def:crs:EPSG:4326
 * * `EPSG:3857`: EPSG:102100, EPSG:102113, EPSG:900913,
 *     urn:ogc:def:crs:EPSG:6.18:3:3857,
 *     http://www.opengis.net/gml/srs/epsg.xml#3857
 *
 * If you use [proj4js](https://github.com/proj4js/proj4js), aliases can
 * be added using `proj4.defs()`. After all required projection definitions are
 * added, call the {@link module:tl/proj/proj4.register} function.
 *
 * @api
 */
class Projection {
  /**
   * @param {Options} options Projection options.
   */

  private code_: string;
  private units_: Units;
  private extent_: Extent;
  private worldExtent_: Extent;
  private axisOrientation_: string;
  private global_: boolean;
  private canWrapX_: boolean;
  private getPointResolutionFunc_: PointResolutionFunction;
  private defaultTileGrid_: TileGrid;
  private metersPerUnit_?: number | undefined;

  constructor(options: ProjectionOptions) {
    /**
     * @private
     * @type {string}
     */
    this.code_ = options.code;

    /**
     * Units of projected coordinates. When set to `TILE_PIXELS`, a
     * `this.extent_` and `this.worldExtent_` must be configured properly for each
     * tile.
     * @private
     * @type {import("./Units").Units}
     */
    this.units_ = /** @type {import("./Units").Units} */ (options.units);

    /**
     * Validity extent of the projection in projected coordinates. For projections
     * with `TILE_PIXELS` units, this is the extent of the tile in
     * tile pixel space.
     * @private
     * @type {import("../extent").Extent}
     */
    this.extent_ = options.extent !== undefined ? options.extent : null;

    /**
     * Extent of the world in EPSG:4326. For projections with
     * `TILE_PIXELS` units, this is the extent of the tile in
     * projected coordinate space.
     * @private
     * @type {import("../extent").Extent}
     */
    this.worldExtent_ =
      options.worldExtent !== undefined ? options.worldExtent : null;

    /**
     * @private
     * @type {string}
     */
    this.axisOrientation_ =
      options.axisOrientation !== undefined ? options.axisOrientation : 'enu';

    /**
     * @private
     * @type {boolean}
     */
    this.global_ = options.global !== undefined ? options.global : false;

    /**
     * @private
     * @type {boolean}
     */
    this.canWrapX_ = !!(this.global_ && this.extent_);

    /**
     * @private
     * @type {function(number, import("../coordinate").Coordinate):number|undefined}
     */
    this.getPointResolutionFunc_ = options.getPointResolution;

    /**
     * @private
     * @type {import("../tilegrid/TileGrid").default}
     */
    this.defaultTileGrid_ = null;

    /**
     * @private
     * @type {number|undefined}
     */
    this.metersPerUnit_ = options.metersPerUnit;
  }

  /**
   * @return {boolean} The projection is suitable for wrapping the x-axis
   */
  public canWrapX(): boolean {
    return this.canWrapX_;
  }

  /**
   * Get the code for this projection, e.g. 'EPSG:4326'.
   * @return {string} Code.
   * @api
   */
  public getCode(): string {
    return this.code_;
  }

  /**
   * Get the validity extent for this projection.
   * @return {import("../extent").Extent} Extent.
   * @api
   */
  public getExtent(): Extent {
    return this.extent_;
  }

  /**
   * Get the units of this projection.
   * @return {import("./Units").Units} Units.
   * @api
   */
  public getUnits(): Units {
    return this.units_;
  }

  /**
   * Get the amount of meters per unit of this projection.  If the projection is
   * not configured with `metersPerUnit` or a units identifier, the return is
   * `undefined`.
   * @return {number|undefined} Meters.
   * @api
   */
  public getMetersPerUnit(): number | undefined {
    return this.metersPerUnit_ || METERS_PER_UNIT[this.units_];
  }

  /**
   * Get the world extent for this projection.
   * @return {import("../extent").Extent} Extent.
   * @api
   */
  public getWorldExtent(): Extent {
    return this.worldExtent_;
  }

  /**
   * Get the axis orientation of this projection.
   * Example values are:
   * enu - the default easting, northing, elevation.
   * neu - northing, easting, up - useful for "lat/long" geographic coordinates,
   *     or south orientated transverse mercator.
   * wnu - westing, northing, up - some planetary coordinate systems have
   *     "west positive" coordinate systems
   * @return {string} Axis orientation.
   * @api
   */
  public getAxisOrientation(): string {
    return this.axisOrientation_;
  }

  /**
   * Is this projection a global projection which spans the whole world?
   * @return {boolean} Whether the projection is global.
   * @api
   */
  public isGlobal(): boolean {
    return this.global_;
  }

  /**
   * Set if the projection is a global projection which spans the whole world
   * @param {boolean} global Whether the projection is global.
   * @api
   */
  public setGlobal(global: boolean): void {
    this.global_ = global;
    this.canWrapX_ = !!(global && this.extent_);
  }

  /**
   * @return {import("../tilegrid/TileGrid").default} The default tile grid.
   */
  public getDefaultTileGrid(): TileGrid {
    return this.defaultTileGrid_;
  }

  /**
   * @param {import("../tilegrid/TileGrid").default} tileGrid The default tile grid.
   */
  public setDefaultTileGrid(tileGrid: TileGrid): void {
    this.defaultTileGrid_ = tileGrid;
  }

  /**
   * Set the validity extent for this projection.
   * @param {import("../extent").Extent} extent Extent.
   * @api
   */
  public setExtent(extent: Extent): void {
    this.extent_ = extent;
    this.canWrapX_ = !!(this.global_ && extent);
  }

  /**
   * Set the world extent for this projection.
   * @param {import("../extent").Extent} worldExtent World extent
   *     [minlon, minlat, maxlon, maxlat].
   * @api
   */
  public setWorldExtent(worldExtent: Extent): void {
    this.worldExtent_ = worldExtent;
  }

  /**
   * Set the getPointResolution function (see {@link module:tl/proj.getPointResolution}
   * for this projection.
   * @param {function(number, import("../coordinate").Coordinate):number} func Function
   * @api
   */
  public setGetPointResolution(func: PointResolutionFunction): void {
    this.getPointResolutionFunc_ = func;
  }

  /**
   * Get the custom point resolution function for this projection (if set).
   * @return {function(number, import("../coordinate").Coordinate):number|undefined} The custom point
   * resolution function (if set).
   */
  public getPointResolutionFunc(): PointResolutionFunction {
    return this.getPointResolutionFunc_;
  }
}

export default Projection;
