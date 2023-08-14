/**
 * @module ol/geom/SimpleGeometry
 */
import Geometry, {GeometryLayout} from './Geometry';
import {createOrUpdateFromFlatCoordinates, getCenter} from '../extent';
import {rotate, scale, transform2D, translate} from './flat/transform';
import {Coordinate} from "../coordinate";
import {FlatCoordinates} from "../coordinate";
import {Extent} from "../extent/Extent";
import {Transform} from "../transform";
import {TransformFunction} from "../proj";

/**
 * @classdesc
 * Abstract base class; only used for creating subclasses; do not instantiate
 * in apps, as cannot be rendered.
 *
 * @abstract
 * @api
 */
export default abstract class SimpleGeometry extends Geometry {

  protected layout: GeometryLayout;
  protected stride: number;
  protected flatCoordinates?: FlatCoordinates;

  protected constructor() {
    super();

    this.layout = 'XY';
    this.stride = 2;
    this.flatCoordinates = null;
  }

  public computeExtent(extent: Extent): Extent {
    return createOrUpdateFromFlatCoordinates(
      this.flatCoordinates,
      0,
      this.flatCoordinates.length,
      this.stride,
      extent
    );
  }

  public abstract getCoordinates(right?: boolean): Array<any> | null;

  /**
   * Return the first coordinate of the geometry.
   * @return {import("../coordinate").Coordinate} First coordinate.
   * @api
   */
  public getFirstCoordinate(): Coordinate {
    return <Coordinate>this.flatCoordinates.slice(0, this.stride);
  }

  /**
   * @return {Array<number>} Flat coordinates.
   */
  public getFlatCoordinates(): FlatCoordinates {
    return this.flatCoordinates;
  }

  public getLastCoordinate(): Coordinate {
    return <Coordinate>this.flatCoordinates.slice(
      this.flatCoordinates.length - this.stride
    );
  }

  public getLayout(): GeometryLayout {
    return this.layout;
  }

  /**
   * Create a simplified version of this geometry using the Douglas algorithm.
   * @param {number} squaredTolerance Squared tolerance.
   * @return {SimpleGeometry} Simplified geometry.
   */
  public getSimplifiedGeometry(squaredTolerance: number): SimpleGeometry {
    if (this.simplifiedGeometryRevision !== this.getRevision()) {
      this.simplifiedGeometryMaxMinSquaredTolerance = 0;
      this.simplifiedGeometryRevision = this.getRevision();
    }
    // If squaredTolerance is negative or if we know that simplification will not
    // have any effect then just return this.
    if (
      squaredTolerance < 0 ||
      (this.simplifiedGeometryMaxMinSquaredTolerance !== 0 &&
        squaredTolerance <= this.simplifiedGeometryMaxMinSquaredTolerance)
    ) {
      return this;
    }

    const simplifiedGeometry =
      this.getSimplifiedGeometryInternal(squaredTolerance);
    const simplifiedFlatCoordinates = simplifiedGeometry.getFlatCoordinates();
    if (simplifiedFlatCoordinates.length < this.flatCoordinates.length) {
      return simplifiedGeometry;
    }
    // Simplification did not actually remove any coordinates.  We now know
    // that any calls to getSimplifiedGeometry with a squaredTolerance less
    // than or equal to the current squaredTolerance will also not have any
    // effect.  This allows us to short circuit simplification (saving CPU
    // cycles) and prevents the cache of simplified geometries from filling
    // up with useless identical copies of this geometry (saving memory).
    this.simplifiedGeometryMaxMinSquaredTolerance = squaredTolerance;
    return this;
  }

  /**
   * @param {number} squaredTolerance Squared tolerance.
   * @return {SimpleGeometry} Simplified geometry.
   * @protected
   */
  protected getSimplifiedGeometryInternal(squaredTolerance: number): SimpleGeometry {
    return this;
  }

  public getStride(): number {
    return this.stride;
  }

  public setFlatCoordinates(layout: GeometryLayout, flatCoordinates: FlatCoordinates): void {
    this.stride = getStrideForLayout(layout);
    this.layout = layout;
    this.flatCoordinates = flatCoordinates;
  }

  public abstract setCoordinates(coordinates: any[], layout: GeometryLayout): void;

  /**
   * @param {import("./Geometry").GeometryLayout|undefined} layout Layout.
   * @param {Array<*>} coordinates Coordinates.
   * @param {number} nesting Nesting.
   * @protected
   */
  protected setLayout(layout: GeometryLayout | undefined, coordinates: any[], nesting: number): void {
    /** @type {number} */
    let stride: number;
    if (layout) {
      stride = getStrideForLayout(layout);
    } else {
      for (let i: number = 0; i < nesting; ++i) {
        if (coordinates.length === 0) {
          this.layout = 'XY';
          this.stride = 2;
          return;
        }
        coordinates = /** @type {Array} */ (coordinates[0]);
      }
      stride = coordinates.length;
      layout = getLayoutForStride(stride);
    }
    this.layout = layout;
    this.stride = stride;
  }

  /**
   * Apply a transform function to the coordinates of the geometry.
   * The geometry is modified in place.
   * If you do not want the geometry modified in place, first `clone()` it and
   * then use this function on the clone.
   * @param {import("../proj").TransformFunction} transformFn Transform function.
   * Called with a flat array of geometry coordinates.
   * @api
   */
  public applyTransform(transformFn: TransformFunction): void {
    if (this.flatCoordinates) {
      transformFn(this.flatCoordinates, this.flatCoordinates, this.stride);
      this.changed();
    }
  }

  /**
   * Rotate the geometry around a given coordinate. This modifies the geometry
   * coordinates in place.
   * @param {number} angle Rotation angle in counter-clockwise radians.
   * @param {import("../coordinate").Coordinate} anchor The rotation center.
   * @api
   */
  public rotate(angle: number, anchor: Coordinate): void {
    const flatCoordinates: FlatCoordinates = this.getFlatCoordinates();
    if (flatCoordinates) {
      const stride: number = this.getStride();
      rotate(
        flatCoordinates,
        0,
        flatCoordinates.length,
        stride,
        angle,
        anchor,
        flatCoordinates
      );
      this.changed();
    }
  }

  /**
   * Scale the geometry (with an optional origin).  This modifies the geometry
   * coordinates in place.
   * @param {number} sx The scaling factor in the x-direction.
   * @param {number} [sy] The scaling factor in the y-direction (defaults to sx).
   * @param {import("../coordinate").Coordinate} [anchor] The scale origin (defaults to the center
   *     of the geometry extent).
   * @api
   */
  public scale(sx: number, sy: number, anchor: Coordinate): void {
    if (sy === undefined) {
      sy = sx;
    }
    if (!anchor) {
      anchor = getCenter(this.getExtent());
    }
    const flatCoordinates: FlatCoordinates = this.getFlatCoordinates();
    if (flatCoordinates) {
      const stride: number = this.getStride();
      scale(
        flatCoordinates,
        0,
        flatCoordinates.length,
        stride,
        sx,
        sy,
        anchor,
        flatCoordinates
      );
      this.changed();
    }
  }

  /**
   * Translate the geometry.  This modifies the geometry coordinates in place.  If
   * instead you want a new geometry, first `clone()` this geometry.
   * @param {number} deltaX Delta X.
   * @param {number} deltaY Delta Y.
   * @api
   */
  public translate(deltaX: number, deltaY: number): void {
    const flatCoordinates = this.getFlatCoordinates();
    if (flatCoordinates) {
      const stride: number = this.getStride();
      translate(
        flatCoordinates,
        0,
        flatCoordinates.length,
        stride,
        deltaX,
        deltaY,
        flatCoordinates
      );
      this.changed();
    }
  }
}

/**
 * @param {number} stride Stride.
 * @return {import("./Geometry").GeometryLayout} layout Layout.
 */
function getLayoutForStride(stride: number): GeometryLayout {
  let layout: GeometryLayout;
  if (stride == 2) {
    layout = 'XY';
  } else if (stride == 3) {
    layout = 'XYZ';
  } else if (stride == 4) {
    layout = 'XYZM';
  }
  return layout;
}

/**
 * @param {import("./Geometry").GeometryLayout} layout Layout.
 * @return {number} Stride.
 */
export function getStrideForLayout(layout: GeometryLayout): number {
  let stride: number;
  if (layout == 'XY') {
    stride = 2;
  } else if (layout == 'XYZ' || layout == 'XYM') {
    stride = 3;
  } else if (layout == 'XYZM') {
    stride = 4;
  }
  return stride;
}

/**
 * @param {SimpleGeometry} simpleGeometry Simple geometry.
 * @param {import("../transform").Transform} transform Transform.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Transformed flat coordinates.
 */
export function transformGeom2D(simpleGeometry: SimpleGeometry, transform: Transform, dest: number[]): number[] {
  const flatCoordinates = simpleGeometry.getFlatCoordinates();
  if (!flatCoordinates) {
    return null;
  }
  const stride = simpleGeometry.getStride();
  return transform2D(
    flatCoordinates,
    0,
    flatCoordinates.length,
    stride,
    transform,
    dest
  );
}
