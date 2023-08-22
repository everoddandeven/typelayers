/**
 * @module tl/render/canvas/ExecutorGroup
 */

import Executor from './Executor';
import {ascending} from '../../array';
import {buffer, createEmpty, extendCoordinate, Extent} from '../../extent';
import {
  compose as composeTransform,
  create as createTransform, Transform,
} from '../../transform';
import {createCanvasContext2D} from '../../dom';
import {isEmpty} from '../../obj';
import {transform2D} from '../../geom/flat/transform';
import {SerializableInstructions} from "../canvas";
import {Coordinate} from "../../coordinate";
import {FeatureLike} from "../../Feature";
import SimpleGeometry from "../../geom/SimpleGeometry";
import RBush_ from "rbush";

/**
 * @const
 * @type {Array<import("../canvas").BuilderType>}
 */
const ORDER = ['Polygon', 'Circle', 'LineString', 'Image', 'Text', 'Default'];

class ExecutorGroup {
  private maxExtent_: Extent;
  private overlaps_: boolean;
  private pixelRatio_: number;
  private resolution_: number;
  private renderBuffer_: number;
  private hitDetectionContext_: CanvasRenderingContext2D;
  private hitDetectionTransform_: Transform;
  private executorsByZIndex_: {[key: string]: {[key: string]: Executor}};

  /**
   * @param {import("../../extent").Extent} maxExtent Max extent for clipping. When a
   * `maxExtent` was set on the Builder for this executor group, the same `maxExtent`
   * should be set here, unless the target context does not exceed that extent (which
   * can be the case when rendering to tiles).
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {boolean} overlaps The executor group can have overlapping geometries.
   * @param {!Object<string, !Object<import("../canvas").BuilderType, import("../canvas").SerializableInstructions>>} allInstructions
   * The serializable instructions.
   * @param {number} [renderBuffer] Optional rendering buffer.
   */
  constructor(
    maxExtent: Extent,
    resolution: number,
    pixelRatio: number,
    overlaps: boolean,
    allInstructions: {[key: string]: {[key: string]: SerializableInstructions}},
    renderBuffer?: number
  ) {
    /**
     * @private
     * @type {import("../../extent").Extent}
     */
    this.maxExtent_ = maxExtent;

    /**
     * @private
     * @type {boolean}
     */
    this.overlaps_ = overlaps;

    /**
     * @private
     * @type {number}
     */
    this.pixelRatio_ = pixelRatio;

    /**
     * @private
     * @type {number}
     */
    this.resolution_ = resolution;

    /**
     * @private
     * @type {number|undefined}
     */
    this.renderBuffer_ = renderBuffer;

    /**
     * @private
     * @type {!Object<string, !Object<import("../canvas").BuilderType, import("./Executor").default>>}
     */

    this.executorsByZIndex_ = {};

    /**
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.hitDetectionContext_ = null;

    /**
     * @private
     * @type {import("../../transform").Transform}
     */
    this.hitDetectionTransform_ = createTransform();

    this.createExecutors_(allInstructions);
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../transform").Transform} transform Transform.
   */
  public clip(context: CanvasRenderingContext2D, transform: Transform): void {
    const flatClipCoords = this.getClipCoords(transform);
    context.beginPath();
    context.moveTo(flatClipCoords[0], flatClipCoords[1]);
    context.lineTo(flatClipCoords[2], flatClipCoords[3]);
    context.lineTo(flatClipCoords[4], flatClipCoords[5]);
    context.lineTo(flatClipCoords[6], flatClipCoords[7]);
    context.clip();
  }

  /**
   * Create executors and populate them using the provided instructions.
   * @private
   * @param {!Object<string, !Object<import("../canvas").BuilderType, import("../canvas").SerializableInstructions>>} allInstructions The serializable instructions
   */
  private createExecutors_(allInstructions: {[key: string]: {[key: string]: SerializableInstructions}}) {
    for (const zIndex in allInstructions) {
      let executors = this.executorsByZIndex_[zIndex];
      if (executors === undefined) {
        executors = {};
        this.executorsByZIndex_[zIndex] = executors;
      }
      const instructionByZindex = allInstructions[zIndex];
      for (const builderType in instructionByZindex) {
        const instructions = instructionByZindex[builderType];
        executors[builderType] = new Executor(
          this.resolution_,
          this.pixelRatio_,
          this.overlaps_,
          instructions
        );
      }
    }
  }

  /**
   * @param {Array<import("../canvas").BuilderType>} executors Executors.
   * @return {boolean} Has executors of the provided types.
   */
  public hasExecutors(executors: string[]): boolean {
    for (const zIndex in this.executorsByZIndex_) {
      const candidates = this.executorsByZIndex_[zIndex];
      for (let i = 0, ii = executors.length; i < ii; ++i) {
        if (executors[i] in candidates) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @param {import("../../coordinate").Coordinate} coordinate Coordinate.
   * @param {number} resolution Resolution.
   * @param {number} rotation Rotation.
   * @param {number} hitTolerance Hit tolerance in pixels.
   * @param {function(import("../../Feature").FeatureLike, import("../../geom/SimpleGeometry").default, number): T} callback Feature callback.
   * @param {Array<import("../../Feature").FeatureLike>} declutteredFeatures Decluttered features.
   * @return {T|undefined} Callback result.
   * @template T
   */
  public forEachFeatureAtCoordinate<Type>(
    coordinate: Coordinate,
    resolution: number,
    rotation: number,
    hitTolerance: number,
    callback: (feature: FeatureLike, geometry: SimpleGeometry, distance: number) => Type,
    declutteredFeatures: FeatureLike[]
  ): Type | undefined {
    hitTolerance = Math.round(hitTolerance);
    const contextSize = hitTolerance * 2 + 1;
    const transform = composeTransform(
      this.hitDetectionTransform_,
      hitTolerance + 0.5,
      hitTolerance + 0.5,
      1 / resolution,
      -1 / resolution,
      -rotation,
      -coordinate[0],
      -coordinate[1]
    );

    const newContext = !this.hitDetectionContext_;
    if (newContext) {
      this.hitDetectionContext_ = <CanvasRenderingContext2D>createCanvasContext2D(
        contextSize,
        contextSize,
        undefined,
        {willReadFrequently: true}
      );
    }
    const context = this.hitDetectionContext_;

    if (
      context.canvas.width !== contextSize ||
      context.canvas.height !== contextSize
    ) {
      context.canvas.width = contextSize;
      context.canvas.height = contextSize;
    } else if (!newContext) {
      context.clearRect(0, 0, contextSize, contextSize);
    }

    /**
     * @type {import("../../extent").Extent}
     */
    let hitExtent;
    if (this.renderBuffer_ !== undefined) {
      hitExtent = createEmpty();
      extendCoordinate(hitExtent, coordinate);
      buffer(
        hitExtent,
        resolution * (this.renderBuffer_ + hitTolerance),
        hitExtent
      );
    }

    const indexes = getPixelIndexArray(hitTolerance);

    let builderType: string;

    /**
     * @param {import("../../Feature").FeatureLike} feature Feature.
     * @param {import("../../geom/SimpleGeometry").default} geometry Geometry.
     * @return {Type|undefined} Callback result.
     */
    function featureCallback(feature: FeatureLike, geometry: SimpleGeometry): Type | undefined {
      const imageData = context.getImageData(
        0,
        0,
        contextSize,
        contextSize
      ).data;
      for (let i = 0, ii = indexes.length; i < ii; i++) {
        if (imageData[indexes[i]] > 0) {
          if (
            !declutteredFeatures ||
            (builderType !== 'Image' && builderType !== 'Text') ||
            declutteredFeatures.includes(feature)
          ) {
            const idx = (indexes[i] - 3) / 4;
            const x = hitTolerance - (idx % contextSize);
            const y = hitTolerance - ((idx / contextSize) | 0);
            const result: Type = callback(feature, geometry, x * x + y * y);
            if (result) {
              return result;
            }
          }
          context.clearRect(0, 0, contextSize, contextSize);
          break;
        }
      }
      return undefined;
    }

    /** @type {Array<number>} */
    const zs = Object.keys(this.executorsByZIndex_).map(Number);
    zs.sort(ascending);

    let i, j, executors, executor, result;
    for (i = zs.length - 1; i >= 0; --i) {
      const zIndexKey = zs[i].toString();
      executors = this.executorsByZIndex_[zIndexKey];
      for (j = ORDER.length - 1; j >= 0; --j) {
        builderType = ORDER[j];
        executor = executors[builderType];
        if (executor !== undefined) {
          result = executor.executeHitDetection(
            context,
            transform,
            rotation,
            featureCallback,
            hitExtent
          );
          if (result) {
            return result;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * @param {import("../../transform").Transform} transform Transform.
   * @return {Array<number>|null} Clip coordinates.
   */
  public getClipCoords(transform: Transform): number[] | null {
    const maxExtent = this.maxExtent_;
    if (!maxExtent) {
      return null;
    }
    const minX = maxExtent[0];
    const minY = maxExtent[1];
    const maxX = maxExtent[2];
    const maxY = maxExtent[3];
    const flatClipCoords = [minX, minY, minX, maxY, maxX, maxY, maxX, minY];
    transform2D(flatClipCoords, 0, 8, 2, transform, flatClipCoords);
    return flatClipCoords;
  }

  /**
   * @return {boolean} Is empty.
   */
  public isEmpty(): boolean {
    return isEmpty(this.executorsByZIndex_);
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} contextScale Scale of the context.
   * @param {import("../../transform").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {boolean} snapToPixel Snap point symbols and test to integer pixel.
   * @param {Array<import("../canvas").BuilderType>} [builderTypes] Ordered replay types to replay.
   *     Default is {@link module:tl/render/replay~ORDER}
   * @param {import("rbush").default} [declutterTree] Declutter tree.
   */
  public execute(
    context: CanvasRenderingContext2D,
    contextScale: number,
    transform: Transform,
    viewRotation: number,
    snapToPixel: boolean,
    builderTypes?: string[],
    declutterTree?: RBush_<any>
  ): void {
    /** @type {Array<number>} */
    const zs = Object.keys(this.executorsByZIndex_).map(Number);
    zs.sort(ascending);

    // setup clipping so that the parts of over-simplified geometries are not
    // visible outside the current extent when panning
    if (this.maxExtent_) {
      context.save();
      this.clip(context, transform);
    }

    builderTypes = builderTypes ? builderTypes : ORDER;
    let i, ii, j, jj, replays, replay;
    if (declutterTree) {
      zs.reverse();
    }
    for (i = 0, ii = zs.length; i < ii; ++i) {
      const zIndexKey = zs[i].toString();
      replays = this.executorsByZIndex_[zIndexKey];
      for (j = 0, jj = builderTypes.length; j < jj; ++j) {
        const builderType = builderTypes[j];
        replay = replays[builderType];
        if (replay !== undefined) {
          replay.execute(
            context,
            contextScale,
            transform,
            viewRotation,
            snapToPixel,
            declutterTree
          );
        }
      }
    }

    if (this.maxExtent_) {
      context.restore();
    }
  }
}

/**
 * This cache is used to store arrays of indexes for calculated pixel circles
 * to increase performance.
 * It is a static property to allow each Replaygroup to access it.
 * @type {Object<number, Array<number>>}
 */
const circlePixelIndexArrayCache: {[key: number]: number[]} = {};

/**
 * This methods creates an array with indexes of all pixels within a circle,
 * ordered by how close they are to the center.
 * A cache is used to increase performance.
 * @param {number} radius Radius.
 * @return {Array<number>} An array with indexes within a circle.
 */
export function getPixelIndexArray(radius: number): number[] {
  if (circlePixelIndexArrayCache[radius] !== undefined) {
    return circlePixelIndexArrayCache[radius];
  }

  const size = radius * 2 + 1;
  const maxDistanceSq = radius * radius;
  const distances = new Array(maxDistanceSq + 1);
  for (let i = 0; i <= radius; ++i) {
    for (let j = 0; j <= radius; ++j) {
      const distanceSq = i * i + j * j;
      if (distanceSq > maxDistanceSq) {
        break;
      }
      let distance = distances[distanceSq];
      if (!distance) {
        distance = [];
        distances[distanceSq] = distance;
      }
      distance.push(((radius + i) * size + (radius + j)) * 4 + 3);
      if (i > 0) {
        distance.push(((radius - i) * size + (radius + j)) * 4 + 3);
      }
      if (j > 0) {
        distance.push(((radius + i) * size + (radius - j)) * 4 + 3);
        if (i > 0) {
          distance.push(((radius - i) * size + (radius - j)) * 4 + 3);
        }
      }
    }
  }

  const pixelIndex = [];
  for (let i = 0, ii = distances.length; i < ii; ++i) {
    if (distances[i]) {
      pixelIndex.push(...distances[i]);
    }
  }

  circlePixelIndexArrayCache[radius] = pixelIndex;
  return pixelIndex;
}

export default ExecutorGroup;
