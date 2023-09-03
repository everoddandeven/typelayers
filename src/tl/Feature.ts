/**
 * @module tl/Feature
 */
import BaseObject from './Object';
import EventType from './events/EventType';
import {assert} from './asserts';
import {EventsKey, listen, unlistenByKey} from './events';
import {Geometry} from "./geom";
import RenderFeature from "./render/Feature";
import BaseEvent from "./events/Event";
import {EventTypes} from "./Observable";
import {ObjectEventTypes} from "./ObjectEventType";
import Style, {StyleFunction, StyleLike} from "./style/Style";


export type FeatureClass = Feature | typeof RenderFeature;
export type FeatureLike = Feature | RenderFeature;

export type FeatureOnSignature<Return> =
    import("./Observable").OnSignature<EventTypes, BaseEvent, Return> &
    import("./Observable").OnSignature<ObjectEventTypes | 'change:geometry', import("./Object").ObjectEvent, Return> &
    import("./Observable").CombinedOnSignature<EventTypes | ObjectEventTypes | 'change:geometry', Return>;

export type ObjectWithGeometry<GeometryType extends Geometry = Geometry> = {[key: string]: any} & { geometry?: GeometryType};

/**
 * @classdesc
 * A vector object for geographic features with a geometry and other
 * attribute properties, similar to the features in vector file formats like
 * GeoJSON.
 *
 * Features can be styled individually with `setStyle`; otherwise they use the
 * style of their vector layer.
 *
 * Note that attribute properties are set as {@link module:tl/Object~BaseObject} properties on
 * the feature object, so they are observable, and have get/set accessors.
 *
 * Typically, a feature has a single geometry property. You can set the
 * geometry using the `setGeometry` method and get it with `getGeometry`.
 * It is possible to store more than one geometry on a feature using attribute
 * properties. By default, the geometry used for rendering is identified by
 * the property name `geometry`. If you want to use another geometry property
 * for rendering, use the `setGeometryName` method to change the attribute
 * property associated with the geometry for the feature.  For example:
 *
 * ```js
 *
 * import Feature from 'tl/Feature';
 * import Polygon from 'tl/geom/Polygon';
 * import Point from 'tl/geom/Point';
 *
 * const feature = new Feature({
 *   geometry: new Polygon(polyCoords),
 *   labelPoint: new Point(labelCoords),
 *   name: 'My Polygon',
 * });
 *
 * // get the polygon geometry
 * const poly = feature.getGeometry();
 *
 * // Render the feature as a point using the coordinates from labelPoint
 * feature.setGeometryName('labelPoint');
 *
 * // get the point geometry
 * const point = feature.getGeometry();
 * ```
 *
 * @api
 * @template {import("./geom/Geometry").default} [Geometry=import("./geom/Geometry").default]
 */
class Feature<GeometryType extends Geometry = Geometry> extends BaseObject {
  /**
   * @param {Geometry|ObjectWithGeometry<Geometry>} [geometryOrProperties]
   *     You may pass a Geometry object directly, or an object literal containing
   *     properties. If you pass an object literal, you may include a Geometry
   *     associated with a `geometry` key.
   */

  private id_?: number | string | null;
  private geometryName_: string;
  private style_: StyleLike;
  private styleFunction_?: StyleFunction;
  private geometryChangeKey_?: EventsKey;

  public on?: FeatureOnSignature<EventsKey>;
  public once?: FeatureOnSignature<EventsKey>;
  public un?: FeatureOnSignature<void>;

  constructor(geometryOrProperties?: GeometryType | ObjectWithGeometry<GeometryType>) {
    super();

    /***
     * @type {FeatureOnSignature<import("./events").EventsKey>}
     */
    this.on = null;

    /***
     * @type {FeatureOnSignature<import("./events").EventsKey>}
     */
    this.once = null;

    /***
     * @type {FeatureOnSignature<void>}
     */
    this.un = null;

    /**
     * @private
     * @type {number|string|undefined}
     */
    this.id_ = undefined;

    /**
     * @type {string}
     * @private
     */
    this.geometryName_ = 'geometry';

    /**
     * User provided style.
     * @private
     * @type {import("./style/Style").StyleLike}
     */
    this.style_ = null;

    /**
     * @private
     * @type {import("./style/Style").StyleFunction|undefined}
     */
    this.styleFunction_ = undefined;

    /**
     * @private
     * @type {?import("./events").EventsKey}
     */
    this.geometryChangeKey_ = null;

    this.addChangeListener(this.geometryName_, this.handleGeometryChanged_);

    if (geometryOrProperties) {
      if (
        typeof (
          /** @type {?} */ (geometryOrProperties).getSimplifiedGeometry
        ) === 'function'
      ) {
        const geometry: GeometryType = <GeometryType>geometryOrProperties;
        this.setGeometry(geometry);
      } else {
        /** @type {Object<string, *>} */
        const properties: {[key: string]: any} = geometryOrProperties;
        this.setProperties(properties);
      }
    }
  }

  /**
   * Clone this feature. If the original feature has a geometry it
   * is also cloned. The feature id is not set in the clone.
   * @return {Feature<Geometry>} The clone.
   * @api
   */
  public clone(): Feature<GeometryType> {
    const clone = /** @type {Feature<Geometry>} */ (
      new Feature<GeometryType>(this.hasProperties() ? this.getProperties() : null)
    );
    clone.setGeometryName(this.getGeometryName());
    const geometry = this.getGeometry();
    if (geometry) {
      clone.setGeometry(/** @type {Geometry} */ (<GeometryType>geometry.clone()));
    }
    const style = this.getStyle();
    if (style) {
      clone.setStyle(style);
    }
    return clone;
  }

  /**
   * Get the feature's default geometry.  A feature may have any number of named
   * geometries.  The "default" geometry (the one that is rendered by default) is
   * set when calling {@link module:tl/Feature~Feature#setGeometry}.
   * @return {Geometry|undefined} The default geometry for the feature.
   * @api
   * @observable
   */
  public getGeometry(): GeometryType | null {
    return /** @type {Geometry|undefined} */ (this.get(this.geometryName_));
  }

  /**
   * Get the feature identifier.  This is a stable identifier for the feature and
   * is either set when reading data from a remote source or set explicitly by
   * calling {@link module:tl/Feature~Feature#setId}.
   * @return {number|string|undefined} Id.
   * @api
   */
  public getId(): number | string | null {
    return this.id_;
  }

  /**
   * Get the name of the feature's default geometry.  By default, the default
   * geometry is named `geometry`.
   * @return {string} Get the property name associated with the default geometry
   *     for this feature.
   * @api
   */
  public getGeometryName(): string {
    return this.geometryName_;
  }

  /**
   * Get the feature's style. Will return what was provided to the
   * {@link module:tl/Feature~Feature#setStyle} method.
   * @return {import("./style/Style").StyleLike|undefined} The feature style.
   * @api
   */
  public getStyle(): StyleLike | null {
    return this.style_;
  }

  /**
   * Get the feature's style function.
   * @return {import("./style/Style").StyleFunction|undefined} Return a function
   * representing the current style of this feature.
   * @api
   */
  public getStyleFunction(): StyleFunction | null {
    return this.styleFunction_;
  }

  /**
   * @private
   */
  private handleGeometryChange_(): void {
    this.changed();
  }

  /**
   * @private
   */
  private handleGeometryChanged_(): void {
    if (this.geometryChangeKey_) {
      unlistenByKey(this.geometryChangeKey_);
      this.geometryChangeKey_ = null;
    }
    const geometry = this.getGeometry();
    if (geometry) {
      this.geometryChangeKey_ = listen(
        geometry,
        EventType.CHANGE,
        this.handleGeometryChange_,
        this,
          null
      );
    }
    this.changed();
  }

  /**
   * Set the default geometry for the feature.  This will update the property
   * with the name returned by {@link module:tl/Feature~Feature#getGeometryName}.
   * @param {Geometry|undefined} geometry The new geometry.
   * @api
   * @observable
   */
  public setGeometry(geometry?: GeometryType): void {
    this.set(this.geometryName_, geometry);
  }

  /**
   * Set the style for the feature to override the layer style.  This can be a
   * single style object, an array of styles, or a function that takes a
   * resolution and returns an array of styles. To unset the feature style, call
   * `setStyle()` without arguments or a false y value.
   * @param {import("./style/Style").StyleLike} [style] Style for this feature.
   * @api
   */
  public setStyle(style: StyleLike): void {
    this.style_ = style;
    this.styleFunction_ = !style ? undefined : createStyleFunction(style);
    this.changed();
  }

  /**
   * Set the feature id.  The feature id is considered stable and may be used when
   * requesting features or comparing identifiers returned from a remote source.
   * The feature id can be used with the
   * {@link module:tl/source/Vector~VectorSource#getFeatureById} method.
   * @param {number|string|undefined} id The feature id.
   * @api
   */
  public setId(id?: number | string | null): void {
    this.id_ = id;
    this.changed();
  }

  /**
   * Set the property name to be used when getting the feature's default geometry.
   * When calling {@link module:tl/Feature~Feature#getGeometry}, the value of the property with
   * this name will be returned.
   * @param {string} name The property name of the default geometry.
   * @api
   */
  public setGeometryName(name: string): void {
    this.removeChangeListener(this.geometryName_, this.handleGeometryChanged_);
    this.geometryName_ = name;
    this.addChangeListener(this.geometryName_, this.handleGeometryChanged_);
    this.handleGeometryChanged_();
  }
}

/**
 * Convert the provided object into a feature style function.  Functions passed
 * through unchanged.  Arrays of Style or single style objects wrapped
 * in a new feature style function.
 * @param {!import("./style/Style").StyleFunction|!Array<import("./style/Style").default>|!import("./style/Style").default} obj
 *     A feature style function, a single style, or an array of styles.
 * @return {import("./style/Style").StyleFunction} A style function.
 */
export function createStyleFunction(obj: StyleFunction | Style[] | Style): StyleFunction {
  if (typeof obj === 'function') {
    return obj;
  }
  /**
   * @type {Array<import("./style/Style").default>}
   */
  let styles: Style[];
  if (Array.isArray(obj)) {
    styles = obj;
  } else {
    assert(typeof (/** @type {?} */ (obj).getZIndex) === 'function', 41); // Expected an `import("./style/Style").Style` or an array of `import("./style/Style").Style`
    const style = /** @type {import("./style/Style").default} */ (obj);
    styles = [style];
  }
  return function () {
    return styles;
  };
}
export default Feature;
