/**
 * @module tl/geom/MultiLineString
 */
import LineString from './LineString';
import SimpleGeometry from './SimpleGeometry';
import {arrayMaxSquaredDelta, assignClosestArrayPoint} from './flat/closest';
import {closestSquaredDistanceXY} from '../extent';
import {deflateCoordinatesArray} from './flat/deflate';
import {douglasPeuckerArray} from './flat/simplify';
import {extend} from '../array';
import {inflateCoordinatesArray} from './flat/inflate';
import {
  interpolatePoint,
  lineStringsCoordinateAtM,
} from './flat/interpolate';
import {intersectsLineStringArray} from './flat/intersectsextent';
import {Coordinate, Coordinates, FlatCoordinates} from "../coordinate";
import {GeometryLayout, GeometryType} from "./Geometry";
import {Extent} from "../extent/Extent";

/**
 * @classdesc
 * Multi-linestring geometry.
 *
 * @api
 */
class MultiLineString extends SimpleGeometry {
  /**
   * @param {Array<Array<import("../coordinate").Coordinate>|LineString>|Array<number>} coordinates
   *     Coordinates or LineString geometries. (For internal use, flat coordinates in
   *     combination with `layout` and `ends` are also accepted.)
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   * @param {Array<number>} [ends] Flat coordinate ends for internal use.
   */

  private ends_: FlatCoordinates;
  private maxDelta_: number;
  private maxDeltaRevision_: number;

  constructor(coordinates: Coordinates[] | LineString[] | FlatCoordinates, layout?: GeometryLayout, ends?: FlatCoordinates) {
    super();

    /**
     * @type {Array<number>}
     * @private
     */
    this.ends_ = [];

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

    if (Array.isArray(coordinates[0])) {
      this.setCoordinates(
        /** @type {Array<Array<import("../coordinate").Coordinate>>} */ (
          <Coordinates[]>coordinates
        ),
        layout
      );
    } else if (layout !== undefined && ends) {
      this.setFlatCoordinates(
        layout,
        /** @type {Array<number>} */ <FlatCoordinates>(coordinates)
      );
      this.ends_ = ends;
    } else {
      let layout: GeometryLayout = this.getLayout();
      const lineStrings: LineString[] = /** @type {Array<LineString>} */ <LineString[]>(coordinates);
      const flatCoordinates: FlatCoordinates = [];
      const ends: FlatCoordinates = [];
      for (let i: number = 0, ii: number = lineStrings.length; i < ii; ++i) {
        const lineString: LineString = lineStrings[i];
        if (i === 0) {
          layout = lineString.getLayout();
        }
        extend(flatCoordinates, lineString.getFlatCoordinates());
        ends.push(flatCoordinates.length);
      }
      this.setFlatCoordinates(layout, flatCoordinates);
      this.ends_ = ends;
    }
  }

  /**
   * Append the passed linestring to the multilinestring.
   * @param {LineString} lineString LineString.
   * @api
   */
  public appendLineString(lineString: LineString): void {
    if (!this.flatCoordinates) {
      this.flatCoordinates = lineString.getFlatCoordinates().slice();
    } else {
      extend(this.flatCoordinates, lineString.getFlatCoordinates().slice());
    }
    this.ends_.push(this.flatCoordinates.length);
    this.changed();
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!MultiLineString} Clone.
   * @api
   */
  public clone(): MultiLineString {
    const multiLineString: MultiLineString = new MultiLineString(
      this.flatCoordinates.slice(),
      this.layout,
      this.ends_.slice()
    );
    multiLineString.applyProperties(this);
    return multiLineString;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @param {import("../coordinate").Coordinate} closestPoint Closest point.
   * @param {number} minSquaredDistance Minimum squared distance.
   * @return {number} Minimum squared distance.
   */
  public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number {
    let closestSquaredDistance = closestSquaredDistanceXY(this.getExtent(), x, y);
    if (minSquaredDistance < closestSquaredDistance) {
      return minSquaredDistance;
    }
    if (this.maxDeltaRevision_ != this.getRevision()) {
      this.maxDelta_ = Math.sqrt(
        arrayMaxSquaredDelta(
          this.flatCoordinates,
          0,
          this.ends_,
          this.stride,
          0
        )
      );
      this.maxDeltaRevision_ = this.getRevision();
    }
    return assignClosestArrayPoint(
      this.flatCoordinates,
      0,
      this.ends_,
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
   * Returns the coordinate at `m` using linear interpolation, or `null` if no
   * such coordinate exists.
   *
   * `extrapolate` controls extrapolation beyond the range of Ms in the
   * MultiLineString. If `extrapolate` is `true` then Ms less than the first
   * M will return the first coordinate and Ms greater than the last M will
   * return the last coordinate.
   *
   * `interpolate` controls interpolation between consecutive LineStrings
   * within the MultiLineString. If `interpolate` is `true` the coordinates
   * will be linearly interpolated between the last coordinate of one LineString
   * and the first coordinate of the next LineString.  If `interpolate` is
   * `false` then the function will return `null` for Ms falling between
   * LineStrings.
   *
   * @param {number} m M.
   * @param {boolean} [extrapolate] Extrapolate. Default is `false`.
   * @param {boolean} [interpolate] Interpolate. Default is `false`.
   * @return {import("../coordinate").Coordinate|null} Coordinate.
   * @api
   */
  public getCoordinateAtM(m: number, extrapolate: boolean = false, interpolate: boolean = false) {
    if (
      (this.layout != 'XYM' && this.layout != 'XYZM') ||
      this.flatCoordinates.length === 0
    ) {
      return null;
    }
    extrapolate = extrapolate !== undefined ? extrapolate : false;
    interpolate = interpolate !== undefined ? interpolate : false;
    return lineStringsCoordinateAtM(
      this.flatCoordinates,
      0,
      this.ends_,
      this.stride,
      m,
      extrapolate,
      interpolate
    );
  }

  /**
   * Return the coordinates of the multilinestring.
   * @return {Array<Array<import("../coordinate").Coordinate>>} Coordinates.
   * @api
   */
  public getCoordinates(): Coordinates[] {
    return inflateCoordinatesArray(
      this.flatCoordinates,
      0,
      this.ends_,
      this.stride
    );
  }

  /**
   * @return {Array<number>} Ends.
   */
  public getEnds(): FlatCoordinates {
    return this.ends_;
  }

  /**
   * Return the linestring at the specified index.
   * @param {number} index Index.
   * @return {LineString} LineString.
   * @api
   */
  public getLineString(index: number): LineString {
    if (index < 0 || this.ends_.length <= index) {
      return null;
    }
    return new LineString(
      this.flatCoordinates.slice(
        index === 0 ? 0 : this.ends_[index - 1],
        this.ends_[index]
      ),
      this.layout
    );
  }

  /**
   * Return the linestrings of this multilinestring.
   * @return {Array<LineString>} LineStrings.
   * @api
   */
  public getLineStrings(): LineString[] {
    const flatCoordinates: FlatCoordinates = this.flatCoordinates;
    const ends: FlatCoordinates = this.ends_;
    const layout: GeometryLayout = this.layout;
    /** @type {Array<LineString>} */
    const lineStrings: LineString[] = [];
    let offset: number = 0;
    for (let i: number = 0, ii: number = ends.length; i < ii; ++i) {
      const end: number = ends[i];
      const lineString: LineString = new LineString(
        flatCoordinates.slice(offset, end),
        layout
      );
      lineStrings.push(lineString);
      offset = end;
    }
    return lineStrings;
  }

  /**
   * @return {Array<number>} Flat midpoints.
   */
  public getFlatMidpoints(): FlatCoordinates {
    const midpoints: FlatCoordinates = [];
    const flatCoordinates: FlatCoordinates = this.flatCoordinates;
    let offset: number = 0;
    const ends: FlatCoordinates = this.ends_;
    const stride: number = this.stride;
    for (let i: number = 0, ii: number = ends.length; i < ii; ++i) {
      const end: number = ends[i];
      const midpoint: FlatCoordinates = interpolatePoint(
        flatCoordinates,
        offset,
        end,
        stride,
        0.5
      );
      extend(midpoints, midpoint);
      offset = end;
    }
    return midpoints;
  }

  /**
   * @param {number} squaredTolerance Squared tolerance.
   * @return {MultiLineString} Simplified MultiLineString.
   * @protected
   */
  public getSimplifiedGeometryInternal(squaredTolerance: number): MultiLineString {
    const simplifiedFlatCoordinates = [];
    const simplifiedEnds = [];
    simplifiedFlatCoordinates.length = douglasPeuckerArray(
      this.flatCoordinates,
      0,
      this.ends_,
      this.stride,
      squaredTolerance,
      simplifiedFlatCoordinates,
      0,
      simplifiedEnds
    );
    return new MultiLineString(simplifiedFlatCoordinates, 'XY', simplifiedEnds);
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'MultiLineString';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    return intersectsLineStringArray(
      this.flatCoordinates,
      0,
      this.ends_,
      this.stride,
      extent
    );
  }

  /**
   * Set the coordinates of the multilinestring.
   * @param {!Array<Array<import("../coordinate").Coordinate>>} coordinates Coordinates.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   * @api
   */
  public setCoordinates(coordinates: Coordinates[], layout: GeometryLayout): void {
    this.setLayout(layout, coordinates, 2);
    if (!this.flatCoordinates) {
      this.flatCoordinates = [];
    }
    const ends = deflateCoordinatesArray(
      this.flatCoordinates,
      0,
      coordinates,
      this.stride,
      this.ends_
    );
    this.flatCoordinates.length = ends.length === 0 ? 0 : ends[ends.length - 1];
    this.changed();
  }
}

export default MultiLineString;
