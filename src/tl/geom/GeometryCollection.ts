/**
 * @module tl/geom/GeometryCollection
 */
import EventType from '../events/EventType';
import Geometry, {GeometryType} from './Geometry';
import {
  closestSquaredDistanceXY,
  createOrUpdateEmpty,
  extend,
  getCenter,
} from '../extent';
import {EventsKey, listen, unlistenByKey} from '../events';
import {Coordinate} from "../coordinate";
import {Extent} from "../extent/Extent";
import {TransformFunction} from "../proj";

export default class GeometryCollection extends Geometry {
  /**
   * @param {Array<Geometry>} [geometries] Geometries.
   */

  private geometries_?: Array<Geometry>;
  private changeEventsKeys_: Array<EventsKey>;

  constructor(geometries: Array<Geometry> | Geometry) {
    super();

    /**
     * @private
     * @type {Array<Geometry>}
     */

    if (geometries instanceof  Geometry)
    {
      this.geometries_ = [geometries];
    }
    else
    {
      this.geometries_ = geometries ? geometries : null;
    }
    /**
     * @type {Array<import("../events").EventsKey>}
     */
    this.changeEventsKeys_ = [];

    this.listenGeometriesChange_();
  }

  /**
   * @private
   */
  private unlistenGeometriesChange_() {
    this.changeEventsKeys_.forEach(unlistenByKey);
    this.changeEventsKeys_.length = 0;
  }

  /**
   * @private
   */
  private listenGeometriesChange_() {
    if (!this.geometries_) {
      return;
    }
    for (let i = 0, ii = this.geometries_.length; i < ii; ++i) {
      this.changeEventsKeys_.push(
        listen(this.geometries_[i], EventType.CHANGE, this.changed, this)
      );
    }
  }

  /**
   * Make a complete copy of the geometry.
   * @return {!GeometryCollection} Clone.
   * @api
   */
  public clone(): GeometryCollection {
    const geometryCollection = new GeometryCollection(null);
    geometryCollection.setGeometries(this.geometries_);
    geometryCollection.applyProperties(this);
    return geometryCollection;
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
    const geometries = this.geometries_;
    for (let i = 0, ii = geometries.length; i < ii; ++i) {
      minSquaredDistance = geometries[i].closestPointXY(
        x,
        y,
        closestPoint,
        minSquaredDistance
      );
    }
    return minSquaredDistance;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   * @return {boolean} Contains (x, y).
   */
  public containsXY(x: number, y: number): boolean {
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      if (geometries[i].containsXY(x, y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @protected
   * @return {import("../extent").Extent} extent Extent.
   */
  public computeExtent(extent: Extent): Extent {
    createOrUpdateEmpty(extent);
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      extend(extent, geometries[i].getExtent());
    }
    return extent;
  }

  /**
   * Return the geometries that make up this geometry collection.
   * @return {Array<Geometry>} Geometries.
   * @api
   */
  public getGeometries(): Geometry[] {
    return cloneGeometries(this.geometries_);
  }

  /**
   * @return {Array<Geometry>} Geometries.
   */
  public getGeometriesArray(): Geometry[] {
    return this.geometries_;
  }

  /**
   * @return {Array<Geometry>} Geometries.
   */
  public getGeometriesArrayRecursive(): Geometry[] {
    /** @type {Array<Geometry>} */
    let geometriesArray: Geometry[] = [];
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      if (geometries[i].getType() === this.getType()) {
        geometriesArray = geometriesArray.concat(
          /** @type {GeometryCollection} */ new GeometryCollection(
            geometries[i]
          ).getGeometriesArrayRecursive()
        );
      } else {
        geometriesArray.push(geometries[i]);
      }
    }
    return geometriesArray;
  }

  /**
   * Create a simplified version of this geometry using the Douglas Peucker algorithm.
   * @param {number} squaredTolerance Squared tolerance.
   * @return {GeometryCollection} Simplified GeometryCollection.
   */
  public getSimplifiedGeometry(squaredTolerance: number): GeometryCollection {
    if (this.simplifiedGeometryRevision !== this.getRevision()) {
      this.simplifiedGeometryMaxMinSquaredTolerance = 0;
      this.simplifiedGeometryRevision = this.getRevision();
    }
    if (
      squaredTolerance < 0 ||
      (this.simplifiedGeometryMaxMinSquaredTolerance !== 0 &&
        squaredTolerance < this.simplifiedGeometryMaxMinSquaredTolerance)
    ) {
      return this;
    }

    const simplifiedGeometries = [];
    const geometries = this.geometries_;
    let simplified = false;
    for (let i = 0, ii = geometries.length; i < ii; ++i) {
      const geometry = geometries[i];
      const simplifiedGeometry =
        geometry.getSimplifiedGeometry(squaredTolerance);
      simplifiedGeometries.push(simplifiedGeometry);
      if (simplifiedGeometry !== geometry) {
        simplified = true;
      }
    }
    if (simplified) {
      const simplifiedGeometryCollection = new GeometryCollection(null);
      simplifiedGeometryCollection.setGeometriesArray(simplifiedGeometries);
      return simplifiedGeometryCollection;
    }
    this.simplifiedGeometryMaxMinSquaredTolerance = squaredTolerance;
    return this;
  }

  /**
   * Get the type of this geometry.
   * @return {import("./Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return 'GeometryCollection';
  }

  /**
   * Test if the geometry and the passed extent intersect.
   * @param {import("../extent").Extent} extent Extent.
   * @return {boolean} `true` if the geometry and the extent intersect.
   * @api
   */
  public intersectsExtent(extent: Extent): boolean {
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      if (geometries[i].intersectsExtent(extent)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @return {boolean} Is empty.
   */
  public isEmpty(): boolean {
    return this.geometries_.length === 0;
  }

  /**
   * Rotate the geometry around a given coordinate. This modifies the geometry
   * coordinates in place.
   * @param {number} angle Rotation angle in radians.
   * @param {import("../coordinate").Coordinate} anchor The rotation center.
   * @api
   */
  public rotate(angle: number, anchor: Coordinate): void {
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      geometries[i].rotate(angle, anchor);
    }
    this.changed();
  }

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
  public scale(sx: number, sy: number, anchor: Coordinate): void {
    if (!anchor) {
      anchor = getCenter(this.getExtent());
    }
    const geometries = this.geometries_;
    for (let i = 0, ii = geometries.length; i < ii; ++i) {
      geometries[i].scale(sx, sy, anchor);
    }
    this.changed();
  }

  /**
   * Set the geometries that make up this geometry collection.
   * @param {Array<Geometry>} geometries Geometries.
   * @api
   */
  public setGeometries(geometries: Geometry[]): void {
    this.setGeometriesArray(cloneGeometries(geometries));
  }

  /**
   * @param {Array<Geometry>} geometries Geometries.
   */
  public setGeometriesArray(geometries: Geometry[]): void {
    this.unlistenGeometriesChange_();
    this.geometries_ = geometries;
    this.listenGeometriesChange_();
    this.changed();
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
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      geometries[i].applyTransform(transformFn);
    }
    this.changed();
  }

  /**
   * Translate the geometry.  This modifies the geometry coordinates in place.  If
   * instead you want a new geometry, first `clone()` this geometry.
   * @param {number} deltaX Delta X.
   * @param {number} deltaY Delta Y.
   * @api
   */
  public translate(deltaX: number, deltaY: number): void {
    const geometries: Geometry[] = this.geometries_;
    for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
      geometries[i].translate(deltaX, deltaY);
    }
    this.changed();
  }

  /**
   * Clean up.
   */
  protected disposeInternal(): void {
    this.unlistenGeometriesChange_();
    super.disposeInternal();
  }
}

/**
 * @param {Array<Geometry>} geometries Geometries.
 * @return {Array<Geometry>} Cloned geometries.
 */
function cloneGeometries(geometries: Geometry[]): Geometry[] {
  const clonedGeometries: Geometry[] = [];
  for (let i: number = 0, ii: number = geometries.length; i < ii; ++i) {
    clonedGeometries.push(geometries[i].clone());
  }
  return clonedGeometries;
}
