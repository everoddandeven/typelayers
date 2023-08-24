/**
 * @module tl/render/canvas/Executor
 */
import CanvasInstruction, {Instruction} from './Instruction';
import {TEXT_ALIGN} from './TextBuilder';
import {
  apply as applyTransform,
  compose as composeTransform,
  create as createTransform,
  setFromArray as transformSetFromArray, Transform,
} from '../../transform';
import {createEmpty, createOrUpdate, Extent, intersects} from '../../extent';
import {
  defaultPadding,
  defaultTextAlign,
  defaultTextBaseline,
  drawImageOrLabel, FillState,
  getTextDimensions, Label,
  measureAndCacheTextWidth, SerializableInstructions, StrokeState, TextState,
} from '../canvas';
import {drawTextOnPath} from '../../geom/flat/textpath';
import {equals} from '../../array';
import {lineStringLength} from '../../geom/flat/length';
import {transform2D} from '../../geom/flat/transform';
import {FeatureLike} from "../../Feature";
import SimpleGeometry from "../../geom/SimpleGeometry";
import {Coordinate, Coordinates} from "../../coordinate";
import RBush_ from "rbush";
import {RenderState} from "../../render";
import {Size} from "../../size";

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  value: any;
}

export interface ImageOrLabelDimensions {
  drawImageX: number;
  drawImageY: number;
  drawImageW: number;
  drawImageH: number;
  originX: number;
  originY: number;
  scale: Size;
  declutterBox: BBox;
  canvasTransform: Transform;
}

export type ReplayImageOrLabelArgs = { 0: CanvasRenderingContext2D; 1: number; 2: Label | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement; 3: ImageOrLabelDimensions; 4: number; 5: any[]; 6: any[]; };

/**
 * @template T
 * @typedef {function(import("../../Feature").FeatureLike, import("../../geom/SimpleGeometry").default): T} FeatureCallback
 */

export type FeatureCallback<T> = (feature: FeatureLike, geometry: SimpleGeometry) => T;

/**
 * @type {import("../../extent").Extent}
 */
const tmpExtent: Extent = createEmpty();

/** @type {import("../../coordinate").Coordinate} */
const p1: Coordinate = [0, 0];
/** @type {import("../../coordinate").Coordinate} */
const p2: Coordinate = [0, 0];
/** @type {import("../../coordinate").Coordinate} */
const p3: Coordinate = [0, 0];
/** @type {import("../../coordinate").Coordinate} */
const p4: Coordinate = [0, 0];

/**
 * @param {ReplayImageOrLabelArgs} replayImageOrLabelArgs Arguments to replayImageOrLabel
 * @return {BBox} Declutter bbox.
 */
function getDeclutterBox(replayImageOrLabelArgs: ReplayImageOrLabelArgs): BBox {
  return replayImageOrLabelArgs[3].declutterBox;
}

const rtlRegEx: RegExp = new RegExp(
  /* eslint-disable prettier/prettier */
  '[' +
    String.fromCharCode(0x00591) + '-' + String.fromCharCode(0x008ff) +
    String.fromCharCode(0x0fb1d) + '-' + String.fromCharCode(0x0fdff) +
    String.fromCharCode(0x0fe70) + '-' + String.fromCharCode(0x0fefc) +
    String.fromCharCode(0x10800) + '-' + String.fromCharCode(0x10fff) +
    String.fromCharCode(0x1e800) + '-' + String.fromCharCode(0x1efff) +
  ']'
  /* eslint-enable prettier/prettier */
);

/**
 * @param {string} text Text.
 * @param {CanvasTextAlign} align Alignment.
 * @return {number} Text alignment.
 */
function horizontalTextAlign(text: string, align: CanvasTextAlign): number{
  if (align === 'start') {
    align = rtlRegEx.test(text) ? 'right' : 'left';
  } else if (align === 'end') {
    align = rtlRegEx.test(text) ? 'left' : 'right';
  }
  return TEXT_ALIGN[align];
}

/**
 * @param {Array<string>} acc Accumulator.
 * @param {string} line Line of text.
 * @param {number} i Index
 * @return {Array<string>} Accumulator.
 */
function createTextChunks(acc: string[], line: string, i: number): string[] {
  if (i > 0) {
    acc.push('\n', '');
  }
  acc.push(line, '');
  return acc;
}

class Executor {
  private alignFill_: boolean;
  private coordinateCache_: {[key: number]: Coordinate | Coordinates | Coordinates[]};
  private renderedTransform_: Transform;

  protected overlaps: boolean;
  protected pixelRatio: number;
  protected resolution: number;
  protected coordinates: number[];
  protected instructions: any[];
  protected hitDetectionInstructions: any[];
  private pixelCoordinates_: number[];
  private viewRotation_: number;
  private fillStates: { [p: string]: FillState };
  private strokeStates: { [p: string]: StrokeState };
  private textStates: { [p: string]: TextState };
  private widths_: {[key: string]: {[key: string]: number}};
  private labels_: {[p: string]: Label};


  /**
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {boolean} overlaps The replay can have overlapping geometries.
   * @param {import("../canvas").SerializableInstructions} instructions The serializable instructions
   */
  constructor(resolution: number, pixelRatio: number, overlaps: boolean, instructions: SerializableInstructions) {
    /**
     * @protected
     * @type {boolean}
     */
    this.overlaps = overlaps;

    /**
     * @protected
     * @type {number}
     */
    this.pixelRatio = pixelRatio;

    /**
     * @protected
     * @const
     * @type {number}
     */
    this.resolution = resolution;

    /**
     * @private
     * @type {boolean}
     */
    this.alignFill_;

    /**
     * @protected
     * @type {Array<*>}
     */
    this.instructions = instructions.instructions;

    /**
     * @protected
     * @type {Array<number>}
     */
    this.coordinates = instructions.coordinates;

    /**
     * @private
     * @type {!Object<number,import("../../coordinate").Coordinate|Array<import("../../coordinate").Coordinate>|Array<Array<import("../../coordinate").Coordinate>>>}
     */

    this.coordinateCache_ = {};

    /**
     * @private
     * @type {!import("../../transform").Transform}
     */
    this.renderedTransform_ = createTransform();

    /**
     * @protected
     * @type {Array<*>}
     */
    this.hitDetectionInstructions = instructions.hitDetectionInstructions;

    /**
     * @private
     * @type {Array<number>}
     */
    this.pixelCoordinates_ = null;

    /**
     * @private
     * @type {number}
     */
    this.viewRotation_ = 0;

    /**
     * @type {!Object<string, import("../canvas").FillState>}
     */
    
    this.fillStates = instructions.fillStates || {};

    /**
     * @type {!Object<string, import("../canvas").StrokeState>}
     */
    this.strokeStates = instructions.strokeStates || {};

    /**
     * @type {!Object<string, import("../canvas").TextState>}
     */
    this.textStates = instructions.textStates || {};

    /**
     * @private
     * @type {Object<string, Object<string, number>>}
     */
    this.widths_ = {};

    /**
     * @private
     * @type {Object<string, import("../canvas").Label>}
     */
    this.labels_ = {};
  }

  /**
   * @param {string|Array<string>} text Text.
   * @param {string} textKey Text style key.
   * @param {string} fillKey Fill style key.
   * @param {string} strokeKey Stroke style key.
   * @return {import("../canvas").Label} Label.
   */
  public createLabel(text: string | string[], textKey: string, fillKey: string, strokeKey: string): Label {
    const key = text + textKey + fillKey + strokeKey;
    if (this.labels_[key]) {
      return this.labels_[key];
    }
    const strokeState = strokeKey ? this.strokeStates[strokeKey] : null;
    const fillState = fillKey ? this.fillStates[fillKey] : null;
    const textState = this.textStates[textKey];
    const pixelRatio = this.pixelRatio;
    const scale = [
      textState.scale[0] * pixelRatio,
      textState.scale[1] * pixelRatio,
    ];
    const textIsArray = Array.isArray(text);
    const align = textState.justify
      ? TEXT_ALIGN[textState.justify]
      : horizontalTextAlign(
          Array.isArray(text) ? text[0] : text,
          textState.textAlign || defaultTextAlign
        );
    const strokeWidth =
      strokeKey && strokeState.lineWidth ? strokeState.lineWidth : 0;

    const chunks = textIsArray
      ? text
      : text.split('\n').reduce(createTextChunks, []);

    const {width, height, widths, heights, lineWidths} = getTextDimensions(
      textState,
      chunks
    );
    const renderWidth = width + strokeWidth;
    const contextInstructions = [];
    // make canvas 2 pixels wider to account for italic text width measurement errors
    const w = (renderWidth + 2) * scale[0];
    const h = (height + strokeWidth) * scale[1];
    /** @type {import("../canvas").Label} */
    const label = {
      width: w < 0 ? Math.floor(w) : Math.ceil(w),
      height: h < 0 ? Math.floor(h) : Math.ceil(h),
      contextInstructions: contextInstructions,
    };
    if (scale[0] != 1 || scale[1] != 1) {
      contextInstructions.push('scale', scale);
    }
    if (strokeKey) {
      contextInstructions.push('strokeStyle', strokeState.strokeStyle);
      contextInstructions.push('lineWidth', strokeWidth);
      contextInstructions.push('lineCap', strokeState.lineCap);
      contextInstructions.push('lineJoin', strokeState.lineJoin);
      contextInstructions.push('miterLimit', strokeState.miterLimit);
      contextInstructions.push('setLineDash', [strokeState.lineDash]);
      contextInstructions.push('lineDashOffset', strokeState.lineDashOffset);
    }
    if (fillKey) {
      contextInstructions.push('fillStyle', fillState.fillStyle);
    }
    contextInstructions.push('textBaseline', 'middle');
    contextInstructions.push('textAlign', 'center');
    const leftRight = 0.5 - align;
    let x = align * renderWidth + leftRight * strokeWidth;
    const strokeInstructions = [];
    const fillInstructions = [];
    let lineHeight = 0;
    let lineOffset = 0;
    let widthHeightIndex = 0;
    let lineWidthIndex = 0;
    let previousFont = null;
    for (let i = 0, ii = chunks.length; i < ii; i += 2) {
      const text = chunks[i];
      if (text === '\n') {
        lineOffset += lineHeight;
        lineHeight = 0;
        x = align * renderWidth + leftRight * strokeWidth;
        ++lineWidthIndex;
        continue;
      }
      const font = chunks[i + 1] || textState.font;
      if (font !== previousFont) {
        if (strokeKey) {
          strokeInstructions.push('font', font);
        }
        if (fillKey) {
          fillInstructions.push('font', font);
        }
        previousFont = font;
      }
      lineHeight = Math.max(lineHeight, heights[widthHeightIndex]);
      const fillStrokeArgs = [
        text,
        x +
          leftRight * widths[widthHeightIndex] +
          align * (widths[widthHeightIndex] - lineWidths[lineWidthIndex]),
        0.5 * (strokeWidth + lineHeight) + lineOffset,
      ];
      x += widths[widthHeightIndex];
      if (strokeKey) {
        strokeInstructions.push('strokeText', fillStrokeArgs);
      }
      if (fillKey) {
        fillInstructions.push('fillText', fillStrokeArgs);
      }
      ++widthHeightIndex;
    }
    Array.prototype.push.apply(contextInstructions, strokeInstructions);
    Array.prototype.push.apply(contextInstructions, fillInstructions);
    this.labels_[key] = label;
    return label;
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../coordinate").Coordinate} p1 1st point of the background box.
   * @param {import("../../coordinate").Coordinate} p2 2nd point of the background box.
   * @param {import("../../coordinate").Coordinate} p3 3rd point of the background box.
   * @param {import("../../coordinate").Coordinate} p4 4th point of the background box.
   * @param {Array<*>} fillInstruction Fill instruction.
   * @param {Array<*>} strokeInstruction Stroke instruction.
   */
  public replayTextBackground_(
    context: CanvasRenderingContext2D,
    p1: Coordinate,
    p2: Coordinate,
    p3: Coordinate,
    p4: Coordinate,
    fillInstruction: any[],
    strokeInstruction: any[]
  ) {
    context.beginPath();
    context.moveTo.apply(context, p1);
    context.lineTo.apply(context, p2);
    context.lineTo.apply(context, p3);
    context.lineTo.apply(context, p4);
    context.lineTo.apply(context, p1);
    if (fillInstruction) {
      this.alignFill_ = /** @type {boolean} */ (fillInstruction[2]);
      this.fill_(context);
    }
    if (strokeInstruction) {
      this.setStrokeStyle_(
        context,
        /** @type {Array<*>} */ (strokeInstruction)
      );
      context.stroke();
    }
  }

  /**
   * @private
   * @param {number} sheetWidth Width of the sprite sheet.
   * @param {number} sheetHeight Height of the sprite sheet.
   * @param {number} centerX X.
   * @param {number} centerY Y.
   * @param {number} width Width.
   * @param {number} height Height.
   * @param {number} anchorX Anchor X.
   * @param {number} anchorY Anchor Y.
   * @param {number} originX Origin X.
   * @param {number} originY Origin Y.
   * @param {number} rotation Rotation.
   * @param {import("../../size").Size} scale Scale.
   * @param {boolean} snapToPixel Snap to pixel.
   * @param {Array<number>} padding Padding.
   * @param {boolean} fillStroke Background fill or stroke.
   * @param {import("../../Feature").FeatureLike} feature Feature.
   * @return {ImageOrLabelDimensions} Dimensions for positioning and decluttering the image or label.
   */
  private calculateImageOrLabelDimensions_(
    sheetWidth: number,
    sheetHeight: number,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    anchorX: number,
    anchorY: number,
    originX: number,
    originY: number,
    rotation: number,
    scale: Size,
    snapToPixel: boolean,
    padding: number[],
    fillStroke: boolean,
    feature: FeatureLike
  ): ImageOrLabelDimensions {
    anchorX *= scale[0];
    anchorY *= scale[1];
    let x = centerX - anchorX;
    let y = centerY - anchorY;

    const w = width + originX > sheetWidth ? sheetWidth - originX : width;
    const h = height + originY > sheetHeight ? sheetHeight - originY : height;
    const boxW = padding[3] + w * scale[0] + padding[1];
    const boxH = padding[0] + h * scale[1] + padding[2];
    const boxX = x - padding[3];
    const boxY = y - padding[0];

    if (fillStroke || rotation !== 0) {
      p1[0] = boxX;
      p4[0] = boxX;
      p1[1] = boxY;
      p2[1] = boxY;
      p2[0] = boxX + boxW;
      p3[0] = p2[0];
      p3[1] = boxY + boxH;
      p4[1] = p3[1];
    }

    let transform;
    if (rotation !== 0) {
      transform = composeTransform(
        createTransform(),
        centerX,
        centerY,
        1,
        1,
        rotation,
        -centerX,
        -centerY
      );

      applyTransform(transform, p1);
      applyTransform(transform, p2);
      applyTransform(transform, p3);
      applyTransform(transform, p4);
      createOrUpdate(
        Math.min(p1[0], p2[0], p3[0], p4[0]),
        Math.min(p1[1], p2[1], p3[1], p4[1]),
        Math.max(p1[0], p2[0], p3[0], p4[0]),
        Math.max(p1[1], p2[1], p3[1], p4[1]),
        tmpExtent
      );
    } else {
      createOrUpdate(
        Math.min(boxX, boxX + boxW),
        Math.min(boxY, boxY + boxH),
        Math.max(boxX, boxX + boxW),
        Math.max(boxY, boxY + boxH),
        tmpExtent
      );
    }
    if (snapToPixel) {
      x = Math.round(x);
      y = Math.round(y);
    }
    return {
      drawImageX: x,
      drawImageY: y,
      drawImageW: w,
      drawImageH: h,
      originX: originX,
      originY: originY,
      declutterBox: {
        minX: tmpExtent[0],
        minY: tmpExtent[1],
        maxX: tmpExtent[2],
        maxY: tmpExtent[3],
        value: feature,
      },
      canvasTransform: transform,
      scale: scale,
    };
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} contextScale Scale of the context.
   * @param {import("../canvas").Label|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} imageOrLabel Image.
   * @param {ImageOrLabelDimensions} dimensions Dimensions.
   * @param {number} opacity Opacity.
   * @param {Array<*>} fillInstruction Fill instruction.
   * @param {Array<*>} strokeInstruction Stroke instruction.
   * @return {boolean} The image or label was rendered.
   */
  private replayImageOrLabel_(
    context: CanvasRenderingContext2D,
    contextScale: number,
    imageOrLabel: Label | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    dimensions: ImageOrLabelDimensions,
    opacity: number,
    fillInstruction: any[],
    strokeInstruction: any[]
  ): boolean {
    const fillStroke = !!(fillInstruction || strokeInstruction);

    const box = dimensions.declutterBox;
    const canvas = context.canvas;
    const strokePadding = strokeInstruction
      ? (strokeInstruction[2] * dimensions.scale[0]) / 2
      : 0;
    const intersects =
      box.minX - strokePadding <= canvas.width / contextScale &&
      box.maxX + strokePadding >= 0 &&
      box.minY - strokePadding <= canvas.height / contextScale &&
      box.maxY + strokePadding >= 0;

    if (intersects) {
      if (fillStroke) {
        this.replayTextBackground_(
          context,
          p1,
          p2,
          p3,
          p4,
          /** @type {Array<*>} */ (fillInstruction),
          /** @type {Array<*>} */ (strokeInstruction)
        );
      }
      drawImageOrLabel(
        context,
        dimensions.canvasTransform,
        opacity,
        imageOrLabel,
        dimensions.originX,
        dimensions.originY,
        dimensions.drawImageW,
        dimensions.drawImageH,
        dimensions.drawImageX,
        dimensions.drawImageY,
        dimensions.scale
      );
    }
    return true;
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   */
  private fill_(context: CanvasRenderingContext2D): void {
    if (this.alignFill_) {
      const origin = applyTransform(this.renderedTransform_, [0, 0]);
      const repeatSize = 512 * this.pixelRatio;
      context.save();
      context.translate(origin[0] % repeatSize, origin[1] % repeatSize);
      context.rotate(this.viewRotation_);
    }
    context.fill();
    if (this.alignFill_) {
      context.restore();
    }
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   * @param {Array<*>} instruction Instruction.
   */
  private setStrokeStyle_(context: CanvasRenderingContext2D, instruction: any[]): void {
    context['strokeStyle'] =
      /** @type {import("../../colorlike").ColorLike} */ (instruction[1]);
    context.lineWidth = /** @type {number} */ (instruction[2]);
    context.lineCap = /** @type {CanvasLineCap} */ (instruction[3]);
    context.lineJoin = /** @type {CanvasLineJoin} */ (instruction[4]);
    context.miterLimit = /** @type {number} */ (instruction[5]);
    context.lineDashOffset = /** @type {number} */ (instruction[7]);
    context.setLineDash(/** @type {Array<number>} */ (instruction[6]));
  }

  /**
   * @private
   * @param {string|Array<string>} text The text to draw.
   * @param {string} textKey The key of the text state.
   * @param {string} strokeKey The key for the stroke state.
   * @param {string} fillKey The key for the fill state.
   * @return {{label: import("../canvas").Label, anchorX: number, anchorY: number}} The text image and its anchor.
   */
  private drawLabelWithPointPlacement_(text: string | string[], textKey: string, strokeKey: string, fillKey: string): { label: Label; anchorX: number; anchorY: number } {
    const textState = this.textStates[textKey];

    const label = this.createLabel(text, textKey, fillKey, strokeKey);

    const strokeState = this.strokeStates[strokeKey];
    const pixelRatio = this.pixelRatio;
    const align = horizontalTextAlign(
      Array.isArray(text) ? text[0] : text,
      textState.textAlign || defaultTextAlign
    );
    const baseline = TEXT_ALIGN[textState.textBaseline || defaultTextBaseline];
    const strokeWidth =
      strokeState && strokeState.lineWidth ? strokeState.lineWidth : 0;

    // Remove the 2 pixels we added in createLabel() for the anchor
    const width = label.width / pixelRatio - 2 * textState.scale[0];
    const anchorX = align * width + 2 * (0.5 - align) * strokeWidth;
    const anchorY =
      (baseline * label.height) / pixelRatio +
      2 * (0.5 - baseline) * strokeWidth;

    return {
      label: label,
      anchorX: anchorX,
      anchorY: anchorY,
    };
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} contextScale Scale of the context.
   * @param {import("../../transform").Transform} transform Transform.
   * @param {Array<*>} instructions Instructions array.
   * @param {boolean} snapToPixel Snap point symbols and text to integer pixels.
   * @param {FeatureCallback<T>} [featureCallback] Feature callback.
   * @param {import("../../extent").Extent} [hitExtent] Only check
   *     features that intersect this extent.
   * @param {import("rbush").default} [declutterTree] Declutter tree.
   * @return {T|undefined} Callback result.
   * @template T
   */
  private execute_<T>(
    context: CanvasRenderingContext2D,
    contextScale: number,
    transform: Transform,
    instructions: any[],
    snapToPixel: boolean,
    featureCallback?: FeatureCallback<T>,
    hitExtent?: Extent,
    declutterTree?: RBush_<any>
  ): any {
    /** @type {Array<number>} */
    let pixelCoordinates;
    if (this.pixelCoordinates_ && equals(transform, this.renderedTransform_)) {
      pixelCoordinates = this.pixelCoordinates_;
    } else {
      if (!this.pixelCoordinates_) {
        this.pixelCoordinates_ = [];
      }
      pixelCoordinates = transform2D(
        this.coordinates,
        0,
        this.coordinates.length,
        2,
        transform,
        this.pixelCoordinates_
      );
      transformSetFromArray(this.renderedTransform_, transform);
    }
    let i = 0; // instruction index
    const ii = instructions.length; // end of instructions
    let d = 0; // data index
    let dd; // end of per-instruction data
    let anchorX: number,
      anchorY: number,
      prevX: number,
      prevY: number,
      roundX: number,
      roundY: number,
      image: Label,
      text,
      textKey: string,
      strokeKey: string,
      fillKey: string;
    let pendingFill = 0;
    let pendingStroke = 0;
    let lastFillInstruction = null;
    let lastStrokeInstruction = null;
    const coordinateCache = this.coordinateCache_;
    const viewRotation = this.viewRotation_;
    const viewRotationFromTransform =
      Math.round(Math.atan2(-transform[1], transform[0]) * 1e12) / 1e12;

    const state = /** @type {import("../../render").State} */ (<RenderState>{
      context: context,
      pixelRatio: this.pixelRatio,
      resolution: this.resolution,
      rotation: viewRotation,
    });

    // When the batch size gets too big, performance decreases. 200 is a good
    // balance between batch size and number of fill/stroke instructions.
    const batchSize =
      this.instructions != instructions || this.overlaps ? 0 : 200;
    let /** @type {import("../../Feature").FeatureLike} */ feature: FeatureLike;
    let x, y, currentGeometry;
    while (i < ii) {
      const instruction = instructions[i];
      const type = /** @type {import("./Instruction").default} */ (
        <Instruction>instruction[0]
      );
      switch (type) {
        case CanvasInstruction.BEGIN_GEOMETRY:
          feature = /** @type {import("../../Feature").FeatureLike} */ (
            instruction[1]
          );
          currentGeometry = instruction[3];
          if (!feature.getGeometry()) {
            i = /** @type {number} */ (instruction[2]);
          } else if (
            hitExtent !== undefined &&
            !intersects(hitExtent, currentGeometry.getExtent())
          ) {
            i = /** @type {number} */ (instruction[2]) + 1;
          } else {
            ++i;
          }
          break;
        case CanvasInstruction.BEGIN_PATH:
          if (pendingFill > batchSize) {
            this.fill_(context);
            pendingFill = 0;
          }
          if (pendingStroke > batchSize) {
            context.stroke();
            pendingStroke = 0;
          }
          if (!pendingFill && !pendingStroke) {
            context.beginPath();
            prevX = NaN;
            prevY = NaN;
          }
          ++i;
          break;
        case CanvasInstruction.CIRCLE:
          d = /** @type {number} */ (instruction[1]);
          const x1 = pixelCoordinates[d];
          const y1 = pixelCoordinates[d + 1];
          const x2 = pixelCoordinates[d + 2];
          const y2 = pixelCoordinates[d + 3];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const r = Math.sqrt(dx * dx + dy * dy);
          context.moveTo(x1 + r, y1);
          context.arc(x1, y1, r, 0, 2 * Math.PI, true);
          ++i;
          break;
        case CanvasInstruction.CLOSE_PATH:
          context.closePath();
          ++i;
          break;
        case CanvasInstruction.CUSTOM:
          d = /** @type {number} */ (<number>instruction[1]);
          dd = instruction[2];
          const geometry =
            /** @type {import("../../geom/SimpleGeometry").default} */ (
              <SimpleGeometry>instruction[3]
            );
          const renderer = instruction[4];
          const fn = instruction.length == 6 ? instruction[5] : undefined;
          state.geometry = geometry;
          state.feature = feature;
          if (!(i in coordinateCache)) {
            coordinateCache[i] = [];
          }
          const coords = coordinateCache[i];
          if (fn) {
            fn(pixelCoordinates, d, dd, 2, coords);
          } else {
            coords[0] = pixelCoordinates[d];
            coords[1] = pixelCoordinates[d + 1];
            coords.length = 2;
          }
          renderer(coords, state);
          ++i;
          break;
        case CanvasInstruction.DRAW_IMAGE:
          d = /** @type {number} */ (instruction[1]);
          dd = /** @type {number} */ (instruction[2]);
          image =
            /** @type {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} */ (
              instruction[3]
            );

          // Remaining arguments in DRAW_IMAGE are in alphabetical order
          anchorX = /** @type {number} */ (instruction[4]);
          anchorY = /** @type {number} */ (instruction[5]);
          let height = /** @type {number} */ (instruction[6]);
          const opacity = /** @type {number} */ (instruction[7]);
          const originX = /** @type {number} */ (instruction[8]);
          const originY = /** @type {number} */ (instruction[9]);
          const rotateWithView = /** @type {boolean} */ (instruction[10]);
          let rotation = /** @type {number} */ (instruction[11]);
          const scale = /** @type {import("../../size").Size} */ (
            instruction[12]
          );
          let width = /** @type {number} */ (instruction[13]);
          const declutterMode =
            /** @type {"declutter"|"obstacle"|"none"|undefined} */ (
              instruction[14]
            );
          const declutterImageWithText =
            /** @type {import("../canvas").DeclutterImageWithText} */ (
              instruction[15]
            );

          if (!image && instruction.length >= 20) {
            // create label images
            text = /** @type {string} */ (instruction[19]);
            textKey = /** @type {string} */ (instruction[20]);
            strokeKey = /** @type {string} */ (instruction[21]);
            fillKey = /** @type {string} */ (instruction[22]);
            const labelWithAnchor = this.drawLabelWithPointPlacement_(
              text,
              textKey,
              strokeKey,
              fillKey
            );
            image = labelWithAnchor.label;
            instruction[3] = image;
            const textOffsetX = /** @type {number} */ (instruction[23]);
            anchorX = (labelWithAnchor.anchorX - textOffsetX) * this.pixelRatio;
            instruction[4] = anchorX;
            const textOffsetY = /** @type {number} */ (instruction[24]);
            anchorY = (labelWithAnchor.anchorY - textOffsetY) * this.pixelRatio;
            instruction[5] = anchorY;
            height = image.height;
            instruction[6] = height;
            width = image.width;
            instruction[13] = width;
          }

          let geometryWidths;
          if (instruction.length > 25) {
            geometryWidths = /** @type {number} */ (instruction[25]);
          }

          let padding, backgroundFill, backgroundStroke;
          if (instruction.length > 17) {
            padding = /** @type {Array<number>} */ (instruction[16]);
            backgroundFill = /** @type {boolean} */ (instruction[17]);
            backgroundStroke = /** @type {boolean} */ (instruction[18]);
          } else {
            padding = defaultPadding;
            backgroundFill = false;
            backgroundStroke = false;
          }

          if (rotateWithView && viewRotationFromTransform) {
            // Canvas is expected to be rotated to reverse view rotation.
            rotation += viewRotation;
          } else if (!rotateWithView && !viewRotationFromTransform) {
            // Canvas is not rotated, images need to be rotated back to be north-up.
            rotation -= viewRotation;
          }
          let widthIndex = 0;
          for (; d < dd; d += 2) {
            if (
              geometryWidths &&
              geometryWidths[widthIndex++] < width / this.pixelRatio
            ) {
              continue;
            }
            const dimensions = this.calculateImageOrLabelDimensions_(
              image.width,
              image.height,
              pixelCoordinates[d],
              pixelCoordinates[d + 1],
              width,
              height,
              anchorX,
              anchorY,
              originX,
              originY,
              rotation,
              scale,
              snapToPixel,
              padding,
              backgroundFill || backgroundStroke,
              feature
            );
            /** @type {ReplayImageOrLabelArgs} */
            const args = [
              context,
              contextScale,
              image,
              dimensions,
              opacity,
              backgroundFill
                ? /** @type {Array<*>} */ (lastFillInstruction)
                : null,
              backgroundStroke
                ? /** @type {Array<*>} */ (lastStrokeInstruction)
                : null,
            ];
            if (declutterTree) {
              if (declutterMode === 'none') {
                // not rendered in declutter group
                continue;
              } else if (declutterMode === 'obstacle') {
                // will always be drawn, thus no collision detection, but insert as obstacle
                declutterTree.insert(dimensions.declutterBox);
                continue;
              } else {
                let imageArgs;
                let imageDeclutterBox;
                if (declutterImageWithText) {
                  const index = dd - d;
                  if (!declutterImageWithText[index]) {
                    // We now have the image for an image+text combination.
                    declutterImageWithText[index] = args;
                    // Don't render anything for now, wait for the text.
                    continue;
                  }
                  imageArgs = declutterImageWithText[index];
                  delete declutterImageWithText[index];
                  imageDeclutterBox = getDeclutterBox(imageArgs);
                  if (declutterTree.collides(imageDeclutterBox)) {
                    continue;
                  }
                }
                if (declutterTree.collides(dimensions.declutterBox)) {
                  continue;
                }
                if (imageArgs) {
                  // We now have image and text for an image+text combination.
                  declutterTree.insert(imageDeclutterBox);
                  // Render the image before we render the text.
                  this.replayImageOrLabel_.apply(this, imageArgs);
                }
                declutterTree.insert(dimensions.declutterBox);
              }
            }
            this.replayImageOrLabel_.apply(this, args);
          }
          ++i;
          break;
        case CanvasInstruction.DRAW_CHARS:
          const begin = /** @type {number} */ (instruction[1]);
          const end = /** @type {number} */ (instruction[2]);
          const baseline = /** @type {number} */ (instruction[3]);
          const overflow = /** @type {number} */ (instruction[4]);
          fillKey = /** @type {string} */ (instruction[5]);
          const maxAngle = /** @type {number} */ (instruction[6]);
          const measurePixelRatio = /** @type {number} */ (instruction[7]);
          const offsetY = /** @type {number} */ (instruction[8]);
          strokeKey = /** @type {string} */ (instruction[9]);
          const strokeWidth = /** @type {number} */ (instruction[10]);
          text = /** @type {string} */ (instruction[11]);
          textKey = /** @type {string} */ (instruction[12]);
          const pixelRatioScale = <Size>[
            /** @type {number} */ (<number>instruction[13]),
            /** @type {number} */ (<number>instruction[13]),
          ];

          const textState = this.textStates[textKey];
          const font = textState.font;
          const textScale = [
            textState.scale[0] * measurePixelRatio,
            textState.scale[1] * measurePixelRatio,
          ];

          let cachedWidths;
          if (font in this.widths_) {
            cachedWidths = this.widths_[font];
          } else {
            cachedWidths = {};
            this.widths_[font] = cachedWidths;
          }

          const pathLength = lineStringLength(pixelCoordinates, begin, end, 2);
          const textLength =
            Math.abs(textScale[0]) *
            measureAndCacheTextWidth(font, text, cachedWidths);
          if (overflow || textLength <= pathLength) {
            const textAlign = this.textStates[textKey].textAlign;
            const startM =
              (pathLength - textLength) * horizontalTextAlign(text, textAlign);
            const parts = drawTextOnPath(
              pixelCoordinates,
              begin,
              end,
              2,
              text,
              startM,
              maxAngle,
              Math.abs(textScale[0]),
              measureAndCacheTextWidth,
              font,
              cachedWidths,
              viewRotationFromTransform ? 0 : this.viewRotation_
            );
            drawChars: if (parts) {
              /** @type {Array<ReplayImageOrLabelArgs>} */
              const replayImageOrLabelArgs = [];
              let c, cc, chars, label, part;
              if (strokeKey) {
                for (c = 0, cc = parts.length; c < cc; ++c) {
                  part = parts[c]; // x, y, anchorX, rotation, chunk
                  chars = /** @type {string} */ (part[4]);
                  label = this.createLabel(chars, textKey, '', strokeKey);
                  anchorX =
                    /** @type {number} */ (part[2]) +
                    (textScale[0] < 0 ? -strokeWidth : strokeWidth);
                  anchorY =
                    baseline * label.height +
                    ((0.5 - baseline) * 2 * strokeWidth * textScale[1]) /
                      textScale[0] -
                    offsetY;
                  const dimensions = this.calculateImageOrLabelDimensions_(
                    label.width,
                    label.height,
                    part[0],
                    part[1],
                    label.width,
                    label.height,
                    anchorX,
                    anchorY,
                    0,
                    0,
                    part[3],
                    pixelRatioScale,
                    false,
                    defaultPadding,
                    false,
                    feature
                  );
                  if (
                    declutterTree &&
                    declutterTree.collides(dimensions.declutterBox)
                  ) {
                    break drawChars;
                  }
                  replayImageOrLabelArgs.push([
                    context,
                    contextScale,
                    label,
                    dimensions,
                    1,
                    null,
                    null,
                  ]);
                }
              }
              if (fillKey) {
                for (c = 0, cc = parts.length; c < cc; ++c) {
                  part = parts[c]; // x, y, anchorX, rotation, chunk
                  chars = /** @type {string} */ (part[4]);
                  label = this.createLabel(chars, textKey, fillKey, '');
                  anchorX = /** @type {number} */ (part[2]);
                  anchorY = baseline * label.height - offsetY;
                  const dimensions = this.calculateImageOrLabelDimensions_(
                    label.width,
                    label.height,
                    part[0],
                    part[1],
                    label.width,
                    label.height,
                    anchorX,
                    anchorY,
                    0,
                    0,
                    part[3],
                    pixelRatioScale,
                    false,
                    defaultPadding,
                    false,
                    feature
                  );
                  if (
                    declutterTree &&
                    declutterTree.collides(dimensions.declutterBox)
                  ) {
                    break drawChars;
                  }
                  replayImageOrLabelArgs.push([
                    context,
                    contextScale,
                    label,
                    dimensions,
                    1,
                    null,
                    null,
                  ]);
                }
              }
              if (declutterTree) {
                declutterTree.load(replayImageOrLabelArgs.map(getDeclutterBox));
              }
              for (let i = 0, ii = replayImageOrLabelArgs.length; i < ii; ++i) {
                this.replayImageOrLabel_.apply(this, replayImageOrLabelArgs[i]);
              }
            }
          }
          ++i;
          break;
        case CanvasInstruction.END_GEOMETRY:
          if (featureCallback !== undefined) {
            feature = /** @type {import("../../Feature").FeatureLike} */ (
              instruction[1]
            );
            const result = featureCallback(feature, currentGeometry);
            if (result) {
              return result;
            }
          }
          ++i;
          break;
        case CanvasInstruction.FILL:
          if (batchSize) {
            pendingFill++;
          } else {
            this.fill_(context);
          }
          ++i;
          break;
        case CanvasInstruction.MOVE_TO_LINE_TO:
          d = /** @type {number} */ (instruction[1]);
          dd = /** @type {number} */ (instruction[2]);
          x = pixelCoordinates[d];
          y = pixelCoordinates[d + 1];
          roundX = (x + 0.5) | 0;
          roundY = (y + 0.5) | 0;
          if (roundX !== prevX || roundY !== prevY) {
            context.moveTo(x, y);
            prevX = roundX;
            prevY = roundY;
          }
          for (d += 2; d < dd; d += 2) {
            x = pixelCoordinates[d];
            y = pixelCoordinates[d + 1];
            roundX = (x + 0.5) | 0;
            roundY = (y + 0.5) | 0;
            if (d == dd - 2 || roundX !== prevX || roundY !== prevY) {
              context.lineTo(x, y);
              prevX = roundX;
              prevY = roundY;
            }
          }
          ++i;
          break;
        case CanvasInstruction.SET_FILL_STYLE:
          lastFillInstruction = instruction;
          this.alignFill_ = instruction[2];

          if (pendingFill) {
            this.fill_(context);
            pendingFill = 0;
            if (pendingStroke) {
              context.stroke();
              pendingStroke = 0;
            }
          }

          context.fillStyle =
            /** @type {import("../../colorlike").ColorLike} */ (
              instruction[1]
            );
          ++i;
          break;
        case CanvasInstruction.SET_STROKE_STYLE:
          lastStrokeInstruction = instruction;
          if (pendingStroke) {
            context.stroke();
            pendingStroke = 0;
          }
          this.setStrokeStyle_(context, /** @type {Array<*>} */ (instruction));
          ++i;
          break;
        case CanvasInstruction.STROKE:
          if (batchSize) {
            pendingStroke++;
          } else {
            context.stroke();
          }
          ++i;
          break;
        default: // consume the instruction anyway, to avoid an infinite loop
          ++i;
          break;
      }
    }
    if (pendingFill) {
      this.fill_(context);
    }
    if (pendingStroke) {
      context.stroke();
    }
    return undefined;
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} contextScale Scale of the context.
   * @param {import("../../transform").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {boolean} snapToPixel Snap point symbols and text to integer pixels.
   * @param {import("rbush").default} [declutterTree] Declutter tree.
   */
  public execute(
    context: CanvasRenderingContext2D,
    contextScale: number,
    transform: Transform,
    viewRotation: number,
    snapToPixel: boolean,
    declutterTree: RBush_<any>
  ): void {
    this.viewRotation_ = viewRotation;
    this.execute_(
      context,
      contextScale,
      transform,
      this.instructions,
      snapToPixel,
      undefined,
      undefined,
      declutterTree
    );
  }

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {import("../../transform").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {FeatureCallback<T>} [featureCallback] Feature callback.
   * @param {import("../../extent").Extent} [hitExtent] Only check
   *     features that intersect this extent.
   * @return {T|undefined} Callback result.
   * @template T
   */
  public executeHitDetection<T>(
    context: CanvasRenderingContext2D,
    transform: Transform,
    viewRotation: number,
    featureCallback?: FeatureCallback<T>,
    hitExtent?: Extent
  ): T | undefined {
    this.viewRotation_ = viewRotation;
    return this.execute_(
      context,
      1,
      transform,
      this.hitDetectionInstructions,
      true,
      featureCallback,
      hitExtent
    );
  }
}

export default Executor;
