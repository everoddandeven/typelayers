/**
 * @module tl/format/Feature
 */
import {
  equivalent as equivalentProjection,
  get as getProjection, ProjectionLike,
  transformExtent,
} from '../proj';
import {Extent} from "../extent/Extent";
import Projection from "../proj/Projection";
import Geometry from "../geom/Geometry";
import Feature, {FeatureLike} from "../Feature";

/**
 * @typedef ReadOptions
 * @property {import("../proj").ProjectionLike} [dataProjection] Projection of the data we are reading.
 * If not provided, the projection will be derived from the data (where possible) or
 * the `dataProjection` of the format is assigned (where set). If the projection
 * can not be derived from the data and if no `dataProjection` is set for a format,
 * the features will not be reprojected.
 * @property {import("../extent").Extent} [extent] Tile extent in map units of the tile being read.
 * This is only required when reading data with tile pixels as geometry units. When configured,
 * a `dataProjection` with `TILE_PIXELS` as `units` and the tile's pixel extent as `extent` needs to be
 * provided.
 * @property {import("../proj").ProjectionLike} [featureProjection] Projection of the feature geometries
 * created by the format reader. If not provided, features will be returned in the
 * `dataProjection`.
 */

export interface ReadOptions
{
  dataProjection?: ProjectionLike,
  extent?: Extent,
  featureProjection?: ProjectionLike
}

/**
 * @typedef {Object} WriteOptions
 * @property {import("../proj").ProjectionLike} [dataProjection] Projection of the data we are writing.
 * If not provided, the `dataProjection` of the format is assigned (where set).
 * If no `dataProjection` is set for a format, the features will be returned
 * in the `featureProjection`.
 * @property {import("../proj").ProjectionLike} [featureProjection] Projection of the feature geometries
 * that will be serialized by the format writer. If not provided, geometries are assumed
 * to be in the `dataProjection` if that is set; in other words, they are not transformed.
 * @property {boolean} [rightHanded] When writing geometries, follow the right-hand
 * rule for linear ring orientation.  This means that polygons will have counter-clockwise
 * exterior rings and clockwise interior rings.  By default, coordinates are serialized
 * as they are provided at construction.  If `true`, the right-hand rule will
 * be applied.  If `false`, the left-hand rule will be applied (clockwise for
 * exterior and counter-clockwise for interior rings).  Note that not all
 * formats support this.  The GeoJSON format does use this property when writing
 * geometries.
 * @property {number} [decimals] Maximum number of decimal places for coordinates.
 * Coordinates are stored internally as floats, but floating-point arithmetic can create
 * coordinates with a large number of decimal places, not generally wanted on output.
 * Set a number here to round coordinates. Can also be used to ensure that
 * coordinates read in can be written back out with the same number of decimals.
 * Default is no rounding.
 */

export interface WriteOptions
{
  dataProjection?: ProjectionLike,
  featureProjection?: ProjectionLike,
  rightHanded?: boolean,
  decimals?: number
}

/**
 * @typedef {'arraybuffer' | 'json' | 'text' | 'xml'} Type
 */

export type FormatType = 'arraybuffer' | 'json' | 'text' | 'xml';
export type FeatureFormatType = FormatType;
/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for feature formats.
 * {@link module:tl/format/Feature~FeatureFormat} subclasses provide the ability to decode and encode
 * {@link module:tl/Feature~Feature} objects from a variety of commonly used geospatial
 * file formats.  See the documentation for each format for more details.
 *
 * @abstract
 * @api
 */
abstract class FeatureFormat {

  protected dataProjection?: Projection;
  protected defaultFeatureProjection?: Projection;

  public supportedMediaTypes?: string[];

  protected constructor() {
    /**
     * @protected
     * @type {import("../proj/Projection").default|undefined}
     */
    this.dataProjection = undefined;

    /**
     * @protected
     * @type {import("../proj/Projection").default|undefined}
     */
    this.defaultFeatureProjection = undefined;

    /**
     * A list media types supported by the format in descending order of preference.
     * @type {Array<string>}
     */
    this.supportedMediaTypes = undefined;
  }

  /**
   * Adds the data projection to the read options.
   * @param {Document|Element|Object|string} source Source.
   * @param {ReadOptions} [options] Options.
   * @return {ReadOptions|undefined} Options.
   * @protected
   */
  protected getReadOptions(source: Document | Element | {} | string, options?: ReadOptions): ReadOptions | undefined {
    if (options) {
      let dataProjection = options.dataProjection
        ? getProjection(options.dataProjection)
        : this.readProjection(source);
      if (
        options.extent &&
        dataProjection &&
        dataProjection.getUnits() === 'tile-pixels'
      ) {
        dataProjection = getProjection(dataProjection);
        dataProjection.setWorldExtent(options.extent);
      }
      options = {
        dataProjection: dataProjection,
        featureProjection: options.featureProjection,
      };
    }
    return this.adaptOptions(options);
  }

  /**
   * Sets the `dataProjection` on the options, if no `dataProjection`
   * is set.
   * @param {WriteOptions|ReadOptions|undefined} options
   *     Options.
   * @protected
   * @return {WriteOptions|ReadOptions|undefined}
   *     Updated options.
   */
  protected adaptOptions(options?: WriteOptions | ReadOptions): WriteOptions | ReadOptions | undefined {
    return Object.assign(
      {
        dataProjection: this.dataProjection,
        featureProjection: this.defaultFeatureProjection,
      },
      options
    );
  }

  /**
   * @abstract
   * @return {Type} The format type.
   */
  public abstract getType(): FormatType;

  /**
   * Read a single feature from a source.
   *
   * @abstract
   * @param {Document|Element|Object|string} source Source.
   * @param {ReadOptions} [options] Read options.
   * @return {import("../Feature").FeatureLike} Feature.
   */
  public abstract readFeature(source: Document | Element | Object | string, options?: ReadOptions): FeatureLike;

  /**
   * Read all features from a source.
   *
   * @abstract
   * @param {Document|Element|ArrayBuffer|Object|string} source Source.
   * @param {ReadOptions} [options] Read options.
   * @return {Array<import("../Feature").FeatureLike>} Features.
   */
  public abstract readFeatures(source: Document | Element | ArrayBuffer | Object | string, options?: ReadOptions): FeatureLike[];

  /**
   * Read a single geometry from a source.
   *
   * @abstract
   * @param {Document|Element|Object|string} source Source.
   * @param {ReadOptions} [options] Read options.
   * @return {import("../geom/Geometry").default} Geometry.
   */
  public abstract readGeometry(source: Document | Element | Object | string, options?: ReadOptions): Geometry;

  /**
   * Read the projection from a source.
   *
   * @abstract
   * @param {Document|Element|Object|string} source Source.
   * @return {import("../proj/Projection").default|undefined} Projection.
   */
  public abstract readProjection(source: Document | Element | Object | string): Projection ;

  /**
   * Encode a feature in this format.
   *
   * @abstract
   * @param {import("../Feature").default} feature Feature.
   * @param {WriteOptions} [options] Write options.
   * @return {string|ArrayBuffer} Result.
   */
  public abstract writeFeature(feature: Feature, options?: WriteOptions) : string | ArrayBuffer;

  /**
   * Encode an array of features in this format.
   *
   * @abstract
   * @param {Array<import("../Feature").default>} features Features.
   * @param {WriteOptions} [options] Write options.
   * @return {string|ArrayBuffer} Result.
   */
  public abstract writeFeatures(features: Feature[], options?: WriteOptions): string | ArrayBuffer;

  /**
   * Write a single geometry in this format.
   *
   * @abstract
   * @param {import("../geom/Geometry").default} geometry Geometry.
   * @param {WriteOptions} [options] Write options.
   * @return {string|ArrayBuffer} Result.
   */
  public abstract writeGeometry(geometry: Geometry, options?: WriteOptions): string | ArrayBuffer;
}

export default FeatureFormat;

/**
 * @param {import("../geom/Geometry").default} geometry Geometry.
 * @param {boolean} write Set to true for writing, false for reading.
 * @param {WriteOptions|ReadOptions} [options] Options.
 * @return {import("../geom/Geometry").default} Transformed geometry.
 */
export function transformGeometryWithOptions(
    geometry: Geometry,
    write: boolean,
    options?: WriteOptions | ReadOptions
): Geometry {
  const featureProjection = options
    ? getProjection(options.featureProjection)
    : null;
  const dataProjection = options ? getProjection(options.dataProjection) : null;

  let transformed: Geometry;
  if (
    featureProjection &&
    dataProjection &&
    !equivalentProjection(featureProjection, dataProjection)
  ) {
    transformed = (write ? geometry.clone() : geometry).transform(
      write ? featureProjection : dataProjection,
      write ? dataProjection : featureProjection
    );
  } else {
    transformed = geometry;
  }
  if (
    write &&
    options &&
    (<WriteOptions>options).decimals !== undefined
  ) {
    const power = Math.pow(10, (<WriteOptions>options).decimals);
    // if decimals option on write, round each coordinate appropriately
    /**
     * @param {Array<number>} coordinates Coordinates.
     * @return {Array<number>} Transformed coordinates.
     */
    const transform = function (coordinates: number[]): number[] {
      for (let i = 0, ii = coordinates.length; i < ii; ++i) {
        coordinates[i] = Math.round(coordinates[i] * power) / power;
      }
      return coordinates;
    };
    if (transformed === geometry) {
      transformed = geometry.clone();
    }
    transformed.applyTransform(transform);
  }
  return transformed;
}

/**
 * @param {import("../extent").Extent} extent Extent.
 * @param {ReadOptions} [options] Read options.
 * @return {import("../extent").Extent} Transformed extent.
 */
export function transformExtentWithOptions(extent: Extent, options: ReadOptions): Extent {
  const featureProjection = options
    ? getProjection(options.featureProjection)
    : null;
  const dataProjection = options ? getProjection(options.dataProjection) : null;

  if (
    featureProjection &&
    dataProjection &&
    !equivalentProjection(featureProjection, dataProjection)
  ) {
    return transformExtent(extent, dataProjection, featureProjection);
  }
  return extent;
}
