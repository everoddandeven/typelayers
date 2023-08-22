/**
 * @module tl/style/Text
 */
import Fill from './Fill';
import {Size, toSize} from '../size';
import {Stroke} from "../style";

/**
 * @typedef {'point' | 'line'} TextPlacement
 * Default text placement is `'point'`. Note that
 * `'line'` requires the underlying geometry to be a {@link module:tl/geom/LineString~LineString},
 * {@link module:tl/geom/Polygon~Polygon}, {@link module:tl/geom/MultiLineString~MultiLineString} or
 * {@link module:tl/geom/MultiPolygon~MultiPolygon}.
 */

export type TextPlacement = 'point' | 'line';

/**
 * @typedef {'left' | 'center' | 'right'} TextJustify
 */

export type TextJustify = 'left' | 'center' | 'right';

/**
 * The default fill color to use if no fill was set at construction time; a
 * blackish `#333`.
 *
 * @const {string}
 */
const DEFAULT_FILL_COLOR: string = '#333';

export interface TextOptions {
  font?: string;
  maxAngle?: number;
  offsetX?: number;
  offsetY?: number;
  overflow?: boolean;
  placement?: TextPlacement;
  repeat?: number;
  scale?: number | Size;
  rotateWithView?: boolean;
  rotation?: number;
  text?: string | string[];
  textAlign?: CanvasTextAlign;
  justify?: TextJustify;
  textBaseline?: CanvasTextBaseline;
  fill?: Fill | null;
  stroke?: Stroke;
  backgroundFill?: Fill;
  backgroundStroke?: Stroke;
  padding?: number[];
}

/**
 * @classdesc
 * Set text style for vector features.
 * @api
 */
class Text {
  /**
   * @param {Options} [options] Options.
   */

  private font_?: string;
  private rotation_?: number;
  private repeat_?: number;
  private rotateWithView_?: boolean;
  private scale_?: number | Size;
  private scaleArray_: Size;
  private text_?: string | string[];
  private textAlign_?: CanvasTextAlign;
  private justify_?: TextJustify;
  private textBaseline_?: CanvasTextBaseline;
  private fill_: Fill;
  private maxAngle_: number;
  private placement_: TextPlacement;
  private overflow_: boolean;
  private stroke_: Stroke;
  private offsetX_: number;
  private offsetY_: number;
  private backgroundFill_: Fill;
  private backgroundStroke_: Stroke;
  private padding_?: number[];

  constructor(options?: TextOptions) {
    options = options || {};

    /**
     * @private
     * @type {string|undefined}
     */
    this.font_ = options.font;

    /**
     * @private
     * @type {number|undefined}
     */
    this.rotation_ = options.rotation;

    /**
     * @private
     * @type {boolean|undefined}
     */
    this.rotateWithView_ = options.rotateWithView;

    /**
     * @private
     * @type {number|import("../size").Size|undefined}
     */
    this.scale_ = options.scale;

    /**
     * @private
     * @type {import("../size").Size}
     */
    this.scaleArray_ = toSize(options.scale !== undefined ? options.scale : 1);

    /**
     * @private
     * @type {string|Array<string>|undefined}
     */
    this.text_ = options.text;

    /**
     * @private
     * @type {CanvasTextAlign|undefined}
     */
    this.textAlign_ = options.textAlign;

    /**
     * @private
     * @type {TextJustify|undefined}
     */
    this.justify_ = options.justify;

    /**
     * @private
     * @type {number|undefined}
     */
    this.repeat_ = options.repeat;

    /**
     * @private
     * @type {CanvasTextBaseline|undefined}
     */
    this.textBaseline_ = options.textBaseline;

    /**
     * @private
     * @type {import("./Fill").default}
     */
    this.fill_ =
      options.fill !== undefined
        ? options.fill
        : new Fill({color: DEFAULT_FILL_COLOR});

    /**
     * @private
     * @type {number}
     */
    this.maxAngle_ =
      options.maxAngle !== undefined ? options.maxAngle : Math.PI / 4;

    /**
     * @private
     * @type {TextPlacement}
     */
    this.placement_ =
      options.placement !== undefined ? options.placement : 'point';

    /**
     * @private
     * @type {boolean}
     */
    this.overflow_ = !!options.overflow;

    /**
     * @private
     * @type {import("./Stroke").default}
     */
    this.stroke_ = options.stroke !== undefined ? options.stroke : null;

    /**
     * @private
     * @type {number}
     */
    this.offsetX_ = options.offsetX !== undefined ? options.offsetX : 0;

    /**
     * @private
     * @type {number}
     */
    this.offsetY_ = options.offsetY !== undefined ? options.offsetY : 0;

    /**
     * @private
     * @type {import("./Fill").default}
     */
    this.backgroundFill_ = options.backgroundFill
      ? options.backgroundFill
      : null;

    /**
     * @private
     * @type {import("./Stroke").default}
     */
    this.backgroundStroke_ = options.backgroundStroke
      ? options.backgroundStroke
      : null;

    /**
     * @private
     * @type {Array<number>|null}
     */
    this.padding_ = options.padding === undefined ? null : options.padding;
  }

  /**
   * Clones the style.
   * @return {Text} The cloned style.
   * @api
   */
  public clone(): Text {
    const scale = this.getScale();
    return new Text({
      font: this.getFont(),
      placement: this.getPlacement(),
      repeat: this.getRepeat(),
      maxAngle: this.getMaxAngle(),
      overflow: this.getOverflow(),
      rotation: this.getRotation(),
      rotateWithView: this.getRotateWithView(),
      scale: Array.isArray(scale) ? <Size>scale.slice() : scale,
      text: this.getText(),
      textAlign: this.getTextAlign(),
      justify: this.getJustify(),
      textBaseline: this.getTextBaseline(),
      fill: this.getFill() ? this.getFill().clone() : undefined,
      stroke: this.getStroke() ? this.getStroke().clone() : undefined,
      offsetX: this.getOffsetX(),
      offsetY: this.getOffsetY(),
      backgroundFill: this.getBackgroundFill()
        ? this.getBackgroundFill().clone()
        : undefined,
      backgroundStroke: this.getBackgroundStroke()
        ? this.getBackgroundStroke().clone()
        : undefined,
      padding: this.getPadding() || undefined,
    });
  }

  /**
   * Get the `overflow` configuration.
   * @return {boolean} Let text overflow the length of the path they follow.
   * @api
   */
  public getOverflow(): boolean {
    return this.overflow_;
  }

  /**
   * Get the font name.
   * @return {string|undefined} Font.
   * @api
   */
  public getFont(): string {
    return this.font_;
  }

  /**
   * Get the maximum angle between adjacent characters.
   * @return {number} Angle in radians.
   * @api
   */
  public getMaxAngle(): number {
    return this.maxAngle_;
  }

  /**
   * Get the label placement.
   * @return {TextPlacement} Text placement.
   * @api
   */
  public getPlacement(): TextPlacement {
    return this.placement_;
  }

  /**
   * Get the repeat interval of the text.
   * @return {number|undefined} Repeat interval in pixels.
   * @api
   */
  public getRepeat(): number | undefined {
    return this.repeat_;
  }

  /**
   * Get the x-offset for the text.
   * @return {number} Horizontal text offset.
   * @api
   */
  public getOffsetX(): number {
    return this.offsetX_;
  }

  /**
   * Get the y-offset for the text.
   * @return {number} Vertical text offset.
   * @api
   */
  public getOffsetY(): number {
    return this.offsetY_;
  }

  /**
   * Get the fill style for the text.
   * @return {import("./Fill").default} Fill style.
   * @api
   */
  public getFill(): Fill {
    return this.fill_;
  }

  /**
   * Determine whether the text rotates with the map.
   * @return {boolean|undefined} Rotate with map.
   * @api
   */
  public getRotateWithView(): boolean {
    return this.rotateWithView_;
  }

  /**
   * Get the text rotation.
   * @return {number|undefined} Rotation.
   * @api
   */
  public getRotation(): number {
    return this.rotation_;
  }

  /**
   * Get the text scale.
   * @return {number|import("../size").Size|undefined} Scale.
   * @api
   */
  public getScale(): number | Size {
    return this.scale_;
  }

  /**
   * Get the symbolizer scale array.
   * @return {import("../size").Size} Scale array.
   */
  public getScaleArray(): Size {
    return this.scaleArray_;
  }

  /**
   * Get the stroke style for the text.
   * @return {import("./Stroke").default} Stroke style.
   * @api
   */
  public getStroke(): Stroke {
    return this.stroke_;
  }

  /**
   * Get the text to be rendered.
   * @return {string|Array<string>|undefined} Text.
   * @api
   */
  public getText(): string | string[] {
    return this.text_;
  }

  /**
   * Get the text alignment.
   * @return {CanvasTextAlign|undefined} Text align.
   * @api
   */
  public getTextAlign(): CanvasTextAlign {
    return this.textAlign_;
  }

  /**
   * Get the justification.
   * @return {TextJustify|undefined} Justification.
   * @api
   */
  public getJustify(): TextJustify {
    return this.justify_;
  }

  /**
   * Get the text baseline.
   * @return {CanvasTextBaseline|undefined} Text baseline.
   * @api
   */
  public getTextBaseline(): CanvasTextBaseline {
    return this.textBaseline_;
  }

  /**
   * Get the background fill style for the text.
   * @return {import("./Fill").default} Fill style.
   * @api
   */
  public getBackgroundFill(): Fill {
    return this.backgroundFill_;
  }

  /**
   * Get the background stroke style for the text.
   * @return {import("./Stroke").default} Stroke style.
   * @api
   */
  public getBackgroundStroke(): Stroke {
    return this.backgroundStroke_;
  }

  /**
   * Get the padding for the text.
   * @return {Array<number>|null} Padding.
   * @api
   */
  public getPadding(): number[] | null {
    return this.padding_;
  }

  /**
   * Set the `overflow` property.
   *
   * @param {boolean} overflow Let text overflow the path that it follows.
   * @api
   */
  public setOverflow(overflow: boolean): void {
    this.overflow_ = overflow;
  }

  /**
   * Set the font.
   *
   * @param {string|undefined} font Font.
   * @api
   */
  public setFont(font?: string): void {
    this.font_ = font;
  }

  /**
   * Set the maximum angle between adjacent characters.
   *
   * @param {number} maxAngle Angle in radians.
   * @api
   */
  public setMaxAngle(maxAngle: number): void {
    this.maxAngle_ = maxAngle;
  }

  /**
   * Set the x offset.
   *
   * @param {number} offsetX Horizontal text offset.
   * @api
   */
  public setOffsetX(offsetX: number): void {
    this.offsetX_ = offsetX;
  }

  /**
   * Set the y offset.
   *
   * @param {number} offsetY Vertical text offset.
   * @api
   */
  public setOffsetY(offsetY: number): void {
    this.offsetY_ = offsetY;
  }

  /**
   * Set the text placement.
   *
   * @param {TextPlacement} placement Placement.
   * @api
   */
  public setPlacement(placement: TextPlacement): void {
    this.placement_ = placement;
  }

  /**
   * Set the repeat interval of the text.
   * @param {number|undefined} [repeat] Repeat interval in pixels.
   * @api
   */
  public setRepeat(repeat?: number): void {
    this.repeat_ = repeat;
  }

  /**
   * Set whether to rotate the text with the view.
   *
   * @param {boolean} rotateWithView Rotate with map.
   * @api
   */
  public setRotateWithView(rotateWithView: boolean): void {
    this.rotateWithView_ = rotateWithView;
  }

  /**
   * Set the fill.
   *
   * @param {import("./Fill").default} fill Fill style.
   * @api
   */
  public setFill(fill: Fill): void {
    this.fill_ = fill;
  }

  /**
   * Set the rotation.
   *
   * @param {number|undefined} rotation Rotation.
   * @api
   */
  public setRotation(rotation?: number): void {
    this.rotation_ = rotation;
  }

  /**
   * Set the scale.
   *
   * @param {number|import("../size").Size|undefined} scale Scale.
   * @api
   */
  setScale(scale) {
    this.scale_ = scale;
    this.scaleArray_ = toSize(scale !== undefined ? scale : 1);
  }

  /**
   * Set the stroke.
   *
   * @param {import("./Stroke").default} stroke Stroke style.
   * @api
   */
  setStroke(stroke) {
    this.stroke_ = stroke;
  }

  /**
   * Set the text.
   *
   * @param {string|Array<string>|undefined} text Text.
   * @api
   */
  setText(text) {
    this.text_ = text;
  }

  /**
   * Set the text alignment.
   *
   * @param {CanvasTextAlign|undefined} textAlign Text align.
   * @api
   */
  setTextAlign(textAlign) {
    this.textAlign_ = textAlign;
  }

  /**
   * Set the justification.
   *
   * @param {TextJustify|undefined} justify Justification.
   * @api
   */
  setJustify(justify) {
    this.justify_ = justify;
  }

  /**
   * Set the text baseline.
   *
   * @param {CanvasTextBaseline|undefined} textBaseline Text baseline.
   * @api
   */
  setTextBaseline(textBaseline) {
    this.textBaseline_ = textBaseline;
  }

  /**
   * Set the background fill.
   *
   * @param {import("./Fill").default} fill Fill style.
   * @api
   */
  setBackgroundFill(fill) {
    this.backgroundFill_ = fill;
  }

  /**
   * Set the background stroke.
   *
   * @param {import("./Stroke").default} stroke Stroke style.
   * @api
   */
  setBackgroundStroke(stroke) {
    this.backgroundStroke_ = stroke;
  }

  /**
   * Set the padding (`[top, right, bottom, left]`).
   *
   * @param {Array<number>|null} padding Padding.
   * @api
   */
  setPadding(padding) {
    this.padding_ = padding;
  }
}

export default Text;
