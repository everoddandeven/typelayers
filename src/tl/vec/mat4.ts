/**
 * @module tl/vec/mat4
 */

import {Transform} from "../transform";

/**
 * @return {Array<number>} "4x4 matrix representing a 3D identity transform."
 */
export function create(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/**
 * @param {Array<number>} mat4 Flattened 4x4 matrix receiving the result.
 * @param {import("../transform").Transform} transform Transformation matrix.
 * @return {Array<number>} "2D transformation matrix as flattened 4x4 matrix."
 */
export function fromTransform(mat4: number[], transform: Transform): number[] {
  mat4[0] = transform[0];
  mat4[1] = transform[1];
  mat4[4] = transform[2];
  mat4[5] = transform[3];
  mat4[12] = transform[4];
  mat4[13] = transform[5];
  return mat4;
}
