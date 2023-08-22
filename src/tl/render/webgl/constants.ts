/**
 * @module tl/render/webgl/constants
 */

/**
 * @enum {string}
 */
import {Transform} from "../../transform";

export enum WebGLWorkerMessageType {
  GENERATE_POLYGON_BUFFERS = 'GENERATE_POLYGON_BUFFERS',
  GENERATE_POINT_BUFFERS = 'GENERATE_POINT_BUFFERS',
  GENERATE_LINE_STRING_BUFFERS = 'GENERATE_LINE_STRING_BUFFERS',
}

export interface WebGLWorkerGenerateBuffersMessage {
  id: number
  type: WebGLWorkerMessageType
  renderInstructions: ArrayBuffer
  customAttributesSize?: number
  vertexBuffer?: ArrayBuffer
  indexBuffer?: ArrayBuffer
  renderInstructionsTransform?: Transform
}
