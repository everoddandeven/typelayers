/**
 * @module tl/render/Feature
 */
import Feature from '../Feature';
import {
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from '../geom';
import {
  compose as composeTransform,
  create as createTransform, Transform,
} from '../transform';
import {
  createOrUpdateFromCoordinate,
  createOrUpdateFromFlatCoordinates, Extent,
  getCenter,
  getHeight,
} from '../extent';
import {extend} from '../array';
import {
  getInteriorPointOfArray,
  getInteriorPointsOfMultiArray,
} from '../geom/flat/interiorpoint';
import {get as getProjection, TransformFunction} from '../proj';
import {inflateEnds} from '../geom/flat/orient';
import {interpolatePoint} from '../geom/flat/interpolate';
import {linearRingss as linearRingssCenter} from '../geom/flat/center';
import {transform2D} from '../geom/flat/transform';
import {GeometryType} from "../geom/Geometry";
import {Coordinate, FlatCoordinates} from "../coordinate";
import {StyleFunction} from "../style/Style";
import Projection from "../proj/Projection";

/**
 * @type {import("../transform").Transform}
 */
const tmpTransform: Transform = createTransform();

/**
 * Lightweight, read-only, {@link module:tl/Feature~Feature} and {@link module:tl/geom/Geometry~Geometry} like
 * structure, optimized for vector tile rendering and styling. Geometry access
 * through the API is limited to getting the type and extent of the geometry.
 */
class RenderFeature {
  /**
   * @param {import("../geom/Geometry").Type} type Geometry type.
   * @param {Array<number>} flatCoordinates Flat coordinates. These always need
   *     to be right-handed for polygons.
   * @param {Array<number>|Array<Array<number>>} ends Ends or Endss.
   * @param {Object<string, *>} properties Properties.
   * @param {number|string|undefined} id Feature id.
   */

  private extent_: Extent;
  private id_?: number | string | undefined;
  private type_?: GeometryType;
  private flatCoordinates_: FlatCoordinates;
  private flatInteriorPoints_: number[];
  private flatMidpoints_: number[];
  private properties_: {[key: string]: any};
  private ends_: FlatCoordinates | FlatCoordinates[];
  private styleFunction?: StyleFunction;

  constructor(
      type: GeometryType,
      flatCoordinates: FlatCoordinates,
      ends: FlatCoordinates | FlatCoordinates[],
      properties: {[key: string]: any},
      id?: number | string | undefined
  ) {
    /**
     * @type {import("../style/Style").StyleFunction|undefined}
     */
    this.styleFunction = null;

    /**
     * @private
     * @type {import("../extent").Extent|undefined}
     */
    this.extent_ = null;

    /**
     * @private
     * @type {number|string|undefined}
     */
    this.id_ = id;

    /**
     * @private
     * @type {import("../geom/Geometry").Type}
     */
    this.type_ = type;

    /**
     * @private
     * @type {Array<number>}
     */
    this.flatCoordinates_ = flatCoordinates;

    /**
     * @private
     * @type {Array<number>}
     */
    this.flatInteriorPoints_ = null;

    /**
     * @private
     * @type {Array<number>}
     */
    this.flatMidpoints_ = null;

    /**
     * @private
     * @type {Array<number>|Array<Array<number>>}
     */
    this.ends_ = ends;

    /**
     * @private
     * @type {Object<string, *>}
     */
    this.properties_ = properties;
  }

  /**
   * Get a feature property by its key.
   * @param {string} key Key
   * @return {*} Value for the requested key.
   * @api
   */
  public get(key: string): any {
    return this.properties_[key];
  }

  /**
   * Get the extent of this feature's geometry.
   * @return {import("../extent").Extent} Extent.
   * @api
   */
  public getExtent(): Extent {
    if (!this.extent_) {
      this.extent_ =
        this.type_ === 'Point'
          ? createOrUpdateFromCoordinate(<Coordinate>this.flatCoordinates_)
          : createOrUpdateFromFlatCoordinates(
              this.flatCoordinates_,
              0,
              this.flatCoordinates_.length,
              2
            );
    }
    return this.extent_;
  }

  /**
   * @return {Array<number>} Flat interior points.
   */
  public getFlatInteriorPoint(): number[] {
    if (!this.flatInteriorPoints_) {
      const flatCenter = getCenter(this.getExtent());
      this.flatInteriorPoints_ = getInteriorPointOfArray(
        this.flatCoordinates_,
        0,
        /** @type {Array<number>} */ (<FlatCoordinates>this.ends_),
        2,
        flatCenter,
        0
      );
    }
    return this.flatInteriorPoints_;
  }

  /**
   * @return {Array<number>} Flat interior points.
   */
  public getFlatInteriorPoints(): FlatCoordinates {
    if (!this.flatInteriorPoints_) {
      const flatCenters = linearRingssCenter(
        this.flatCoordinates_,
        0,
        /** @type {Array<Array<number>>} */ (<FlatCoordinates[]>this.ends_),
        2
      );
      this.flatInteriorPoints_ = getInteriorPointsOfMultiArray(
        this.flatCoordinates_,
        0,
        /** @type {Array<Array<number>>} */ (<FlatCoordinates[]>this.ends_),
        2,
        flatCenters
      );
    }
    return this.flatInteriorPoints_;
  }

  /**
   * @return {Array<number>} Flat midpoint.
   */
  public getFlatMidpoint(): number[] {
    if (!this.flatMidpoints_) {
      this.flatMidpoints_ = interpolatePoint(
        this.flatCoordinates_,
        0,
        this.flatCoordinates_.length,
        2,
        0.5
      );
    }
    return this.flatMidpoints_;
  }

  /**
   * @return {Array<number>} Flat midpoints.
   */
  public getFlatMidpoints(): FlatCoordinates {
    if (!this.flatMidpoints_) {
      this.flatMidpoints_ = [];
      const flatCoordinates = this.flatCoordinates_;
      let offset = 0;
      const ends = /** @type {Array<number>} */ (<FlatCoordinates>this.ends_);
      for (let i = 0, ii = ends.length; i < ii; ++i) {
        const end = ends[i];
        const midpoint = interpolatePoint(flatCoordinates, offset, end, 2, 0.5);
        extend(this.flatMidpoints_, midpoint);
        offset = end;
      }
    }
    return this.flatMidpoints_;
  }

  /**
   * Get the feature identifier.  This is a stable identifier for the feature and
   * is set when reading data from a remote source.
   * @return {number|string|undefined} Id.
   * @api
   */
  public getId(): string | number {
    return this.id_;
  }

  /**
   * @return {Array<number>} Flat coordinates.
   */
  public getOrientedFlatCoordinates(): FlatCoordinates {
    return this.flatCoordinates_;
  }

  /**
   * For API compatibility with {@link module:tl/Feature~Feature}, this method is useful when
   * determining the geometry type in style function (see {@link #getType}).
   * @return {RenderFeature} Feature.
   * @api
   */
  public getGeometry(): RenderFeature {
    return this;
  }

  /**
   * @param {number} squaredTolerance Squared tolerance.
   * @return {RenderFeature} Simplified geometry.
   */
  public getSimplifiedGeometry(squaredTolerance: number): RenderFeature {
    return this;
  }

  /**
   * Get a transformed and simplified version of the geometry.
   * @abstract
   * @param {number} squaredTolerance Squared tolerance.
   * @param {import("../proj").TransformFunction} [transform] Optional transform function.
   * @return {RenderFeature} Simplified geometry.
   */
  public simplifyTransformed(squaredTolerance: number, transform?: TransformFunction): RenderFeature {
    return this;
  }

  /**
   * Get the feature properties.
   * @return {Object<string, *>} Feature properties.
   * @api
   */
  public getProperties(): {[p: string]: any} {
    return this.properties_;
  }

  /**
   * @return {number} Stride.
   */
  public getStride(): number {
    return 2;
  }

  /**
   * @return {import('../style/Style').StyleFunction|undefined} Style
   */
  public getStyleFunction(): StyleFunction {
    return this.styleFunction;
  }

  /**
   * Get the type of this feature's geometry.
   * @return {import("../geom/Geometry").Type} Geometry type.
   * @api
   */
  public getType(): GeometryType {
    return this.type_;
  }

  /**
   * Transform geometry coordinates from tile pixel space to projected.
   *
   * @param {import("../proj").ProjectionLike} projection The data projection
   */
  public transform(projection: Projection): void {
    projection = getProjection(projection);
    const pixelExtent = projection.getExtent();
    const projectedExtent = projection.getWorldExtent();
    if (pixelExtent && projectedExtent) {
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
        this.flatCoordinates_,
        0,
        this.flatCoordinates_.length,
        2,
        tmpTransform,
        this.flatCoordinates_
      );
    }
  }
  /**
   * @return {Array<number>|Array<Array<number>>} Ends or endss.
   */
  public getEnds(): FlatCoordinates | FlatCoordinates[] {
    return this.ends_;
  }

  public getEndss(): FlatCoordinates | FlatCoordinates[] {
    return this.ends_;
  }

  public getFlatCoordinates(): FlatCoordinates {
    return this.getOrientedFlatCoordinates();
  }
}

/**
 * Create a geometry from an `tl/render/Feature`
 * @param {RenderFeature} renderFeature
 * Render Feature
 * @return {Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon}
 * New geometry instance.
 * @api
 */
export function toGeometry(renderFeature: RenderFeature): Geometry {
  const geometryType = renderFeature.getType();
  switch (geometryType) {
    case 'Point':
      return new Point(renderFeature.getFlatCoordinates());
    case 'MultiPoint':
      return new MultiPoint(renderFeature.getFlatCoordinates(), 'XY');
    case 'LineString':
      return new LineString(renderFeature.getFlatCoordinates(), 'XY');
    case 'MultiLineString':
      return new MultiLineString(
        renderFeature.getFlatCoordinates(),
        'XY',
        /** @type {Array<number>} */ (<FlatCoordinates>renderFeature.getEnds())
      );
    case 'Polygon':
      const flatCoordinates = renderFeature.getFlatCoordinates();
      const ends = /** @type {Array<number>} */ (<FlatCoordinates>renderFeature.getEnds());
      const endss = inflateEnds(flatCoordinates, ends);
      return endss.length > 1
        ? new MultiPolygon(flatCoordinates, 'XY', endss)
        : new Polygon(flatCoordinates, 'XY', ends);
    default:
      throw new Error('Invalid geometry type:' + geometryType);
  }
}

/**
 * Create an `tl/Feature` from an `tl/render/Feature`
 * @param {RenderFeature} renderFeature RenderFeature
 * @param {string} [geometryName='geometry'] Geometry name to use
 * when creating the Feature.
 * @return {Feature} Newly constructed `tl/Feature` with properties,
 * geometry, and id copied over.
 * @api
 */
export function toFeature(renderFeature: RenderFeature, geometryName: string = 'geometry'): Feature {
  const id = renderFeature.getId();
  const geometry = toGeometry(renderFeature);
  const properties = renderFeature.getProperties();
  const feature = new Feature();
  if (geometryName !== undefined) {
    feature.setGeometryName(geometryName);
  }
  feature.setGeometry(geometry);
  if (id !== undefined) {
    feature.setId(id);
  }
  feature.setProperties(properties, true);
  return feature;
}

export default RenderFeature;
