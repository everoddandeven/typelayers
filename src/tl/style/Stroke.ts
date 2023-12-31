/**
 * @module tl/style/Stroke
 */

import {ColorLike} from "../colorlike";
import {Color} from "../color";

export interface StrokeOptions
{
  color?: Color | ColorLike;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  lineDash?: number[];
  lineDashOffset?: number;
  miterLimit?: number;
  width?: number;
}

/**
 * @classdesc
 * Set stroke style for vector features.
 * Note that the defaults given are the Canvas defaults, which will be used if
 * option is not defined. The `get` functions return whatever was entered in
 * the options; they will not return the default.
 * @api
 */
class Stroke {
  /**
   * @param {Options} [options] Options.
   */

  private color_?: Color | ColorLike;
  private lineCap_?: CanvasLineCap;
  private lineJoin_?: CanvasLineJoin;
  private lineDash_?: number[];
  private lineDashOffset_?: number;
  private miterLimit_?: number;
  private width_?: number;

  constructor(options: StrokeOptions) {
    options = options || {};

    /**
     * @private
     * @type {import("../color").Color|import("../colorlike").ColorLike}
     */
    this.color_ = options.color !== undefined ? options.color : null;

    /**
     * @private
     * @type {CanvasLineCap|undefined}
     */
    this.lineCap_ = options.lineCap;

    /**
     * @private
     * @type {Array<number>|null}
     */
    this.lineDash_ = options.lineDash !== undefined ? options.lineDash : null;

    /**
     * @private
     * @type {number|undefined}
     */
    this.lineDashOffset_ = options.lineDashOffset;

    /**
     * @private
     * @type {CanvasLineJoin|undefined}
     */
    this.lineJoin_ = options.lineJoin;

    /**
     * @private
     * @type {number|undefined}
     */
    this.miterLimit_ = options.miterLimit;

    /**
     * @private
     * @type {number|undefined}
     */
    this.width_ = options.width;
  }

  /**
   * Clones the style.
   * @return {Stroke} The cloned style.
   * @api
   */
  public clone(): Stroke {
    const color: Color | ColorLike = this.getColor();
    return new Stroke({
      color: Array.isArray(color) ? <Color>color.slice() : color || undefined,
      lineCap: this.getLineCap(),
      lineDash: this.getLineDash() ? this.getLineDash().slice() : undefined,
      lineDashOffset: this.getLineDashOffset(),
      lineJoin: this.getLineJoin(),
      miterLimit: this.getMiterLimit(),
      width: this.getWidth(),
    });
  }

  /**
   * Get the stroke color.
   * @return {import("../color").Color|import("../colorlike").ColorLike} Color.
   * @api
   */
  public getColor(): Color | ColorLike {
    return this.color_;
  }

  /**
   * Get the line cap type for the stroke.
   * @return {CanvasLineCap|undefined} Line cap.
   * @api
   */
  public getLineCap(): CanvasLineCap {
    return this.lineCap_;
  }

  /**
   * Get the line dash style for the stroke.
   * @return {Array<number>|null} Line dash.
   * @api
   */
  public getLineDash(): number[] {
    return this.lineDash_;
  }

  /**
   * Get the line dash offset for the stroke.
   * @return {number|undefined} Line dash offset.
   * @api
   */
  public getLineDashOffset(): number {
    return this.lineDashOffset_;
  }

  /**
   * Get the line join type for the stroke.
   * @return {CanvasLineJoin|undefined} Line join.
   * @api
   */
  public getLineJoin(): CanvasLineJoin {
    return this.lineJoin_;
  }

  /**
   * Get the miter limit for the stroke.
   * @return {number|undefined} Miter limit.
   * @api
   */
  public getMiterLimit(): number {
    return this.miterLimit_;
  }

  /**
   * Get the stroke width.
   * @return {number|undefined} Width.
   * @api
   */
  public getWidth(): number {
    return this.width_;
  }

  /**
   * Set the color.
   *
   * @param {import("../color").Color|import("../colorlike").ColorLike} color Color.
   * @api
   */
  public setColor(color: Color | ColorLike): void {
    this.color_ = color;
  }

  /**
   * Set the line cap.
   *
   * @param {CanvasLineCap|undefined} lineCap Line cap.
   * @api
   */
  public setLineCap(lineCap?: CanvasLineCap): void {
    this.lineCap_ = lineCap;
  }

  /**
   * Set the line dash.
   *
   * @param {Array<number>|null} lineDash Line dash.
   * @api
   */
  public setLineDash(lineDash?: number[]): void {
    this.lineDash_ = lineDash;
  }

  /**
   * Set the line dash offset.
   *
   * @param {number|undefined} lineDashOffset Line dash offset.
   * @api
   */
  public setLineDashOffset(lineDashOffset?: number): void {
    this.lineDashOffset_ = lineDashOffset;
  }

  /**
   * Set the line join.
   *
   * @param {CanvasLineJoin|undefined} lineJoin Line join.
   * @api
   */
  public setLineJoin(lineJoin: CanvasLineJoin): void {
    this.lineJoin_ = lineJoin;
  }

  /**
   * Set the miter limit.
   *
   * @param {number|undefined} miterLimit Miter limit.
   * @api
   */
  public setMiterLimit(miterLimit?: number): void {
    this.miterLimit_ = miterLimit;
  }

  /**
   * Set the width.
   *
   * @param {number|undefined} width Width.
   * @api
   */
  public setWidth(width?: number): void {
    this.width_ = width;
  }
}

export default Stroke;
