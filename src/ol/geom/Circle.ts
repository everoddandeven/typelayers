/**
 * @module ol/geom/Circle
 */
import SimpleGeometry from './SimpleGeometry';
import {createOrUpdate, Extent, forEachCorner, intersects} from '../extent';
import {deflateCoordinate} from './flat/deflate';
import {rotate} from './flat/transform';
import {Coordinate, Coordinates} from "../coordinate";
import {GeometryLayout, GeometryType} from './Geometry';

/**
 * @classdesc
 * Circle geometry.
 *
 * @api
 */
export default class Circle extends SimpleGeometry {
  /**
   * @param {!import("../coordinate").Coordinate} center Center.
   *     For internal use, flat coordinates in combination with `layout` and no
   *     `radius` are also accepted.
   * @param {number} [radius] Radius in units of the projection.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   */
  constructor(center: Coordinate, radius: number, layout: GeometryLayout) {
    super();
    if (layout !== undefined && radius === undefined) {
      this.setFlatCoordinates(layout, center);
    } else {
      radius = radius ? radius : 0;
      this.setCenterAndRadius(center, radius, layout);
    }
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!Circle} Clone.
   * @api
   */
  public clone(): Circle {
    const circle = new Circle(
      <Coordinate>this.flatCoordinates.slice(),
      undefined,
      this.layout
    );

    circle.applyProperties(this);
    return circle;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @param {import("../coordinate").Coordinate} closestPoint Closest point.
   * @param {number} minSquaredDistance Minimum squared distance.
   * @return {number} Minimum squared distance.
   */
  public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number {
    const flatCoordinates = this.flatCoordinates;
    const dx = x - flatCoordinates[0];
    const dy = y - flatCoordinates[1];
    const squaredDistance = dx * dx + dy * dy;
    if (squaredDistance < minSquaredDistance) {
      if (squaredDistance === 0) {
        for (let i = 0; i < this.stride; ++i) {
          closestPoint[i] = flatCoordinates[i];
        }
      } else {
        const delta = this.getRadius() / Math.sqrt(squaredDistance);
        closestPoint[0] = flatCoordinates[0] + delta * dx;
        closestPoint[1] = flatCoordinates[1] + delta * dy;
        for (let i = 2; i < this.stride; ++i) {
          closestPoint[i] = flatCoordinates[i];
        }
      }
      //closestPoint.length = this.stride;

      closestPoint.length = 2;

      return squaredDistance;
    }
    return minSquaredDistance;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @return {boolean} Contains (x, y).
   */
  public containsXY(x: number, y: number): boolean {
    const flatCoordinates = this.flatCoordinates;
    const dx = x - flatCoordinates[0];
    const dy = y - flatCoordinates[1];
    return dx * dx + dy * dy <= this.getRadiusSquared_();
  }

  /**
   * Return the center of the circle as {@link module:ol/coordinate~Coordinate coordinate}.
   * @return {import("../coordinate").Coordinate} Center.
   * @api
   */
  public getCenter(): Coordinate {
    return <Coordinate>this.flatCoordinates.slice(0, this.stride);
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @protected
   * @return {import("../extent").Extent} extent Extent.
   */
  public computeExtent(extent: Extent): Extent {
    const flatCoordinates = this.flatCoordinates;
    const radius = flatCoordinates[this.stride] - flatCoordinates[0];
    return createOrUpdate(
      flatCoordinates[0] - radius,
      flatCoordinates[1] - radius,
      flatCoordinates[0] + radius,
      flatCoordinates[1] + radius,
      extent
    );
  }

  /**
   * Return the radius of the circle.
   * @return {number} Radius.
   * @api
   */
  public getRadius(): number {
    return Math.sqrt(this.getRadiusSquared_());
  }

  /**
   * @private
   * @return {number} Radius squared.
   */
  private getRadiusSquared_(): number {
    const dx = this.flatCoordinates[this.stride] - this.flatCoordinates[0];
    const dy = this.flatCoordinates[this.stride + 1] - this.flatCoordinates[1];
    return dx * dx + dy * dy;
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'Circle';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    const circleExtent = this.getExtent();
    if (intersects(extent, circleExtent)) {
      const center = this.getCenter();

      if (extent[0] <= center[0] && extent[2] >= center[0]) {
        return true;
      }
      if (extent[1] <= center[1] && extent[3] >= center[1]) {
        return true;
      }

      return forEachCorner(extent, this.intersectsCoordinate.bind(this));
    }
    return false;
  }

  /**
   * Set the center of the circle as {@link module:ol/coordinate~Coordinate coordinate}.
   * @param {import("../coordinate").Coordinate} center Center.
   * @api
   */
  public setCenter(center: Coordinate): void {
    const stride = this.stride;
    const radius = this.flatCoordinates[stride] - this.flatCoordinates[0];
    const flatCoordinates = center.slice();
    flatCoordinates[stride] = flatCoordinates[0] + radius;
    for (let i = 1; i < stride; ++i) {
      flatCoordinates[stride + i] = center[i];
    }
    this.setFlatCoordinates(this.layout, flatCoordinates);
    this.changed();
  }

  /**
   * Set the center (as {@link module:ol/coordinate~Coordinate coordinate}) and the radius (as
   * number) of the circle.
   * @param {!import("../coordinate").Coordinate} center Center.
   * @param {number} radius Radius.
   * @param {import("./Geometry").GeometryLayout} [layout] Layout.
   * @api
   */
  public setCenterAndRadius(center: Coordinate, radius: number, layout: GeometryLayout): void {
    this.setLayout(layout, center, 0);
    if (!this.flatCoordinates) {
      this.flatCoordinates = [];
    }

    const flatCoordinates = this.flatCoordinates;
    let offset = deflateCoordinate(flatCoordinates, 0, center, this.stride);
    flatCoordinates[offset++] = flatCoordinates[0] + radius;
    for (let i = 1, ii = this.stride; i < ii; ++i) {
      flatCoordinates[offset++] = flatCoordinates[i];
    }
    flatCoordinates.length = offset;
    this.changed();
  }

  public getCoordinates() {
    return null;
  }

  public setCoordinates(coordinates: Coordinates, layout: GeometryLayout): void {}

  /**
   * Set the radius of the circle. The radius is in the units of the projection.
   * @param {number} radius Radius.
   * @api
   */
  public setRadius(radius: number): void {
    this.flatCoordinates[this.stride] = this.flatCoordinates[0] + radius;
    this.changed();
  }

  /**
   * Rotate the geometry around a given coordinate. This modifies the geometry
   * coordinates in place.
   * @param {number} angle Rotation angle in counter-clockwise radians.
   * @param {import("../coordinate").Coordinate} anchor The rotation center.
   * @api
   */
  public rotate(angle: number, anchor: Coordinate): void {
    const center = this.getCenter();
    const stride = this.getStride();
    this.setCenter(
      <Coordinate>rotate(center, 0, center.length, stride, angle, anchor, center)
    );
    this.changed();
  }
}

/**
 * Transform each coordinate of the circle from one coordinate reference system
 * to another. The geometry is modified in place.
 * If you do not want the geometry modified in place, first clone() it and
 * then use this function on the clone.
 *
 * Internally a circle is currently represented by two points: the center of
 * the circle `[cx, cy]`, and the point to the right of the circle
 * `[cx + r, cy]`. This `transform` function just transforms these two points.
 * So the resulting geometry is also a circle, and that circle does not
 * correspond to the shape that would be obtained by transforming every point
 * of the original circle.
 *
 * @param {import("../proj").ProjectionLike} source The current projection.  Can be a
 *     string identifier or a {@link module:ol/proj/Projection~Projection} object.
 * @param {import("../proj").ProjectionLike} destination The desired projection.  Can be a
 *     string identifier or a {@link module:ol/proj/Projection~Projection} object.
 * @return {Circle} This geometry.  Note that original geometry is
 *     modified in place.
 * @function
 * @api
 */
Circle.prototype.transform;

