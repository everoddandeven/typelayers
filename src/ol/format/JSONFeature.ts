/**
 * @module ol/format/JSONFeature
 */
import FeatureFormat, {FormatType, ReadOptions, WriteOptions} from './Feature';
import Feature from "../Feature";
import Geometry from "../geom/Geometry";
import Projection from "../proj/Projection";

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for JSON feature formats.
 *
 * @abstract
 */
abstract class JSONFeature extends FeatureFormat {
  protected constructor() {
    super();
  }

  /**
   * @return {import("./Feature").Type} Format.
   */
  public getType(): FormatType {
    return 'json';
  }

  /**
   * Read a feature.  Only works for a single feature. Use `readFeatures` to
   * read a feature collection.
   *
   * @param {ArrayBuffer|Document|Element|Object|string} source Source.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @param idField
   * @return {import("../Feature").default} Feature.
   * @api
   */
  public readFeature(source: ArrayBuffer | Document | Element | {} | string, options?: ReadOptions): Feature {
    return this.readFeatureFromObject(
      getObject(source),
      this.getReadOptions(source, options)
    );
  }

  /**
   * Read all features.  Works with both a single feature and a feature
   * collection.
   *
   * @param {ArrayBuffer|Document|Element|Object|string} source Source.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @return {Array<import("../Feature").default>} Features.
   * @api
   */
  public readFeatures(source: ArrayBuffer | Document | Element | {} | string, options?: ReadOptions): Feature[] {
    return this.readFeaturesFromObject(
      getObject(source),
      this.getReadOptions(source, options)
    );
  }

  /**
   * @abstract
   * @param {Object} object Object.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @param idField
   * @protected
   * @return {import("../Feature").default} Feature.
   */
  protected abstract readFeatureFromObject(object: {}, options?: ReadOptions, idField?: string): Feature;

  /**
   * @abstract
   * @param {Object} object Object.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {Array<import("../Feature").default>} Features.
   */
  protected abstract readFeaturesFromObject(object: {}, options?: ReadOptions): Feature[] ;

  /**
   * Read a geometry.
   *
   * @param {ArrayBuffer|Document|Element|Object|string} source Source.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @return {import("../geom/Geometry").default} Geometry.
   * @api
   */
  public readGeometry(source: ArrayBuffer | Document | Element | {} | string, options?: ReadOptions): Geometry {
    return this.readGeometryFromObject(
      getObject(source),
      this.getReadOptions(source, options)
    );
  }

  /**
   * @abstract
   * @param {Object} object Object.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {import("../geom/Geometry").default} Geometry.
   */
  protected abstract readGeometryFromObject(object: {}, options?: ReadOptions): Geometry;

  /**
   * Read the projection.
   *
   * @param {ArrayBuffer|Document|Element|Object|string} source Source.
   * @return {import("../proj/Projection").default} Projection.
   * @api
   */
  public readProjection(source: ArrayBuffer | Document | Element | {} | string): Projection {
    return this.readProjectionFromObject(getObject(source));
  }

  /**
   * @abstract
   * @param {Object} object Object.
   * @protected
   * @return {import("../proj/Projection").default} Projection.
   */
  protected abstract readProjectionFromObject(object: {}): Projection;

  /**
   * Encode a feature as string.
   *
   * @param {import("../Feature").default} feature Feature.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {string} Encoded feature.
   * @api
   */
  public writeFeature(feature: Feature, options?: WriteOptions): string {
    return JSON.stringify(this.writeFeatureObject(feature, options));
  }

  /**
   * @abstract
   * @param {import("../Feature").default} feature Feature.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {Object} Object.
   */
  public abstract writeFeatureObject(feature: Feature, options?: WriteOptions): {[key: string]: any};

  /**
   * Encode an array of features as string.
   *
   * @param {Array<import("../Feature").default>} features Features.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {string} Encoded features.
   * @api
   */
  public writeFeatures(features: Feature[], options?: WriteOptions): string {
    return JSON.stringify(this.writeFeaturesObject(features, options));
  }

  /**
   * @abstract
   * @param {Array<import("../Feature").default>} features Features.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {Object} Object.
   */
  public abstract writeFeaturesObject(features: Feature[], options?: WriteOptions): {[key: string]: any} ;

  /**
   * Encode a geometry as string.
   *
   * @param {import("../geom/Geometry").default} geometry Geometry.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {string} Encoded geometry.
   * @api
   */
  public writeGeometry(geometry: Geometry, options?: WriteOptions): string {
    return JSON.stringify(this.writeGeometryObject(geometry, options));
  }

  /**
   * @abstract
   * @param {import("../geom/Geometry").default} geometry Geometry.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {Object} Object.
   */
  public abstract writeGeometryObject(geometry: Geometry, options?: WriteOptions): {[key: string]: any} ;
}

/**
 * @param {Document|Element|Object|string} source Source.
 * @return {Object} Object.
 */
function getObject(source: Document | Element | {[key: string]: any} | string): {[key: string]: any} {
  if (typeof source === 'string') {
    const object = JSON.parse(source);
    return object ? /** @type {Object} */ (object) : null;
  }
  if (source !== null) {
    return source;
  }
  return null;
}

export default JSONFeature;
