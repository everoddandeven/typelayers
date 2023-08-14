/**
 * @module ol/geom/MultiPoint
 */
import Point from './Point';
import SimpleGeometry from './SimpleGeometry';
import {closestSquaredDistanceXY, containsXY} from '../extent';
import {deflateCoordinates} from './flat/deflate';
import {extend} from '../array';
import {inflateCoordinates} from './flat/inflate';
import {squaredDistance as squaredDx} from '../math';
import {Coordinate, Coordinates, FlatCoordinates} from "../coordinate";
import {GeometryLayout, GeometryType} from "./Geometry";
import {Extent} from "../extent/Extent";

/**
 * @classdesc
 * Multi-point geometry.
 *
 * @api
 */
class MultiPoint extends SimpleGeometry {
  /**
   * @param {Array<import("../coordinate").Coordinate>|Array<number>} coordinates Coordinates.
   *     For internal use, flat coordinates in combination with `layout` are also accepted.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   */
  constructor(coordinates: Coordinates | FlatCoordinates, layout?: GeometryLayout) {
    super();
    if (layout && !Array.isArray(coordinates[0])) {
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
   * Append the passed point to this multipoint.
   * @param {Point} point Point.
   * @api
   */
  public appendPoint(point: Point): void {
    if (!this.flatCoordinates) {
      this.flatCoordinates = point.getFlatCoordinates().slice();
    } else {
      extend(this.flatCoordinates, point.getFlatCoordinates());
    }
    this.changed();
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!MultiPoint} Clone.
   * @api
   */
  public clone(): MultiPoint {
    const multiPoint = new MultiPoint(
      this.flatCoordinates.slice(),
      this.layout
    );
    multiPoint.applyProperties(this);
    return multiPoint;
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
    const flatCoordinates = this.flatCoordinates;
    const stride = this.stride;
    for (let i = 0, ii = flatCoordinates.length; i < ii; i += stride) {
      const squaredDistance = squaredDx(
        x,
        y,
        flatCoordinates[i],
        flatCoordinates[i + 1]
      );
      if (squaredDistance < minSquaredDistance) {
        minSquaredDistance = squaredDistance;
        for (let j = 0; j < stride; ++j) {
          closestPoint[j] = flatCoordinates[i + j];
        }
        // closestPoint.length = stride;
        closestPoint.length = 2;
      }
    }
    return minSquaredDistance;
  }

  /**
   * Return the coordinates of the multipoint.
   * @return {Array<import("../coordinate").Coordinate>} Coordinates.
   * @api
   */
  public getCoordinates(): Coordinate[] {
    return inflateCoordinates(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride
    );
  }

  /**
   * Return the point at the specified index.
   * @param {number} index Index.
   * @return {Point} Point.
   * @api
   */
  public getPoint(index: number): Point {
    const n = !this.flatCoordinates
      ? 0
      : this.flatCoordinates.length / this.stride;
    if (index < 0 || n <= index) {
      return null;
    }
    return new Point(
      <Coordinate>this.flatCoordinates.slice(
        index * this.stride,
        (index + 1) * this.stride
      ),
      this.layout
    );
  }

  /**
   * Return the points of this multipoint.
   * @return {Array<Point>} Points.
   * @api
   */
  public getPoints(): Point[] {
    const flatCoordinates = this.flatCoordinates;
    const layout = this.layout;
    const stride = this.stride;
    /** @type {Array<Point>} */
    const points: Point[] = [];
    for (let i = 0, ii = flatCoordinates.length; i < ii; i += stride) {
      const point = new Point(<Coordinate>flatCoordinates.slice(i, i + stride), layout);
      points.push(point);
    }
    return points;
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'MultiPoint';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    const flatCoordinates = this.flatCoordinates;
    const stride = this.stride;
    for (let i = 0, ii = flatCoordinates.length; i < ii; i += stride) {
      const x = flatCoordinates[i];
      const y = flatCoordinates[i + 1];
      if (containsXY(extent, x, y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Set the coordinates of the multipoint.
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

export default MultiPoint;
