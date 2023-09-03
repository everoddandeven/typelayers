/**
 * @module tl/layer/MapboxVector
 */
import BaseEvent from '../events/Event';
import EventType from '../events/EventType';
import MVT from '../format/MVT';
import VectorTileLayer, {VectorTileRenderType} from './VectorTile';
import VectorTileSource from '../source/VectorTile';
import {applyBackground, applyStyle} from 'ol-mapbox-style';
import {BackgroundColor} from "./Base";
import {RenderOrderFunction} from "../render";
import {Extent} from "../extent/Extent";
import Map from "../Map";

/**
 * @classdesc
 * Event emitted on configuration or loading error.
 */
export class ErrorEvent extends BaseEvent {
  /**
   * @param {Error} error error object.
   */
  public error: Error;

  constructor(error: Error) {
    super(EventType.ERROR);

    /**
     * @type {Error}
     */
    this.error = error;
  }
}

export interface MapboxVectorLayerOptions {
  styleUrl: string;
  accessToken?: string;
  source?: string;
  layers?: string[];
  declutter?: boolean;
  background?: BackgroundColor | false;
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  renderOrder?: RenderOrderFunction;
  renderBuffer?: number;
  renderMode?: VectorTileRenderType;
  map?: Map;
  updateWhileAnimating?: boolean;
  updateWhileInteracting?: boolean;
  preload?: number;
  useInterimTilesOnError?: boolean;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * A vector tile layer based on a Mapbox style that uses a single vector source.  Configure
 * the layer with the `styleUrl` and `accessToken` shown in Mapbox Studio's share panel.
 * If the style uses more than one source, use the `source` property to choose a single
 * vector source.  If you want to render a subset of the layers in the style, use the `layers`
 * property (all layers must share the same vector source).  See the constructor options for
 * more detail.
 *
 *     const map = new Map({
 *       view: new View({
 *         center: [0, 0],
 *         zoom: 1,
 *       }),
 *       layers: [
 *         new MapboxVectorLayer({
 *           styleUrl: 'mapbox://styles/mapbox/bright-v9',
 *           accessToken: 'your-mapbox-access-token-here',
 *         }),
 *       ],
 *       target: 'map',
 *     });
 *
 * On configuration or loading error, the layer will trigger an `'error'` event.  Listeners
 * will receive an object with an `error` property that can be used to diagnose the problem.
 *
 * **Note for users of the full build**: The `MapboxVectorLayer` requires the
 * [tl-mapbox-style](https://github.com/openlayers/ol-mapbox-style) library to be loaded as well.
 *
 * @param {Options} options Options.
 * @extends {VectorTileLayer}
 * @fires module:tl/events/Event~BaseEvent#event:error
 * @api
 */
class MapboxVectorLayer extends VectorTileLayer {
  public accessToken: string;
  /**
   * @param {Options} options Layer options.  At a minimum, `styleUrl` and `accessToken`
   * must be provided.
   */
  constructor(options: MapboxVectorLayerOptions) {
    const declutter = 'declutter' in options ? options.declutter : true;
    const source = new VectorTileSource({
      state: 'loading',
      format: new MVT(),
    });

    super({
      source: source,
      background: options.background,
      declutter: declutter,
      className: options.className,
      opacity: options.opacity,
      visible: options.visible,
      zIndex: options.zIndex,
      minResolution: options.minResolution,
      maxResolution: options.maxResolution,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      renderOrder: options.renderOrder,
      renderBuffer: options.renderBuffer,
      renderMode: options.renderMode,
      map: options.map,
      updateWhileAnimating: options.updateWhileAnimating,
      updateWhileInteracting: options.updateWhileInteracting,
      preload: options.preload,
      useInterimTilesOnError: options.useInterimTilesOnError,
      properties: options.properties,
    });

    if (options.accessToken) {
      this.accessToken = options.accessToken;
    }
    const url = options.styleUrl;
    //FIXME Remove type cast as soon as we know why it is needed
    applyStyle(/** @type {*} */ (<any>this), url, options.layers || options.source, {
      accessToken: this.accessToken,
    })
      .then(() => {
        source.setState('ready');
      })
      .catch((error) => {
        this.dispatchEvent(new ErrorEvent(error));
        const source = this.getSource();
        source.setState('error');
      });
    if (this.getBackground() === undefined) {
      //FIXME Remove type cast as soon as we know why it is needed
      applyBackground(/** @type {*} */ (<any>this), options.styleUrl, {
        accessToken: this.accessToken,
      });
    }
  }
}

export default MapboxVectorLayer;
