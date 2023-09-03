/**
 * @module tl/source/Vector
 */

import Collection, {CollectionEvent} from '../Collection';
import CollectionEventType from '../CollectionEventType';
import Event from '../events/Event';
import EventType from '../events/EventType';
import ObjectEventType, {ObjectEventTypes} from '../ObjectEventType';
import RBush from '../structs/RBush';
import Source, {AttributionLike} from './Source';
import VectorEventType, {VectorSourceEventTypes} from './VectorEventType';
import {TRUE, VOID} from '../functions';
import {all as allStrategy} from '../loadingstrategy';
import {assert} from '../asserts';
import {containsExtent, equals, Extent, wrapAndSliceX} from '../extent';
import {extend} from '../array';
import {getUid} from '../util';
import {isEmpty} from '../obj';
import {EventsKey, listen, unlistenByKey} from '../events';
import {FeatureLoader, FeatureUrlFunction, xhr} from '../featureloader';
import {Geometry} from "../geom";
import Projection from "../proj/Projection";
import Feature from "../Feature";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import BaseEvent from "../events/Event";
import {ObjectEvent} from "../Object";
import FeatureFormat from "../format/Feature";
import {Coordinate} from "../coordinate";

export type LoadingStrategy = (extent: Extent, resolution: number, projection: Projection ) => Extent[];

/**
 * @classdesc
 * Events emitted by {@link module:tl/source/Vector~VectorSource} instances are instances of this
 * type.
 * @template {import("../geom/Geometry").default} [Geometry=import("../geom/Geometry").default]
 */
export class VectorSourceEvent<GeometryType extends Geometry = Geometry> extends Event {
  /**
   * @param {string} type Type.
   * @param {import("../Feature").default<Geometry>} [feature] Feature.
   * @param {Array<import("../Feature").default<Geometry>>} [features] Features.
   */
  public feature?: Feature<GeometryType>;
  public features?: Feature<GeometryType>[];

  constructor(type: string, feature?: Feature<GeometryType>, features?: Feature<GeometryType>[]) {
    super(type);

    /**
     * The added or removed feature for the `ADDFEATURE` and `REMOVEFEATURE` events, `undefined` otherwise.
     * @type {import("../Feature").default<Geometry>|undefined}
     * @api
     */
    this.feature = feature;

    /**
     * The loaded features for the `FEATURESLOADED` event, `undefined` otherwise.
     * @type {Array<import("../Feature").default<Geometry>>|undefined}
     * @api
     */
    this.features = features;
  }
}

export type VectorSourceOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<ObjectEventTypes, ObjectEvent, Return> &
    OnSignature<VectorSourceEventTypes, VectorSourceEvent, Return> &
    CombinedOnSignature<EventTypes | ObjectEventTypes | VectorSourceEventTypes, Return>;

export interface VectorSourceOptions<GeometryType extends Geometry = Geometry> {
  attributions?: AttributionLike;
  features?: Array<Feature<GeometryType>> | Collection<Feature<GeometryType>>;
  format?: FeatureFormat;
  loader?: FeatureLoader;
  overlaps?: boolean;
  strategy?: LoadingStrategy;
  url?: string | FeatureUrlFunction;
  useSpatialIndex?: boolean;
  wrapX?: boolean;
}
/**
 * @classdesc
 * Provides a source of features for vector layers. Vector features provided
 * by this source are suitable for editing. See {@link module:tl/source/VectorTile~VectorTile} for
 * vector data that is optimized for rendering.
 *
 * @fires VectorSourceEvent
 * @api
 * @template {import("../geom/Geometry").default} [Geometry=import("../geom/Geometry").default]
 */
class VectorSource <GeometryType extends Geometry = Geometry> extends Source {
  /**
   * @param {Options<Geometry>} [options] Vector source options.
   */

  public on?: VectorSourceOnSignature<EventsKey>;
  public once?: VectorSourceOnSignature<EventsKey>;
  public un?: VectorSourceOnSignature<void>;
  private loader_: FeatureLoader;
  private format_: FeatureFormat;
  private overlaps_: boolean;
  private url_: string | FeatureUrlFunction;
  private strategy_: LoadingStrategy;
  private featuresRtree_: RBush<Feature<GeometryType>>;
  private loadedExtentsRtree_: RBush<{ extent: Extent }>;
  private loadingExtentsCount_: number;
  private nullGeometryFeatures_: { [key: string]: Feature<GeometryType> };
  private idIndex_: { [key: string]: Feature<GeometryType> };
  private uidIndex_: { [key: string]: Feature<GeometryType> };
  private featureChangeKeys_: { [key: string]: EventsKey[] };
  private featuresCollection_: Collection<Feature<GeometryType>>;

  constructor(options?: VectorSourceOptions<GeometryType>) {
    options = options || {};

    super({
      attributions: options.attributions,
      interpolate: true,
      projection: undefined,
      state: 'ready',
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
    });

    /***
     * @type {VectorSourceOnSignature<import("../events").EventsKey>}
     */
    this.on = null;

    /***
     * @type {VectorSourceOnSignature<import("../events").EventsKey>}
     */
    this.once = null;

    /***
     * @type {VectorSourceOnSignature<void>}
     */
    this.un = null;

    /**
     * @private
     * @type {import("../featureloader").FeatureLoader}
     */
    this.loader_ = VOID;

    /**
     * @private
     * @type {import("../format/Feature").default|undefined}
     */
    this.format_ = options.format;

    /**
     * @private
     * @type {boolean}
     */
    this.overlaps_ = options.overlaps === undefined ? true : options.overlaps;

    /**
     * @private
     * @type {string|import("../featureloader").FeatureUrlFunction|undefined}
     */
    this.url_ = options.url;

    if (options.loader !== undefined) {
      this.loader_ = options.loader;
    } else if (this.url_ !== undefined) {
      assert(this.format_, 7); // `format` must be set when `url` is set
      // create a XHR feature loader for "url" and "format"
      this.loader_ = xhr(
        this.url_,
        /** @type {import("../format/Feature").default} */ (this.format_)
      );
    }

    /**
     * @private
     * @type {LoadingStrategy}
     */
    this.strategy_ =
      options.strategy !== undefined ? options.strategy : allStrategy;

    const useSpatialIndex =
      options.useSpatialIndex !== undefined ? options.useSpatialIndex : true;

    /**
     * @private
     * @type {RBush<import("../Feature").default<Geometry>>}
     */
    this.featuresRtree_ = useSpatialIndex ? new RBush<Feature<GeometryType>>() : null;

    /**
     * @private
     * @type {RBush<{extent: import("../extent").Extent}>}
     */
    this.loadedExtentsRtree_ = new RBush<{extent: Extent}>();

    /**
     * @type {number}
     * @private
     */
    this.loadingExtentsCount_ = 0;

    /**
     * @private
     * @type {!Object<string, import("../Feature").default<Geometry>>}
     */
    this.nullGeometryFeatures_ = {};

    /**
     * A lookup of features by id (the return from feature.getId()).
     * @private
     * @type {!Object<string, import("../Feature").default<Geometry>>}
     */
    this.idIndex_ = {};

    /**
     * A lookup of features by uid (using getUid(feature)).
     * @private
     * @type {!Object<string, import("../Feature").default<Geometry>>}
     */
    this.uidIndex_ = {};

    /**
     * @private
     * @type {Object<string, Array<import("../events").EventsKey>>}
     */
    this.featureChangeKeys_ = {};

    /**
     * @private
     * @type {Collection<import("../Feature").default<Geometry>>|null}
     */
    this.featuresCollection_ = null;

    /** @type {Collection<import("../Feature").default<Geometry>>} */
    let collection: Collection<Feature<GeometryType>>;
    /** @type {Array<import("../Feature").default<Geometry>>} */
    let features: Feature<GeometryType>[];
    if (Array.isArray(options.features)) {
      features = options.features;
    } else if (options.features) {
      collection = options.features;
      features = collection.getArray();
    }
    if (!useSpatialIndex && collection === undefined) {
      collection = new Collection(features);
    }
    if (features !== undefined) {
      this.addFeaturesInternal(features);
    }
    if (collection !== undefined) {
      this.bindFeaturesCollection_(collection);
    }
  }

  /**
   * Add a single feature to the source.  If you want to add a batch of features
   * at once, call {@link module:tl/source/Vector~VectorSource#addFeatures #addFeatures()}
   * instead. A feature will not be added to the source if feature with
   * the same id is already there. The reason for this behavior is to avoid
   * feature duplication when using bbox or tile loading strategies.
   * Note: this also applies if an {@link module:tl/Collection~Collection} is used for features,
   * meaning that if a feature with a duplicate id is added in the collection, it will
   * be removed from it right away.
   * @param {import("../Feature").default<Geometry>} feature Feature to add.
   * @api
   */
  public addFeature(feature: Feature<GeometryType>): void {
    this.addFeatureInternal(feature);
    this.changed();
  }

  /**
   * Add a feature without firing a `change` event.
   * @param {import("../Feature").default<Geometry>} feature Feature.
   * @protected
   */
  protected addFeatureInternal(feature: Feature<GeometryType>): void {
    const featureKey = getUid(feature);

    if (!this.addToIndex_(featureKey, feature)) {
      if (this.featuresCollection_) {
        this.featuresCollection_.remove(feature);
      }
      return;
    }

    this.setupChangeEvents_(featureKey, feature);

    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      if (this.featuresRtree_) {
        this.featuresRtree_.insert(extent, feature);
      }
    } else {
      this.nullGeometryFeatures_[featureKey] = feature;
    }

    this.dispatchEvent(
      new VectorSourceEvent(VectorEventType.ADDFEATURE, feature)
    );
  }

  /**
   * @param {string} featureKey Unique identifier for the feature.
   * @param {import("../Feature").default<Geometry>} feature The feature.
   * @private
   */
  private setupChangeEvents_(featureKey: string, feature: Feature<GeometryType>): void {
    this.featureChangeKeys_[featureKey] = [
      listen(feature, EventType.CHANGE, this.handleFeatureChange_, this),
      listen(
        feature,
        ObjectEventType.PROPERTYCHANGE,
        this.handleFeatureChange_,
        this
      ),
    ];
  }

  /**
   * @param {string} featureKey Unique identifier for the feature.
   * @param {import("../Feature").default<Geometry>} feature The feature.
   * @return {boolean} The feature is "valid", in the sense that it is also a
   *     candidate for insertion into the Rtree.
   * @private
   */
  private addToIndex_(featureKey: string, feature: Feature<GeometryType>): boolean {
    let valid = true;
    const id = feature.getId();
    if (id !== undefined) {
      if (!(id.toString() in this.idIndex_)) {
        this.idIndex_[id.toString()] = feature;
      } else {
        valid = false;
      }
    }
    if (valid) {
      assert(!(featureKey in this.uidIndex_), 30); // The passed `feature` was already added to the source
      this.uidIndex_[featureKey] = feature;
    }
    return valid;
  }

  /**
   * Add a batch of features to the source.
   * @param {Array<import("../Feature").default<Geometry>>} features Features to add.
   * @api
   */
  public addFeatures(features: Feature<GeometryType>[]): void {
    this.addFeaturesInternal(features);
    this.changed();
  }

  /**
   * Add features without firing a `change` event.
   * @param {Array<import("../Feature").default<Geometry>>} features Features.
   * @protected
   */
  protected addFeaturesInternal(features: Feature<GeometryType>[]): void {
    const extents = [];
    const newFeatures = [];
    const geometryFeatures = [];

    for (let i = 0, length = features.length; i < length; i++) {
      const feature = features[i];
      const featureKey = getUid(feature);
      if (this.addToIndex_(featureKey, feature)) {
        newFeatures.push(feature);
      }
    }

    for (let i = 0, length = newFeatures.length; i < length; i++) {
      const feature = newFeatures[i];
      const featureKey = getUid(feature);
      this.setupChangeEvents_(featureKey, feature);

      const geometry = feature.getGeometry();
      if (geometry) {
        const extent = geometry.getExtent();
        extents.push(extent);
        geometryFeatures.push(feature);
      } else {
        this.nullGeometryFeatures_[featureKey] = feature;
      }
    }
    if (this.featuresRtree_) {
      this.featuresRtree_.load(extents, geometryFeatures);
    }

    if (this.hasListener(VectorEventType.ADDFEATURE)) {
      for (let i = 0, length = newFeatures.length; i < length; i++) {
        this.dispatchEvent(
          new VectorSourceEvent(VectorEventType.ADDFEATURE, newFeatures[i])
        );
      }
    }
  }

  /**
   * @param {!Collection<import("../Feature").default<Geometry>>} collection Collection.
   * @private
   */
  private bindFeaturesCollection_(collection: Collection<Feature<GeometryType>>): void {
    let modifyingCollection = false;
    this.addEventListener(
      VectorEventType.ADDFEATURE,
      /**
       * @param {VectorSourceEvent<Geometry>} evt The vector source event
       */
      function (evt: VectorSourceEvent<GeometryType>) {
        if (!modifyingCollection) {
          modifyingCollection = true;
          collection.push(evt.feature);
          modifyingCollection = false;
        }
      }
    );
    this.addEventListener(
      VectorEventType.REMOVEFEATURE,
      /**
       * @param {VectorSourceEvent<Geometry>} evt The vector source event
       */
      function (evt: VectorSourceEvent<GeometryType>) {
        if (!modifyingCollection) {
          modifyingCollection = true;
          collection.remove(evt.feature);
          modifyingCollection = false;
        }
      }
    );
    collection.addEventListener(
      CollectionEventType.ADD,
      /**
       * @param {import("../Collection").CollectionEvent<import("../Feature").default<Geometry>>} evt The collection event
       */
      (evt: CollectionEvent<Feature<GeometryType>>) => {
        if (!modifyingCollection) {
          modifyingCollection = true;
          this.addFeature(evt.element);
          modifyingCollection = false;
        }
      }
    );
    collection.addEventListener(
      CollectionEventType.REMOVE,
      /**
       * @param {import("../Collection").CollectionEvent<import("../Feature").default<Geometry>>} evt The collection event
       */
      (evt: CollectionEvent<Feature<GeometryType>>) => {
        if (!modifyingCollection) {
          modifyingCollection = true;
          this.removeFeature(evt.element);
          modifyingCollection = false;
        }
      }
    );
    this.featuresCollection_ = collection;
  }

  /**
   * Remove all features from the source.
   * @param {boolean} [fast] Skip dispatching of {@link module:tl/source/Vector.VectorSourceEvent#event:removefeature} events.
   * @api
   */
  public clear(fast?: boolean): void {
    if (fast) {
      for (const featureId in this.featureChangeKeys_) {
        const keys = this.featureChangeKeys_[featureId];
        keys.forEach(unlistenByKey);
      }
      if (!this.featuresCollection_) {
        this.featureChangeKeys_ = {};
        this.idIndex_ = {};
        this.uidIndex_ = {};
      }
    } else {
      if (this.featuresRtree_) {
        const removeAndIgnoreReturn = (feature) => {
          this.removeFeatureInternal(feature);
        };
        this.featuresRtree_.forEach(removeAndIgnoreReturn);
        for (const id in this.nullGeometryFeatures_) {
          this.removeFeatureInternal(this.nullGeometryFeatures_[id]);
        }
      }
    }
    if (this.featuresCollection_) {
      this.featuresCollection_.clear();
    }

    if (this.featuresRtree_) {
      this.featuresRtree_.clear();
    }
    this.nullGeometryFeatures_ = {};

    const clearEvent = new VectorSourceEvent(VectorEventType.CLEAR);
    this.dispatchEvent(clearEvent);
    this.changed();
  }

  /**
   * Iterate through all features on the source, calling the provided callback
   * with each one.  If the callback returns any "truthy" value, iteration will
   * stop and the function will return the same value.
   * Note: this function only iterate through the feature that have a defined geometry.
   *
   * @param {function(import("../Feature").default<Geometry>): T} callback Called with each feature
   *     on the source.  Return a truthy value to stop iteration.
   * @return {T|undefined} The return value from the last call to the callback.
   * @template T
   * @api
   */
  public forEachFeature<T>(callback: (feature: Feature<GeometryType>) => T): T | undefined {
    if (this.featuresRtree_) {
      return this.featuresRtree_.forEach(callback);
    }
    if (this.featuresCollection_) {
      this.featuresCollection_.forEach(callback);
    }
  }

  /**
   * Iterate through all features whose geometries contain the provided
   * coordinate, calling the callback with each feature.  If the callback returns
   * a "truthy" value, iteration will stop and the function will return the same
   * value.
   *
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {function(import("../Feature").default<Geometry>): T} callback Called with each feature
   *     whose goemetry contains the provided coordinate.
   * @return {T|undefined} The return value from the last call to the callback.
   * @template T
   */
  public forEachFeatureAtCoordinateDirect<T>(
      coordinate: Coordinate,
      callback: (feature: Feature<GeometryType>) => T
  ): T | undefined {
    const extent: Extent = [coordinate[0], coordinate[1], coordinate[0], coordinate[1]];
    return this.forEachFeatureInExtent(extent, function (feature) {
      const geometry = feature.getGeometry();
      if (geometry.intersectsCoordinate(coordinate)) {
        return callback(feature);
      }
      return undefined;
    });
  }

  /**
   * Iterate through all features whose bounding box intersects the provided
   * extent (note that the feature's geometry may not intersect the extent),
   * calling the callback with each feature.  If the callback returns a "truthy"
   * value, iteration will stop and the function will return the same value.
   *
   * If you are interested in features whose geometry intersects an extent, call
   * the {@link module:tl/source/Vector~VectorSource#forEachFeatureIntersectingExtent #forEachFeatureIntersectingExtent()} method instead.
   *
   * When `useSpatialIndex` is set to false, this method will loop through all
   * features, equivalent to {@link module:tl/source/Vector~VectorSource#forEachFeature #forEachFeature()}.
   *
   * @param {import("../extent").Extent} extent Extent.
   * @param {function(import("../Feature").default<Geometry>): T} callback Called with each feature
   *     whose bounding box intersects the provided extent.
   * @return {T|undefined} The return value from the last call to the callback.
   * @template T
   * @api
   */
  public forEachFeatureInExtent<T>(extent: Extent, callback: (feature: Feature<GeometryType>) => T): T | undefined {
    if (this.featuresRtree_) {
      return this.featuresRtree_.forEachInExtent(extent, callback);
    }
    if (this.featuresCollection_) {
      this.featuresCollection_.forEach(callback);
    }
  }

  /**
   * Iterate through all features whose geometry intersects the provided extent,
   * calling the callback with each feature.  If the callback returns a "truthy"
   * value, iteration will stop and the function will return the same value.
   *
   * If you only want to test for bounding box intersection, call the
   * {@link module:tl/source/Vector~VectorSource#forEachFeatureInExtent #forEachFeatureInExtent()} method instead.
   *
   * @param {import("../extent").Extent} extent Extent.
   * @param {function(import("../Feature").default<Geometry>): T} callback Called with each feature
   *     whose geometry intersects the provided extent.
   * @return {T|undefined} The return value from the last call to the callback.
   * @template T
   * @api
   */
  public forEachFeatureIntersectingExtent<T>(extent: Extent, callback: (feature: Feature<GeometryType>) => T): T | undefined {
    return this.forEachFeatureInExtent(
      extent,

      function (feature: Feature<GeometryType>): T | undefined {
        const geometry = feature.getGeometry();
        if (geometry.intersectsExtent(extent)) {
          const result = callback(feature);
          if (result) {
            return result;
          }
        }
      }
    );
  }

  /**
   * Get the features collection associated with this source. Will be `null`
   * unless the source was configured with `useSpatialIndex` set to `false`, or
   * with an {@link module:tl/Collection~Collection} as `features`.
   * @return {Collection<import("../Feature").default<Geometry>>|null} The collection of features.
   * @api
   */
  public getFeaturesCollection(): Collection<Feature<GeometryType>> {
    return this.featuresCollection_;
  }

  /**
   * Get a snapshot of the features currently on the source in random order. The returned array
   * is a copy, the features are references to the features in the source.
   * @return {Array<import("../Feature").default<Geometry>>} Features.
   * @api
   */
  public getFeatures(): Feature<GeometryType>[] {
    let features: Feature<GeometryType>[];
    if (this.featuresCollection_) {
      features = this.featuresCollection_.getArray().slice(0);
    } else if (this.featuresRtree_) {
      features = this.featuresRtree_.getAll();
      if (!isEmpty(this.nullGeometryFeatures_)) {
        extend(features, Object.values(this.nullGeometryFeatures_));
      }
    }
    return /** @type {Array<import("../Feature").default<Geometry>>} */ (
      features
    );
  }

  /**
   * Get all features whose geometry intersects the provided coordinate.
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @return {Array<import("../Feature").default<Geometry>>} Features.
   * @api
   */
  public getFeaturesAtCoordinate(coordinate: Coordinate): Feature<GeometryType>[] {
    const features = [];
    this.forEachFeatureAtCoordinateDirect(coordinate, function (feature) {
      features.push(feature);
    });
    return features;
  }

  /**
   * Get all features whose bounding box intersects the provided extent.  Note that this returns an array of
   * all features intersecting the given extent in random order (so it may include
   * features whose geometries do not intersect the extent).
   *
   * When `useSpatialIndex` is set to false, this method will return all
   * features.
   *
   * @param {import("../extent").Extent} extent Extent.
   * @param {import("../proj/Projection").default} [projection] Include features
   * where `extent` exceeds the x-axis bounds of `projection` and wraps around the world.
   * @return {Array<import("../Feature").default<Geometry>>} Features.
   * @api
   */
  public getFeaturesInExtent(extent: Extent, projection?: Projection): Feature<GeometryType>[] {
    if (this.featuresRtree_) {
      const multiWorld = projection && projection.canWrapX() && this.getWrapX();

      if (!multiWorld) {
        return this.featuresRtree_.getInExtent(extent);
      }

      const extents = wrapAndSliceX(extent, projection);

      return [].concat(
        ...extents.map((anExtent) => this.featuresRtree_.getInExtent(anExtent))
      );
    }
    if (this.featuresCollection_) {
      return this.featuresCollection_.getArray().slice(0);
    }
    return [];
  }

  /**
   * Get the closest feature to the provided coordinate.
   *
   * This method is not available when the source is configured with
   * `useSpatialIndex` set to `false`.
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {function(import("../Feature").default<Geometry>):boolean} [filter] Feature filter function.
   *     The filter function will receive one argument, the {@link module:tl/Feature~Feature feature}
   *     and it should return a boolean value. By default, no filtering is made.
   * @return {import("../Feature").default<Geometry>} Closest feature.
   * @api
   */
  public getClosestFeatureToCoordinate(coordinate: Coordinate, filter?: (feature: Feature<GeometryType>) => boolean): Feature<GeometryType> {
    // Find the closest feature using branch and bound.  We start searching an
    // infinite extent, and find the distance from the first feature found.  This
    // becomes the closest feature.  We then compute a smaller extent which any
    // closer feature must intersect.  We continue searching with this smaller
    // extent, trying to find a closer feature.  Every time we find a closer
    // feature, we update the extent being searched so that any even closer
    // feature must intersect it.  We continue until we run out of features.
    const x = coordinate[0];
    const y = coordinate[1];
    let closestFeature = null;
    const closestPoint: Coordinate = [NaN, NaN];
    let minSquaredDistance = Infinity;
    const extent: Extent = [-Infinity, -Infinity, Infinity, Infinity];
    filter = filter ? filter : TRUE;
    this.featuresRtree_.forEachInExtent(
      extent,
      /**
       * @param {import("../Feature").default<Geometry>} feature Feature.
       */
      function (feature: Feature<GeometryType>): void {
        if (filter(feature)) {
          const geometry = feature.getGeometry();
          const previousMinSquaredDistance = minSquaredDistance;
          minSquaredDistance = geometry.closestPointXY(
            x,
            y,
            closestPoint,
            minSquaredDistance
          );
          if (minSquaredDistance < previousMinSquaredDistance) {
            closestFeature = feature;
            // This is sneaky.  Reduce the extent that it is currently being
            // searched while the R-Tree traversal using this same extent object
            // is still in progress.  This is safe because the new extent is
            // strictly contained by the old extent.
            const minDistance = Math.sqrt(minSquaredDistance);
            extent[0] = x - minDistance;
            extent[1] = y - minDistance;
            extent[2] = x + minDistance;
            extent[3] = y + minDistance;
          }
        }
      }
    );
    return closestFeature;
  }

  /**
   * Get the extent of the features currently in the source.
   *
   * This method is not available when the source is configured with
   * `useSpatialIndex` set to `false`.
   * @param {import("../extent").Extent} [extent] Destination extent. If provided, no new extent
   *     will be created. Instead, that extent's coordinates will be overwritten.
   * @return {import("../extent").Extent} Extent.
   * @api
   */
  public getExtent(extent?: Extent): Extent {
    return this.featuresRtree_.getExtent(extent);
  }

  /**
   * Get a feature by its identifier (the value returned by feature.getId()).
   * Note that the index treats string and numeric identifiers as the same.  So
   * `source.getFeatureById(2)` will return a feature with id `'2'` or `2`.
   *
   * @param {string|number} id Feature identifier.
   * @return {import("../Feature").default<Geometry>|null} The feature (or `null` if not found).
   * @api
   */
  public getFeatureById(id: string | number): Feature<GeometryType> {
    const feature = this.idIndex_[id.toString()];
    return feature !== undefined ? feature : null;
  }

  /**
   * Get a feature by its internal unique identifier (using `getUid`).
   *
   * @param {string} uid Feature identifier.
   * @return {import("../Feature").default<Geometry>|null} The feature (or `null` if not found).
   */
  public getFeatureByUid(uid: string): Feature<GeometryType> {
    const feature = this.uidIndex_[uid];
    return feature !== undefined ? feature : null;
  }

  /**
   * Get the format associated with this source.
   *
   * @return {import("../format/Feature").default|undefined} The feature format.
   * @api
   */
  public getFormat(): FeatureFormat {
    return this.format_;
  }

  /**
   * @return {boolean} The source can have overlapping geometries.
   */
  public getOverlaps(): boolean {
    return this.overlaps_;
  }

  /**
   * Get the url associated with this source.
   *
   * @return {string|import("../featureloader").FeatureUrlFunction|undefined} The url.
   * @api
   */
  public getUrl(): string | FeatureUrlFunction | undefined {
    return this.url_;
  }

  /**
   * @param {Event} event Event.
   * @private
   */
  private handleFeatureChange_(event: Event): void {
    const feature = /** @type {import("../Feature").default<Geometry>} */ (
      <Feature<GeometryType>>event.target
    );
    const featureKey = getUid(feature);
    const geometry = feature.getGeometry();
    if (!geometry) {
      if (!(featureKey in this.nullGeometryFeatures_)) {
        if (this.featuresRtree_) {
          this.featuresRtree_.remove(feature);
        }
        this.nullGeometryFeatures_[featureKey] = feature;
      }
    } else {
      const extent = geometry.getExtent();
      if (featureKey in this.nullGeometryFeatures_) {
        delete this.nullGeometryFeatures_[featureKey];
        if (this.featuresRtree_) {
          this.featuresRtree_.insert(extent, feature);
        }
      } else {
        if (this.featuresRtree_) {
          this.featuresRtree_.update(extent, feature);
        }
      }
    }
    const id = feature.getId();
    if (id !== undefined) {
      const sid = id.toString();
      if (this.idIndex_[sid] !== feature) {
        this.removeFromIdIndex_(feature);
        this.idIndex_[sid] = feature;
      }
    } else {
      this.removeFromIdIndex_(feature);
      this.uidIndex_[featureKey] = feature;
    }
    this.changed();
    this.dispatchEvent(
      new VectorSourceEvent(VectorEventType.CHANGEFEATURE, feature)
    );
  }

  /**
   * Returns true if the feature is contained within the source.
   * @param {import("../Feature").default<Geometry>} feature Feature.
   * @return {boolean} Has feature.
   * @api
   */
  public hasFeature(feature: Feature<GeometryType>): boolean {
    const id = feature.getId();
    if (id !== undefined) {
      return id in this.idIndex_;
    }
    return getUid(feature) in this.uidIndex_;
  }

  /**
   * @return {boolean} Is empty.
   */
  public isEmpty(): boolean {
    if (this.featuresRtree_) {
      return (
        this.featuresRtree_.isEmpty() && isEmpty(this.nullGeometryFeatures_)
      );
    }
    if (this.featuresCollection_) {
      return this.featuresCollection_.getLength() === 0;
    }
    return true;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {import("../proj/Projection").default} projection Projection.
   */
  public loadFeatures(extent: Extent, resolution: number, projection: Projection): void {
    const loadedExtentsRtree = this.loadedExtentsRtree_;
    const extentsToLoad = this.strategy_(extent, resolution, projection);
    for (let i = 0, ii = extentsToLoad.length; i < ii; ++i) {
      const extentToLoad = extentsToLoad[i];
      const alreadyLoaded = loadedExtentsRtree.forEachInExtent(
        extentToLoad,
        /**
         * @param {{extent: import("../extent").Extent}} object Object.
         * @return {boolean} Contains.
         */
        function (object: {extent: Extent}): boolean {
          return containsExtent(object.extent, extentToLoad);
        }
      );
      if (!alreadyLoaded) {
        ++this.loadingExtentsCount_;
        this.dispatchEvent(
          new VectorSourceEvent(VectorEventType.FEATURESLOADSTART)
        );
        this.loader_.call(
          this,
          extentToLoad,
          resolution,
          projection,
          (features) => {
            --this.loadingExtentsCount_;
            this.dispatchEvent(
              new VectorSourceEvent(
                VectorEventType.FEATURESLOADEND,
                undefined,
                features
              )
            );
          },
          () => {
            --this.loadingExtentsCount_;
            this.dispatchEvent(
              new VectorSourceEvent(VectorEventType.FEATURESLOADERROR)
            );
          }
        );
        loadedExtentsRtree.insert(extentToLoad, {extent: <Extent>extentToLoad.slice()});
      }
    }
    this.loading =
      this.loader_.length < 4 ? false : this.loadingExtentsCount_ > 0;
  }

  public refresh(): void {
    this.clear(true);
    this.loadedExtentsRtree_.clear();
    super.refresh();
  }

  /**
   * Remove an extent from the list of loaded extents.
   * @param {import("../extent").Extent} extent Extent.
   * @api
   */
  public removeLoadedExtent(extent: Extent): void {
    const loadedExtentsRtree = this.loadedExtentsRtree_;
    let obj;
    loadedExtentsRtree.forEachInExtent(extent, function (object) {
      if (equals(object.extent, extent)) {
        obj = object;
        return true;
      }
    });
    if (obj) {
      loadedExtentsRtree.remove(obj);
    }
  }

  /**
   * Remove a single feature from the source.  If you want to remove all features
   * at once, use the {@link module:tl/source/Vector~VectorSource#clear #clear()} method
   * instead.
   * @param {import("../Feature").default<Geometry>} feature Feature to remove.
   * @api
   */
  public removeFeature(feature: Feature<GeometryType>): void {
    if (!feature) {
      return;
    }
    const featureKey = getUid(feature);
    if (featureKey in this.nullGeometryFeatures_) {
      delete this.nullGeometryFeatures_[featureKey];
    } else {
      if (this.featuresRtree_) {
        this.featuresRtree_.remove(feature);
      }
    }
    const result = this.removeFeatureInternal(feature);
    if (result) {
      this.changed();
    }
  }

  /**
   * Remove feature without firing a `change` event.
   * @param {import("../Feature").default<Geometry>} feature Feature.
   * @return {import("../Feature").default<Geometry>|undefined} The removed feature
   *     (or undefined if the feature was not found).
   * @protected
   */
  protected removeFeatureInternal(feature: Feature<GeometryType>): Feature<GeometryType> | undefined {
    const featureKey = getUid(feature);
    const featureChangeKeys = this.featureChangeKeys_[featureKey];
    if (!featureChangeKeys) {
      return;
    }
    featureChangeKeys.forEach(unlistenByKey);
    delete this.featureChangeKeys_[featureKey];
    const id = feature.getId();
    if (id !== undefined) {
      delete this.idIndex_[id.toString()];
    }
    delete this.uidIndex_[featureKey];
    this.dispatchEvent(
      new VectorSourceEvent(VectorEventType.REMOVEFEATURE, feature)
    );
    return feature;
  }

  /**
   * Remove a feature from the id index.  Called internally when the feature id
   * may have changed.
   * @param {import("../Feature").default<Geometry>} feature The feature.
   * @return {boolean} Removed the feature from the index.
   * @private
   */
  private removeFromIdIndex_(feature: Feature<GeometryType>): boolean {
    let removed = false;
    for (const id in this.idIndex_) {
      if (this.idIndex_[id] === feature) {
        delete this.idIndex_[id];
        removed = true;
        break;
      }
    }
    return removed;
  }

  /**
   * Set the new loader of the source. The next render cycle will use the
   * new loader.
   * @param {import("../featureloader").FeatureLoader} loader The loader to set.
   * @api
   */
  public setLoader(loader: FeatureLoader): void {
    this.loader_ = loader;
  }

  /**
   * Points the source to a new url. The next render cycle will use the new url.
   * @param {string|import("../featureloader").FeatureUrlFunction} url Url.
   * @api
   */
  public setUrl(url: string | FeatureUrlFunction): void {
    assert(this.format_, 7); // `format` must be set when `url` is set
    this.url_ = url;
    this.setLoader(xhr(url, this.format_));
  }
}

export default VectorSource;
