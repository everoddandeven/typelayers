/**
 * @module tl/renderer/Map
 */
import Disposable from '../Disposable';
import Map, {FrameState} from '../Map';
import {TRUE} from '../functions';
import {compose as composeTransform, makeInverse} from '../transform';
import {getWidth} from '../extent';
import {shared as iconImageCache} from '../style/IconImageCache';
import Layer, {inView} from '../layer/Layer';
import {Coordinate, wrapX} from '../coordinate';
import {FeatureLike} from "../Feature";
import {SimpleGeometry} from "../geom";
import Geometry from "../geom/Geometry";
import {FeatureCallback} from "./vector";
import RenderEventType from "../render/EventType";

export interface HitMatch<T> {
  feature: FeatureLike;
  layer: Layer;
  geometry: SimpleGeometry;
  distanceSq: number;
  callback: FeatureCallback<T>;
}

/**
 * @abstract
 */
abstract class MapRenderer extends Disposable {
  /**
   * @param {import("../Map").default} map Map.
   */

  private map_: Map;

  protected constructor(map: Map) {
    super();

    /**
     * @private
     * @type {import("../Map").default}
     */
    this.map_ = map;
  }

  /**
   * @abstract
   * @param {import("../render/EventType").default} type Event type.
   * @param {import("../Map").FrameState} frameState Frame state.
   */
  public abstract dispatchRenderEvent(type: RenderEventType, frameState: FrameState): void;

  /**
   * @param {import("../Map").FrameState} frameState FrameState.
   * @protected
   */
  protected calculateMatrices2D(frameState: FrameState): void {
    const viewState = frameState.viewState;
    const coordinateToPixelTransform = frameState.coordinateToPixelTransform;
    const pixelToCoordinateTransform = frameState.pixelToCoordinateTransform;

    composeTransform(
      coordinateToPixelTransform,
      frameState.size[0] / 2,
      frameState.size[1] / 2,
      1 / viewState.resolution,
      -1 / viewState.resolution,
      -viewState.rotation,
      -viewState.center[0],
      -viewState.center[1]
    );

    makeInverse(pixelToCoordinateTransform, coordinateToPixelTransform);
  }

  /**
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {import("../Map").FrameState} frameState FrameState.
   * @param {number} hitTolerance Hit tolerance in pixels.
   * @param {boolean} checkWrapped Check for wrapped geometries.
   * @param {import("./vector").FeatureCallback<T>} callback Feature callback.
   * @param {S} thisArg Value to use as `this` when executing `callback`.
   * @param {function(this: U, import("../layer/Layer").default): boolean} layerFilter Layer filter
   *     function, only layers which are visible and for which this function
   *     returns `true` will be tested for features.  By default, all visible
   *     layers will be tested.
   * @param {U} thisArg2 Value to use as `this` when executing `layerFilter`.
   * @return {T|undefined} Callback result.
   * @template S,T,U
   */
  public forEachFeatureAtCoordinate<S, T, U>(
    coordinate: Coordinate,
    frameState: FrameState,
    hitTolerance: number,
    checkWrapped: boolean,
    callback: FeatureCallback<T>,
    thisArg: S,
    layerFilter: (thisArg: U, layer: Layer) => boolean,
    thisArg2: U
  ): T | undefined {
    let result: T;
    const viewState = frameState.viewState;

    /**
     * @param {boolean} managed Managed layer.
     * @param {import("../Feature").FeatureLike} feature Feature.
     * @param {import("../layer/Layer").default} layer Layer.
     * @param {import("../geom/Geometry").default} geometry Geometry.
     * @return {T|undefined} Callback result.
     */
    function forEachFeatureAtCoordinate(managed: boolean, feature: FeatureLike, layer: Layer, geometry: Geometry): any {
      return callback.call(thisArg, feature, managed ? layer : null, geometry);
    }

    const projection = viewState.projection;

    const translatedCoordinate = wrapX(<Coordinate>coordinate.slice(), projection);
    const offsets = [[0, 0]];
    if (projection.canWrapX() && checkWrapped) {
      const projectionExtent = projection.getExtent();
      const worldWidth = getWidth(projectionExtent);
      offsets.push([-worldWidth, 0], [worldWidth, 0]);
    }

    const layerStates = frameState.layerStatesArray;
    const numLayers = layerStates.length;

    const matches = /** @type {Array<HitMatch<T>>} */ ([]);
    const tmpCoord: Coordinate = [NaN, NaN];
    for (let i = 0; i < offsets.length; i++) {
      for (let j = numLayers - 1; j >= 0; --j) {
        const layerState = layerStates[j];
        const layer = layerState.layer;
        if (
          layer.hasRenderer() &&
          inView(layerState, viewState) &&
          layerFilter.call(thisArg2, layer)
        ) {
          const layerRenderer = layer.getRenderer();
          const source = layer.getSource();
          if (layerRenderer && source) {
            const coordinates = source.getWrapX()
              ? translatedCoordinate
              : coordinate;
            const callback = forEachFeatureAtCoordinate.bind(
              null,
              layerState.managed
            );
            tmpCoord[0] = coordinates[0] + offsets[i][0];
            tmpCoord[1] = coordinates[1] + offsets[i][1];
            result = layerRenderer.forEachFeatureAtCoordinate(
              tmpCoord,
              frameState,
              hitTolerance,
              callback,
              matches
            );
          }
          if (result) {
            return result;
          }
        }
      }
    }
    if (matches.length === 0) {
      return undefined;
    }
    const order = 1 / matches.length;
    matches.forEach((m, i) => (m.distanceSq += i * order));
    matches.sort((a, b) => a.distanceSq - b.distanceSq);
    matches.some((m) => {
      return (result = m.callback(m.feature, m.layer, m.geometry));
    });
    return result;
  }

  /**
   * @param {import("../coordinate").Coordinate} coordinate Coordinate.
   * @param {import("../Map").FrameState} frameState FrameState.
   * @param {number} hitTolerance Hit tolerance in pixels.
   * @param {boolean} checkWrapped Check for wrapped geometries.
   * @param {function(this: U, import("../layer/Layer").default): boolean} layerFilter Layer filter
   *     function, only layers which are visible and for which this function
   *     returns `true` will be tested for features.  By default, all visible
   *     layers will be tested.
   * @param {U} thisArg Value to use as `this` when executing `layerFilter`.
   * @return {boolean} Is there a feature at the given coordinate?
   * @template U
   */
  public hasFeatureAtCoordinate<U>(
    coordinate: Coordinate,
    frameState: FrameState,
    hitTolerance: number,
    checkWrapped: boolean,
    layerFilter: (thisArg: U, layer: Layer) => boolean,
    thisArg: U
  ): boolean {
    const hasFeature = this.forEachFeatureAtCoordinate(
      coordinate,
      frameState,
      hitTolerance,
      checkWrapped,
      TRUE,
      thisArg,
      layerFilter,
      thisArg
    );

    return hasFeature !== undefined;
  }

  /**
   * @return {import("../Map").default} Map.
   */
  public getMap(): Map {
    return this.map_;
  }

  /**
   * Render.
   * @abstract
   * @param {?import("../Map").FrameState} frameState Frame state.
   */
  public abstract renderFrame(frameState: FrameState): void;

  /**
   * @param {import("../Map").FrameState} frameState Frame state.
   * @protected
   */
  protected scheduleExpireIconCache(frameState: FrameState): void {
    if (iconImageCache.canExpireCache()) {
      frameState.postRenderFunctions.push(expireIconCache);
    }
  }
}

/**
 * @param {import("../Map").default} map Map.
 * @param {import("../Map").FrameState} frameState Frame state.
 */
function expireIconCache(map: Map, frameState: FrameState): void {
  iconImageCache.expire();
}

export default MapRenderer;
