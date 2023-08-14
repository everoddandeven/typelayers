/**
 * @module ol/proj/transforms
 */
import {isEmpty} from '../obj';
import Projection from "./Projection";
import {TransformFunction} from "../proj";

/**
 * @private
 * @type {!Object<string, Object<string, import("../proj").TransformFunction>>}
 */
let transforms: {[key: string]: {[key: string]: TransformFunction}} = {};

/**
 * Clear the transform cache.
 */
export function clear() {
  transforms = {};
}

/**
 * Registers a conversion function to convert coordinates from the source
 * projection to the destination projection.
 *
 * @param {import("./Projection").default} source Source.
 * @param {import("./Projection").default} destination Destination.
 * @param {import("../proj").TransformFunction} transformFn Transform.
 */
export function add(source: Projection, destination: Projection, transformFn: TransformFunction): void {
  const sourceCode = source.getCode();
  const destinationCode = destination.getCode();
  if (!(sourceCode in transforms)) {
    transforms[sourceCode] = {};
  }
  transforms[sourceCode][destinationCode] = transformFn;
}

/**
 * Unregisters the conversion function to convert coordinates from the source
 * projection to the destination projection.  This method is used to clean up
 * cached transforms during testing.
 *
 * @param {import("./Projection").default} source Source projection.
 * @param {import("./Projection").default} destination Destination projection.
 * @return {import("../proj").TransformFunction} transformFn The unregistered transform.
 */
export function remove(source, destination) {
  const sourceCode = source.getCode();
  const destinationCode = destination.getCode();
  const transform = transforms[sourceCode][destinationCode];
  delete transforms[sourceCode][destinationCode];
  if (isEmpty(transforms[sourceCode])) {
    delete transforms[sourceCode];
  }
  return transform;
}

/**
 * Get a transform given a source code and a destination code.
 * @param {string} sourceCode The code for the source projection.
 * @param {string} destinationCode The code for the destination projection.
 * @return {import("../proj").TransformFunction|undefined} The transform function (if found).
 */
export function get(sourceCode: string, destinationCode: string): TransformFunction | null {
  let transform: TransformFunction;
  if (sourceCode in transforms && destinationCode in transforms[sourceCode]) {
    transform = transforms[sourceCode][destinationCode];
  }
  return transform;
}
