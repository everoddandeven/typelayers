/**
 * @module tl/extent/Relationship
 */

/**
 * Relationship to an extent.
 * @enum {number}
 */
export enum Relationship {
  UNKNOWN = 0,
  INTERSECTING = 1,
  ABOVE = 2,
  RIGHT = 4,
  BELOW = 8,
  LEFT = 16,
}


export default Relationship;