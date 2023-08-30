/**
 * @module tl/Geolocation
 */
import BaseEvent from './events/Event';
import BaseObject, {ObjectEvent} from './Object';
import {circular as circularPolygon} from './geom/Polygon';
import {
  get as getProjection,
  getTransformFromProjections,
  identityTransform, ProjectionLike, TransformFunction,
} from './proj';
import {toRadians} from './math';
import {ObjectEventTypes} from "./ObjectEventType";
import {CombinedOnSignature, EventTypes, OnSignature} from "./Observable";
import {EventsKey} from "./events";
import {Coordinate} from "./coordinate";
import {Polygon} from "./geom";
import Projection from "./proj/Projection";

/**
 * @enum {string}
 */
const Property = {
  ACCURACY: 'accuracy',
  ACCURACY_GEOMETRY: 'accuracyGeometry',
  ALTITUDE: 'altitude',
  ALTITUDE_ACCURACY: 'altitudeAccuracy',
  HEADING: 'heading',
  POSITION: 'position',
  PROJECTION: 'projection',
  SPEED: 'speed',
  TRACKING: 'tracking',
  TRACKING_OPTIONS: 'trackingOptions',
};

/**
 * @enum string
 */
export enum GeolocationErrorType {
  /**
   * Triggered when a `GeolocationPositionError` occurs.
   * @event module:tl/Geolocation.GeolocationError#error
   * @api
   */
  ERROR = 'error',
}

/**
 * @classdesc
 * Events emitted on [GeolocationPositionError](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError).
 */
export class GeolocationError extends BaseEvent {
  public code: number;
  public message: string;
  /**
   * @param {GeolocationPositionError} error error object.
   */
  constructor(error: GeolocationPositionError) {
    super(GeolocationErrorType.ERROR);

    /**
     * Code of the underlying `GeolocationPositionError`.
     * @type {number}
     * @api
     */
    this.code = error.code;

    /**
     * Message of the underlying `GeolocationPositionError`.
     * @type {string}
     * @api
     */
    this.message = error.message;
  }
}

export interface GeolocationOptions {
  tracking?: boolean;
  trackingOptions?: PositionOptions;
  projection?: ProjectionLike;
}


export type GeolocationObjectEventTypes =
    ObjectEventTypes
    | 'change:accuracy'
    | 'change:accuracyGeometry'
    | 'change:altitude'
    |
    'change:altitudeAccuracy'
    | 'change:heading'
    | 'change:position'
    | 'change:projection'
    | 'change:speed'
    | 'change:tracking'
    |
    'change:trackingOptions';

export type GeolocationOnSignature<Return> = OnSignature<GeolocationObjectEventTypes, ObjectEvent, Return> &
    OnSignature<'error', GeolocationError, Return> &
    CombinedOnSignature<EventTypes | GeolocationObjectEventTypes, Return> &
    OnSignature<EventTypes, BaseEvent, Return>;

/**
 * @classdesc
 * Helper class for providing HTML5 Geolocation capabilities.
 * The [Geolocation API](https://www.w3.org/TR/geolocation-API/)
 * is used to locate a user's position.
 *
 * To get notified of position changes and errors, register listeners for the generic
 * `change` event and the `error` event on your instance of {@link module:tl/Geolocation~Geolocation}.
 *
 * Example:
 *
 *     const geolocation = new Geolocation({
 *       // take the projection to use from the map's view
 *       projection: view.getProjection()
 *     });
 *     // listen to changes in position
 *     geolocation.on('change', function(evt) {
 *       console.log(geolocation.getPosition());
 *     });
 *     // listen to error
 *     geolocation.on('error', function(evt) {
 *       window.console.log(evt.message);
 *     });
 *
 * @fires GeolocationError
 * @api
 */
class Geolocation extends BaseObject {
  /**
   * @param {Options} [options] Options.
   */

  public on?: GeolocationOnSignature<EventsKey>;
  public once?: GeolocationOnSignature<EventsKey>;
  public un?: GeolocationOnSignature<void>;
  private position_?: Coordinate;
  private transform_: TransformFunction;
  private watchId_?: number;

  constructor(options?: GeolocationOptions) {
    super();

    /***
     * @type {GeolocationOnSignature<EventsKey>}
     */
    this.on = null;

    /***
     * @type {GeolocationOnSignature<EventsKey>}
     */
    this.once = null;

    /***
     * @type {GeolocationOnSignature<void>}
     */
    this.un = null;

    options = options || {};

    /**
     * The unprojected (EPSG:4326) device position.
     * @private
     * @type {?Coordinate}
     */
    this.position_ = null;

    /**
     * @private
     * @type {TransformFunction}
     */
    this.transform_ = identityTransform;

    /**
     * @private
     * @type {number|undefined}
     */
    this.watchId_ = undefined;

    this.addChangeListener(Property.PROJECTION, this.handleProjectionChanged_);
    this.addChangeListener(Property.TRACKING, this.handleTrackingChanged_);

    if (options.projection !== undefined) {
      this.setProjection(options.projection);
    }
    if (options.trackingOptions !== undefined) {
      this.setTrackingOptions(options.trackingOptions);
    }

    this.setTracking(options.tracking !== undefined ? options.tracking : false);
  }

  /**
   * Clean up.
   */
  protected disposeInternal(): void {
    this.setTracking(false);
    super.disposeInternal();
  }

  /**
   * @private
   */
  private handleProjectionChanged_(): void {
    const projection = this.getProjection();
    if (projection) {
      this.transform_ = getTransformFromProjections(
        getProjection('EPSG:4326'),
        projection
      );
      if (this.position_) {
        this.set(Property.POSITION, this.transform_(this.position_));
      }
    }
  }

  /**
   * @private
   */
  private handleTrackingChanged_(): void {
    if ('geolocation' in navigator) {
      const tracking = this.getTracking();
      if (tracking && this.watchId_ === undefined) {
        this.watchId_ = navigator.geolocation.watchPosition(
          this.positionChange_.bind(this),
          this.positionError_.bind(this),
          this.getTrackingOptions()
        );
      } else if (!tracking && this.watchId_ !== undefined) {
        navigator.geolocation.clearWatch(this.watchId_);
        this.watchId_ = undefined;
      }
    }
  }

  /**
   * @private
   * @param {GeolocationPosition} position position event.
   */
  private positionChange_(position: GeolocationPosition): void {
    const coords = position.coords;
    this.set(Property.ACCURACY, coords.accuracy);
    this.set(
      Property.ALTITUDE,
      coords.altitude === null ? undefined : coords.altitude
    );
    this.set(
      Property.ALTITUDE_ACCURACY,
      coords.altitudeAccuracy === null ? undefined : coords.altitudeAccuracy
    );
    this.set(
      Property.HEADING,
      coords.heading === null ? undefined : toRadians(coords.heading)
    );
    if (!this.position_) {
      this.position_ = [coords.longitude, coords.latitude];
    } else {
      this.position_[0] = coords.longitude;
      this.position_[1] = coords.latitude;
    }
    const projectedPosition = this.transform_(this.position_);
    this.set(Property.POSITION, projectedPosition.slice());
    this.set(Property.SPEED, coords.speed === null ? undefined : coords.speed);
    const geometry = circularPolygon(this.position_, coords.accuracy);
    geometry.applyTransform(this.transform_);
    this.set(Property.ACCURACY_GEOMETRY, geometry);
    this.changed();
  }

  /**
   * @private
   * @param {GeolocationPositionError} error error object.
   */
  private positionError_(error: GeolocationPositionError): void {
    this.dispatchEvent(new GeolocationError(error));
  }

  /**
   * Get the accuracy of the position in meters.
   * @return {number|undefined} The accuracy of the position measurement in
   *     meters.
   * @observable
   * @api
   */
  public getAccuracy(): number | undefined {
    return /** @type {number|undefined} */ (<number | undefined>this.get(Property.ACCURACY));
  }

  /**
   * Get a geometry of the position accuracy.
   * @return {?import("./geom/Polygon").default} A geometry of the position accuracy.
   * @observable
   * @api
   */
  public getAccuracyGeometry(): Polygon {
    return /** @type {?import("./geom/Polygon").default} */ (
      this.get(Property.ACCURACY_GEOMETRY) || null
    );
  }

  /**
   * Get the altitude associated with the position.
   * @return {number|undefined} The altitude of the position in meters above mean
   *     sea level.
   * @observable
   * @api
   */
  public getAltitude(): number | undefined {
    return /** @type {number|undefined} */ (this.get(Property.ALTITUDE));
  }

  /**
   * Get the altitude accuracy of the position.
   * @return {number|undefined} The accuracy of the altitude measurement in
   *     meters.
   * @observable
   * @api
   */
  public getAltitudeAccuracy(): number | undefined {
    return /** @type {number|undefined} */ (
      this.get(Property.ALTITUDE_ACCURACY)
    );
  }

  /**
   * Get the heading as radians clockwise from North.
   * Note: depending on the browser, the heading is only defined if the `enableHighAccuracy`
   * is set to `true` in the tracking options.
   * @return {number|undefined} The heading of the device in radians from north.
   * @observable
   * @api
   */
  public getHeading(): number | undefined {
    return /** @type {number|undefined} */ (this.get(Property.HEADING));
  }

  /**
   * Get the position of the device.
   * @return {import("./coordinate").Coordinate|undefined} The current position of the device reported
   *     in the current projection.
   * @observable
   * @api
   */
  public getPosition(): Coordinate | undefined {
    return /** @type {import("./coordinate").Coordinate|undefined} */ (
      this.get(Property.POSITION)
    );
  }

  /**
   * Get the projection associated with the position.
   * @return {import("./proj/Projection").default|undefined} The projection the position is
   *     reported in.
   * @observable
   * @api
   */
  public getProjection(): Projection | undefined {
    return /** @type {import("./proj/Projection").default|undefined} */ (
      this.get(Property.PROJECTION)
    );
  }

  /**
   * Get the speed in meters per second.
   * @return {number|undefined} The instantaneous speed of the device in meters
   *     per second.
   * @observable
   * @api
   */
  public getSpeed(): number | undefined {
    return /** @type {number|undefined} */ (this.get(Property.SPEED));
  }

  /**
   * Determine if the device location is being tracked.
   * @return {boolean} The device location is being tracked.
   * @observable
   * @api
   */
  public getTracking(): boolean {
    return /** @type {boolean} */ (this.get(Property.TRACKING));
  }

  /**
   * Get the tracking options.
   * See https://www.w3.org/TR/geolocation-API/#position-options.
   * @return {PositionOptions|undefined} PositionOptions as defined by
   *     the [HTML5 Geolocation spec
   *     ](https://www.w3.org/TR/geolocation-API/#position_options_interface).
   * @observable
   * @api
   */
  public getTrackingOptions(): PositionOptions | undefined {
    return /** @type {PositionOptions|undefined} */ (
      this.get(Property.TRACKING_OPTIONS)
    );
  }

  /**
   * Set the projection to use for transforming the coordinates.
   * @param {import("./proj").ProjectionLike} projection The projection the position is
   *     reported in.
   * @observable
   * @api
   */
  public setProjection(projection: ProjectionLike): void {
    this.set(Property.PROJECTION, getProjection(projection));
  }

  /**
   * Enable or disable tracking.
   * @param {boolean} tracking Enable tracking.
   * @observable
   * @api
   */
  public setTracking(tracking: boolean): void {
    this.set(Property.TRACKING, tracking);
  }

  /**
   * Set the tracking options.
   * See http://www.w3.org/TR/geolocation-API/#position-options.
   * @param {PositionOptions} options PositionOptions as defined by the
   *     [HTML5 Geolocation spec
   *     ](http://www.w3.org/TR/geolocation-API/#position_options_interface).
   * @observable
   * @api
   */
  public setTrackingOptions(options: PositionOptions): void {
    this.set(Property.TRACKING_OPTIONS, options);
  }
}

export default Geolocation;
