/**
 * @module ol/TileRange
 */

import {TileCoord} from "./tilecoord";

/**
 * A representation of a contiguous block of tiles.  A tile range is specified
 * by its min/max tile coordinates and is inclusive of coordinates.
 */
export default class TileRange {
  /**
   * @param {number} minX Minimum X.
   * @param {number} maxX Maximum X.
   * @param {number} minY Minimum Y.
   * @param {number} maxY Maximum Y.
   */

  public minX: number;
  public maxX: number;
  public minY: number;
  public maxY: number;

  constructor(minX: number, maxX: number, minY: number, maxY: number) {
    /**
     * @type {number}
     */
    this.minX = minX;

    /**
     * @type {number}
     */
    this.maxX = maxX;

    /**
     * @type {number}
     */
    this.minY = minY;

    /**
     * @type {number}
     */
    this.maxY = maxY;
  }

  /**
   * @param {import("./tilecoord").TileCoord} tileCoord Tile coordinate.
   * @return {boolean} Contains tile coordinate.
   */
  public contains(tileCoord: TileCoord): boolean {
    return this.containsXY(tileCoord[1], tileCoord[2]);
  }

  /**
   * @param {TileRange} tileRange Tile range.
   * @return {boolean} Contains.
   */
  public containsTileRange(tileRange: TileRange): boolean {
    return (
      this.minX <= tileRange.minX &&
      tileRange.maxX <= this.maxX &&
      this.minY <= tileRange.minY &&
      tileRange.maxY <= this.maxY
    );
  }

  /**
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @return {boolean} Contains coordinate.
   */
  public containsXY(x: number, y: number): boolean {
    return this.minX <= x && x <= this.maxX && this.minY <= y && y <= this.maxY;
  }

  /**
   * @param {TileRange} tileRange Tile range.
   * @return {boolean} Equals.
   */
  public equals(tileRange: TileRange): boolean {
    return (
      this.minX == tileRange.minX &&
      this.minY == tileRange.minY &&
      this.maxX == tileRange.maxX &&
      this.maxY == tileRange.maxY
    );
  }

  /**
   * @param {TileRange} tileRange Tile range.
   */
  public extend(tileRange: TileRange): void {
    if (tileRange.minX < this.minX) {
      this.minX = tileRange.minX;
    }
    if (tileRange.maxX > this.maxX) {
      this.maxX = tileRange.maxX;
    }
    if (tileRange.minY < this.minY) {
      this.minY = tileRange.minY;
    }
    if (tileRange.maxY > this.maxY) {
      this.maxY = tileRange.maxY;
    }
  }

  /**
   * @return {number} Height.
   */
  public getHeight(): number {
    return this.maxY - this.minY + 1;
  }

  /**
   * @return {import("./size").Size} Size.
   */
  public getSize(): number[] {
    return [this.getWidth(), this.getHeight()];
  }

  /**
   * @return {number} Width.
   */
  public getWidth(): number {
    return this.maxX - this.minX + 1;
  }

  /**
   * @param {TileRange} tileRange Tile range.
   * @return {boolean} Intersects.
   */
  public intersects(tileRange: TileRange): boolean {
    return (
      this.minX <= tileRange.maxX &&
      this.maxX >= tileRange.minX &&
      this.minY <= tileRange.maxY &&
      this.maxY >= tileRange.minY
    );
  }
}

/**
 * @param {number} minX Minimum X.
 * @param {number} maxX Maximum X.
 * @param {number} minY Minimum Y.
 * @param {number} maxY Maximum Y.
 * @param {TileRange} [tileRange] TileRange.
 * @return {TileRange} Tile range.
 */
export function createOrUpdate(minX: number, maxX: number, minY: number, maxY: number, tileRange: TileRange): TileRange {
  if (tileRange !== undefined) {
    tileRange.minX = minX;
    tileRange.maxX = maxX;
    tileRange.minY = minY;
    tileRange.maxY = maxY;
    return tileRange;
  }
  return new TileRange(minX, maxX, minY, maxY);
}