/**
 * @module tl/geom/flat/transform
 */

import {FlatCoordinates} from "../../coordinate";

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {import("../../transform").Transform} transform Transform.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Transformed coordinates.
 */
export function transform2D(
  flatCoordinates: FlatCoordinates,
  offset: number,
  end: number,
  stride: number,
  transform: Transform,
  dest: number[]
): number[] {
  dest = dest ? dest : [];
  let i: number = 0;
  for (let j: number = offset; j < end; j += stride) {
    const x: number = flatCoordinates[j];
    const y: number = flatCoordinates[j + 1];
    dest[i++] = transform[0] * x + transform[2] * y + transform[4];
    dest[i++] = transform[1] * x + transform[3] * y + transform[5];
  }
  if (dest && dest.length != i) {
    dest.length = i;
  }
  return dest;
}

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {number} angle Angle.
 * @param {Array<number>} anchor Rotation anchor point.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Transformed coordinates.
 */
export function rotate(
  flatCoordinates: FlatCoordinates,
  offset: number,
  end: number,
  stride: number,
  angle: number,
  anchor: number[],
  dest: number[]
): number[] {
  dest = dest ? dest : [];
  const cos: number = Math.cos(angle);
  const sin: number = Math.sin(angle);
  const anchorX: number = anchor[0];
  const anchorY: number = anchor[1];
  let i: number = 0;
  for (let j: number = offset; j < end; j += stride) {
    const deltaX: number = flatCoordinates[j] - anchorX;
    const deltaY: number = flatCoordinates[j + 1] - anchorY;
    dest[i++] = anchorX + deltaX * cos - deltaY * sin;
    dest[i++] = anchorY + deltaX * sin + deltaY * cos;
    for (let k: number = j + 2; k < j + stride; ++k) {
      dest[i++] = flatCoordinates[k];
    }
  }
  if (dest && dest.length != i) {
    dest.length = i;
  }
  return dest;
}

/**
 * Scale the coordinates.
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {number} sx Scale factor in the x-direction.
 * @param {number} sy Scale factor in the y-direction.
 * @param {Array<number>} anchor Scale anchor point.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Transformed coordinates.
 */
export function scale(
  flatCoordinates: FlatCoordinates,
  offset: number,
  end: number,
  stride: number,
  sx: number,
  sy: number,
  anchor: number[],
  dest: number[]
): number[] {
  dest = dest ? dest : [];
  const anchorX: number = anchor[0];
  const anchorY: number = anchor[1];
  let i: number = 0;
  for (let j: number = offset; j < end; j += stride) {
    const deltaX: number = flatCoordinates[j] - anchorX;
    const deltaY: number = flatCoordinates[j + 1] - anchorY;
    dest[i++] = anchorX + sx * deltaX;
    dest[i++] = anchorY + sy * deltaY;
    for (let k: number = j + 2; k < j + stride; ++k) {
      dest[i++] = flatCoordinates[k];
    }
  }
  if (dest && dest.length != i) {
    dest.length = i;
  }
  return dest;
}

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {number} deltaX Delta X.
 * @param {number} deltaY Delta Y.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Transformed coordinates.
 */
export function translate(
  flatCoordinates: FlatCoordinates,
  offset: number,
  end: number,
  stride: number,
  deltaX: number,
  deltaY: number,
  dest: number[]
): number[] {
  dest = dest ? dest : [];
  let i: number = 0;
  for (let j: number = offset; j < end; j += stride) {
    dest[i++] = flatCoordinates[j] + deltaX;
    dest[i++] = flatCoordinates[j + 1] + deltaY;
    for (let k: number = j + 2; k < j + stride; ++k) {
      dest[i++] = flatCoordinates[k];
    }
  }
  if (dest && dest.length != i) {
    dest.length = i;
  }
  return dest;
}
