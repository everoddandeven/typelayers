/**
 * @module tl/obj
 */

/**
 * Removes all properties from an object.
 * @param {Object} object The object to clear.
 */
export function clear(object: Object): void {
  for (const property in object) {
    delete object[property];
  }
}

/**
 * Determine if an object has any properties.
 * @param {Object} object The object to check.
 * @return {boolean} The object is empty.
 */
export function isEmpty(object: Object): boolean {
  let property: string;

  for(let prop in object) {
    property = prop;
    return false;
  }

  return !property;
}
