/**
 * @module ol/geom/LinearRing
 */
import SimpleGeometry from './SimpleGeometry';
import {assignClosestPoint, maxSquaredDelta} from './flat/closest';
import {closestSquaredDistanceXY} from '../extent';
import {deflateCoordinates} from './flat/deflate';
import {douglasPeucker} from './flat/simplify';
import {inflateCoordinates} from './flat/inflate';
import {linearRing as linearRingArea} from './flat/area';
import {Coordinate, Coordinates, FlatCoordinates} from "../coordinate";
import {GeometryLayout, GeometryType} from "./Geometry";
import {Extent} from "../extent/Extent";

/**
 * @classdesc
 * Linear ring geometry. Only used as part of polygon; cannot be rendered
 * on its own.
 *
 * @api
 */
export default class LinearRing extends SimpleGeometry {
  /**
   * @param {Array<import("../coordinate").Coordinate>|FlatCoordinates} coordinates Coordinates.
   *     For internal use, flat coordinates in combination with `layout` are also accepted.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   */

  private maxDelta_: number;
  private maxDeltaRevision_: number;

  constructor(coordinates: Coordinates | FlatCoordinates, layout?: GeometryLayout) {
    super();

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
        <FlatCoordinates>coordinates
      );
    } else {
      this.setCoordinates(
          <Coordinates>coordinates,
          layout
      );
    }
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!LinearRing} Clone.
   * @api
   */
  public clone(): LinearRing {
    return new LinearRing(this.flatCoordinates.slice(), this.layout);
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @param {import("../coordinate").Coordinate} closestPoint Closest point.
   * @param {number} minSquaredDistance Minimum squared distance.
   * @return {number} Minimum squared distance.
   */
  public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number {
    let closestSquaredDistance = closestSquaredDistanceXY(this.getExtent(), x, y)
    if (minSquaredDistance < closestSquaredDistance) {
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
      true,
      x,
      y,
      closestPoint,
      minSquaredDistance
    );
  }

  /**
   * Return the area of the linear ring on projected plane.
   * @return {number} Area (on projected plane).
   * @api
   */
  public getArea(): number {
    return linearRingArea(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride
    );
  }

  /**
   * Return the coordinates of the linear ring.
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
   * @param {number} squaredTolerance Squared tolerance.
   * @return {LinearRing} Simplified LinearRing.
   * @protected
   */
  protected getSimplifiedGeometryInternal(squaredTolerance: number): LinearRing {
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
    return new LinearRing(simplifiedFlatCoordinates, 'XY');
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").GeometryType} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'LinearRing';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    return false;
  }

  /**
   * Set the coordinates of the linear ring.
   * @param {!Array<import("../coordinate").Coordinate>} coordinates Coordinates.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   * @api
   */
  public setCoordinates(coordinates: Coordinates, layout?: GeometryLayout): void {
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