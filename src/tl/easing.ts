/**
 * @module tl/easing
 */

/**
 * Start slow and speed up.
 * @param {number} t Input between 0 and 1.
 * @return {number} Output between 0 and 1.
 * @api
 */
export function easeIn(t: number): number {
  return Math.pow(t, 3);
}

/**
 * Start fast and slow down.
 * @param {number} t Input between 0 and 1.
 * @return {number} Output between 0 and 1.
 * @api
 */
export function easeOut(t: number): number {
  return 1 - easeIn(1 - t);
}

/**
 * Start slow, speed up, and then slow down again.
 * @param {number} t Input between 0 and 1.
 * @return {number} Output between 0 and 1.
 * @api
 */
export function inAndOut(t: number): number {
  return 3 * t * t - 2 * t * t * t;
}

/**
 * Maintain a constant speed over time.
 * @param {number} t Input between 0 and 1.
 * @return {number} Output between 0 and 1.
 * @api
 */
export function linear(t: number): number {
  return t;
}

/**
 * Start slow, speed up, and at the very end slow down again.  This has the
 * same general behavior as {@link module:tl/easing.inAndOut}, but the final
 * slowdown is delayed.
 * @param {number} t Input between 0 and 1.
 * @return {number} Output between 0 and 1.
 * @api
 */
export function upAndDown(t: number): number {
  if (t < 0.5) {
    return inAndOut(2 * t);
  }
  return 1 - inAndOut(2 * (t - 0.5));
}
