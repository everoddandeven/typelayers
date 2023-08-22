/**
 * @module tl/render/canvas/PolygonBuilder
 */
import CanvasBuilder from './Builder';
import CanvasInstruction, {
  beginPathInstruction,
  closePathInstruction,
  fillInstruction,
  strokeInstruction,
} from './Instruction';
import {
  defaultFillStyle,
  defaultLineDash,
  defaultLineDashOffset, SerializableInstructions,
} from '../canvas';
import {snap} from '../../geom/flat/simplify';
import {Extent} from "../../extent/Extent";
import Circle from "../../geom/Circle";
import Feature, {FeatureLike} from "../../Feature";
import {FlatCoordinates} from "../../coordinate";
import MultiPolygon from "../../geom/MultiPolygon";
import Polygon from "../../geom/Polygon";

class CanvasPolygonBuilder extends CanvasBuilder {
  /**
   * @param {number} tolerance Tolerance.
   * @param {import("../../extent").Extent} maxExtent Maximum extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   */
  constructor(tolerance: number, maxExtent: Extent, resolution: number, pixelRatio: number) {
    super(tolerance, maxExtent, resolution, pixelRatio);
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {Array<number>} ends Ends.
   * @param {number} stride Stride.
   * @private
   * @return {number} End.
   */
  private drawFlatCoordinatess_(flatCoordinates: FlatCoordinates, offset: number, ends: FlatCoordinates, stride: number): number {
    const state = this.state;
    const fill = state.fillStyle !== undefined;
    const stroke = state.strokeStyle !== undefined;
    const numEnds = ends.length;
    this.instructions.push(beginPathInstruction);
    this.hitDetectionInstructions.push(beginPathInstruction);
    for (let i = 0; i < numEnds; ++i) {
      const end = ends[i];
      const myBegin = this.coordinates.length;
      const myEnd = this.appendFlatLineCoordinates(
        flatCoordinates,
        offset,
        end,
        stride,
        true,
        !stroke
      );
      const moveToLineToInstruction = [
        CanvasInstruction.MOVE_TO_LINE_TO,
        myBegin,
        myEnd,
      ];
      this.instructions.push(moveToLineToInstruction);
      this.hitDetectionInstructions.push(moveToLineToInstruction);
      if (stroke) {
        // Performance optimization: only call closePath() when we have a stroke.
        // Otherwise, the ring is closed already (see appendFlatLineCoordinates above).
        this.instructions.push(closePathInstruction);
        this.hitDetectionInstructions.push(closePathInstruction);
      }
      offset = end;
    }
    if (fill) {
      this.instructions.push(fillInstruction);
      this.hitDetectionInstructions.push(fillInstruction);
    }
    if (stroke) {
      this.instructions.push(strokeInstruction);
      this.hitDetectionInstructions.push(strokeInstruction);
    }
    return offset;
  }

  /**
   * @param {import("../../geom/Circle").default} circleGeometry Circle geometry.
   * @param {import("../../Feature").default} feature Feature.
   */
  public drawCircle(circleGeometry: Circle, feature: Feature): void {
    const state = this.state;
    const fillStyle = state.fillStyle;
    const strokeStyle = state.strokeStyle;
    if (fillStyle === undefined && strokeStyle === undefined) {
      return;
    }
    this.setFillStrokeStyles_();
    this.beginGeometry(circleGeometry, feature);
    if (state.fillStyle !== undefined) {
      this.hitDetectionInstructions.push([
        CanvasInstruction.SET_FILL_STYLE,
        defaultFillStyle,
      ]);
    }
    if (state.strokeStyle !== undefined) {
      this.hitDetectionInstructions.push([
        CanvasInstruction.SET_STROKE_STYLE,
        state.strokeStyle,
        state.lineWidth,
        state.lineCap,
        state.lineJoin,
        state.miterLimit,
        defaultLineDash,
        defaultLineDashOffset,
      ]);
    }
    const flatCoordinates = circleGeometry.getFlatCoordinates();
    const stride = circleGeometry.getStride();
    const myBegin = this.coordinates.length;
    this.appendFlatLineCoordinates(
      flatCoordinates,
      0,
      flatCoordinates.length,
      stride,
      false,
      false
    );
    const circleInstruction = [CanvasInstruction.CIRCLE, myBegin];
    this.instructions.push(beginPathInstruction, circleInstruction);
    this.hitDetectionInstructions.push(beginPathInstruction, circleInstruction);
    if (state.fillStyle !== undefined) {
      this.instructions.push(fillInstruction);
      this.hitDetectionInstructions.push(fillInstruction);
    }
    if (state.strokeStyle !== undefined) {
      this.instructions.push(strokeInstruction);
      this.hitDetectionInstructions.push(strokeInstruction);
    }
    this.endGeometry(feature);
  }

  /**
   * @param {import("../../geom/Polygon").default|import("../Feature").default} polygonGeometry Polygon geometry.
   * @param {import("../../Feature").FeatureLike} feature Feature.
   */
  public drawPolygon(polygonGeometry: Polygon, feature: FeatureLike): void {
    const state = this.state;
    const fillStyle = state.fillStyle;
    const strokeStyle = state.strokeStyle;
    if (fillStyle === undefined && strokeStyle === undefined) {
      return;
    }
    this.setFillStrokeStyles_();
    this.beginGeometry(polygonGeometry, feature);
    if (state.fillStyle !== undefined) {
      this.hitDetectionInstructions.push([
        CanvasInstruction.SET_FILL_STYLE,
        defaultFillStyle,
      ]);
    }
    if (state.strokeStyle !== undefined) {
      this.hitDetectionInstructions.push([
        CanvasInstruction.SET_STROKE_STYLE,
        state.strokeStyle,
        state.lineWidth,
        state.lineCap,
        state.lineJoin,
        state.miterLimit,
        defaultLineDash,
        defaultLineDashOffset,
      ]);
    }
    const ends = polygonGeometry.getEnds();
    const flatCoordinates = polygonGeometry.getOrientedFlatCoordinates();
    const stride = polygonGeometry.getStride();
    this.drawFlatCoordinatess_(
      flatCoordinates,
      0,
      /** @type {Array<number>} */ (ends),
      stride
    );
    this.endGeometry(feature);
  }

  /**
   * @param {import("../../geom/MultiPolygon").default} multiPolygonGeometry MultiPolygon geometry.
   * @param {import("../../Feature").FeatureLike} feature Feature.
   */
  public drawMultiPolygon(multiPolygonGeometry: MultiPolygon, feature: FeatureLike): void {
    const state = this.state;
    const fillStyle = state.fillStyle;
    const strokeStyle = state.strokeStyle;
    if (fillStyle === undefined && strokeStyle === undefined) {
      return;
    }
    this.setFillStrokeStyles_();
    this.beginGeometry(multiPolygonGeometry, feature);
    if (state.fillStyle !== undefined) {
      this.hitDetectionInstructions.push([
        CanvasInstruction.SET_FILL_STYLE,
        defaultFillStyle,
      ]);
    }
    if (state.strokeStyle !== undefined) {
      this.hitDetectionInstructions.push([
        CanvasInstruction.SET_STROKE_STYLE,
        state.strokeStyle,
        state.lineWidth,
        state.lineCap,
        state.lineJoin,
        state.miterLimit,
        defaultLineDash,
        defaultLineDashOffset,
      ]);
    }
    const endss = multiPolygonGeometry.getEndss();
    const flatCoordinates = multiPolygonGeometry.getOrientedFlatCoordinates();
    const stride = multiPolygonGeometry.getStride();
    let offset = 0;
    for (let i = 0, ii = endss.length; i < ii; ++i) {
      offset = this.drawFlatCoordinatess_(
        flatCoordinates,
        offset,
        endss[i],
        stride
      );
    }
    this.endGeometry(feature);
  }

  /**
   * @return {import("../canvas").SerializableInstructions} the serializable instructions.
   */
  public finish(): SerializableInstructions {
    this.reverseHitDetectionInstructions();
    this.state = null;
    // We want to preserve topology when drawing polygons.  Polygons are
    // simplified using quantization and point elimination. However, we might
    // have received a mix of quantized and non-quantized geometries, so ensure
    // that all are quantized by quantizing all coordinates in the batch.
    const tolerance = this.tolerance;
    if (tolerance !== 0) {
      const coordinates = this.coordinates;
      for (let i = 0, ii = coordinates.length; i < ii; ++i) {
        coordinates[i] = snap(coordinates[i], tolerance);
      }
    }
    return super.finish();
  }

  /**
   * @private
   */
  private setFillStrokeStyles_(): void {
    const state = this.state;
    const fillStyle = state.fillStyle;
    if (fillStyle !== undefined) {
      this.updateFillStyle(state, this.createFill);
    }
    if (state.strokeStyle !== undefined) {
      this.updateStrokeStyle(state, this.applyStroke);
    }
  }
}

export default CanvasPolygonBuilder;
