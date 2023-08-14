/**
 * @module ol/colorlike
 */
import {Color, toString} from './color';

/**
 * A type accepted by CanvasRenderingContext2D.fillStyle
 * or CanvasRenderingContext2D.strokeStyle.
 * Represents a color, pattern, or gradient. The origin for patterns and
 * gradients as fill style is an increment of 512 css pixels from map coordinate
 * `[0, 0]`. For seamless repeat patterns, width and height of the pattern image
 * must be a factor of two (2, 4, 8, ..., 512).
 *
 * @typedef {string|CanvasPattern|CanvasGradient} ColorLike
 * @api
 */

export type ColorLike = string | CanvasPattern | CanvasGradient;
let a = "".slice();
let b = a.slice()

/**
 * @param {import("./color").Color|ColorLike} color Color.
 * @return {ColorLike} The color as an {@link ol/colorlike~ColorLike}.
 * @api
 */
export function asColorLike(color: ColorLike | Color): ColorLike {
  if (Array.isArray(color)) {
    return toString(color);
  }
  return color;
}
