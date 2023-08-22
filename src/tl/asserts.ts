/**
 * @module tl/asserts
 */
import AssertionError from './AssertionError';

/**
 * @param {*} assertion Assertion we expected to be truthy.
 * @param {number} errorCode Error code.
 */
export function assert(assertion: any, errorCode: number): void {
  if (!assertion) {
    throw new AssertionError(errorCode);
  }
}
