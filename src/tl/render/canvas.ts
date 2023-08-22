/**
 * @module tl/render/canvas
 */
import BaseObject from '../Object';
import {WORKER_OFFSCREEN_CANVAS} from '../has';
import {clear} from '../obj';
import {createCanvasContext2D} from '../dom';
import {getFontParameters} from '../css';
import {ColorLike} from "../colorlike";
import {Size} from '../size';

export type BuilderType = 'Circle' | 'Image' | 'LineString' | 'Polygon' | 'Text' | 'Default';

export interface FillState {
  fillStyle: ColorLike;
}

export interface Label {
  width: number;
  height: number;
  contextInstructions: Array<string | number>;
}

export interface FillStrokeState {
  currentFillStyle?: ColorLike;
  currentStrokeStyle?: ColorLike;
  currentLineCap?: CanvasLineCap;
  currentLineDash: Array<number>;
  currentLineDashOffset?: number;
  currentLineJoin?: CanvasLineJoin;
  currentLineWidth?: number;
  currentMiterLimit?: number;
  lastStroke?: number;
  fillStyle?: ColorLike;
  strokeStyle?: ColorLike;
  lineCap?: CanvasLineCap;
  lineDash: Array<number>;
  lineDashOffset?: number;
  lineJoin?: CanvasLineJoin;
  lineWidth?: number;
  miterLimit?: number;
}

export interface StrokeState {
  lineCap: CanvasLineCap;
  lineDash: Array<number>;
  lineDashOffset: number;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  miterLimit: number;
  strokeStyle: ColorLike;
}

export interface TextState {
  font: string;
  textAlign?: CanvasTextAlign;
  repeat?: number;
  justify?: import("../style/Text").TextJustify;
  textBaseline: CanvasTextBaseline;
  placement?: import("../style/Text").TextPlacement;
  maxAngle?: number;
  overflow?: boolean;
  backgroundFill?: import("../style/Fill").default;
  backgroundStroke?: import("../style/Stroke").default;
  scale?: Size;
  padding?: Array<number>;
}

export interface SerializableInstructions {
  instructions: any[];
  hitDetectionInstructions: any[];
  coordinates: number[];
  textStates?: {[key:string]: TextState};
  fillStates?: {[key:string]: FillState};
  strokeStates?: {[key:string]: StrokeState};
}

/**
 * @typedef {Object<number, import("./canvas/Executor").ReplayImageOrLabelArgs>} DeclutterImageWithText
 */

export type DeclutterImageWithText = any;

/**
 * @const
 * @type {string}
 */
export const defaultFont: string = '10px sans-serif';

/**
 * @const
 * @type {string}
 */
export const defaultFillStyle: string = '#000';

/**
 * @const
 * @type {CanvasLineCap}
 */
export const defaultLineCap : CanvasLineCap= 'round';

/**
 * @const
 * @type {Array<number>}
 */
export const defaultLineDash: number[] = [];

/**
 * @const
 * @type {number}
 */
export const defaultLineDashOffset: number = 0;

/**
 * @const
 * @type {CanvasLineJoin}
 */
export const defaultLineJoin: CanvasLineJoin = 'round';

/**
 * @const
 * @type {number}
 */
export const defaultMiterLimit: number = 10;

/**
 * @const
 * @type {import("../colorlike").ColorLike}
 */
export const defaultStrokeStyle: ColorLike = '#000';

/**
 * @const
 * @type {CanvasTextAlign}
 */
export const defaultTextAlign: CanvasTextAlign = 'center';

/**
 * @const
 * @type {CanvasTextBaseline}
 */
export const defaultTextBaseline: CanvasTextBaseline = 'middle';

/**
 * @const
 * @type {Array<number>}
 */
export const defaultPadding: number[] = [0, 0, 0, 0];

/**
 * @const
 * @type {number}
 */
export const defaultLineWidth: number = 1;

export class FontsObject extends BaseObject
{
  public constructor() {
    super();
  }
}

/**
 * @type {BaseObject}
 */
export const checkedFonts: FontsObject = new FontsObject();

/**
 * @type {CanvasRenderingContext2D}
 */
let measureContext: CanvasRenderingContext2D = null;

/**
 * @type {string}
 */
let measureFont: string;

/**
 * @type {!Object<string, number>}
 */
export const textHeights: {[text: string]: number} = {};

/**
 * Clears the label cache when a font becomes available.
 * @param {string} fontSpec CSS font spec.
 */
export const registerFont = (function () {
  const retries = 100;
  const size = '32px ';
  const referenceFonts = ['monospace', 'serif'];
  const len = referenceFonts.length;
  const text = 'wmytzilWMYTZIL@#/&?$%10\uF013';
  let interval, referenceWidth;

  /**
   * @param {string} fontStyle Css font-style
   * @param {string} fontWeight Css font-weight
   * @param {*} fontFamily Css font-family
   * @return {boolean} Font with style and weight is available
   */
  function isAvailable(fontStyle: string, fontWeight: string, fontFamily: any): boolean {
    let available = true;
    for (let i = 0; i < len; ++i) {
      const referenceFont = referenceFonts[i];
      referenceWidth = measureTextWidth(
        fontStyle + ' ' + fontWeight + ' ' + size + referenceFont,
        text
      );
      if (fontFamily != referenceFont) {
        const width = measureTextWidth(
          fontStyle +
            ' ' +
            fontWeight +
            ' ' +
            size +
            fontFamily +
            ',' +
            referenceFont,
          text
        );
        // If width and referenceWidth are the same, then the fallback was used
        // instead of the font we wanted, so the font is not available.
        available = available && width != referenceWidth;
      }
    }
    return available;
  }

  function check(): void {
    let done = true;
    const fonts = checkedFonts.getKeys();
    for (let i = 0, ii = fonts.length; i < ii; ++i) {
      const font = fonts[i];
      if (checkedFonts.get(font) < retries) {
        if (isAvailable.apply(this, font.split('\n'))) {
          clear(textHeights);
          // Make sure that loaded fonts are picked up by Safari
          measureContext = null;
          measureFont = undefined;
          checkedFonts.set(font, retries);
        } else {
          checkedFonts.set(font, checkedFonts.get(font) + 1, true);
          done = false;
        }
      }
    }
    if (done) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  return function (fontSpec: string): void {
    const font = getFontParameters(fontSpec);
    if (!font) {
      return;
    }
    const families = font.families;
    for (let i = 0, ii = families.length; i < ii; ++i) {
      const family = families[i];
      const key = font.style + '\n' + font.weight + '\n' + family;
      if (checkedFonts.get(key) === undefined) {
        checkedFonts.set(key, retries, true);
        if (!isAvailable(font.style, font.weight, family)) {
          checkedFonts.set(key, 0, true);
          if (interval === undefined) {
            interval = setInterval(check, 32);
          }
        }
      }
    }
  };
})();

/**
 * @param {string} font Font to use for measuring.
 * @return {import("../size").Size} Measurement.
 */
export const measureTextHeight = (function () {
  /**
   * @type {HTMLDivElement}
   */
  let measureElement: HTMLDivElement;
  return function (fontSpec: string) {
    let height = textHeights[fontSpec];
    if (height == undefined) {
      if (WORKER_OFFSCREEN_CANVAS) {
        const font = getFontParameters(fontSpec);
        const metrics = measureText(fontSpec, 'Žg');
        const lineHeight = isNaN(Number(font.lineHeight))
          ? 1.2
          : Number(font.lineHeight);
        height =
          lineHeight *
          (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
      } else {
        if (!measureElement) {
          measureElement = document.createElement('div');
          measureElement.innerHTML = 'M';
          measureElement.style.minHeight = '0';
          measureElement.style.maxHeight = 'none';
          measureElement.style.height = 'auto';
          measureElement.style.padding = '0';
          measureElement.style.border = 'none';
          measureElement.style.position = 'absolute';
          measureElement.style.display = 'block';
          measureElement.style.left = '-99999px';
        }
        measureElement.style.font = fontSpec;
        document.body.appendChild(measureElement);
        height = measureElement.offsetHeight;
        document.body.removeChild(measureElement);
      }
      textHeights[fontSpec] = height;
    }
    return height;
  };
})();

/**
 * @param {string} font Font.
 * @param {string} text Text.
 * @return {TextMetrics} Text metrics.
 */
function measureText(font: string, text: string): TextMetrics {
  if (!measureContext) {
    measureContext = <CanvasRenderingContext2D>createCanvasContext2D(1, 1);
  }
  if (font != measureFont) {
    measureContext.font = font;
    measureFont = measureContext.font;
  }
  return measureContext.measureText(text);
}

/**
 * @param {string} font Font.
 * @param {string} text Text.
 * @return {number} Width.
 */
export function measureTextWidth(font, text) {
  return measureText(font, text).width;
}

/**
 * Measure text width using a cache.
 * @param {string} font The font.
 * @param {string} text The text to measure.
 * @param {Object<string, number>} cache A lookup of cached widths by text.
 * @return {number} The text width.
 */
export function measureAndCacheTextWidth(font, text, cache) {
  if (text in cache) {
    return cache[text];
  }
  const width = text
    .split('\n')
    .reduce((prev, curr) => Math.max(prev, measureTextWidth(font, curr)), 0);
  cache[text] = width;
  return width;
}

/**
 * @param {TextState} baseStyle Base style.
 * @param {Array<string>} chunks Text chunks to measure.
 * @return {{width: number, height: number, widths: Array<number>, heights: Array<number>, lineWidths: Array<number>}}} Text metrics.
 */
export function getTextDimensions(baseStyle, chunks) {
  const widths = [];
  const heights = [];
  const lineWidths = [];
  let width = 0;
  let lineWidth = 0;
  let height = 0;
  let lineHeight = 0;
  for (let i = 0, ii = chunks.length; i <= ii; i += 2) {
    const text = chunks[i];
    if (text === '\n' || i === ii) {
      width = Math.max(width, lineWidth);
      lineWidths.push(lineWidth);
      lineWidth = 0;
      height += lineHeight;
      continue;
    }
    const font = chunks[i + 1] || baseStyle.font;
    const currentWidth = measureTextWidth(font, text);
    widths.push(currentWidth);
    lineWidth += currentWidth;
    const currentHeight = measureTextHeight(font);
    heights.push(currentHeight);
    lineHeight = Math.max(lineHeight, currentHeight);
  }
  return {width, height, widths, heights, lineWidths};
}

/**
 * @param {CanvasRenderingContext2D} context Context.
 * @param {number} rotation Rotation.
 * @param {number} offsetX X offset.
 * @param {number} offsetY Y offset.
 */
export function rotateAtOffset(context, rotation, offsetX, offsetY) {
  if (rotation !== 0) {
    context.translate(offsetX, offsetY);
    context.rotate(rotation);
    context.translate(-offsetX, -offsetY);
  }
}

/**
 * @param {CanvasRenderingContext2D} context Context.
 * @param {import("../transform").Transform|null} transform Transform.
 * @param {number} opacity Opacity.
 * @param {Label|HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} labelOrImage Label.
 * @param {number} originX Origin X.
 * @param {number} originY Origin Y.
 * @param {number} w Width.
 * @param {number} h Height.
 * @param {number} x X.
 * @param {number} y Y.
 * @param {import("../size").Size} scale Scale.
 */
export function drawImageOrLabel(
  context,
  transform,
  opacity,
  labelOrImage,
  originX,
  originY,
  w,
  h,
  x,
  y,
  scale
) {
  context.save();

  if (opacity !== 1) {
    context.globalAlpha *= opacity;
  }
  if (transform) {
    context.setTransform.apply(context, transform);
  }

  if (/** @type {*} */ (labelOrImage).contextInstructions) {
    // label
    context.translate(x, y);
    context.scale(scale[0], scale[1]);
    executeLabelInstructions(/** @type {Label} */ (labelOrImage), context);
  } else if (scale[0] < 0 || scale[1] < 0) {
    // flipped image
    context.translate(x, y);
    context.scale(scale[0], scale[1]);
    context.drawImage(
      /** @type {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} */ (
        labelOrImage
      ),
      originX,
      originY,
      w,
      h,
      0,
      0,
      w,
      h
    );
  } else {
    // if image not flipped translate and scale can be avoided
    context.drawImage(
      /** @type {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} */ (
        labelOrImage
      ),
      originX,
      originY,
      w,
      h,
      x,
      y,
      w * scale[0],
      h * scale[1]
    );
  }

  context.restore();
}

/**
 * @param {Label} label Label.
 * @param {CanvasRenderingContext2D} context Context.
 */
function executeLabelInstructions(label, context) {
  const contextInstructions = label.contextInstructions;
  for (let i = 0, ii = contextInstructions.length; i < ii; i += 2) {
    if (Array.isArray(contextInstructions[i + 1])) {
      context[contextInstructions[i]].apply(
        context,
        contextInstructions[i + 1]
      );
    } else {
      context[contextInstructions[i]] = contextInstructions[i + 1];
    }
  }
}
