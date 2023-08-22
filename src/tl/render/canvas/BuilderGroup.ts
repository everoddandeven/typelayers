/**
 * @module tl/render/canvas/BuilderGroup
 */

import Builder from './Builder';
import ImageBuilder from './ImageBuilder';
import LineStringBuilder from './LineStringBuilder';
import PolygonBuilder from './PolygonBuilder';
import TextBuilder from './TextBuilder';
import {Extent} from "../../extent/Extent";
import {BuilderType} from '../canvas';

/**
 * @type {Object<import("../canvas").BuilderType, typeof Builder>}
 */
const BATCH_CONSTRUCTORS: {[key: string]: typeof Builder} = {
  'Circle': PolygonBuilder,
  'Default': Builder,
  'Image': ImageBuilder,
  'LineString': LineStringBuilder,
  'Polygon': PolygonBuilder,
  'Text': TextBuilder,
};

class BuilderGroup {
  /**
   * @param {number} tolerance Tolerance.
   * @param {import("../../extent").Extent} maxExtent Max extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   */

  private tolerance_: number;
  private maxExtent_: Extent;
  private pixelRatio_: number;
  private resolution_: number;
  private buildersByZIndex_: {[key: string]: {[key: string]: Builder}}

  constructor(tolerance: number, maxExtent: Extent, resolution: number, pixelRatio: number) {
    /**
     * @private
     * @type {number}
     */
    this.tolerance_ = tolerance;

    /**
     * @private
     * @type {import("../../extent").Extent}
     */
    this.maxExtent_ = maxExtent;

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
     * @type {!Object<string, !Object<import("../canvas").BuilderType, Builder>>}
     */
    this.buildersByZIndex_ = {};
  }

  /**
   * @return {!Object<string, !Object<import("../canvas").BuilderType, import("./Builder").SerializableInstructions>>} The serializable instructions
   */
  public finish(): {[key: string]: {[key: string]: SerializableInstructions}} {
    const builderInstructions = {};
    for (const zKey in this.buildersByZIndex_) {
      builderInstructions[zKey] = builderInstructions[zKey] || {};
      const builders = this.buildersByZIndex_[zKey];
      for (const builderKey in builders) {
        const builderInstruction = builders[builderKey].finish();
        builderInstructions[zKey][builderKey] = builderInstruction;
      }
    }
    return builderInstructions;
  }

  /**
   * @param {number|undefined} zIndex Z index.
   * @param {import("../canvas").BuilderType} builderType Replay type.
   * @return {import("../VectorContext").default} Replay.
   */
  public getBuilder(zIndex: number, builderType: BuilderType): Builder {
    const zIndexKey = zIndex !== undefined ? zIndex.toString() : '0';
    let replays = this.buildersByZIndex_[zIndexKey];
    if (replays === undefined) {
      replays = {};
      this.buildersByZIndex_[zIndexKey] = replays;
    }
    let replay = replays[builderType];
    if (replay === undefined) {
      const Constructor = BATCH_CONSTRUCTORS[builderType];
      replay = new Constructor(
        this.tolerance_,
        this.maxExtent_,
        this.resolution_,
        this.pixelRatio_
      );
      replays[builderType] = replay;
    }
    return replay;
  }
}

export default BuilderGroup;
