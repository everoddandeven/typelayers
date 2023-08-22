/**
 * @module tl/geom/Geometry
 */
import BaseObject from '../Object';
import {
  compose as composeTransform,
  create as createTransform, Transform,
} from '../transform';
import {
  createEmpty,
  createOrUpdateEmpty,
  getHeight,
  returnOrUpdate,
} from '../extent';
import { Extent } from '../extent/Extent';
import {get as getProjection, getTransform, ProjectionLike, TransformFunction} from '../proj';
import {memoizeOne} from '../functions';
import {transform2D} from './flat/transform';
import {Coordinate, FlatCoordinates} from "../coordinate";
import Projection from "../proj/Projection";

export type GeometryLayout = 'XY' | 'XYZ' | 'XYM' | 'XYZM';
export type GeometryType = 'Point' | 'LineString' | 'LinearRing' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection' | 'Circle';

/**
 * @type {import("../transform").Transform}
 */
const tmpTransform: Transform = createTransform();

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for vector geometries.
 *
 * To get notified of changes to the geometry, register a listener for the
 * generic `change` event on your geometry instance.
 *
 * @abstract
 * @api
 */
export default abstract class Geometry extends BaseObject {
  private extent_: Extent;
  private extentRevision_: number;
  private simplifyTransformedInternal: (
      revision: number,
      squaredTolerance: number,
      transform: TransformFunction
  ) => Geometry;
  protected simplifiedGeometryMaxMinSquaredTolerance: number;
  protected simplifiedGeometryRevision: number;

  protected constructor() {
    super();

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.extent_ = createEmpty();

    /**
     * @private
     * @type {number}
     */
    this.extentRevision_ = -1;

    /**
     * @protected
     * @type {number}
     */
    this.simplifiedGeometryMaxMinSquaredTolerance = 0;

    /**
     * @protected
     * @type {number}
     */
    this.simplifiedGeometryRevision = 0;

    /**
     * Get a transformed and simplified version of the geometry.
     * @abstract
     * @param {number} revision The geometry revision.
     * @param {number} squaredTolerance Squared tolerance.
     * @param {import("../proj").TransformFunction} [transform] Optional transform function.
     * @return {Geometry} Simplified geometry.
     */
    this.simplifyTransformedInternal = memoizeOne( (
      revision: number,
      squaredTolerance: number,
      transform: TransformFunction
    ): Geometry => {
      if (!transform) {
        return this.getSimplifiedGeometry(squaredTolerance);
      }
      const clone = this.clone();
      clone.applyTransform(transform);
      return clone.getSimplifiedGeometry(squaredTolerance);
    });
  }

  /**
   * Get a transformed and simplified version of the geometry.
   * @abstract
   * @param {number} squaredTolerance Squared tolerance.
   * @param {import("../proj").TransformFunction} [transform] Optional transform function.
   * @return {Geometry} Simplified geometry.
   */
  public simplifyTransformed(squaredTolerance: number, transform?: TransformFunction): Geometry {
    return this.simplifyTransformedInternal(
      this.getRevision(),
      squaredTolerance,
      transform
    );
  }

  /**
   * Make a complete copy of the geometry.
   * @abstract
   * @return {!Geometry} Clone.
   */
  public abstract clone(): Geometry;

  /**
   * @abstract
   * @param {number} x X.
   * @param {number} y Y.
   * @param {import("../coordinate").Coordinate} closestPoint Closest point.
   * @param {number} minSquaredDistance Minimum squared distance.
   * @return {number} Minimum squared distance.
   */
  public abstract closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number;

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @return {boolean} Contains (x, y).
   */
  public containsXY(x: number, y: number): boolean {
    const coord = this.getClosestPoint([x, y]);
    return coord[0] === x && coord[1] === y;
  }

  /**
   * Return the closest point of the geometry to the passed point as
   * {@link module:tl/~Coordinate}.
   * @param {import("../coordinate").Coordinate} point Point.
   * @param {import("../coordinate").Coordinate} [closestPoint] Closest point.
   * @return {import("../coordinate").Coordinate} Closest point.
   * @api
   */
  public getClosestPoint(point: Coordinate, closestPoint?: Coordinate): Coordinate {
    closestPoint = closestPoint ? closestPoint : [NaN, NaN];
    this.closestPointXY(point[0], point[1], closestPoint, Infinity);
    return closestPoint;
  }

  /**
   * Returns true if this geometry includes the specified coordinate. If the
   * coordinate is on the boundary of the geometry, returns false.
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @return {boolean} Contains coordinate.
   * @api
   */
  public intersectsCoordinate(coordinate: Coordinate): boolean {
    return this.containsXY(coordinate[0], coordinate[1]);
  }

  /**
   * @abstract
   * @param {import("../extent").Extent} extent Extent.
   * @protected
   * @return {import("../extent").Extent} extent Extent.
   */
  public abstract computeExtent(extent: Extent): Extent;

  /**
   * Get the extent of the geometry.
   * @param {import("../extent").Extent} [extent] Extent.
   * @return {import("../extent").Extent} extent Extent.
   * @api
   */
  public getExtent(extent?: Extent): Extent {
    if (this.extentRevision_ != this.getRevision()) {
      const extent: Extent = this.computeExtent(this.extent_);
      if (isNaN(extent[0]) || isNaN(extent[1])) {
        createOrUpdateEmpty(extent);
      }
      this.extentRevision_ = this.getRevision();
    }
    return returnOrUpdate(this.extent_, extent);
  }

  /**
   * Rotate the geometry around a given coordinate. This modifies the geometry
   * coordinates in place.
   * @abstract
   * @param {number} angle Rotation angle in radians.
   * @param {import("../coordinate").Coordinate} anchor The rotation center.
   * @api
   */
  public abstract rotate(angle: number, anchor: Coordinate): void;

  /**
   * Scale the geometry (with an optional origin).  This modifies the geometry
   * coordinates in place.
   * @abstract
   * @param {number} sx The scaling factor in the x-direction.
   * @param {number} [sy] The scaling factor in the y-direction (defaults to sx).
   * @param {import("../coordinate").Coordinate} [anchor] The scale origin (defaults to the center
   *     of the geometry extent).
   * @api
   */
  public abstract scale(sx: number, sy: number, anchor: Coordinate): void;

  /**
   * Create a simplified version of this geometry.  For linestrings, this uses
   * the [Douglas Peucker](https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm)
   * algorithm.  For polygons, a quantization-based
   * simplification is used to preserve topology.
   * @param {number} tolerance The tolerance distance for simplification.
   * @return {Geometry} A new, simplified version of the original geometry.
   * @api
   */
  public simplify(tolerance: number): Geometry {
    return this.getSimplifiedGeometry(tolerance * tolerance);
  }

  /**
   * Create a simplified version of this geometry using the Douglas Peucker
   * algorithm.
   * See https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm.
   * @abstract
   * @param {number} squaredTolerance Squared tolerance.
   * @return {Geometry} Simplified geometry.
   */
  public abstract getSimplifiedGeometry(squaredTolerance: number): Geometry;

  /**
   * Get the type of this geometry.
   * @abstract
   * @return {Type} Geometry type.
   */
  public abstract getType(): GeometryType;

  /**
   * Apply a transform function to the coordinates of the geometry.
   * The geometry is modified in place.
   * If you do not want the geometry modified in place, first `clone()` it and
   * then use this function on the clone.
   * @abstract
   * @param {import("../proj").TransformFunction} transformFn Transform function.
   * Called with a flat array of geometry coordinates.
   */
  public abstract applyTransform(transformFn: TransformFunction): void;

  /**
   * Test if the geometry and the passed extent intersect.
   * @abstract
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   */
  public abstract intersectsExtent(extent: Extent): boolean;
  /**
   * Translate the geometry.  This modifies the geometry coordinates in place.  If
   * instead you want a new geometry, first `clone()` this geometry.
   * @abstract
   * @param {number} deltaX Delta X.
   * @param {number} deltaY Delta Y.
   * @api
   */
  public abstract translate(deltaX: number, deltaY: number): void;

  /**
   * Transform each coordinate of the geometry from one coordinate reference
   * system to another. The geometry is modified in place.
   * For example, a line will be transformed to a line and a circle to a circle.
   * If you do not want the geometry modified in place, first `clone()` it and
   * then use this function on the clone.
   *
   * @param {import("../proj").ProjectionLike} source The current projection.  Can be a
   *     string identifier or a {@link module:tl/proj/Projection~Projection} object.
   * @param {import("../proj").ProjectionLike} destination The desired projection.  Can be a
   *     string identifier or a {@link module:tl/proj/Projection~Projection} object.
   * @return {Geometry} This geometry.  Note that original geometry is
   *     modified in place.
   * @api
   */
  public transform(source: ProjectionLike, destination: ProjectionLike): Geometry {

    const sourceProj = <Projection>getProjection(source);
    const transformFn =
      sourceProj.getUnits() == 'tile-pixels'
        ? function (inCoordinates: FlatCoordinates, outCoordinates: FlatCoordinates, stride: number) {
            const pixelExtent = sourceProj.getExtent();
            const projectedExtent = sourceProj.getWorldExtent();
            const scale = getHeight(projectedExtent) / getHeight(pixelExtent);
            composeTransform(
              tmpTransform,
              projectedExtent[0],
              projectedExtent[3],
              scale,
              -scale,
              0,
              0,
              0
            );
            transform2D(
              inCoordinates,
              0,
              inCoordinates.length,
              stride,
              tmpTransform,
              outCoordinates
            );
            return getTransform(sourceProj, destination)(
              inCoordinates,
              outCoordinates,
              stride
            );
          }
        : getTransform(sourceProj, destination);
    this.applyTransform(transformFn);
    return this;
  }
}
