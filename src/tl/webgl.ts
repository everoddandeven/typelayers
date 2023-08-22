/**
 * @module tl/webgl
 */

import {SAFARI_BUG_237906} from './has';

/**
 * Constants taken from goog.webgl
 */

/**
 * Used by {@link module:tl/webgl/Helper~WebGLHelper} for buffers containing vertices data, such as
 * position, color, texture coordinate, etc. These vertices are then referenced by an index buffer
 * to be drawn on screen (see {@link module:tl/webgl.ELEMENT_ARRAY_BUFFER}).
 * @const
 * @type {number}
 * @api
 */
export const ARRAY_BUFFER: number = 0x8892;

/**
 * Used by {@link module:tl/webgl/Helper~WebGLHelper} for buffers containing indices data.
 * Index buffers are essentially lists of references to vertices defined in a vertex buffer
 * (see {@link module:tl/webgl.ARRAY_BUFFER}), and define the primitives (triangles) to be drawn.
 * @const
 * @type {number}
 * @api
 */
export const ELEMENT_ARRAY_BUFFER: number = 0x8893;

/**
 * Used by {link module:tl/webgl/Buffer~WebGLArrayBuffer}.
 * @const
 * @type {number}
 * @api
 */
export const STREAM_DRAW: number = 0x88e0;

/**
 * Used by {link module:tl/webgl/Buffer~WebGLArrayBuffer}.
 * @const
 * @type {number}
 * @api
 */
export const STATIC_DRAW: number = 0x88e4;

/**
 * Used by {link module:tl/webgl/Buffer~WebGLArrayBuffer}.
 * @const
 * @type {number}
 * @api
 */
export const DYNAMIC_DRAW: number = 0x88e8;

/**
 * @const
 * @type {number}
 */
export const UNSIGNED_BYTE: number = 0x1401;

/**
 * @const
 * @type {number}
 */
export const UNSIGNED_SHORT: number = 0x1403;

/**
 * @const
 * @type {number}
 */
export const UNSIGNED_INT: number = 0x1405;

/**
 * @const
 * @type {number}
 */
export const FLOAT: number = 0x1406;

/** end of goog.webgl constants
 */

/**
 * @const
 * @type {Array<string>}
 */
const CONTEXT_IDS: string[] = ['experimental-webgl', 'webgl', 'webkit-3d', 'moz-webgl'];

/**
 * @param {HTMLCanvasElement} canvas Canvas.
 * @param {Object} [attributes] Attributes.
 * @return {WebGLRenderingContext} WebGL rendering context.
 */
export function getContext(canvas: HTMLCanvasElement, attributes?: {[key: string]: any}): WebGLRenderingContext {
  attributes = Object.assign(
    {
      preserveDrawingBuffer: true,
      antialias: !SAFARI_BUG_237906, // https://bugs.webkit.org/show_bug.cgi?id=237906
    },
    attributes
  );
  const ii = CONTEXT_IDS.length;
  for (let i = 0; i < ii; ++i) {
    try {
      const context = canvas.getContext(CONTEXT_IDS[i], attributes);
      if (context) {
        return /** @type {!WebGLRenderingContext} */ (<WebGLRenderingContext>context);
      }
    } catch (e) {
      // pass
    }
  }
  return null;
}

/**
 * @type {Array<string>}
 */
let supportedExtensions: string[];

/**
 * @return {Array<string>} List of supported WebGL extensions.
 */
export function getSupportedExtensions(): string[] {
  if (!supportedExtensions) {
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    const gl: WebGLRenderingContext = getContext(canvas);
    if (gl instanceof WebGLRenderingContext) {
      supportedExtensions = gl.getSupportedExtensions();
    }
  }
  return supportedExtensions;
}
