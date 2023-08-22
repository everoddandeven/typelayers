/**
 * @module tl/style/Circle
 */

import RegularShape from './RegularShape';
import Fill from "./Fill";
import Stroke from "./Stroke";
import {Size} from "../size";
import {Coordinate} from "../coordinate";

interface CircleStyleOptions {
  fill?: Fill;
  radius: number;
  stroke?: Stroke;
  displacement?: number[];
  scale?: number | Size;
  rotation?: number;
  rotateWithView?: boolean;
  declutterMode?: "declutter" | "obstacle" | "none" | undefined;
}

/**
 * @classdesc
 * Set circle style for vector features.
 * @api
 */
class CircleStyle extends RegularShape {
  /**
   * @param {Options} [options] Options.
   */
  constructor(options: CircleStyleOptions) {
    options = options ? options : {radius: 5};

    super({
      points: Infinity,
      fill: options.fill,
      radius: options.radius,
      stroke: options.stroke,
      scale: options.scale !== undefined ? options.scale : 1,
      rotation: options.rotation !== undefined ? options.rotation : 0,
      rotateWithView:
        options.rotateWithView !== undefined ? options.rotateWithView : false,
      displacement:
        options.displacement !== undefined ? options.displacement : [0, 0],
      declutterMode: options.declutterMode,
    });
  }

  /**
   * Clones the style.
   * @return {CircleStyle} The cloned style.
   * @api
   */
  public clone(): CircleStyle {
    const scale = this.getScale();
    const style = new CircleStyle({
      fill: this.getFill() ? this.getFill().clone() : undefined,
      stroke: this.getStroke() ? this.getStroke().clone() : undefined,
      radius: this.getRadius(),
      scale: Array.isArray(scale) ? <Coordinate>scale.slice() : scale,
      rotation: this.getRotation(),
      rotateWithView: this.getRotateWithView(),
      displacement: this.getDisplacement().slice(),
      declutterMode: this.getDeclutterMode(),
    });
    style.setOpacity(this.getOpacity());
    return style;
  }

  /**
   * Set the circle radius.
   *
   * @param {number} radius Circle radius.
   * @api
   */
  public setRadius(radius: number): void {
    this.radius_ = radius;
    this.render();
  }
}

export default CircleStyle;
