/**
 * @module ol/geom/flat/inflate
 */

import {Coordinate, Coordinates, FlatCoordinates} from "../../coordinate";

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {Array<import("../../coordinate").Coordinate>} [coordinates] Coordinates.
 * @return {Array<import("../../coordinate").Coordinate>} Coordinates.
 */
export function inflateCoordinates(
  flatCoordinates: FlatCoordinates,
  offset: number,
  end: number,
  stride: number,
  coordinates?: Coordinates
): Coordinates {
  coordinates = coordinates !== undefined ? coordinates : [];
  let i = 0;
  for (let j = offset; j < end; j += stride) {
    coordinates[i++] = <Coordinate>flatCoordinates.slice(j, j + stride);
  }
  coordinates.length = i;
  return coordinates;
}

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<number>} ends Ends.
 * @param {number} stride Stride.
 * @param {Array<Array<import("../../coordinate").Coordinate>>} [coordinatess] Coordinatess.
 * @return {Array<Array<import("../../coordinate").Coordinate>>} Coordinatess.
 */
export function inflateCoordinatesArray(
  flatCoordinates: FlatCoordinates,
  offset: number,
  ends: FlatCoordinates,
  stride: number,
  coordinatess?: Coordinates[]
): Coordinates[] {
  coordinatess = coordinatess !== undefined ? coordinatess : [];
  let i = 0;
  for (let j = 0, jj = ends.length; j < jj; ++j) {
    const end = ends[j];
    coordinatess[i++] = inflateCoordinates(
      flatCoordinates,
      offset,
      end,
      stride,
      coordinatess[i]
    );
    offset = end;
  }
  coordinatess.length = i;
  return coordinatess;
}

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<Array<number>>} endss Endss.
 * @param {number} stride Stride.
 * @param {Array<Array<Array<import("../../coordinate").Coordinate>>>} [coordinatesss]
 *     Coordinatesss.
 * @return {Array<Array<Array<import("../../coordinate").Coordinate>>>} Coordinatesss.
 */
export function inflateMultiCoordinatesArray(
  flatCoordinates,
  offset,
  endss,
  stride,
  coordinatesss?
) {
  coordinatesss = coordinatesss !== undefined ? coordinatesss : [];
  let i = 0;
  for (let j = 0, jj = endss.length; j < jj; ++j) {
    const ends = endss[j];
    coordinatesss[i++] =
      ends.length === 1 && ends[0] === offset
        ? []
        : inflateCoordinatesArray(
            flatCoordinates,
            offset,
            ends,
            stride,
            coordinatesss[i]
          );
    offset = ends[ends.length - 1];
  }
  coordinatesss.length = i;
  return coordinatesss;
}
