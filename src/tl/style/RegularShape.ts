/**
 * @module tl/style/RegularShape
 */

import ImageState from '../ImageState';
import ImageStyle from './Image';
import {asArray} from '../color';
import {asColorLike, ColorLike} from '../colorlike';
import Stroke from './Stroke';
import {createCanvasContext2D} from '../dom';
import {
  defaultFillStyle,
  defaultLineJoin,
  defaultLineWidth,
  defaultMiterLimit,
  defaultStrokeStyle,
} from '../render/canvas';
import {Size} from "../size";
import {Coordinate} from "../coordinate";
import Fill from "./Fill";
import BaseEvent from "../events/Event";

export interface RegularShapeOptions {
  fill?: Fill;
  points: number;
  radius?: number;
  radius1?: number;
  radius2?: number;
  angle?: number;
  displacement?: number[];
  stroke?: Stroke;
  rotation?: number;
  rotateWithView?: boolean;
  scale?: number | Size;
  declutterMode?: "declutter" | "obstacle" | "none" | undefined;
}

export interface RenderOptions {
  strokeStyle?: ColorLike;
  strokeWidth: number;
  size: number;
  lineDash: Array<number> | null;
  lineDashOffset: number;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
}

/**
 * @classdesc
 * Set regular shape style for vector features. The resulting shape will be
 * a regular polygon when `radius` is provided, or a star when `radius1` and
 * `radius2` are provided.
 * @api
 */
class RegularShape extends ImageStyle {
  /**
   * @param {Options} options Options.
   */

  private canvas_: {[key: number]: HTMLCanvasElement};
  private hitDetectionCanvas_: HTMLCanvasElement;
  private fill_: Fill;
  private origin_: Coordinate;
  private points_: number;
  private radius2_?: number;
  private angle_: number;
  private stroke_: Stroke;
  private size_?: Size;
  private renderOptions_: RenderOptions;

  protected radius_: number;

  constructor(options: RegularShapeOptions) {
    /**
     * @type {boolean}
     */
    const rotateWithView: boolean =
      options.rotateWithView !== undefined ? options.rotateWithView : false;

    super({
      opacity: 1,
      rotateWithView: rotateWithView,
      rotation: options.rotation !== undefined ? options.rotation : 0,
      scale: options.scale !== undefined ? options.scale : 1,
      displacement:
        options.displacement !== undefined ? options.displacement : [0, 0],
      declutterMode: options.declutterMode,
    });

    /**
     * @private
     * @type {Object<number, HTMLCanvasElement>}
     */
    this.canvas_ = undefined;

    /**
     * @private
     * @type {HTMLCanvasElement}
     */
    this.hitDetectionCanvas_ = null;

    /**
     * @private
     * @type {import("./Fill").default}
     */
    this.fill_ = options.fill !== undefined ? options.fill : null;

    /**
     * @private
     * @type {Array<number>}
     */
    this.origin_ = [0, 0];

    /**
     * @private
     * @type {number}
     */
    this.points_ = options.points;

    /**
     * @protected
     * @type {number}
     */
    this.radius_ =
      options.radius !== undefined ? options.radius : options.radius1;

    /**
     * @private
     * @type {number|undefined}
     */
    this.radius2_ = options.radius2;

    /**
     * @private
     * @type {number}
     */
    this.angle_ = options.angle !== undefined ? options.angle : 0;

    /**
     * @private
     * @type {import("./Stroke").default}
     */
    this.stroke_ = options.stroke !== undefined ? options.stroke : null;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.size_ = null;

    /**
     * @private
     * @type {RenderOptions}
     */
    this.renderOptions_ = null;

    this.render();
  }

  /**
   * Clones the style.
   * @return {RegularShape} The cloned style.
   * @api
   */
  public clone(): RegularShape {
    const scale = this.getScale();
    const style = new RegularShape({
      fill: this.getFill() ? this.getFill().clone() : undefined,
      points: this.getPoints(),
      radius: this.getRadius(),
      radius2: this.getRadius2(),
      angle: this.getAngle(),
      stroke: this.getStroke() ? this.getStroke().clone() : undefined,
      rotation: this.getRotation(),
      rotateWithView: this.getRotateWithView(),
      scale: Array.isArray(scale) ? <Coordinate>scale.slice() : scale,
      displacement: this.getDisplacement().slice(),
      declutterMode: this.getDeclutterMode(),
    });
    style.setOpacity(this.getOpacity());
    return style;
  }

  /**
   * Get the anchor point in pixels. The anchor determines the center point for the
   * symbolizer.
   * @return {Array<number>} Anchor.
   * @api
   */
  public getAnchor(): number[] {
    const size = this.size_;
    if (!size) {
      return null;
    }
    const displacement = this.getDisplacement();
    const scale = this.getScaleArray();
    // anchor is scaled by renderer but displacement should not be scaled
    // so divide by scale here
    return [
      size[0] / 2 - displacement[0] / scale[0],
      size[1] / 2 + displacement[1] / scale[1],
    ];
  }

  /**
   * Get the angle used in generating the shape.
   * @return {number} Shape's rotation in radians.
   * @api
   */
  public getAngle(): number {
    return this.angle_;
  }

  /**
   * Get the fill style for the shape.
   * @return {import("./Fill").default} Fill style.
   * @api
   */
  public getFill(): Fill {
    return this.fill_;
  }

  /**
   * Set the fill style.
   * @param {import("./Fill").default} fill Fill style.
   * @api
   */
  public setFill(fill: Fill): void {
    this.fill_ = fill;
    this.render();
  }

  /**
   * @return {HTMLCanvasElement} Image element.
   */
  public getHitDetectionImage(): HTMLCanvasElement {
    if (!this.hitDetectionCanvas_) {
      this.createHitDetectionCanvas_(this.renderOptions_);
    }
    return this.hitDetectionCanvas_;
  }

  /**
   * Get the image icon.
   * @param {number} pixelRatio Pixel ratio.
   * @return {HTMLCanvasElement} Image or Canvas element.
   * @api
   */
  public getImage(pixelRatio: number): HTMLCanvasElement {
    let image: HTMLCanvasElement = this.canvas_[pixelRatio];
    if (!image) {
      const renderOptions = this.renderOptions_;
      const context = <CanvasRenderingContext2D>createCanvasContext2D(
        renderOptions.size * pixelRatio,
        renderOptions.size * pixelRatio
      );
      this.draw_(renderOptions, context, pixelRatio);

      image = <HTMLCanvasElement>context.canvas;
      this.canvas_[pixelRatio] = image;
    }
    return image;
  }

  /**
   * Get the image pixel ratio.
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} Pixel ratio.
   */
  public getPixelRatio(pixelRatio: number): number {
    return pixelRatio;
  }

  /**
   * @return {import("../size").Size} Image size.
   */
  public getImageSize(): Size {
    return this.size_;
  }

  /**
   * @return {import("../ImageState").default} Image state.
   */
  public getImageState(): ImageState {
    return ImageState.LOADED;
  }

  /**
   * Get the origin of the symbolizer.
   * @return {Array<number>} Origin.
   * @api
   */
  public getOrigin(): Coordinate {
    return this.origin_;
  }

  /**
   * Get the number of points for generating the shape.
   * @return {number} Number of points for stars and regular polygons.
   * @api
   */
  public getPoints(): number {
    return this.points_;
  }

  /**
   * Get the (primary) radius for the shape.
   * @return {number} Radius.
   * @api
   */
  public getRadius(): number {
    return this.radius_;
  }

  /**
   * Get the secondary radius for the shape.
   * @return {number|undefined} Radius2.
   * @api
   */
  public getRadius2(): number {
    return this.radius2_;
  }

  /**
   * Get the size of the symbolizer (in pixels).
   * @return {import("../size").Size} Size.
   * @api
   */
  public getSize(): Size {
    return this.size_;
  }

  /**
   * Get the stroke style for the shape.
   * @return {import("./Stroke").default} Stroke style.
   * @api
   */
  public getStroke(): Stroke {
    return this.stroke_;
  }

  /**
   * Set the stroke style.
   * @param {import("./Stroke").default} stroke Stroke style.
   * @api
   */
  public setStroke(stroke: Stroke): void {
    this.stroke_ = stroke;
    this.render();
  }

  /**
   * @param {function(import("../events/Event").default): void} listener Listener function.
   */
  public listenImageChange(listener: (event: BaseEvent) => void): void {}

  /**
   * Load not yet loaded URI.
   */
  public load() {}

  /**
   * @param {function(import("../events/Event").default): void} listener Listener function.
   */
  public unlistenImageChange(listener: (event: BaseEvent) => void): void {}

  /**
   * Calculate additional canvas size needed for the miter.
   * @param {string} lineJoin Line join
   * @param {number} strokeWidth Stroke width
   * @param {number} miterLimit Miter limit
   * @return {number} Additional canvas size needed
   * @private
   */
  private calculateLineJoinSize_(lineJoin: string, strokeWidth: number, miterLimit: number): number {
    if (
      strokeWidth === 0 ||
      this.points_ === Infinity ||
      (lineJoin !== 'bevel' && lineJoin !== 'miter')
    ) {
      return strokeWidth;
    }
    // m  | ^
    // i  | |\                  .
    // t >|  #\
    // e  | |\ \              .
    // r      \s\
    //      |  \t\          .                 .
    //          \r\                      .   .
    //      |    \o\      .          .  . . .
    //          e \k\            .  .    . .
    //      |      \e\  .    .  .       . .
    //       d      \ \  .  .          . .
    //      | _ _a_ _\#  .            . .
    //   r1          / `             . .
    //      |                       . .
    //       b     /               . .
    //      |                     . .
    //           / r2            . .
    //      |                        .   .
    //         /                           .   .
    //      |α                                   .   .
    //       /                                         .   .
    //      ° center
    let r1 = this.radius_;
    let r2 = this.radius2_ === undefined ? r1 : this.radius2_;
    if (r1 < r2) {
      const tmp = r1;
      r1 = r2;
      r2 = tmp;
    }
    const points =
      this.radius2_ === undefined ? this.points_ : this.points_ * 2;
    const alpha = (2 * Math.PI) / points;
    const a = r2 * Math.sin(alpha);
    const b = Math.sqrt(r2 * r2 - a * a);
    const d = r1 - b;
    const e = Math.sqrt(a * a + d * d);
    const miterRatio = e / a;
    if (lineJoin === 'miter' && miterRatio <= miterLimit) {
      return miterRatio * strokeWidth;
    }
    // Calculate the distance from center to the stroke corner where
    // it was cut short because of the miter limit.
    //              l
    //        ----+---- <= distance from center to here is maxr
    //       /####|k ##\
    //      /#####^#####\
    //     /#### /+\# s #\
    //    /### h/+++\# t #\
    //   /### t/+++++\# r #\
    //  /### a/+++++++\# o #\
    // /### p/++ fill +\# k #\
    ///#### /+++++^+++++\# e #\
    //#####/+++++/+\+++++\#####\
    const k = strokeWidth / 2 / miterRatio;
    const l = (strokeWidth / 2) * (d / e);
    const maxr = Math.sqrt((r1 + k) * (r1 + k) + l * l);
    const bevelAdd = maxr - r1;
    if (this.radius2_ === undefined || lineJoin === 'bevel') {
      return bevelAdd * 2;
    }
    // If outer miter is over the miter limit the inner miter may reach through the
    // center and be longer than the bevel, same calculation as above but swap r1 / r2.
    const aa = r1 * Math.sin(alpha);
    const bb = Math.sqrt(r1 * r1 - aa * aa);
    const dd = r2 - bb;
    const ee = Math.sqrt(aa * aa + dd * dd);
    const innerMiterRatio = ee / aa;
    if (innerMiterRatio <= miterLimit) {
      const innerLength = (innerMiterRatio * strokeWidth) / 2 - r2 - r1;
      return 2 * Math.max(bevelAdd, innerLength);
    }
    return bevelAdd * 2;
  }

  /**
   * @return {RenderOptions}  The render options
   * @protected
   */
  protected createRenderOptions(): RenderOptions {
    let lineJoin = defaultLineJoin;
    let miterLimit = 0;
    let lineDash = null;
    let lineDashOffset = 0;
    let strokeStyle;
    let strokeWidth = 0;

    if (this.stroke_) {
      strokeStyle = this.stroke_.getColor();
      if (strokeStyle === null) {
        strokeStyle = defaultStrokeStyle;
      }
      strokeStyle = asColorLike(strokeStyle);
      strokeWidth = this.stroke_.getWidth();
      if (strokeWidth === undefined) {
        strokeWidth = defaultLineWidth;
      }
      lineDash = this.stroke_.getLineDash();
      lineDashOffset = this.stroke_.getLineDashOffset();
      lineJoin = this.stroke_.getLineJoin();
      if (lineJoin === undefined) {
        lineJoin = defaultLineJoin;
      }
      miterLimit = this.stroke_.getMiterLimit();
      if (miterLimit === undefined) {
        miterLimit = defaultMiterLimit;
      }
    }

    const add = this.calculateLineJoinSize_(lineJoin, strokeWidth, miterLimit);
    const maxRadius = Math.max(this.radius_, this.radius2_ || 0);
    const size = Math.ceil(2 * maxRadius + add);

    return {
      strokeStyle: strokeStyle,
      strokeWidth: strokeWidth,
      size: size,
      lineDash: lineDash,
      lineDashOffset: lineDashOffset,
      lineJoin: lineJoin,
      miterLimit: miterLimit,
    };
  }

  /**
   * @protected
   */
  protected render() {
    this.renderOptions_ = this.createRenderOptions();
    const size = this.renderOptions_.size;
    this.canvas_ = {};
    this.size_ = [size, size];
  }

  /**
   * @private
   * @param {RenderOptions} renderOptions Render options.
   * @param {CanvasRenderingContext2D} context The rendering context.
   * @param {number} pixelRatio The pixel ratio.
   */
  private draw_(renderOptions: RenderOptions, context: CanvasRenderingContext2D, pixelRatio: number): void {
    context.scale(pixelRatio, pixelRatio);
    // set origin to canvas center
    context.translate(renderOptions.size / 2, renderOptions.size / 2);

    this.createPath_(context);

    if (this.fill_) {
      let color = this.fill_.getColor();
      if (color === null) {
        color = defaultFillStyle;
      }
      context.fillStyle = asColorLike(color);
      context.fill();
    }
    if (this.stroke_) {
      context.strokeStyle = renderOptions.strokeStyle;
      context.lineWidth = renderOptions.strokeWidth;
      if (renderOptions.lineDash) {
        context.setLineDash(renderOptions.lineDash);
        context.lineDashOffset = renderOptions.lineDashOffset;
      }
      context.lineJoin = renderOptions.lineJoin;
      context.miterLimit = renderOptions.miterLimit;
      context.stroke();
    }
  }

  /**
   * @private
   * @param {RenderOptions} renderOptions Render options.
   */
  private createHitDetectionCanvas_(renderOptions: RenderOptions): void {
    if (this.fill_) {
      let color = this.fill_.getColor();

      // determine if fill is transparent (or pattern or gradient)
      let opacity = 0;
      if (typeof color === 'string') {
        color = asArray(color);
      }
      if (color === null) {
        opacity = 1;
      } else if (Array.isArray(color)) {
        opacity = color.length === 4 ? color[3] : 1;
      }
      if (opacity === 0) {
        // if a transparent fill style is set, create an extra hit-detection image
        // with a default fill style
        const context = <CanvasRenderingContext2D>createCanvasContext2D(
          renderOptions.size,
          renderOptions.size
        );
        this.hitDetectionCanvas_ = <HTMLCanvasElement>context.canvas;

        this.drawHitDetectionCanvas_(renderOptions, context);
      }
    }
    if (!this.hitDetectionCanvas_) {
      this.hitDetectionCanvas_ = this.getImage(1);
    }
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} context The context to draw in.
   */
  private createPath_(context: CanvasRenderingContext2D): void {
    let points = this.points_;
    const radius = this.radius_;
    if (points === Infinity) {
      context.arc(0, 0, radius, 0, 2 * Math.PI);
    } else {
      const radius2 = this.radius2_ === undefined ? radius : this.radius2_;
      if (this.radius2_ !== undefined) {
        points *= 2;
      }
      const startAngle = this.angle_ - Math.PI / 2;
      const step = (2 * Math.PI) / points;
      for (let i = 0; i < points; i++) {
        const angle0 = startAngle + i * step;
        const radiusC = i % 2 === 0 ? radius : radius2;
        context.lineTo(radiusC * Math.cos(angle0), radiusC * Math.sin(angle0));
      }
      context.closePath();
    }
  }

  /**
   * @private
   * @param {RenderOptions} renderOptions Render options.
   * @param {CanvasRenderingContext2D} context The context.
   */
  private drawHitDetectionCanvas_(renderOptions: RenderOptions, context: CanvasRenderingContext2D): void {
    // set origin to canvas center
    context.translate(renderOptions.size / 2, renderOptions.size / 2);

    this.createPath_(context);

    context.fillStyle = defaultFillStyle;
    context.fill();
    if (this.stroke_) {
      context.strokeStyle = renderOptions.strokeStyle;
      context.lineWidth = renderOptions.strokeWidth;
      if (renderOptions.lineDash) {
        context.setLineDash(renderOptions.lineDash);
        context.lineDashOffset = renderOptions.lineDashOffset;
      }
      context.lineJoin = renderOptions.lineJoin;
      context.miterLimit = renderOptions.miterLimit;
      context.stroke();
    }
  }
}

export default RegularShape;
