/**
 * @module ol/style/Fill
 */

import {asColorLike, ColorLike} from "../colorlike";
import {Color} from "../color";

export interface FillOptions
{
  color?: Color | ColorLike;
}

/**
 * @classdesc
 * Set fill style for vector features.
 * @api
 */
class Fill {
  /**
   * @param {Options} [options] Options.
   */

  private color_?: Color | ColorLike;

  constructor(options: FillOptions) {
    options = options || {};

    /**
     * @private
     * @type {import("../color").Color|import("../colorlike").ColorLike|null}
     */
    this.color_ = options.color !== undefined ? options.color : null;
  }

  /**
   * Clones the style. The color is not cloned if it is an {@link module:ol/colorlike~ColorLike}.
   * @return {Fill} The cloned style.
   * @api
   */
  public clone(): Fill {
    const color = this.getColor();
    return new Fill({
      color: Array.isArray(color) ? asColorLike(<Color>color.slice()) : color || undefined,
    });
  }

  /**
   * Get the fill color.
   * @return {import("../color").Color|import("../colorlike").ColorLike|null} Color.
   * @api
   */
  public getColor(): Color | ColorLike {
    return this.color_;
  }

  /**
   * Set the color.
   *
   * @param {import("../color").Color|import("../colorlike").ColorLike|null} color Color.
   * @api
   */
  public setColor(color?: Color | ColorLike): void {
    this.color_ = color;
  }
}

export default Fill;
