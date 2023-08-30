/**
 * @module tl/source/Source
 */
import BaseObject from '../Object';
import {get as getProjection, ProjectionLike} from '../proj';
import Projection from "../proj/Projection";
import {ViewOptions, ViewStateLayerStateExtent} from "../View";

export type SourceState = 'undefined' | 'loading' | 'ready' | 'error';
export type Attribution = (viewStateLayerStateExtent: ViewStateLayerStateExtent) => string | string[];
export type AttributionLike = string | string[] | Attribution;

/**
 * @typedef {'undefined' | 'loading' | 'ready' | 'error'} State
 * SourceState of the source, one of 'undefined', 'loading', 'ready' or 'error'.
 */

/**
 * A function that takes a {@link import("../View").ViewStateLayerStateExtent} and returns a string or
 * an array of strings representing source attributions.
 *
 * @typedef {function(import("../View").ViewStateLayerStateExtent): (string|Array<string>)} Attribution
 */

/**
 * A type that can be used to provide attribution information for data sources.
 *
 * It represents either
 * * a simple string (e.g. `'© Acme Inc.'`)
 * * an array of simple strings (e.g. `['© Acme Inc.', '© Bacme Inc.']`)
 * * a function that returns a string or array of strings ({@link module:tl/source/Source~Attribution})
 *
 * @typedef {string|Array<string>|Attribution} AttributionLike
 */

/**
 * @typedef Options
 * @property {AttributionLike} [attributions] Attributions.
 * @property {boolean} [attributionsCollapsible=true] Attributions are collapsible.
 * @property {import("../proj").ProjectionLike} [projection] Projection. Default is the view projection.
 * @property {import("./Source").SourceState} [state='ready'] SourceState.
 * @property {boolean} [wrapX=false] WrapX.
 * @property {boolean} [interpolate=false] Use interpolated values when resampling.  By default,
 * the nearest neighbor is used when resampling.
 */

export interface SourceOptions
{
  attributions: AttributionLike,
  attributionsCollapsible?: boolean,
  projection: ProjectionLike,
  state?: SourceState,
  wrapX?: boolean,
  interpolate?: boolean
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for {@link module:tl/layer/Layer~Layer} sources.
 *
 * A generic `change` event is triggered when the state of the source changes.
 * @abstract
 * @api
 */
export default abstract class Source extends BaseObject {
  /**
   * @param {Options} options Source options.
   */

  private attributions_?: Attribution;
  private attributionsCollapsible_: boolean;
  private state_: SourceState;
  private wrapX_: boolean;
  private interpolate_: boolean;
  private viewPromise_: Promise<ViewOptions>;

  protected viewResolver: (viewOptions: ViewOptions) => void;
  protected viewRejector: (error: Error) => void;

  public projection?: Projection;
  public loading: boolean;

  protected constructor(options: SourceOptions) {
    super();

    /**
     * @protected
     * @type {import("../proj/Projection").default|null}
     */
    this.projection = getProjection(options.projection);

    /**
     * @private
     * @type {?Attribution}
     */
    this.attributions_ = adaptAttributions(options.attributions);

    /**
     * @private
     * @type {boolean}
     */
    this.attributionsCollapsible_ =
      options.attributionsCollapsible !== undefined
        ? options.attributionsCollapsible
        : true;

    /**
     * This source is currently loading data. Sources that defer loading to the
     * map's tile queue never set this to `true`.
     * @type {boolean}
     */
    this.loading = false;

    /**
     * @private
     * @type {import("./Source").SourceState}
     */
    this.state_ = options.state !== undefined ? options.state : 'ready';

    /**
     * @private
     * @type {boolean}
     */
    this.wrapX_ = options.wrapX !== undefined ? options.wrapX : false;

    /**
     * @private
     * @type {boolean}
     */
    this.interpolate_ = !!options.interpolate;

    /**
     * @protected
     * @type {function(import("../View").ViewOptions):void}
     */
    this.viewResolver = null;

    /**
     * @protected
     * @type {function(Error):void}
     */
    this.viewRejector = null;

    const self = this;
    /**
     * @private
     * @type {Promise<import("../View").ViewOptions>}
     */
    this.viewPromise_ = new Promise(function (resolve, reject) {
      self.viewResolver = resolve;
      self.viewRejector = reject;
    });
  }

  /**
   * Get the attribution function for the source.
   * @return {?Attribution} Attribution function.
   * @api
   */
  public getAttributions(): Attribution | null {
    return this.attributions_;
  }

  /**
   * @return {boolean} Attributions are collapsible.
   * @api
   */
  public getAttributionsCollapsible(): boolean {
    return this.attributionsCollapsible_;
  }

  /**
   * Get the projection of the source.
   * @return {import("../proj/Projection").default|null} Projection.
   * @api
   */
  public getProjection(): Projection {
    return this.projection;
  }

  /**
   * @param {import("../proj/Projection").default} [projection] Projection.
   * @return {Array<number>|null} Resolutions.
   */
  public getResolutions(projection: Projection) {
    return null;
  }

  /**
   * @return {Promise<import("../View").ViewOptions>} A promise for view-related properties.
   */
  public getView(): Promise<ViewOptions> {
    return this.viewPromise_;
  }

  /**
   * Get the state of the source, see {@link import("./Source").SourceState} for possible states.
   * @return {import("./Source").SourceState} SourceState.
   * @api
   */
  public getState(): SourceState {
    return this.state_;
  }

  /**
   * @return {boolean|undefined} Wrap X.
   */
  public getWrapX(): boolean {
    return this.wrapX_;
  }

  /**
   * @return {boolean} Use linear interpolation when resampling.
   */
  public getInterpolate(): boolean {
    return this.interpolate_;
  }

  /**
   * Refreshes the source. The source will be cleared, and data from the server will be reloaded.
   * @api
   */
  public refresh(): void {
    this.changed();
  }

  /**
   * Set the attributions of the source.
   * @param {AttributionLike|undefined} attributions Attributions.
   *     Can be passed as `string`, `Array<string>`, {@link module:tl/source/Source~Attribution},
   *     or `undefined`.
   * @api
   */
  public setAttributions(attributions?: AttributionLike): void {
    this.attributions_ = adaptAttributions(attributions);
    this.changed();
  }

  /**
   * Set the state of the source.
   * @param {import("./Source").SourceState} state SourceState.
   */
  public setState(state: SourceState): void {
    this.state_ = state;
    this.changed();
  }
}

/**
 * Turns the attributions option into an attributions function.
 * @param {AttributionLike|undefined} attributionLike The attribution option.
 * @return {Attribution|null} An attribution function (or null).
 */
function adaptAttributions(attributionLike?: AttributionLike): Attribution | null {
  if (!attributionLike) {
    return null;
  }
  if (Array.isArray(attributionLike)) {
    return function (frameState: ViewStateLayerStateExtent): string[] {
      return attributionLike;
    };
  }

  if (typeof attributionLike === 'function') {
    return attributionLike;
  }

  return function (frameState: ViewStateLayerStateExtent): string[] {
    return [attributionLike];
  };
}