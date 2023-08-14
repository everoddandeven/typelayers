/**
 * @module ol/proj/projections
 */

import Projection from "./Projection";

/**
 * @type {Object<string, import("./Projection").default>}
 */
let cache: {[key: string]: Projection} = {};

/**
 * Clear the projections cache.
 */
export function clear(): void {
  cache = {};
}

/**
 * Get a cached projection by code.
 * @param {string} code The code for the projection.
 * @return {import("./Projection").default} The projection (if cached).
 */
export function get(code: string): Projection {
  return (
    cache[code] ||
    cache[code.replace(/urn:(x-)?ogc:def:crs:EPSG:(.*:)?(\w+)$/, 'EPSG:$3')] ||
    null
  );
}

/**
 * Add a projection to the cache.
 * @param {string} code The projection code.
 * @param {import("./Projection").default} projection The projection to cache.
 */
export function add(code: string, projection: Projection): void {
  cache[code] = projection;
}
