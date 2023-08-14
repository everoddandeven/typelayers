/**
 * @module ol/render/Box
 */

import Disposable from '../Disposable';
import Polygon from '../geom/Polygon';
import Map from '../Map';
import {Pixel} from "../pixel";

class RenderBox extends Disposable {
  /**
   * @param {string} className CSS class name.
   */

  private geometry_: Polygon;
  private element_: HTMLElement;
  private map_?: Map;
  private startPixel_?: Pixel;
  private endPixel_?: Pixel;

  constructor(className: string) {
    super();

    /**
     * @type {import("../geom/Polygon").default}
     * @private
     */
    this.geometry_ = null;

    /**
     * @type {HTMLDivElement}
     * @private
     */
    this.element_ = document.createElement('div');
    this.element_.style.position = 'absolute';
    this.element_.style.pointerEvents = 'auto';
    this.element_.className = 'ol-box ' + className;

    /**
     * @private
     * @type {import("../Map").default|null}
     */
    this.map_ = null;

    /**
     * @private
     * @type {import("../pixel").Pixel}
     */
    this.startPixel_ = null;

    /**
     * @private
     * @type {import("../pixel").Pixel}
     */
    this.endPixel_ = null;
  }

  /**
   * Clean up.
   */
  public disposeInternal(): void {
    this.setMap(null);
  }

  /**
   * @private
   */
  private render_(): void {
    const startPixel = this.startPixel_;
    const endPixel = this.endPixel_;
    const px = 'px';
    const style = this.element_.style;
    style.left = Math.min(startPixel[0], endPixel[0]) + px;
    style.top = Math.min(startPixel[1], endPixel[1]) + px;
    style.width = Math.abs(endPixel[0] - startPixel[0]) + px;
    style.height = Math.abs(endPixel[1] - startPixel[1]) + px;
  }

  /**
   * @param {import("../Map").default|null} map Map.
   */
  public setMap(map: Map): void {
    if (this.map_) {
      this.map_.getOverlayContainer().removeChild(this.element_);
      const style = this.element_.style;
      style.left = 'inherit';
      style.top = 'inherit';
      style.width = 'inherit';
      style.height = 'inherit';
    }
    this.map_ = map;
    if (this.map_) {
      this.map_.getOverlayContainer().appendChild(this.element_);
    }
  }

  /**
   * @param {import("../pixel").Pixel} startPixel Start pixel.
   * @param {import("../pixel").Pixel} endPixel End pixel.
   */
  public setPixels(startPixel: Pixel, endPixel: Pixel): void {
    this.startPixel_ = startPixel;
    this.endPixel_ = endPixel;
    this.createOrUpdateGeometry();
    this.render_();
  }

  /**
   * Creates or updates the cached geometry.
   */
  public createOrUpdateGeometry(): void {
    const startPixel = this.startPixel_;
    const endPixel = this.endPixel_;
    const pixels = [
      startPixel,
      [startPixel[0], endPixel[1]],
      endPixel,
      [endPixel[0], startPixel[1]],
    ];
    const coordinates = pixels.map(
      this.map_.getCoordinateFromPixelInternal,
      this.map_
    );
    // close the polygon
    coordinates[4] = coordinates[0].slice();
    if (!this.geometry_) {
      this.geometry_ = new Polygon([coordinates]);
    } else {
      this.geometry_.setCoordinates([coordinates]);
    }
  }

  /**
   * @return {import("../geom/Polygon").default} Geometry.
   */
  public getGeometry(): Polygon {
    return this.geometry_;
  }
}

export default RenderBox;
