/**
 * @module tl/geom/LineString
 */
import SimpleGeometry from './SimpleGeometry';
import {assignClosestPoint, maxSquaredDelta} from './flat/closest';
import {closestSquaredDistanceXY} from '../extent';
import {deflateCoordinates} from './flat/deflate';
import {douglasPeucker} from './flat/simplify';
import {extend} from '../array';
import {forEach as forEachSegment} from './flat/segments';
import {inflateCoordinates} from './flat/inflate';
import {interpolatePoint, lineStringCoordinateAtM} from './flat/interpolate';
import {intersectsLineString} from './flat/intersectsextent';
import {lineStringLength} from './flat/length';
import {Coordinate, Coordinates, FlatCoordinates} from "../coordinate";
import {GeometryLayout, GeometryType} from "./Geometry";
import {Extent} from "../extent/Extent";

/**
 * @classdesc
 * Linestring geometry.
 *
 * @api
 */
export default class LineString extends SimpleGeometry {
  /**
   * @param {Array<import("../coordinate").Coordinate>|Array<number>} coordinates Coordinates.
   *     For internal use, flat coordinates in combination with `layout` are also accepted.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   */

  private flatMidpoint_?: Coordinate;
  private flatMidpointRevision_: number;
  private maxDelta_: number;
  private maxDeltaRevision_: number;

  constructor(coordinates: Coordinates | FlatCoordinates, layout?: GeometryLayout) {
    super();

    /**
     * @private
     * @type {import("../coordinate").Coordinate}
     */
    this.flatMidpoint_ = null;

    /**
     * @private
     * @type {number}
     */
    this.flatMidpointRevision_ = -1;

    /**
     * @private
     * @type {number}
     */
    this.maxDelta_ = -1;

    /**
     * @private
     * @type {number}
     */
    this.maxDeltaRevision_ = -1;

    if (layout !== undefined && !Array.isArray(coordinates[0])) {
      this.setFlatCoordinates(
        layout,
        coordinates as FlatCoordinates
      );
    }
    else
    {
      this.setCoordinates(coordinates as Coordinates, layout);
    }
  }

  /**
   * Append the passed coordinate to the coordinates of the linestring.
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @api
   */
  public appendCoordinate(coordinate: Coordinate): void {
    if (!this.flatCoordinates) {
      this.flatCoordinates = coordinate.slice();
    } else {
      extend(this.flatCoordinates, coordinate);
    }
    this.changed();
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!LineString} Clone.
   * @api
   */
  public clone(): LineString {
    const lineString: LineString = new LineString(
      this.flatCoordinates.slice(),
      this.layout
    );

    lineString.applyProperties(this);

    return lineString;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @param {import("../coordinate").Coordinate} closestPoint Closest point.
   * @param {number} minSquaredDistance Minimum squared distance.
   * @return {number} Minimum squared distance.
   */
  public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number {
    if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
      return minSquaredDistance;
    }
    if (this.maxDeltaRevision_ != this.getRevision()) {
      this.maxDelta_ = Math.sqrt(
        maxSquaredDelta(
          this.flatCoordinates,
          0,
          this.flatCoordinates.length,
          this.stride,
          0
        )
      );
      this.maxDeltaRevision_ = this.getRevision();
    }
    return assignClosestPoint(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      this.maxDelta_,
      false,
      x,
      y,
      closestPoint,
      minSquaredDistance
    );
  }

  /**
   * Iterate over each segment, calling the provided callback.
   * If the callback returns a truthy value the function returns that
   * value immediately. Otherwise, the function returns `false`.
   *
   * @param {function(this: S, import("../coordinate").Coordinate, import("../coordinate").Coordinate): T} callback Function
   *     called for each segment. The function will receive two arguments, the start and end coordinates of the segment.
   * @return {T|boolean} Value.
   * @template T,S
   * @api
   */
  public forEachSegment(callback: (start: Coordinate, end: Coordinate) => any): boolean {
    return forEachSegment(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      callback
    );
  }

  /**
   * Returns the coordinate at `m` using linear interpolation, or `null` if no
   * such coordinate exists.
   *
   * `extrapolate` controls extrapolation beyond the range of Ms in the
   * MultiLineString. If `extrapolate` is `true` then Ms less than the first
   * M will return the first coordinate and Ms greater than the last M will
   * return the last coordinate.
   *
   * @param {number} m M.
   * @param {boolean} [extrapolate] Extrapolate. Default is `false`.
   * @return {import("../coordinate").Coordinate|null} Coordinate.
   * @api
   */
  public getCoordinateAtM(m: number, extrapolate: boolean): Coordinate {
    if (this.layout != 'XYM' && this.layout != 'XYZM') {
      return null;
    }
    extrapolate = extrapolate !== undefined ? extrapolate : false;
    return lineStringCoordinateAtM(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      m,
      extrapolate
    );
  }

  /**
   * Return the coordinates of the linestring.
   * @return {Array<import("../coordinate").Coordinate>} Coordinates.
   * @api
   */
  public getCoordinates(): Coordinates {
    return inflateCoordinates(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride
    );
  }

  /**
   * Return the coordinate at the provided fraction along the linestring.
   * The `fraction` is a number between 0 and 1, where 0 is the start of the
   * linestring and 1 is the end.
   * @param {number} fraction Fraction.
   * @param {import("../coordinate").Coordinate} [dest] Optional coordinate whose values will
   *     be modified. If not provided, a new coordinate will be returned.
   * @return {import("../coordinate").Coordinate} Coordinate of the interpolated point.
   * @api
   */
  public getCoordinateAt(fraction: number, dest: Coordinate): Coordinate {
    return <Coordinate>interpolatePoint(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      fraction,
      dest,
      this.stride
    );
  }

  /**
   * Return the length of the linestring on projected plane.
   * @return {number} Length (on projected plane).
   * @api
   */
  public getLength(): number {
    return lineStringLength(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride
    );
  }

  /**
   * @return {Array<number>} Flat midpoint.
   */
  public getFlatMidpoint(): number[] {
    if (this.flatMidpointRevision_ != this.getRevision()) {
      this.flatMidpoint_ = this.getCoordinateAt(0.5, this.flatMidpoint_);
      this.flatMidpointRevision_ = this.getRevision();
    }
    return this.flatMidpoint_;
  }

  /**
   * @param {number} squaredTolerance Squared tolerance.
   * @return {LineString} Simplified LineString.
   * @protected
   */
  protected getSimplifiedGeometryInternal(squaredTolerance: number): LineString {
    const simplifiedFlatCoordinates = [];
    simplifiedFlatCoordinates.length = douglasPeucker(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      squaredTolerance,
      simplifiedFlatCoordinates,
      0
    );
    return new LineString(simplifiedFlatCoordinates, 'XY');
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'LineString';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    return intersectsLineString(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      extent
    );
  }

  /**
   * Set the coordinates of the linestring.
   * @param {!Array<import("../coordinate").Coordinate>} coordinates Coordinates.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   * @api
   */
  public setCoordinates(coordinates: Coordinates, layout: GeometryLayout): void {
    this.setLayout(layout, coordinates, 1);
    if (!this.flatCoordinates) {
      this.flatCoordinates = [];
    }
    this.flatCoordinates.length = deflateCoordinates(
      this.flatCoordinates,
      0,
      coordinates,
      this.stride
    );
    this.changed();
  }
}