/**
 * @module ol/format/TextFeature
 */
import FeatureFormat, {FeatureFormatType, ReadOptions, WriteOptions} from './Feature';
import Feature from "../Feature";
import Geometry from "../geom/Geometry";
import Projection from "../proj/Projection";


/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for text feature formats.
 *
 * @abstract
 */
abstract class TextFeature extends FeatureFormat {
  protected constructor() {
    super();
  }

  /**
   * @return {import("./Feature").Type} Format.
   */
  public getType(): FeatureFormatType {
    return 'text';
  }

  /**
   * Read the feature from the source.
   *
   * @param {Document|Element|Object|string} source Source.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @return {import("../Feature").default} Feature.
   * @api
   */
  public readFeature(source: Document | Element | Object | string, options?: ReadOptions): Feature {
    return this.readFeatureFromText(
      getText(source),
      this.adaptOptions(options)
    );
  }

  /**
   * @abstract
   * @param {string} text Text.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {import("../Feature").default} Feature.
   */
  protected abstract readFeatureFromText(text: string, options?: ReadOptions): Feature;

  /**
   * Read the features from the source.
   *
   * @param {Document|Element|Object|string} source Source.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @return {Array<import("../Feature").default>} Features.
   * @api
   */
  public readFeatures(source: Document | Element | Object | string, options?: ReadOptions): Feature[] {
    return this.readFeaturesFromText(
      getText(source),
      this.adaptOptions(options)
    );
  }

  /**
   * @abstract
   * @param {string} text Text.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {Array<import("../Feature").default>} Features.
   */
  protected abstract readFeaturesFromText(text: string, options?: ReadOptions): Feature[];

  /**
   * Read the geometry from the source.
   *
   * @param {Document|Element|Object|string} source Source.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @return {import("../geom/Geometry").default} Geometry.
   * @api
   */
  public readGeometry(source: Document | Element | Object | string, options?: ReadOptions): Geometry {
    return this.readGeometryFromText(
      getText(source),
      this.adaptOptions(options)
    );
  }

  /**
   * @abstract
   * @param {string} text Text.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {import("../geom/Geometry").default} Geometry.
   */
  protected abstract readGeometryFromText(text: string, options?: ReadOptions): Geometry;

  /**
   * Read the projection from the source.
   *
   * @param {Document|Element|Object|string} source Source.
   * @return {import("../proj/Projection").default|undefined} Projection.
   * @api
   */
  public readProjection(source: Document | Element | Object | string): Projection | undefined {
    return this.readProjectionFromText(getText(source));
  }

  /**
   * @param {string} text Text.
   * @protected
   * @return {import("../proj/Projection").default|undefined} Projection.
   */
  protected readProjectionFromText(text: string): Projection {
    return this.dataProjection;
  }

  /**
   * Encode a feature as a string.
   *
   * @param {import("../Feature").default} feature Feature.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {string} Encoded feature.
   * @api
   */
  public writeFeature(feature: Feature, options?: WriteOptions): string {
    return this.writeFeatureText(feature, this.adaptOptions(options));
  }

  /**
   * @abstract
   * @param {import("../Feature").default} feature Features.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @protected
   * @return {string} Text.
   */
  protected abstract writeFeatureText(feature: Feature, options?: WriteOptions): string;

  /**
   * Encode an array of features as string.
   *
   * @param {Array<import("../Feature").default>} features Features.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {string} Encoded features.
   * @api
   */
  public writeFeatures(features: Feature[], options?: WriteOptions): string {
    return this.writeFeaturesText(features, this.adaptOptions(options));
  }

  /**
   * @abstract
   * @param {Array<import("../Feature").default>} features Features.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @protected
   * @return {string} Text.
   */
  protected abstract writeFeaturesText(features: Feature[], options?: WriteOptions): string;

  /**
   * Write a single geometry.
   *
   * @param {import("../geom/Geometry").default} geometry Geometry.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {string} Geometry.
   * @api
   */
  public writeGeometry(geometry: Geometry, options? : WriteOptions): string {
    return this.writeGeometryText(geometry, this.adaptOptions(options));
  }

  /**
   * @abstract
   * @param {import("../geom/Geometry").default} geometry Geometry.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @protected
   * @return {string} Text.
   */
  protected abstract writeGeometryText(geometry: Geometry, options?: WriteOptions): string;

}

/**
 * @param {Document|Element|Object|string} source Source.
 * @return {string} Text.
 */
function getText(source: Document | Element | Object | string): string {
  if (typeof source === 'string') {
    return source;
  }
  return '';
}

export default TextFeature;
