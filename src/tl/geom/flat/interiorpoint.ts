/**
 * @module tl/geom/flat/interiorpoint
 */
import {ascending} from '../../array';
import {linearRingsContainsXY} from './contains';
import {FlatCoordinates, XYCoordinate} from "../../coordinate";

/**
 * Calculates a point that is likely to lie in the interior of the linear rings.
 * Inspired by JTS's com.vividsolutions.jts.geom.Geometry#getInteriorPoint.
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<number>} ends Ends.
 * @param {number} stride Stride.
 * @param {Array<number>} flatCenters Flat centers.
 * @param {number} flatCentersOffset Flat center offset.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Destination point as XYM coordinate, where M is the
 * length of the horizontal intersection that the point belongs to.
 */
export function getInteriorPointOfArray(
  flatCoordinates: FlatCoordinates,
  offset: number,
  ends: FlatCoordinates,
  stride: number,
  flatCenters: FlatCoordinates,
  flatCentersOffset: number,
  dest?: FlatCoordinates
): FlatCoordinates {
  let i: number, ii: number, x: number, x1: number, x2: number, y1: number, y2: number;
  const y: number = flatCenters[flatCentersOffset + 1];
  /** @type {Array<number>} */
  const intersections: number[] = [];
  // Calculate intersections with the horizontal line
  for (let r: number = 0, rr: number = ends.length; r < rr; ++r) {
    const end: number = ends[r];
    x1 = flatCoordinates[end - stride];
    y1 = flatCoordinates[end - stride + 1];
    for (i = offset; i < end; i += stride) {
      x2 = flatCoordinates[i];
      y2 = flatCoordinates[i + 1];
      if ((y <= y1 && y2 <= y) || (y1 <= y && y <= y2)) {
        x = ((y - y1) / (y2 - y1)) * (x2 - x1) + x1;
        intersections.push(x);
      }
      x1 = x2;
      y1 = y2;
    }
  }
  // Find the longest segment of the horizontal line that has its center point
  // inside the linear ring.
  let pointX: number = NaN;
  let maxSegmentLength: number = -Infinity;
  intersections.sort(ascending);
  x1 = intersections[0];
  for (i = 1, ii = intersections.length; i < ii; ++i) {
    x2 = intersections[i];
    const segmentLength: number = Math.abs(x2 - x1);
    if (segmentLength > maxSegmentLength) {
      x = (x1 + x2) / 2;
      if (linearRingsContainsXY(flatCoordinates, offset, ends, stride, x, y)) {
        pointX = x;
        maxSegmentLength = segmentLength;
      }
    }
    x1 = x2;
  }
  if (isNaN(pointX)) {
    // There is no horizontal line that has its center point inside the linear
    // ring.  Use the center of the linear ring's extent.
    pointX = flatCenters[flatCentersOffset];
  }
  if (dest) {
    dest.push(pointX, y, maxSegmentLength);
    return dest;
  }
  return [pointX, y, maxSegmentLength];
}

export function getInteriorPointXYCoordinateOfArray(
    flatCoordinates: FlatCoordinates,
    offset: number,
    ends: FlatCoordinates,
    stride: number,
    flatCenters: FlatCoordinates,
    flatCentersOffset: number,
    dest?: FlatCoordinates
): XYCoordinate
{
  return <XYCoordinate>getInteriorPointOfArray(
      flatCoordinates,
      offset,
      ends,
      stride,
      flatCenters,
      flatCentersOffset,
      dest
  );
}

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<Array<number>>} endss Endss.
 * @param {number} stride Stride.
 * @param {Array<number>} flatCenters Flat centers.
 * @return {Array<number>} Interior points as XYM coordinates, where M is the
 * length of the horizontal intersection that the point belongs to.
 */
export function getInteriorPointsOfMultiArray(
  flatCoordinates: FlatCoordinates,
  offset: number,
  endss: FlatCoordinates[],
  stride: number,
  flatCenters: FlatCoordinates
): number[] {
  let interiorPoints: number[] = [];
  for (let i: number = 0, ii: number = endss.length; i < ii; ++i) {
    const ends: FlatCoordinates = endss[i];
    interiorPoints = getInteriorPointOfArray(
      flatCoordinates,
      offset,
      ends,
      stride,
      flatCenters,
      2 * i,
      interiorPoints
    );
    offset = ends[ends.length - 1];
  }
  return interiorPoints;
}
