/**
 * @module tl/VectorTile
 */
import Tile, {TileLoadFunction} from './Tile';
import TileState from './TileState';
import {TileCoord} from "./tilecoord";
import FeatureFormat from "./format/Feature";
import {TileOptions} from "./DataTile";
import {Extent} from "./extent/Extent";
import Feature from "./Feature";
import Projection from "./proj/Projection";
import {FeatureLoader} from "./featureloader";

class VectorTile extends Tile {
  /**
   * @param {import("./tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {import("./TileState").default} state SourceState.
   * @param {string} src Data source url.
   * @param {import("./format/Feature").default} format Feature format.
   * @param {import("./Tile").LoadFunction} tileLoadFunction Tile load function.
   * @param {import("./Tile").Options} [options] Tile options.
   */

  private format_: FeatureFormat;
  private features_: Feature[];
  private loader_: FeatureLoader;
  private tileLoadFunction_: TileLoadFunction;
  private url_?: string;

  public extent: Extent;
  public projection: Projection;
  public resolution: number;

  constructor(tileCoord: TileCoord, state: TileState, src: string, format: FeatureFormat, tileLoadFunction: TileLoadFunction, options?: TileOptions) {
    super(tileCoord, state, options);

    /**
     * Extent of this tile; set by the source.
     * @type {import("./extent").Extent}
     */
    this.extent = null;

    /**
     * @private
     * @type {import("./format/Feature").default}
     */
    this.format_ = format;

    /**
     * @private
     * @type {Array<import("./Feature").default>}
     */
    this.features_ = [];

    /**
     * @private
     * @type {import("./featureloader").FeatureLoader}
     */
    this.loader_ = null;

    /**
     * Feature projection of this tile; set by the source.
     * @type {import("./proj/Projection").default}
     */
    this.projection = null;

    /**
     * Resolution of this tile; set by the source.
     * @type {number}
     */
    this.resolution = null;

    /**
     * @private
     * @type {import("./Tile").LoadFunction}
     */
    this.tileLoadFunction_ = tileLoadFunction;

    /**
     * @private
     * @type {string}
     */
    this.url_ = src;

    this.key = src;
  }

  /**
   * Get the feature format assigned for reading this tile's features.
   * @return {import("./format/Feature").default} Feature format.
   * @api
   */
  public getFormat(): FeatureFormat {
    return this.format_;
  }

  /**
   * Get the features for this tile. Geometries will be in the view projection.
   * @return {Array<import("./Feature").FeatureLike>} Features.
   * @api
   */
  public getFeatures(): Feature[] {
    return this.features_;
  }

  /**
   * Load not yet loaded URI.
   */
  public load(): void {
    if (this.state == TileState.IDLE) {
      this.setState(TileState.LOADING);
      this.tileLoadFunction_(this, this.url_);
      if (this.loader_) {
        this.loader_(this.extent, this.resolution, this.projection);
      }
    }
  }

  /**
   * Handler for successful tile load.
   * @param {Array<import("./Feature").default>} features The loaded features.
   * @param {import("./proj/Projection").default} dataProjection Data projection.
   */
  public onLoad(features: Feature[], dataProjection: Projection): void {
    this.setFeatures(features);
  }

  /**
   * Handler for tile load errors.
   */
  public onError(): void {
    this.setState(TileState.ERROR);
  }

  /**
   * Function for use in an {@link module:tl/source/VectorTile~VectorTile}'s `tileLoadFunction`.
   * Sets the features for the tile.
   * @param {Array<import("./Feature").default>} features Features.
   * @api
   */
  public setFeatures(features: Feature[]): void {
    this.features_ = features;
    this.setState(TileState.LOADED);
  }

  /**
   * Set the feature loader for reading this tile's features.
   * @param {import("./featureloader").FeatureLoader} loader Feature loader.
   * @api
   */
  public setLoader(loader: FeatureLoader): void {
    this.loader_ = loader;
  }
}

export default VectorTile;
