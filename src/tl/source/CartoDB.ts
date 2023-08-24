/**
 * @module tl/source/CartoDB
 */

import XYZ from './XYZ';
import {NearestDirectionFunction} from "../array";
import {ProjectionLike} from "../proj";
import {AttributionLike} from "./Source";

export interface CartoDBOptions {
  attributions?: AttributionLike;
  cacheSize?: number;
  crossOrigin?: null | string;
  projection?: ProjectionLike;
  maxZoom?: number;
  minZoom?: number;
  wrapX?: boolean;
  config?: {[key: string]: any};
  map?: string;
  account?: string;
  transition?: number;
  zDirection?: number | NearestDirectionFunction;
}

export interface CartoDBLayerInfo {
  layergroupid: string;
  cdn_url: { https: string; };
}

/**
 * @classdesc
 * Layer source for the CartoDB Maps API.
 * @api
 */
class CartoDB extends XYZ {
  private account_: string;
  private mapId_: string;
  private config_: {[key: string]: any};
  private templateCache_: {[key: string]: CartoDBLayerInfo};
  /**
   * @param {Options} options CartoDB options.
   */
  constructor(options: CartoDBOptions) {
    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      maxZoom: options.maxZoom !== undefined ? options.maxZoom : 18,
      minZoom: options.minZoom,
      projection: options.projection,
      transition: options.transition,
      wrapX: options.wrapX,
      zDirection: options.zDirection,
    });

    /**
     * @type {string}
     * @private
     */
    this.account_ = options.account;

    /**
     * @type {string}
     * @private
     */
    this.mapId_ = options.map || '';

    /**
     * @type {!Object}
     * @private
     */
    this.config_ = options.config || {};

    /**
     * @type {!Object<string, CartoDBLayerInfo>}
     * @private
     */
    this.templateCache_ = {};

    this.initializeMap_();
  }

  /**
   * Returns the current config.
   * @return {!Object} The current configuration.
   * @api
   */
  public getConfig(): {[key: string]: any } {
    return this.config_;
  }

  /**
   * Updates the carto db config.
   * @param {Object} config a key-value lookup. Values will replace current values
   *     in the config.
   * @api
   */
  public updateConfig(config: {[key: string]: any }): void {
    Object.assign(this.config_, config);
    this.initializeMap_();
  }

  /**
   * Sets the CartoDB config
   * @param {Object} config In the case of anonymous maps, a CartoDB configuration
   *     object.
   * If using named maps, a key-value lookup with the template parameters.
   * @api
   */
  public setConfig(config: {[key: string]: any }): void {
    this.config_ = config || {};
    this.initializeMap_();
  }

  /**
   * Issue a request to initialize the CartoDB map.
   * @private
   */
  private initializeMap_(): void {
    const paramHash = JSON.stringify(this.config_);
    if (this.templateCache_[paramHash]) {
      this.applyTemplate_(this.templateCache_[paramHash]);
      return;
    }
    let mapUrl = 'https://' + this.account_ + '.carto.com/api/v1/map';

    if (this.mapId_) {
      mapUrl += '/named/' + this.mapId_;
    }

    const client = new XMLHttpRequest();
    client.addEventListener(
      'load',
      this.handleInitResponse_.bind(this, paramHash)
    );
    client.addEventListener('error', this.handleInitError_.bind(this));
    client.open('POST', mapUrl);
    client.setRequestHeader('Content-type', 'application/json');
    client.send(JSON.stringify(this.config_));
  }

  /**
   * Handle map initialization response.
   * @param {string} paramHash a hash representing the parameter set that was used
   *     for the request
   * @param {Event} event Event.
   * @private
   */
  private handleInitResponse_(paramHash: string, event: Event): void {
    const client = /** @type {XMLHttpRequest} */ (<XMLHttpRequest>event.target);
    // status will be 0 for file:// urls
    if (!client.status || (client.status >= 200 && client.status < 300)) {
      let response;
      try {
        response = /** @type {CartoDBLayerInfo} */ (
          JSON.parse(client.responseText)
        );
      } catch (err) {
        this.setState('error');
        return;
      }
      this.applyTemplate_(response);
      this.templateCache_[paramHash] = response;
      this.setState('ready');
    } else {
      this.setState('error');
    }
  }

  /**
   * @private
   * @param {Event} event Event.
   */
  private handleInitError_(event: Event): void {
    this.setState('error');
  }

  /**
   * Apply the new tile urls returned by carto db
   * @param {CartoDBLayerInfo} data Result of carto db call.
   * @private
   */
  private applyTemplate_(data: CartoDBLayerInfo): void {
    const tilesUrl =
      'https://' +
      data.cdn_url.https +
      '/' +
      this.account_ +
      '/api/v1/map/' +
      data.layergroupid +
      '/{z}/{x}/{y}.png';
    this.setUrl(tilesUrl);
  }
}

export default CartoDB;
