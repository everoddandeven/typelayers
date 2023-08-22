/**
 * @module tl/geom/Point
 */
import SimpleGeometry from './SimpleGeometry';
import {containsXY, createOrUpdateFromCoordinate} from '../extent';
import {deflateCoordinate} from './flat/deflate';
import {squaredDistance as squaredDx} from '../math';
import {Coordinate, Coordinates} from "../coordinate";
import {GeometryLayout, GeometryType} from "./Geometry";
import {Extent} from "../extent/Extent";

/**
 * @classdesc
 * Point geometry.
 *
 * @api
 */
export default class Point extends SimpleGeometry {

  public m: number;
  public z: number;

  constructor(coordinate: number[], layout: GeometryLayout = 'XY') {
    super();

    this.setCoordinates([<Coordinate>[coordinate[0], coordinate[1]]], layout);

    this.z = layout.includes('Z') && coordinate.length > 2 ? coordinate[2] : 0;
    this.m = layout.includes('M') && coordinate.length > 3 ? coordinate[3] : 0;
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!Point} Clone.
   * @api
   */
  public clone(): Point {
    const point = new Point(<Coordinate>this.flatCoordinates.slice(), this.layout);
    point.applyProperties(this);
    return point;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @param {import("../coordinate").Coordinate} closestPoint Closest point.
   * @param {number} minSquaredDistance Minimum squared distance.
   * @return {number} Minimum squared distance.
   */
  closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number {
    const flatCoordinates = this.flatCoordinates;
    const squaredDistance = squaredDx(
      x,
      y,
      flatCoordinates[0],
      flatCoordinates[1]
    );
    if (squaredDistance < minSquaredDistance) {
      const stride: number = this.stride;
      for (let i: number = 0; i < stride; ++i) {
        closestPoint[i] = flatCoordinates[i];
      }

      //closestPoint.length = stride;
      closestPoint.length = 2;
      return squaredDistance;
    }
    return minSquaredDistance;
  }

  /**
   * Return the coordinate of the point.
   * @return {import("../coordinate").Coordinate} Coordinates.
   * @api
   */
  public getCoordinates(): Coordinate {
    return !this.flatCoordinates ? [NaN, NaN] : <Coordinate>this.flatCoordinates.slice();
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @protected
   * @return {import("../extent").Extent} extent Extent.
   */
  public computeExtent(extent: Extent): Extent {
    return createOrUpdateFromCoordinate(<Coordinate>this.flatCoordinates, extent);
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'Point';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    return containsXY(extent, this.flatCoordinates[0], this.flatCoordinates[1]);
  }

  /**
   * @param {!Array<*>} coordinates Coordinates.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   * @api
   */
  public setCoordinates(coordinates: Coordinates, layout: GeometryLayout): void {
    this.setLayout(layout, coordinates, 0);
    if (!this.flatCoordinates) {
      this.flatCoordinates = [];
    }
    this.flatCoordinates.length = deflateCoordinate(
      this.flatCoordinates,
      0,
      coordinates[0],
      this.stride
    );
    this.changed();
  }
}
