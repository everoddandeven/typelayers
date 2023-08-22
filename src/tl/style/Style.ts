/**
 * @module tl/style/Style
 */

import CircleStyle from './Circle';
import Fill from './Fill';
import Stroke from './Stroke';
import {assert} from '../asserts';
import {FeatureLike} from "../Feature";
import Geometry, {GeometryType} from "../geom/Geometry";
import RenderFeature from "../render/Feature";
import Image from "./Image";
import {Color} from "../color";
import Text from "./Text";

/**
 * A function that takes an {@link module:tl/Feature~Feature} and a `{number}`
 * representing the view's resolution. The function should return a
 * {@link module:tl/style/Style~Style} or an array of them. This way e.g. a
 * vector layer can be styled. If the function returns `undefined`, the
 * feature will not be rendered.
 *
 * @typedef {function(import("../Feature").FeatureLike, number):(Style|Array<Style>|void)} StyleFunction
 */

export type StyleFunction = (feature: FeatureLike, viewResolution: number) => Style | Style[] | void;

/**
 * A {@link Style}, an array of {@link Style}, or a {@link StyleFunction}.
 * @typedef {Style|Array<Style>|StyleFunction} StyleLike
 */

export type StyleLike = Style | Style[] | StyleFunction;

/**
 * A function that takes an {@link module:tl/Feature~Feature} as argument and returns an
 * {@link module:tl/geom/Geometry~Geometry} that will be rendered and styled for the feature.
 *
 * @typedef {function(import("../Feature").FeatureLike):
 *     (import("../geom/Geometry").default|import("../render/Feature").default|undefined)} GeometryFunction
 */

export type GeometryFunction = (feature: FeatureLike) => Geometry | RenderFeature | undefined;

/**
 * Custom renderer function. Takes two arguments:
 *
 * 1. The pixel coordinates of the geometry in GeoJSON notation.
 * 2. The {@link module:tl/render~State} of the layer renderer.
 *
 * @typedef {function((import("../coordinate").Coordinate|Array<import("../coordinate").Coordinate>|Array<Array<import("../coordinate").Coordinate>>|Array<Array<Array<import("../coordinate").Coordinate>>>),import("../render").State): void} RenderFunction
 */

export type RenderFunction = Function;

export interface StyleOptions {
  geometry?: string | Geometry | GeometryFunction;
  fill?: Fill;
  image?: Image;
  renderer?: RenderFunction;
  hitDetectionRenderer?: RenderFunction;
  stroke?: Stroke;
  text?: Text;
  zIndex?: number;
}

/**
 * @classdesc
 * Container for vector feature rendering styles. Any changes made to the style
 * or its children through `set*()` methods will not take effect until the
 * feature or layer that uses the style is re-rendered.
 *
 * ## Feature styles
 *
 * If no style is defined, the following default style is used:
 * ```js
 *  import {Circle, Fill, Stroke, Style} from 'tl/style';
 *
 *  const fill = new Fill({
 *    color: 'rgba(255,255,255,0.4)',
 *  });
 *  const stroke = new Stroke({
 *    color: '#3399CC',
 *    width: 1.25,
 *  });
 *  const styles = [
 *    new Style({
 *      image: new Circle({
 *        fill: fill,
 *        stroke: stroke,
 *        radius: 5,
 *      }),
 *      fill: fill,
 *      stroke: stroke,
 *    }),
 *  ];
 * ```
 *
 * A separate editing style has the following defaults:
 * ```js
 *  import {Circle, Fill, Stroke, Style} from 'tl/style';
 *
 *  const styles = {};
 *  const white = [255, 255, 255, 1];
 *  const blue = [0, 153, 255, 1];
 *  const width = 3;
 *  styles['Polygon'] = [
 *    new Style({
 *      fill: new Fill({
 *        color: [255, 255, 255, 0.5],
 *      }),
 *    }),
 *  ];
 *  styles['MultiPolygon'] =
 *      styles['Polygon'];
 *  styles['LineString'] = [
 *    new Style({
 *      stroke: new Stroke({
 *        color: white,
 *        width: width + 2,
 *      }),
 *    }),
 *    new Style({
 *      stroke: new Stroke({
 *        color: blue,
 *        width: width,
 *      }),
 *    }),
 *  ];
 *  styles['MultiLineString'] = styles['LineString'];
 *
 *  styles['Circle'] = styles['Polygon'].concat(
 *    styles['LineString']
 *  );
 *
 *  styles['Point'] = [
 *    new Style({
 *      image: new Circle({
 *        radius: width * 2,
 *        fill: new Fill({
 *          color: blue,
 *        }),
 *        stroke: new Stroke({
 *          color: white,
 *          width: width / 2,
 *        }),
 *      }),
 *      zIndex: Infinity,
 *    }),
 *  ];
 *  styles['MultiPoint'] =
 *      styles['Point'];
 *  styles['GeometryCollection'] =
 *      styles['Polygon'].concat(
 *          styles['LineString'],
 *          styles['Point']
 *      );
 * ```
 *
 * @api
 */
class Style {
  /**
   * @param {Options} [options] Style options.
   */

  private geometry_: Geometry | GeometryFunction | string;
  private geometryFunction_: GeometryFunction;
  private fill_: Fill;
  private image_: Image;
  private renderer_: RenderFunction | null;
  private hitDetectionRenderer_: RenderFunction | null;
  private stroke_: Stroke;
  private text_: Text;
  private zIndex_: number | undefined;

  constructor(options?: StyleOptions) {
    options = options || {};

    /**
     * @private
     * @type {string|import("../geom/Geometry").default|GeometryFunction}
     */
    this.geometry_ = null;

    /**
     * @private
     * @type {!GeometryFunction}
     */
    this.geometryFunction_ = defaultGeometryFunction;

    if (options.geometry !== undefined) {
      this.setGeometry(options.geometry);
    }

    /**
     * @private
     * @type {import("./Fill").default}
     */
    this.fill_ = options.fill !== undefined ? options.fill : null;

    /**
     * @private
     * @type {import("./Image").default}
     */
    this.image_ = options.image !== undefined ? options.image : null;

    /**
     * @private
     * @type {RenderFunction|null}
     */
    this.renderer_ = options.renderer !== undefined ? options.renderer : null;

    /**
     * @private
     * @type {RenderFunction|null}
     */
    this.hitDetectionRenderer_ =
      options.hitDetectionRenderer !== undefined
        ? options.hitDetectionRenderer
        : null;

    /**
     * @private
     * @type {import("./Stroke").default}
     */
    this.stroke_ = options.stroke !== undefined ? options.stroke : null;

    /**
     * @private
     * @type {import("./Text").default}
     */
    this.text_ = options.text !== undefined ? options.text : null;

    /**
     * @private
     * @type {number|undefined}
     */
    this.zIndex_ = options.zIndex;
  }

  /**
   * Clones the style.
   * @return {Style} The cloned style.
   * @api
   */
  public clone(): Style {
    let geometry = this.getGeometry();
    if (geometry && typeof geometry === 'object') {
      geometry = /** @type {import("../geom/Geometry").default} */ (
        geometry
      ).clone();
    }
    return new Style({
      geometry: geometry,
      fill: this.getFill() ? this.getFill().clone() : undefined,
      image: this.getImage() ? this.getImage().clone() : undefined,
      renderer: this.getRenderer(),
      stroke: this.getStroke() ? this.getStroke().clone() : undefined,
      text: this.getText() ? this.getText().clone() : undefined,
      zIndex: this.getZIndex(),
    });
  }

  /**
   * Get the custom renderer function that was configured with
   * {@link #setRenderer} or the `renderer` constructor option.
   * @return {RenderFunction|null} Custom renderer function.
   * @api
   */
  public getRenderer(): RenderFunction {
    return this.renderer_;
  }

  /**
   * Sets a custom renderer function for this style. When set, `fill`, `stroke`
   * and `image` options of the style will be ignored.
   * @param {RenderFunction|null} renderer Custom renderer function.
   * @api
   */
  public setRenderer(renderer?: RenderFunction): void {
    this.renderer_ = renderer;
  }

  /**
   * Sets a custom renderer function for this style used
   * in hit detection.
   * @param {RenderFunction|null} renderer Custom renderer function.
   * @api
   */
  public setHitDetectionRenderer(renderer?: RenderFunction): void {
    this.hitDetectionRenderer_ = renderer;
  }

  /**
   * Get the custom renderer function that was configured with
   * {@link #setHitDetectionRenderer} or the `hitDetectionRenderer` constructor option.
   * @return {RenderFunction|null} Custom renderer function.
   * @api
   */
  public getHitDetectionRenderer(): RenderFunction | null {
    return this.hitDetectionRenderer_;
  }

  /**
   * Get the geometry to be rendered.
   * @return {string|import("../geom/Geometry").default|GeometryFunction}
   * Feature property or geometry or function that returns the geometry that will
   * be rendered with this style.
   * @api
   */
  public getGeometry(): Geometry | GeometryFunction | string {
    return this.geometry_;
  }

  /**
   * Get the function used to generate a geometry for rendering.
   * @return {!GeometryFunction} Function that is called with a feature
   * and returns the geometry to render instead of the feature's geometry.
   * @api
   */
  public getGeometryFunction(): GeometryFunction {
    return this.geometryFunction_;
  }

  /**
   * Get the fill style.
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
  }

  /**
   * Get the image style.
   * @return {import("./Image").default} Image style.
   * @api
   */
  public getImage(): Image {
    return this.image_;
  }

  /**
   * Set the image style.
   * @param {import("./Image").default} image Image style.
   * @api
   */
  public setImage(image: Image): void {
    this.image_ = image;
  }

  /**
   * Get the stroke style.
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
  }

  /**
   * Get the text style.
   * @return {import("./Text").default} Text style.
   * @api
   */
  public getText(): Text {
    return this.text_;
  }

  /**
   * Set the text style.
   * @param {import("./Text").default} text Text style.
   * @api
   */
  public setText(text: Text): void {
    this.text_ = text;
  }

  /**
   * Get the z-index for the style.
   * @return {number|undefined} ZIndex.
   * @api
   */
  public getZIndex(): number {
    return this.zIndex_;
  }

  /**
   * Set a geometry that is rendered instead of the feature's geometry.
   *
   * @param {string|import("../geom/Geometry").default|GeometryFunction} geometry
   *     Feature property or geometry or function returning a geometry to render
   *     for this style.
   * @api
   */
  public setGeometry(geometry: Geometry | GeometryFunction | string): void {
    if (typeof geometry === 'function')
    {
      this.geometryFunction_ = geometry;
    }
    else if (typeof geometry === 'string')
    {
      this.geometryFunction_ = (feature) =>
      {
        return /** @type {import("../geom/Geometry").default} */ (
          feature.get(geometry)
        );
      };
    }
    else if (!geometry)
    {
      this.geometryFunction_ = defaultGeometryFunction;
    }
    else if (geometry !== undefined)
    {
      this.geometryFunction_ = () =>
      {
        return /** @type {import("../geom/Geometry").default} */ (<Geometry>geometry)
      }
    }

    this.geometry_ = geometry;
  }

  /**
   * Set the z-index.
   *
   * @param {number|undefined} zIndex ZIndex.
   * @api
   */
  public setZIndex(zIndex?: number): void {
    this.zIndex_ = zIndex;
  }
}

/**
 * Convert the provided object into a style function.  Functions passed through
 * unchanged.  Arrays of Style or single style objects wrapped in a
 * new style function.
 * @param {StyleFunction|Array<Style>|Style} obj
 *     A style function, a single style, or an array of styles.
 * @return {StyleFunction} A style function.
 */
export function toFunction(obj: StyleFunction | Style[] | Style): StyleFunction {
  let styleFunction: StyleFunction;

  if (typeof obj === 'function') {
    styleFunction = obj;
  } else {
    /**
     * @type {Array<Style>}
     */
    let styles: Style[];
    if (Array.isArray(obj)) {
      styles = obj;
    } else {
      assert(typeof (/** @type {?} */ (obj).getZIndex) === 'function', 41); // Expected an `Style` or an array of `Style`
      const style = /** @type {Style} */ (obj);
      styles = [style];
    }
    styleFunction = function () {
      return styles;
    };
  }
  return styleFunction;
}

/**
 * @type {Array<Style>|null}
 */
let defaultStyles: Style[] = null;

/**
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {number} resolution Resolution.
 * @return {Array<Style>} Style.
 */
export function createDefaultStyle(feature: FeatureLike, resolution: number): Style[] {
  // We don't use an immediately-invoked function
  // and a closure so, we don't get an error at script evaluation time in
  // browsers that do not support Canvas. (import("./Circle").CircleStyle does
  // canvas.getContext('2d') at construction time, which will cause an.error
  // in such browsers.)
  if (!defaultStyles) {
    const fill = new Fill({
      color: 'rgba(255,255,255,0.4)',
    });
    const stroke = new Stroke({
      color: '#3399CC',
      width: 1.25,
    });
    defaultStyles = [
      new Style({
        image: new CircleStyle({
          fill: fill,
          stroke: stroke,
          radius: 5,
        }),
        fill: fill,
        stroke: stroke,
      }),
    ];
  }
  return defaultStyles;
}

/**
 * Default styles for editing features.
 * @return {Object<import("../geom/Geometry").Type, Array<Style>>} Styles
 */
export function createEditingStyle(): {[key: string]: Style[]} {
  /** @type {Object<import("../geom/Geometry").GeometryType, Array<Style>>} */
  const styles: {[key: string]: Style[]} = {};
  const white: Color = [255, 255, 255, 1];
  const blue: Color = [0, 153, 255, 1];
  const width: number = 3;
  styles['Polygon'] = [
    new Style({
      fill: new Fill({
        color: <Color>[255, 255, 255, 0.5],
      }),
    }),
  ];
  styles['MultiPolygon'] = styles['Polygon'];

  styles['LineString'] = [
    new Style({
      stroke: new Stroke({
        color: white,
        width: width + 2,
      }),
    }),
    new Style({
      stroke: new Stroke({
        color: blue,
        width: width,
      }),
    }),
  ];
  styles['MultiLineString'] = styles['LineString'];

  styles['Circle'] = styles['Polygon'].concat(styles['LineString']);

  styles['Point'] = [
    new Style({
      image: new CircleStyle({
        radius: width * 2,
        fill: new Fill({
          color: blue,
        }),
        stroke: new Stroke({
          color: white,
          width: width / 2,
        }),
      }),
      zIndex: Infinity,
    }),
  ];
  styles['MultiPoint'] = styles['Point'];

  styles['GeometryCollection'] = styles['Polygon'].concat(
    styles['LineString'],
    styles['Point']
  );

  return styles;
}

/**
 * Function that is called with a feature and returns its default geometry.
 * @param {import("../Feature").FeatureLike} feature Feature to get the geometry for.
 * @return {import("../geom/Geometry").default|import("../render/Feature").default|undefined} Geometry to render.
 */
function defaultGeometryFunction(feature: FeatureLike): RenderFeature | Geometry {
  return feature.getGeometry();
}

export default Style;
