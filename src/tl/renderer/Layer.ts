/**
 * @module tl/renderer/Layer
 */
import EventType from '../events/EventType';
import ImageState from '../ImageState';
import Observable from '../Observable';
import Layer from "../layer/Layer";
import ExecutorGroup from "../render/canvas/ExecutorGroup";
import {Pixel} from "../pixel";
import {FrameState} from "../Map";
import Tile from "../Tile";
import Projection from "../proj/Projection";
import TileRange from "../TileRange";
import {Coordinate} from "../coordinate";
import BaseEvent from "../events/Event";
import ImageWrapper from "../Image";
import ImageBase from "../ImageBase";
import TileSource from "../source/Tile";
import {FeatureCallback} from "./vector";
import {FeatureLike} from "../Feature";
import { Listener } from '../events';

/**
 * @template {import("../layer/Layer").default} LayerType
 */

//export type LayerType = Layer;

abstract class LayerRenderer<LayerType extends Layer<any, any>> extends Observable {
  /**
   * @param {LayerType} layer Layer.
   */

  private boundHandleImageChange_: Listener;
  public declutterExecutorGroup: ExecutorGroup;

  protected layer_: LayerType;

  public ready: boolean;


  protected constructor(layer: LayerType) {
    super();

    /**
     * The renderer is initialized and ready to render.
     * @type {boolean}
     */
    this.ready = true;

    /** @private */
    this.boundHandleImageChange_ = this.handleImageChange_.bind(this);

    /**
     * @protected
     * @type {LayerType}
     */
    this.layer_ = layer;

    /**
     * @type {import("../render/canvas/ExecutorGroup").default}
     */
    this.declutterExecutorGroup = null;
  }

  /**
   * Asynchronous layer level hit detection.
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Promise<Array<import("../Feature").FeatureLike>>} Promise that resolves with
   * an array of features.
   */
  public abstract getFeatures(pixel: Pixel): Promise<FeatureLike[]>;

  /**
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Uint8ClampedArray|Uint8Array|Float32Array|DataView|null} Pixel data.
   */
  public getData(pixel: Pixel): Uint8ClampedArray|Uint8Array|Float32Array|DataView|null {
    return null;
  }

  /**
   * Determine whether render should be called.
   * @abstract
   * @param {import("../Map").FrameState} frameState Frame state.
   * @return {boolean} Layer is ready to be rendered.
   */
  public abstract prepareFrame(frameState: FrameState): boolean;

  /**
   * Render the layer.
   * @abstract
   * @param {import("../Map").FrameState} frameState Frame state.
   * @param {HTMLElement} target Target that may be used to render content to.
   * @return {HTMLElement} The rendered element.
   */
  public abstract renderFrame(frameState: FrameState, target: HTMLElement): HTMLElement;

  /**
   * @param {Object<number, Object<string, import("../Tile").default>>} tiles Lookup of loaded tiles by zoom level.
   * @param {number} zoom Zoom level.
   * @param {import("../Tile").default} tile Tile.
   * @return {boolean|void} If `false`, the tile will not be considered loaded.
   */
  public loadedTileCallback(tiles: {[key: number]: {[key: string]: Tile}}, zoom: number, tile: Tile): boolean | void {
    if (!tiles[zoom]) {
      tiles[zoom] = {};
    }
    tiles[zoom][tile.tileCoord.toString()] = tile;
    return undefined;
  }

  /**
   * Create a function that adds loaded tiles to the tile lookup.
   * @param {import("../source/Tile").default} source Tile source.
   * @param {import("../proj/Projection").default} projection Projection of the tiles.
   * @param {Object<number, Object<string, import("../Tile").default>>} tiles Lookup of loaded tiles by zoom level.
   * @return {function(number, import("../TileRange").default):boolean} A function that can be
   *     called with a zoom level and a tile range to add loaded tiles to the lookup.
   * @protected
   */
  protected createLoadedTileFinder(
      source: TileSource,
      projection: Projection,
      tiles: {[key: number]: {[key: string]: Tile}}
  ): (zoomLevel: number, tileRange: TileRange) => boolean {
    return (
      /**
       * @param {number} zoom Zoom level.
       * @param {import("../TileRange").default} tileRange Tile range.
       * @return {boolean} The tile range is fully loaded.
       */
      (zoom: number, tileRange: TileRange): boolean => {
        const callback = this.loadedTileCallback.bind(this, tiles, zoom);
        return source.forEachLoadedTile(projection, zoom, tileRange, callback);
      }
    );
  }
  /**
   * @abstract
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {import("../Map").FrameState} frameState Frame state.
   * @param {number} hitTolerance Hit tolerance in pixels.
   * @param {import("./vector").FeatureCallback<T>} callback Feature callback.
   * @param {Array<import("./Map").HitMatch<T>>} matches The hit detected matches with tolerance.
   * @return {T|undefined} Callback result.
   * @template T
   */
  public abstract forEachFeatureAtCoordinate<T>(
    coordinate: Coordinate,
    frameState: FrameState,
    hitTolerance: number,
    callback: FeatureCallback<T>,
    matches: any[]
  ): any;

  /**
   * @return {LayerType} Layer.
   */
  public getLayer(): LayerType {
    return this.layer_;
  }

  /**
   * Perform action necessary to get the layer rendered after new fonts have loaded
   * @abstract
   */
  public abstract handleFontsChanged(): void;

  /**
   * Handle changes in image state.
   * @param {import("../events/Event").default} event Image change event.
   * @private
   */
  private handleImageChange_(event: BaseEvent): void {
    const image = /** @type {import("../Image").default} */ (<ImageWrapper>event.target);
    if (
      image.getState() === ImageState.LOADED ||
      image.getState() === ImageState.ERROR
    ) {
      this.renderIfReadyAndVisible();
    }
  }

  /**
   * Load the image if not already loaded, and register the image change
   * listener if needed.
   * @param {import("../ImageBase").default} image Image.
   * @return {boolean} `true` if the image is already loaded, `false` otherwise.
   * @protected
   */
  protected loadImage(image: ImageBase): boolean {
    let imageState = image.getState();
    if (imageState != ImageState.LOADED && imageState != ImageState.ERROR) {
      image.addEventListener(EventType.CHANGE, this.boundHandleImageChange_);
    }
    if (imageState == ImageState.IDLE) {
      image.load();
      imageState = image.getState();
    }
    return imageState == ImageState.LOADED;
  }

  /**
   * @protected
   */
  protected renderIfReadyAndVisible(): void {
    const layer = this.getLayer();
    if (layer && layer.getVisible() && layer.getSourceState() === 'ready') {
      layer.changed();
    }
  }

  /**
   * Clean up.
   */
  protected disposeInternal(): void {
    delete this.layer_;
    super.disposeInternal();
  }
}

export default LayerRenderer;
