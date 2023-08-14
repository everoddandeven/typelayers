/**
 * @module ol/rotationconstraint
 */
import {toRadians} from './math';

export type RotationConstraintType = (rotation: number | undefined, isMoving?: boolean) => number | undefined

/**
 * @param {number|undefined} rotation Rotation.
 * @return {number|undefined} Rotation.
 */
export function disable(rotation?: number): number | undefined {
  if (rotation !== undefined) {
    return 0;
  }
  return undefined;
}

/**
 * @param {number|undefined} rotation Rotation.
 * @return {number|undefined} Rotation.
 */
export function none(rotation?: number): number | undefined {
  if (rotation !== undefined) {
    return rotation;
  }
  return undefined;
}

/**
 * @param {number} n N.
 * @return {Type} Rotation constraint.
 */
export function createSnapToN(n: number): RotationConstraintType {
  const theta = (2 * Math.PI) / n;
  return (
    /**
     * @param {number|undefined} rotation Rotation.
     * @param {boolean} [isMoving] True if an interaction or animation is in progress.
     * @return {number|undefined} Rotation.
     */
    function (rotation?: number, isMoving?: boolean): number | undefined {
      if (isMoving) {
        return rotation;
      }

      if (rotation !== undefined) {
        rotation = Math.floor(rotation / theta + 0.5) * theta;
        return rotation;
      }
      return undefined;
    }
  );
}

/**
 * @param {number} [tolerance] Tolerance.
 * @return {Type} Rotation constraint.
 */
export function createSnapToZero(tolerance?: number): RotationConstraintType {
  tolerance = tolerance || toRadians(5);
  return (
    /**
     * @param {number|undefined} rotation Rotation.
     * @param {boolean} [isMoving] True if an interaction or animation is in progress.
     * @return {number|undefined} Rotation.
     */
    function (rotation?: number, isMoving?: boolean): number | undefined {
      if (isMoving) {
        return rotation;
      }

      if (rotation !== undefined) {
        if (Math.abs(rotation) <= tolerance) {
          return 0;
        }
        return rotation;
      }
      return undefined;
    }
  );
}
