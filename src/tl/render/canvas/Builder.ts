/**
 * @module tl/render/canvas/Builder
 */
import CanvasInstruction from './Instruction';
import Relationship from '../../extent/Relationship';
import VectorContext from '../VectorContext';
import {asColorLike} from '../../colorlike';
import {
  buffer,
  clone,
  containsCoordinate,
  coordinateRelationship, Extent,
} from '../../extent';
import {
  defaultFillStyle,
  defaultLineCap,
  defaultLineDash,
  defaultLineDashOffset,
  defaultLineJoin,
  defaultLineWidth,
  defaultMiterLimit,
  defaultStrokeStyle, FillStrokeState, SerializableInstructions,
} from '../canvas';
import {equals, reverseSubArray} from '../../array';
import {
  inflateCoordinates,
  inflateCoordinatesArray,
  inflateMultiCoordinatesArray,
} from '../../geom/flat/inflate';
import {Coordinate, FlatCoordinates} from "../../coordinate";
import SimpleGeometry from "../../geom/SimpleGeometry";
import {FeatureLike} from "../../Feature";
import {Geometry, MultiLineString, MultiPolygon, Polygon} from "../../geom";
import RenderFeature from "../Feature";
import {Fill} from "../../style";
import Stroke from "../../style/Stroke";

class CanvasBuilder extends VectorContext {
  /**
   * @param {number} tolerance Tolerance.
   * @param {import("../../extent").Extent} maxExtent Maximum extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   */

  /**
   * @private
   * @type {Array<*>}
   */
  private beginGeometryInstruction1_?: any[];

  /**
   * @private
   * @type {Array<*>}
   */
  private beginGeometryInstruction2_?: any[];

  /**
   * @private
   * @type {import("../../extent").Extent}
   */
  private bufferedMaxExtent_?: Extent;
  private tmpCoordinate_: Coordinate;

  protected tolerance: number;
  protected maxExtent: Extent;
  protected pixelRatio: number;
  protected maxLineWidth: number;
  protected resolution: number;
  protected instructions: any[];
  protected coordinates: number[];
  protected hitDetectionInstructions: any[];
  protected state: FillStrokeState;

  constructor(tolerance: number, maxExtent: Extent, resolution: number, pixelRatio: number) {
    super();

    /**
     * @protected
     * @type {number}
     */
    this.tolerance = tolerance;

    /**
     * @protected
     * @const
     * @type {import("../../extent").Extent}
     */
    this.maxExtent = maxExtent;

    /**
     * @protected
     * @type {number}
     */
    this.pixelRatio = pixelRatio;

    /**
     * @protected
     * @type {number}
     */
    this.maxLineWidth = 0;

    /**
     * @protected
     * @const
     * @type {number}
     */
    this.resolution = resolution;

    /**
     * @private
     * @type {Array<*>}
     */
    this.beginGeometryInstruction1_ = null;

    /**
     * @private
     * @type {Array<*>}
     */
    this.beginGeometryInstruction2_ = null;

    /**
     * @private
     * @type {import("../../extent").Extent}
     */
    this.bufferedMaxExtent_ = null;

    /**
     * @protected
     * @type {Array<*>}
     */
    this.instructions = [];

    /**
     * @protected
     * @type {Array<number>}
     */
    this.coordinates = [];

    /**
     * @private
     * @type {import("../../coordinate").Coordinate}
     */
    this.tmpCoordinate_ = [0, 0];

    /**
     * @protected
     * @type {Array<*>}
     */
    this.hitDetectionInstructions = [];

    /**
     * @protected
     * @type {import("../canvas").FillStrokeState}
     */
    this.state = /** @type {import("../canvas").FillStrokeState} */ (<FillStrokeState>{});
  }

  /**
   * @protected
   * @param {Array<number>} dashArray Dash array.
   * @return {Array<number>} Dash array with pixel ratio applied
   */
  protected applyPixelRatio(dashArray: number[]): number[] {
    const pixelRatio = this.pixelRatio;
    return pixelRatio == 1
      ? dashArray
      : dashArray.map(function (dash) {
          return dash * pixelRatio;
        });
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} stride Stride.
   * @protected
   * @return {number} My end
   */
  protected appendFlatPointCoordinates(flatCoordinates: FlatCoordinates, stride: number): number {
    const extent = this.getBufferedMaxExtent();
    const tmpCoord = this.tmpCoordinate_;
    const coordinates = this.coordinates;
    let myEnd = coordinates.length;
    for (let i = 0, ii = flatCoordinates.length; i < ii; i += stride) {
      tmpCoord[0] = flatCoordinates[i];
      tmpCoord[1] = flatCoordinates[i + 1];
      if (containsCoordinate(extent, tmpCoord)) {
        coordinates[myEnd++] = tmpCoord[0];
        coordinates[myEnd++] = tmpCoord[1];
      }
    }
    return myEnd;
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {number} end End.
   * @param {number} stride Stride.
   * @param {boolean} closed Last input coordinate equals first.
   * @param {boolean} skipFirst Skip first coordinate.
   * @protected
   * @return {number} My end.
   */
  protected appendFlatLineCoordinates(
    flatCoordinates: FlatCoordinates,
    offset: number,
    end: number,
    stride: number,
    closed: boolean,
    skipFirst: boolean
  ): number {
    const coordinates = this.coordinates;
    let myEnd = coordinates.length;
    const extent = this.getBufferedMaxExtent();
    if (skipFirst) {
      offset += stride;
    }
    let lastXCoord = flatCoordinates[offset];
    let lastYCoord = flatCoordinates[offset + 1];
    const nextCoord = this.tmpCoordinate_;
    let skipped = true;

    let i: number, lastRel: number = null, nextRel: number;
    for (i = offset + stride; i < end; i += stride) {
      nextCoord[0] = flatCoordinates[i];
      nextCoord[1] = flatCoordinates[i + 1];
      nextRel = coordinateRelationship(extent, nextCoord);
      if (nextRel !== lastRel) {
        if (skipped) {
          coordinates[myEnd++] = lastXCoord;
          coordinates[myEnd++] = lastYCoord;
          skipped = false;
        }
        coordinates[myEnd++] = nextCoord[0];
        coordinates[myEnd++] = nextCoord[1];
      } else if (nextRel === Relationship.INTERSECTING) {
        coordinates[myEnd++] = nextCoord[0];
        coordinates[myEnd++] = nextCoord[1];
        skipped = false;
      } else {
        skipped = true;
      }
      lastXCoord = nextCoord[0];
      lastYCoord = nextCoord[1];
      lastRel = nextRel;
    }

    // Last coordinate equals first or only one point to append:
    if ((closed && skipped) || i === offset + stride) {
      coordinates[myEnd++] = lastXCoord;
      coordinates[myEnd++] = lastYCoord;
    }
    return myEnd;
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {Array<number>} ends Ends.
   * @param {number} stride Stride.
   * @param {Array<number>} builderEnds Builder ends.
   * @return {number} Offset.
   */
  private drawCustomCoordinates_(flatCoordinates: FlatCoordinates, offset: number, ends: FlatCoordinates, stride: number, builderEnds: FlatCoordinates): number {
    for (let i = 0, ii = ends.length; i < ii; ++i) {
      const end = ends[i];
      const builderEnd = this.appendFlatLineCoordinates(
        flatCoordinates,
        offset,
        end,
        stride,
        false,
        false
      );
      builderEnds.push(builderEnd);
      offset = end;
    }
    return offset;
  }

  /**
   * @param {import("../../geom/SimpleGeometry").default} geometry Geometry.
   * @param {import("../../Feature").FeatureLike} feature Feature.
   * @param {Function} renderer Renderer.
   * @param {Function} hitDetectionRenderer Renderer.
   */
  public drawCustom(geometry: SimpleGeometry, feature: FeatureLike, renderer: Function, hitDetectionRenderer: Function): void {
    this.beginGeometry(geometry, feature);

    const type = geometry.getType();
    const stride = geometry.getStride();
    const builderBegin = this.coordinates.length;

    let flatCoordinates: FlatCoordinates, builderEnd: number, builderEnds: FlatCoordinates, builderEndss: FlatCoordinates[];
    let offset: number;

    switch (type) {
      case 'MultiPolygon':
        flatCoordinates = (<MultiPolygon>geometry).getOrientedFlatCoordinates();
        builderEndss = [];
        const endss = (<MultiPolygon>geometry).getEndss();
        offset = 0;
        for (let i = 0, ii = endss.length; i < ii; ++i) {
          const myEnds = [];
          offset = this.drawCustomCoordinates_(
            flatCoordinates,
            offset,
            endss[i],
            stride,
            myEnds
          );
          builderEndss.push(myEnds);
        }
        this.instructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEndss,
          geometry,
          renderer,
          inflateMultiCoordinatesArray,
        ]);
        this.hitDetectionInstructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEndss,
          geometry,
          hitDetectionRenderer || renderer,
          inflateMultiCoordinatesArray,
        ]);
        break;
      case 'Polygon':
      case 'MultiLineString':
        builderEnds = [];
        flatCoordinates =
          type == 'Polygon'
            ? /** @type {import("../../geom/Polygon").default} */ (
                <Polygon>geometry
              ).getOrientedFlatCoordinates()
            : geometry.getFlatCoordinates();
        offset = this.drawCustomCoordinates_(
          flatCoordinates,
          0,
          /** @type {import("../../geom/Polygon").default|import("../../geom/MultiLineString").default} */ (
            <MultiLineString>geometry
          ).getEnds(),
          stride,
          builderEnds
        );
        this.instructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEnds,
          geometry,
          renderer,
          inflateCoordinatesArray,
        ]);
        this.hitDetectionInstructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEnds,
          geometry,
          hitDetectionRenderer || renderer,
          inflateCoordinatesArray,
        ]);
        break;
      case 'LineString':
      case 'Circle':
        flatCoordinates = geometry.getFlatCoordinates();
        builderEnd = this.appendFlatLineCoordinates(
          flatCoordinates,
          0,
          flatCoordinates.length,
          stride,
          false,
          false
        );
        this.instructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEnd,
          geometry,
          renderer,
          inflateCoordinates,
        ]);
        this.hitDetectionInstructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEnd,
          geometry,
          hitDetectionRenderer || renderer,
          inflateCoordinates,
        ]);
        break;
      case 'MultiPoint':
        flatCoordinates = geometry.getFlatCoordinates();
        builderEnd = this.appendFlatPointCoordinates(flatCoordinates, stride);

        if (builderEnd > builderBegin) {
          this.instructions.push([
            CanvasInstruction.CUSTOM,
            builderBegin,
            builderEnd,
            geometry,
            renderer,
            inflateCoordinates,
          ]);
          this.hitDetectionInstructions.push([
            CanvasInstruction.CUSTOM,
            builderBegin,
            builderEnd,
            geometry,
            hitDetectionRenderer || renderer,
            inflateCoordinates,
          ]);
        }
        break;
      case 'Point':
        flatCoordinates = geometry.getFlatCoordinates();
        this.coordinates.push(flatCoordinates[0], flatCoordinates[1]);
        builderEnd = this.coordinates.length;

        this.instructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEnd,
          geometry,
          renderer,
        ]);
        this.hitDetectionInstructions.push([
          CanvasInstruction.CUSTOM,
          builderBegin,
          builderEnd,
          geometry,
          hitDetectionRenderer || renderer,
        ]);
        break;
      default:
    }
    this.endGeometry(feature);
  }

  /**
   * @protected
   * @param {import("../../geom/Geometry").default|import("../Feature").default} geometry The geometry.
   * @param {import("../../Feature").FeatureLike} feature Feature.
   */
  protected beginGeometry(geometry: Geometry | RenderFeature, feature: FeatureLike): void {
    this.beginGeometryInstruction1_ = [
      CanvasInstruction.BEGIN_GEOMETRY,
      feature,
      0,
      geometry,
    ];
    this.instructions.push(this.beginGeometryInstruction1_);
    this.beginGeometryInstruction2_ = [
      CanvasInstruction.BEGIN_GEOMETRY,
      feature,
      0,
      geometry,
    ];
    this.hitDetectionInstructions.push(this.beginGeometryInstruction2_);
  }

  /**
   * @return {import("../canvas").SerializableInstructions} the serializable instructions.
   */
  public finish(): SerializableInstructions {
    return {
      instructions: this.instructions,
      hitDetectionInstructions: this.hitDetectionInstructions,
      coordinates: this.coordinates,
    };
  }

  /**
   * Reverse the hit detection instructions.
   */
  public reverseHitDetectionInstructions(): void {
    const hitDetectionInstructions = this.hitDetectionInstructions;
    // step 1 - reverse array
    hitDetectionInstructions.reverse();
    // step 2 - reverse instructions within geometry blocks
    let i: number;
    const n = hitDetectionInstructions.length;
    let instruction: number[];
    let type: CanvasInstruction;
    let begin = -1;
    for (i = 0; i < n; ++i) {
      instruction = hitDetectionInstructions[i];
      type = /** @type {import("./Instruction").default} */ (<CanvasInstruction>instruction[0]);
      if (type == CanvasInstruction.END_GEOMETRY) {
        begin = i;
      } else if (type == CanvasInstruction.BEGIN_GEOMETRY) {
        instruction[2] = i;
        reverseSubArray(this.hitDetectionInstructions, begin, i);
        begin = -1;
      }
    }
  }

  /**
   * @param {import("../../style/Fill").default} fillStyle Fill style.
   * @param {import("../../style/Stroke").default} strokeStyle Stroke style.
   */
  public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke): void {
    const state = this.state;
    if (fillStyle) {
      const fillStyleColor = fillStyle.getColor();
      state.fillStyle = asColorLike(
        fillStyleColor ? fillStyleColor : defaultFillStyle
      );
    } else {
      state.fillStyle = undefined;
    }
    if (strokeStyle) {
      const strokeStyleColor = strokeStyle.getColor();
      state.strokeStyle = asColorLike(
        strokeStyleColor ? strokeStyleColor : defaultStrokeStyle
      );
      const strokeStyleLineCap = strokeStyle.getLineCap();
      state.lineCap =
        strokeStyleLineCap !== undefined ? strokeStyleLineCap : defaultLineCap;
      const strokeStyleLineDash = strokeStyle.getLineDash();
      state.lineDash = strokeStyleLineDash
        ? strokeStyleLineDash.slice()
        : defaultLineDash;
      const strokeStyleLineDashOffset = strokeStyle.getLineDashOffset();
      state.lineDashOffset = strokeStyleLineDashOffset
        ? strokeStyleLineDashOffset
        : defaultLineDashOffset;
      const strokeStyleLineJoin = strokeStyle.getLineJoin();
      state.lineJoin =
        strokeStyleLineJoin !== undefined
          ? strokeStyleLineJoin
          : defaultLineJoin;
      const strokeStyleWidth = strokeStyle.getWidth();
      state.lineWidth =
        strokeStyleWidth !== undefined ? strokeStyleWidth : defaultLineWidth;
      const strokeStyleMiterLimit = strokeStyle.getMiterLimit();
      state.miterLimit =
        strokeStyleMiterLimit !== undefined
          ? strokeStyleMiterLimit
          : defaultMiterLimit;

      if (state.lineWidth > this.maxLineWidth) {
        this.maxLineWidth = state.lineWidth;
        // invalidate the buffered max extent cache
        this.bufferedMaxExtent_ = null;
      }
    } else {
      state.strokeStyle = undefined;
      state.lineCap = undefined;
      state.lineDash = null;
      state.lineDashOffset = undefined;
      state.lineJoin = undefined;
      state.lineWidth = undefined;
      state.miterLimit = undefined;
    }
  }

  /**
   * @param {import("../canvas").FillStrokeState} state SourceState.
   * @return {Array<*>} Fill instruction.
   */
  public createFill(state: FillStrokeState): any[] {
    const fillStyle = state.fillStyle;
    /** @type {Array<*>} */
    const fillInstruction: any[] = [CanvasInstruction.SET_FILL_STYLE, fillStyle];
    if (typeof fillStyle !== 'string') {
      // Fill is a pattern or gradient - align it!
      fillInstruction.push(true);
    }
    return fillInstruction;
  }

  /**
   * @param {import("../canvas").FillStrokeState} state SourceState.
   */
  public applyStroke(state: FillStrokeState): void {
    this.instructions.push(this.createStroke(state));
  }

  /**
   * @param {import("../canvas").FillStrokeState} state SourceState.
   * @return {Array<*>} Stroke instruction.
   */
  public createStroke(state: FillStrokeState): any[] {
    return [
      CanvasInstruction.SET_STROKE_STYLE,
      state.strokeStyle,
      state.lineWidth * this.pixelRatio,
      state.lineCap,
      state.lineJoin,
      state.miterLimit,
      this.applyPixelRatio(state.lineDash),
      state.lineDashOffset * this.pixelRatio,
    ];
  }

  /**
   * @param {import("../canvas").FillStrokeState} state SourceState.
   * @param {function(this:CanvasBuilder, import("../canvas").FillStrokeState):Array<*>} createFill Create fill.
   */
  public updateFillStyle(state: FillStrokeState, createFill: (builder: CanvasBuilder, state: FillStrokeState) => any[]): void {
    const fillStyle = state.fillStyle;
    if (typeof fillStyle !== 'string' || state.currentFillStyle != fillStyle) {
      if (fillStyle !== undefined) {
        this.instructions.push(createFill.call(this, state));
      }
      state.currentFillStyle = fillStyle;
    }
  }

  /**
   * @param {import("../canvas").FillStrokeState} state SourceState.
   * @param {function(this:CanvasBuilder, import("../canvas").FillStrokeState): void} applyStroke Apply stroke.
   */
  public updateStrokeStyle(state: FillStrokeState, applyStroke: (builder: CanvasBuilder, state: FillStrokeState) => void): void {
    const strokeStyle = state.strokeStyle;
    const lineCap = state.lineCap;
    const lineDash = state.lineDash;
    const lineDashOffset = state.lineDashOffset;
    const lineJoin = state.lineJoin;
    const lineWidth = state.lineWidth;
    const miterLimit = state.miterLimit;
    if (
      state.currentStrokeStyle != strokeStyle ||
      state.currentLineCap != lineCap ||
      (lineDash != state.currentLineDash &&
        !equals(state.currentLineDash, lineDash)) ||
      state.currentLineDashOffset != lineDashOffset ||
      state.currentLineJoin != lineJoin ||
      state.currentLineWidth != lineWidth ||
      state.currentMiterLimit != miterLimit
    ) {
      if (strokeStyle !== undefined) {
        applyStroke.call(this, state);
      }
      state.currentStrokeStyle = strokeStyle;
      state.currentLineCap = lineCap;
      state.currentLineDash = lineDash;
      state.currentLineDashOffset = lineDashOffset;
      state.currentLineJoin = lineJoin;
      state.currentLineWidth = lineWidth;
      state.currentMiterLimit = miterLimit;
    }
  }

  /**
   * @param {import("../../Feature").FeatureLike} feature Feature.
   */
  public endGeometry(feature: FeatureLike): void {
    this.beginGeometryInstruction1_[2] = this.instructions.length;
    this.beginGeometryInstruction1_ = null;
    this.beginGeometryInstruction2_[2] = this.hitDetectionInstructions.length;
    this.beginGeometryInstruction2_ = null;
    const endGeometryInstruction = [CanvasInstruction.END_GEOMETRY, feature];
    this.instructions.push(endGeometryInstruction);
    this.hitDetectionInstructions.push(endGeometryInstruction);
  }

  /**
   * Get the buffered rendering extent.  Rendering will be clipped to the extent
   * provided to the constructor.  To account for symbolizers that may intersect
   * this extent, we calculate a buffered extent (e.g. based on stroke width).
   * @return {import("../../extent").Extent} The buffered rendering extent.
   * @protected
   */
  protected getBufferedMaxExtent(): Extent {
    if (!this.bufferedMaxExtent_) {
      this.bufferedMaxExtent_ = clone(this.maxExtent, null);
      if (this.maxLineWidth > 0) {
        const width = (this.resolution * (this.maxLineWidth + 1)) / 2;
        buffer(this.bufferedMaxExtent_, width, this.bufferedMaxExtent_);
      }
    }
    return this.bufferedMaxExtent_;
  }
}

export default CanvasBuilder;
