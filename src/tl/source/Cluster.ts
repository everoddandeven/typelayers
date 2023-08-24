/**
 * @module tl/source/Cluster
 */

import EventType from '../events/EventType';
import Feature from '../Feature';
import Point from '../geom/Point';
import VectorSource from './Vector';
import {add as addCoordinate, Coordinate, scale as scaleCoordinate} from '../coordinate';
import {assert} from '../asserts';
import {
  buffer,
  createEmpty,
  createOrUpdateFromCoordinate, Extent,
  getCenter,
} from '../extent';
import {getUid} from '../util';
import {AttributionLike} from "./Source";
import Projection from "../proj/Projection";

export type GeometryFunction = (feature: Feature) => Point;

export interface ClusterOptions {
  attributions?: AttributionLike;
  distance?: number;
  minDistance?: number;
  geometryFunction?: GeometryFunction;
  createCluster?: (point: Point, features: Feature[]) => Feature;
  source?: VectorSource;
  wrapX?: boolean;
}

/**
 * @classdesc
 * Layer source to cluster vector data. Works out of the box with point
 * geometries. For other geometry types, or if not all geometries should be
 * considered for clustering, a custom `geometryFunction` can be defined.
 *
 * If the instance is disposed without also disposing the underlying
 * source `setSource(null)` has to be called to remove the listener reference
 * from the wrapped source.
 * @api
 */
class Cluster extends VectorSource {
  protected resolution?: number;
  protected distance: number;
  protected minDistance: number;
  protected interpolationRatio: number;
  protected features: Feature[];
  protected geometryFunction: GeometryFunction;
  private createCustomCluster_: (point: Point, features: Feature[]) => Feature;
  protected source?: VectorSource;
  private boundRefresh_: any;
  /**
   * @param {Options} options Cluster options.
   */
  constructor(options: ClusterOptions) {
    super({
      attributions: options.attributions,
      wrapX: options.wrapX,
    });

    /**
     * @type {number|undefined}
     * @protected
     */
    this.resolution = undefined;

    /**
     * @type {number}
     * @protected
     */
    this.distance = options.distance !== undefined ? options.distance : 20;

    /**
     * @type {number}
     * @protected
     */
    this.minDistance = options.minDistance || 0;

    /**
     * @type {number}
     * @protected
     */
    this.interpolationRatio = 0;

    /**
     * @type {Array<Feature>}
     * @protected
     */
    this.features = [];

    /**
     * @param {Feature} feature Feature.
     * @return {Point} Cluster calculation point.
     * @protected
     */
    this.geometryFunction =
      options.geometryFunction ||
      function (feature: Feature) {
        const geometry = /** @type {Point} */ (<Point>feature.getGeometry());
        assert(!geometry || geometry.getType() === 'Point', 10); // The default `geometryFunction` can only handle `Point` or null geometries
        return geometry;
      };

    /**
     * @type {function(Point, Array<Feature>):Feature}
     * @private
     */
    this.createCustomCluster_ = options.createCluster;

    /**
     * @type {VectorSource|null}
     * @protected
     */
    this.source = null;

    /**
     * @private
     */
    this.boundRefresh_ = this.refresh.bind(this);

    this.updateDistance(this.distance, this.minDistance);
    this.setSource(options.source || null);
  }

  /**
   * Remove all features from the source.
   * @param {boolean} [fast] Skip dispatching of {@link module:tl/source/VectorEventType~VectorEventType#removefeature} events.
   * @api
   */
  public clear(fast?: boolean): void {
    this.features.length = 0;
    super.clear(fast);
  }

  /**
   * Get the distance in pixels between clusters.
   * @return {number} Distance.
   * @api
   */
  public getDistance(): number {
    return this.distance;
  }

  /**
   * Get a reference to the wrapped source.
   * @return {VectorSource|null} Source.
   * @api
   */
  public getSource(): VectorSource {
    return this.source;
  }

  /**
   * @param {import("../extent").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {import("../proj/Projection").default} projection Projection.
   */
  public loadFeatures(extent: Extent, resolution: number, projection: Projection): void {
    this.source.loadFeatures(extent, resolution, projection);
    if (resolution !== this.resolution) {
      this.resolution = resolution;
      this.refresh();
    }
  }

  /**
   * Set the distance within which features will be clusterd together.
   * @param {number} distance The distance in pixels.
   * @api
   */
  public setDistance(distance: number): void {
    this.updateDistance(distance, this.minDistance);
  }

  /**
   * Set the minimum distance between clusters. Will be capped at the
   * configured distance.
   * @param {number} minDistance The minimum distance in pixels.
   * @api
   */
  public setMinDistance(minDistance: number): void {
    this.updateDistance(this.distance, minDistance);
  }

  /**
   * The configured minimum distance between clusters.
   * @return {number} The minimum distance in pixels.
   * @api
   */
  public getMinDistance(): number {
    return this.minDistance;
  }

  /**
   * Replace the wrapped source.
   * @param {VectorSource|null} source The new source for this instance.
   * @api
   */
  public setSource(source: VectorSource): void {
    if (this.source) {
      this.source.removeEventListener(EventType.CHANGE, this.boundRefresh_);
    }
    this.source = source;
    if (source) {
      source.addEventListener(EventType.CHANGE, this.boundRefresh_);
    }
    this.refresh();
  }

  /**
   * Handle the source changing.
   */
  public refresh(): void {
    this.clear();
    this.cluster();
    this.addFeatures(this.features);
  }

  /**
   * Update the distances and refresh the source if necessary.
   * @param {number} distance The new distance.
   * @param {number} minDistance The new minimum distance.
   */
  public updateDistance(distance: number, minDistance: number): void {
    const ratio =
      distance === 0 ? 0 : Math.min(minDistance, distance) / distance;
    const changed =
      distance !== this.distance || this.interpolationRatio !== ratio;
    this.distance = distance;
    this.minDistance = minDistance;
    this.interpolationRatio = ratio;
    if (changed) {
      this.refresh();
    }
  }

  /**
   * @protected
   */
  protected cluster(): void {
    if (this.resolution === undefined || !this.source) {
      return;
    }
    const extent = createEmpty();
    const mapDistance = this.distance * this.resolution;
    const features = this.source.getFeatures();

    /** @type {Object<string, true>} */
    const clustered = {};

    for (let i = 0, ii = features.length; i < ii; i++) {
      const feature = features[i];
      if (!(getUid(feature) in clustered)) {
        const geometry = this.geometryFunction(feature);
        if (geometry) {
          const coordinates = geometry.getCoordinates();
          createOrUpdateFromCoordinate(coordinates, extent);
          buffer(extent, mapDistance, extent);

          const neighbors = this.source
            .getFeaturesInExtent(extent)
            .filter(function (neighbor) {
              const uid = getUid(neighbor);
              if (uid in clustered) {
                return false;
              }
              clustered[uid] = true;
              return true;
            });
          this.features.push(this.createCluster(neighbors, extent));
        }
      }
    }
  }

  /**
   * @param {Array<Feature>} features Features
   * @param {import("../extent").Extent} extent The searched extent for these features.
   * @return {Feature} The cluster feature.
   * @protected
   */
  protected createCluster(features: Feature[], extent: Extent): Feature {
    const centroid: Coordinate = [0, 0];
    for (let i = features.length - 1; i >= 0; --i) {
      const geometry = this.geometryFunction(features[i]);
      if (geometry) {
        addCoordinate(centroid, geometry.getCoordinates());
      } else {
        features.splice(i, 1);
      }
    }
    scaleCoordinate(centroid, 1 / features.length);
    const searchCenter = getCenter(extent);
    const ratio = this.interpolationRatio;
    const geometry = new Point([
      centroid[0] * (1 - ratio) + searchCenter[0] * ratio,
      centroid[1] * (1 - ratio) + searchCenter[1] * ratio,
    ]);
    if (this.createCustomCluster_) {
      return this.createCustomCluster_(geometry, features);
    }
    return new Feature({
      geometry,
      features,
    });
  }
}

export default Cluster;
