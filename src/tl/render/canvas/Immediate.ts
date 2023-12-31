/**
 * @module tl/render/canvas/Immediate
 */
// FIXME test, especially polygons with holes and multipolygons
// FIXME need to handle large thick features (where pixel size matters)
// FIXME add offset and end to tl/geom/flat/transform~transform2D?

import VectorContext from '../VectorContext';
import {asColorLike} from '../../colorlike';
import {
  compose as composeTransform,
  create as createTransform, Transform,
} from '../../transform';
import {
  defaultFillStyle,
  defaultFont,
  defaultLineCap,
  defaultLineDash,
  defaultLineDashOffset,
  defaultLineJoin,
  defaultLineWidth,
  defaultMiterLimit,
  defaultStrokeStyle,
  defaultTextAlign,
  defaultTextBaseline, FillState, StrokeState, TextState,
} from '../canvas';
import {equals} from '../../array';
import {Extent, intersects} from '../../extent';
import {toFixed} from '../../math';
import {transform2D} from '../../geom/flat/transform';
import {transformGeom2D} from '../../geom/SimpleGeometry';
import Style from "../../style/Style";
import {TransformFunction} from "../../proj";
import {Size} from "../../size";
import {FlatCoordinates} from "../../coordinate";
import {
  Circle,
  Geometry,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon
} from "../../geom";
import RenderFeature from "../Feature";
import Feature from "../../Feature";
import ImageStyle from '../../style/Image';
import { Fill, Stroke, Text} from '../../style';

/**
 * @classdesc
 * A concrete subclass of {@link module:tl/render/VectorContext~VectorContext} that implements
 * direct rendering of features and geometries to an HTML5 Canvas context.
 * Instances of this class are created internally by the library and
 * provided to application code as vectorContext member of the
 * {@link module:tl/render/Event~RenderEvent} object associated with postcompose, precompose and
 * render events emitted by layers and maps.
 */
class CanvasImmediateRenderer extends VectorContext {
  private context_: CanvasRenderingContext2D;
  private pixelRatio_: number;
  private extent_: Extent;
  private transform_: Transform;
  private transformRotation_: number;
  private viewRotation_: number;
  private squaredTolerance_: number;
  private userTransform_: TransformFunction;
  private contextFillState_: FillState;
  private contextStrokeState_: StrokeState;
  private contextTextState_: TextState;
  private fillState_: FillState;
  private strokeState_: StrokeState;
  private image_: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;
  private imageAnchorX_: number;
  private imageAnchorY_: number;
  private imageHeight_: number;
  private imageOpacity_: number;
  private imageOriginX_: number;
  private imageOriginY_: number;
  private imageRotateWithView_: boolean;
  private imageRotation_: number;
  private imageScale_: Size;
  private imageWidth_: number;
  private text_: string;
  private textOffsetX_: number;
  private textOffsetY_: number;
  private textRotateWithView_: boolean;
  private textRotation_: number;
  private textScale_: Size;
  private textFillState_: FillState;
  private textStrokeState_: StrokeState;
  private textState_: TextState;
  private pixelCoordinates_: number[];
  private tmpLocalTransform_: Transform;

  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../../extent").Extent} extent Extent.
   * @param {import("../../transform").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {number} [squaredTolerance] Optional squared tolerance for simplification.
   * @param {import("../../proj").TransformFunction} [userTransform] Transform from user to view projection.
   */
  constructor(
      context: CanvasRenderingContext2D,
      pixelRatio: number,
      extent: Extent,
      transform: Transform,
      viewRotation: number,
      squaredTolerance?: number,
      userTransform?: TransformFunction
  ) {
    super();

    /**
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.context_ = context;

    /**
     * @private
     * @type {number}
     */
    this.pixelRatio_ = pixelRatio;

    /**
     * @private
     * @type {import("../../extent").Extent}
     */
    this.extent_ = extent;

    /**
     * @private
     * @type {import("../../transform").Transform}
     */
    this.transform_ = transform;

    /**
     * @private
     * @type {number}
     */
    this.transformRotation_ = transform
        ? toFixed(Math.atan2(transform[1], transform[0]), 10)
        : 0;

    /**
     * @private
     * @type {number}
     */
    this.viewRotation_ = viewRotation;

    /**
     * @private
     * @type {number}
     */
    this.squaredTolerance_ = squaredTolerance;

    /**
     * @private
     * @type {import("../../proj").TransformFunction}
     */
    this.userTransform_ = userTransform;

    /**
     * @private
     * @type {?import("../canvas").FillState}
     */
    this.contextFillState_ = null;

    /**
     * @private
     * @type {?import("../canvas").StrokeState}
     */
    this.contextStrokeState_ = null;

    /**
     * @private
     * @type {?import("../canvas").TextState}
     */
    this.contextTextState_ = null;

    /**
     * @private
     * @type {?import("../canvas").FillState}
     */
    this.fillState_ = null;

    /**
     * @private
     * @type {?import("../canvas").StrokeState}
     */
    this.strokeState_ = null;

    /**
     * @private
     * @type {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement}
     */
    this.image_ = null;

    /**
     * @private
     * @type {number}
     */
    this.imageAnchorX_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.imageAnchorY_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.imageHeight_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.imageOpacity_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.imageOriginX_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.imageOriginY_ = 0;

    /**
     * @private
     * @type {boolean}
     */
    this.imageRotateWithView_ = false;

    /**
     * @private
     * @type {number}
     */
    this.imageRotation_ = 0;

    /**
     * @private
     * @type {import("../../size").Size}
     */
    this.imageScale_ = [0, 0];

    /**
     * @private
     * @type {number}
     */
    this.imageWidth_ = 0;

    /**
     * @private
     * @type {string}
     */
    this.text_ = '';

    /**
     * @private
     * @type {number}
     */
    this.textOffsetX_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.textOffsetY_ = 0;

    /**
     * @private
     * @type {boolean}
     */
    this.textRotateWithView_ = false;

    /**
     * @private
     * @type {number}
     */
    this.textRotation_ = 0;

    /**
     * @private
     * @type {import("../../size").Size}
     */
    this.textScale_ = [0, 0];

    /**
     * @private
     * @type {?import("../canvas").FillState}
     */
    this.textFillState_ = null;

    /**
     * @private
     * @type {?import("../canvas").StrokeState}
     */
    this.textStrokeState_ = null;

    /**
     * @private
     * @type {?import("../canvas").TextState}
     */
    this.textState_ = null;

    /**
     * @private
     * @type {Array<number>}
     */
    this.pixelCoordinates_ = [];

    /**
     * @private
     * @type {import("../../transform").Transform}
     */
    this.tmpLocalTransform_ = createTransform();
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {number} end End.
   * @param {number} stride Stride.
   * @private
   */
  private drawImages_(flatCoordinates: FlatCoordinates, offset: number, end: number, stride: number): void {
    if (!this.image_) {
      return;
    }
    const pixelCoordinates = transform2D(
        flatCoordinates,
        offset,
        end,
        stride,
        this.transform_,
        this.pixelCoordinates_
    );
    const context = this.context_;
    const localTransform = this.tmpLocalTransform_;
    const alpha = context.globalAlpha;
    if (this.imageOpacity_ != 1) {
      context.globalAlpha = alpha * this.imageOpacity_;
    }
    let rotation = this.imageRotation_;
    if (this.transformRotation_ === 0) {
      rotation -= this.viewRotation_;
    }
    if (this.imageRotateWithView_) {
      rotation += this.viewRotation_;
    }
    for (let i = 0, ii = pixelCoordinates.length; i < ii; i += 2) {
      const x = pixelCoordinates[i] - this.imageAnchorX_;
      const y = pixelCoordinates[i + 1] - this.imageAnchorY_;
      if (
          rotation !== 0 ||
          this.imageScale_[0] != 1 ||
          this.imageScale_[1] != 1
      ) {
        const centerX = x + this.imageAnchorX_;
        const centerY = y + this.imageAnchorY_;
        composeTransform(
            localTransform,
            centerX,
            centerY,
            1,
            1,
            rotation,
            -centerX,
            -centerY
        );
        context.setTransform.apply(context, localTransform);
        context.translate(centerX, centerY);
        context.scale(this.imageScale_[0], this.imageScale_[1]);
        context.drawImage(
            this.image_,
            this.imageOriginX_,
            this.imageOriginY_,
            this.imageWidth_,
            this.imageHeight_,
            -this.imageAnchorX_,
            -this.imageAnchorY_,
            this.imageWidth_,
            this.imageHeight_
        );
        context.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        context.drawImage(
            this.image_,
            this.imageOriginX_,
            this.imageOriginY_,
            this.imageWidth_,
            this.imageHeight_,
            x,
            y,
            this.imageWidth_,
            this.imageHeight_
        );
      }
    }
    if (this.imageOpacity_ != 1) {
      context.globalAlpha = alpha;
    }
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {number} end End.
   * @param {number} stride Stride.
   * @private
   */
  private drawText_(flatCoordinates: FlatCoordinates, offset: number, end: number, stride: number): void {
    if (!this.textState_ || this.text_ === '') {
      return;
    }
    if (this.textFillState_) {
      this.setContextFillState_(this.textFillState_);
    }
    if (this.textStrokeState_) {
      this.setContextStrokeState_(this.textStrokeState_);
    }
    this.setContextTextState_(this.textState_);
    const pixelCoordinates = transform2D(
        flatCoordinates,
        offset,
        end,
        stride,
        this.transform_,
        this.pixelCoordinates_
    );
    const context = this.context_;
    let rotation = this.textRotation_;
    if (this.transformRotation_ === 0) {
      rotation -= this.viewRotation_;
    }
    if (this.textRotateWithView_) {
      rotation += this.viewRotation_;
    }
    for (; offset < end; offset += stride) {
      const x = pixelCoordinates[offset] + this.textOffsetX_;
      const y = pixelCoordinates[offset + 1] + this.textOffsetY_;
      if (
          rotation !== 0 ||
          this.textScale_[0] != 1 ||
          this.textScale_[1] != 1
      ) {
        context.translate(x - this.textOffsetX_, y - this.textOffsetY_);
        context.rotate(rotation);
        context.translate(this.textOffsetX_, this.textOffsetY_);
        context.scale(this.textScale_[0], this.textScale_[1]);
        if (this.textStrokeState_) {
          context.strokeText(this.text_, 0, 0);
        }
        if (this.textFillState_) {
          context.fillText(this.text_, 0, 0);
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        if (this.textStrokeState_) {
          context.strokeText(this.text_, x, y);
        }
        if (this.textFillState_) {
          context.fillText(this.text_, x, y);
        }
      }
    }
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {number} end End.
   * @param {number} stride Stride.
   * @param {boolean} close Close.
   * @private
   * @return {number} end End.
   */
  private moveToLineTo_(flatCoordinates: FlatCoordinates, offset: number, end: number, stride: number, close: boolean): number {
    const context = this.context_;
    const pixelCoordinates = transform2D(
        flatCoordinates,
        offset,
        end,
        stride,
        this.transform_,
        this.pixelCoordinates_
    );
    context.moveTo(pixelCoordinates[0], pixelCoordinates[1]);
    let length = pixelCoordinates.length;
    if (close) {
      length -= 2;
    }
    for (let i = 2; i < length; i += 2) {
      context.lineTo(pixelCoordinates[i], pixelCoordinates[i + 1]);
    }
    if (close) {
      context.closePath();
    }
    return end;
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {Array<number>} ends Ends.
   * @param {number} stride Stride.
   * @private
   * @return {number} End.
   */
  private drawRings_(flatCoordinates: FlatCoordinates, offset: number, ends: FlatCoordinates, stride: number): number {
    for (let i = 0, ii = ends.length; i < ii; ++i) {
      offset = this.moveToLineTo_(
          flatCoordinates,
          offset,
          ends[i],
          stride,
          true
      );
    }
    return offset;
  }

  /**
   * Render a circle geometry into the canvas.  Rendering is immediate and uses
   * the current fill and stroke styles.
   *
   * @param {import("../../geom/Circle").default} geometry Circle geometry.
   * @api
   */
  public drawCircle(geometry: Circle): void {
    if (this.squaredTolerance_) {
      geometry = /** @type {import("../../geom/Circle").default} */ (<Circle>
              geometry.simplifyTransformed(
                  this.squaredTolerance_,
                  this.userTransform_
              )
      );
    }
    if (!intersects(this.extent_, geometry.getExtent())) {
      return;
    }
    if (this.fillState_ || this.strokeState_) {
      if (this.fillState_) {
        this.setContextFillState_(this.fillState_);
      }
      if (this.strokeState_) {
        this.setContextStrokeState_(this.strokeState_);
      }
      const pixelCoordinates = transformGeom2D(
          geometry,
          this.transform_,
          this.pixelCoordinates_
      );
      const dx = pixelCoordinates[2] - pixelCoordinates[0];
      const dy = pixelCoordinates[3] - pixelCoordinates[1];
      const radius = Math.sqrt(dx * dx + dy * dy);
      const context = this.context_;
      context.beginPath();
      context.arc(
          pixelCoordinates[0],
          pixelCoordinates[1],
          radius,
          0,
          2 * Math.PI
      );
      if (this.fillState_) {
        context.fill();
      }
      if (this.strokeState_) {
        context.stroke();
      }
    }
    if (this.text_ !== '') {
      this.drawText_(geometry.getCenter(), 0, 2, 2);
    }
  }

  /**
   * Set the rendering style.  Note that since this is an immediate rendering API,
   * any `zIndex` on the provided style will be ignored.
   *
   * @param {import("../../style/Style").default} style The rendering style.
   * @api
   */
  public setStyle(style: Style): void {
    this.setFillStrokeStyle(style.getFill(), style.getStroke());
    this.setImageStyle(style.getImage());
    this.setTextStyle(style.getText());
  }

  /**
   * @param {import("../../transform").Transform} transform Transform.
   */
  public setTransform(transform: Transform): void {
    this.transform_ = transform;
  }

  /**
   * Render a geometry into the canvas.  Call
   * {@link module:tl/render/canvas/Immediate~CanvasImmediateRenderer#setStyle renderer.setStyle()} first to set the rendering style.
   *
   * @param {import("../../geom/Geometry").default|import("../Feature").default} geometry The geometry to render.
   * @api
   */
  public drawGeometry(geometry: Geometry | RenderFeature): void {
    const type = geometry.getType();
    switch (type) {
      case 'Point':
        this.drawPoint(
            /** @type {import("../../geom/Point").default} */ (<Point>geometry)
        );
        break;
      case 'LineString':
        this.drawLineString(
            /** @type {import("../../geom/LineString").default} */ (<LineString>geometry)
        );
        break;
      case 'Polygon':
        this.drawPolygon(
            /** @type {import("../../geom/Polygon").default} */ (<Polygon>geometry)
        );
        break;
      case 'MultiPoint':
        this.drawMultiPoint(
            /** @type {import("../../geom/MultiPoint").default} */ (<MultiPoint>geometry)
        );
        break;
      case 'MultiLineString':
        this.drawMultiLineString(
            /** @type {import("../../geom/MultiLineString").default} */ (<MultiLineString>
                geometry
            )
        );
        break;
      case 'MultiPolygon':
        this.drawMultiPolygon(
            /** @type {import("../../geom/MultiPolygon").default} */ (<MultiPolygon>geometry)
        );
        break;
      case 'GeometryCollection':
        this.drawGeometryCollection(
            /** @type {import("../../geom/GeometryCollection").default} */ (<GeometryCollection>
                geometry
            )
        );
        break;
      case 'Circle':
        this.drawCircle(
            /** @type {import("../../geom/Circle").default} */ (<Circle>geometry)
        );
        break;
      default:
    }
  }

  /**
   * Render a feature into the canvas.  Note that any `zIndex` on the provided
   * style will be ignored - features are rendered immediately in the order that
   * this method is called.  If you need `zIndex` support, you should be using an
   * {@link module:tl/layer/Vector~VectorLayer} instead.
   *
   * @param {import("../../Feature").default} feature Feature.
   * @param {import("../../style/Style").default} style Style.
   * @api
   */
  public drawFeature(feature: Feature, style: Style): void {
    const geometry = style.getGeometryFunction()(feature);
    if (!geometry) {
      return;
    }
    this.setStyle(style);
    this.drawGeometry(geometry);
  }

  /**
   * Render a GeometryCollection to the canvas.  Rendering is immediate and
   * uses the current styles appropriate for each geometry in the collection.
   *
   * @param {import("../../geom/GeometryCollection").default} geometry Geometry collection.
   */
  public drawGeometryCollection(geometry: GeometryCollection): void {
    const geometries = geometry.getGeometriesArray();
    for (let i = 0, ii = geometries.length; i < ii; ++i) {
      this.drawGeometry(geometries[i]);
    }
  }

  /**
   * Render a Point geometry into the canvas.  Rendering is immediate and uses
   * the current style.
   *
   * @param {import("../../geom/Point").default|import("../Feature").default} geometry Point geometry.
   */
  public drawPoint(geometry: Point | RenderFeature): void {
    if (this.squaredTolerance_) {
      geometry = /** @type {import("../../geom/Point").default} */ (<Point>
          geometry.simplifyTransformed(
              this.squaredTolerance_,
              this.userTransform_
          )
      );
    }
    const flatCoordinates = geometry.getFlatCoordinates();
    const stride = geometry.getStride();
    if (this.image_) {
      this.drawImages_(flatCoordinates, 0, flatCoordinates.length, stride);
    }
    if (this.text_ !== '') {
      this.drawText_(flatCoordinates, 0, flatCoordinates.length, stride);
    }
  }

  /**
   * Render a MultiPoint geometry  into the canvas.  Rendering is immediate and
   * uses the current style.
   *
   * @param {import("../../geom/MultiPoint").default|import("../Feature").default} geometry MultiPoint geometry.
   */
  public drawMultiPoint(geometry: MultiPoint | RenderFeature): void {
    if (this.squaredTolerance_) {
      geometry = /** @type {import("../../geom/MultiPoint").default} */ (<MultiPoint>
          geometry.simplifyTransformed(
              this.squaredTolerance_,
              this.userTransform_
          )
      );
    }
    const flatCoordinates = geometry.getFlatCoordinates();
    const stride = geometry.getStride();
    if (this.image_) {
      this.drawImages_(flatCoordinates, 0, flatCoordinates.length, stride);
    }
    if (this.text_ !== '') {
      this.drawText_(flatCoordinates, 0, flatCoordinates.length, stride);
    }
  }

  /**
   * Render a LineString into the canvas.  Rendering is immediate and uses
   * the current style.
   *
   * @param {import("../../geom/LineString").default|import("../Feature").default} geometry LineString geometry.
   */
  public drawLineString(geometry: LineString | RenderFeature): void {
    if (this.squaredTolerance_) {
      geometry = /** @type {import("../../geom/LineString").default} */ (<LineString>
          geometry.simplifyTransformed(
              this.squaredTolerance_,
              this.userTransform_
          )
      );
    }
    if (!intersects(this.extent_, geometry.getExtent())) {
      return;
    }
    if (this.strokeState_) {
      this.setContextStrokeState_(this.strokeState_);
      const context = this.context_;
      const flatCoordinates = geometry.getFlatCoordinates();
      context.beginPath();
      this.moveToLineTo_(
          flatCoordinates,
          0,
          flatCoordinates.length,
          geometry.getStride(),
          false
      );
      context.stroke();
    }
    if (this.text_ !== '') {
      const flatMidpoint = geometry.getFlatMidpoint();
      this.drawText_(flatMidpoint, 0, 2, 2);
    }
  }

  /**
   * Render a MultiLineString geometry into the canvas.  Rendering is immediate
   * and uses the current style.
   *
   * @param {import("../../geom/MultiLineString").default|import("../Feature").default} geometry MultiLineString geometry.
   */
  public drawMultiLineString(geometry: MultiLineString | RenderFeature): void {
    if (this.squaredTolerance_) {
      geometry =
          /** @type {import("../../geom/MultiLineString").default} */ (<MultiLineString>
          geometry.simplifyTransformed(
              this.squaredTolerance_,
              this.userTransform_
          )
      );
    }
    const geometryExtent = geometry.getExtent();
    if (!intersects(this.extent_, geometryExtent)) {
      return;
    }
    if (this.strokeState_) {
      this.setContextStrokeState_(this.strokeState_);
      const context = this.context_;
      const flatCoordinates = geometry.getFlatCoordinates();
      let offset = 0;
      const ends = /** @type {Array<number>} */ (<FlatCoordinates>geometry.getEnds());
      const stride = geometry.getStride();
      context.beginPath();
      for (let i = 0, ii = ends.length; i < ii; ++i) {
        offset = this.moveToLineTo_(
            flatCoordinates,
            offset,
            ends[i],
            stride,
            false
        );
      }
      context.stroke();
    }
    if (this.text_ !== '') {
      const flatMidpoints = geometry.getFlatMidpoints();
      this.drawText_(flatMidpoints, 0, flatMidpoints.length, 2);
    }
  }

  /**
   * Render a Polygon geometry into the canvas.  Rendering is immediate and uses
   * the current style.
   *
   * @param {import("../../geom/Polygon").default|import("../Feature").default} geometry Polygon geometry.
   */
  public drawPolygon(geometry: Polygon | RenderFeature): void {
    if (this.squaredTolerance_) {
      geometry = /** @type {import("../../geom/Polygon").default} */ (<Polygon>
          geometry.simplifyTransformed(
              this.squaredTolerance_,
              this.userTransform_
          )
      );
    }
    if (!intersects(this.extent_, geometry.getExtent())) {
      return;
    }
    if (this.strokeState_ || this.fillState_) {
      if (this.fillState_) {
        this.setContextFillState_(this.fillState_);
      }
      if (this.strokeState_) {
        this.setContextStrokeState_(this.strokeState_);
      }
      const context = this.context_;
      context.beginPath();
      this.drawRings_(
          geometry.getOrientedFlatCoordinates(),
          0,
          /** @type {Array<number>} */ (<FlatCoordinates>geometry.getEnds()),
          geometry.getStride()
      );
      if (this.fillState_) {
        context.fill();
      }
      if (this.strokeState_) {
        context.stroke();
      }
    }
    if (this.text_ !== '') {
      const flatInteriorPoint = geometry.getFlatInteriorPoint();
      this.drawText_(flatInteriorPoint, 0, 2, 2);
    }
  }

  /**
   * Render MultiPolygon geometry into the canvas.  Rendering is immediate and
   * uses the current style.
   * @param {import("../../geom/MultiPolygon").default} geometry MultiPolygon geometry.
   */
  public drawMultiPolygon(geometry: MultiPolygon): void {
    if (this.squaredTolerance_) {
      geometry = /** @type {import("../../geom/MultiPolygon").default} */ (<MultiPolygon>
          geometry.simplifyTransformed(
              this.squaredTolerance_,
              this.userTransform_
          )
      );
    }
    if (!intersects(this.extent_, geometry.getExtent())) {
      return;
    }
    if (this.strokeState_ || this.fillState_) {
      if (this.fillState_) {
        this.setContextFillState_(this.fillState_);
      }
      if (this.strokeState_) {
        this.setContextStrokeState_(this.strokeState_);
      }
      const context = this.context_;
      const flatCoordinates = geometry.getOrientedFlatCoordinates();
      let offset = 0;
      const endss = geometry.getEndss();
      const stride = geometry.getStride();
      context.beginPath();
      for (let i = 0, ii = endss.length; i < ii; ++i) {
        const ends = endss[i];
        offset = this.drawRings_(flatCoordinates, offset, ends, stride);
      }
      if (this.fillState_) {
        context.fill();
      }
      if (this.strokeState_) {
        context.stroke();
      }
    }
    if (this.text_ !== '') {
      const flatInteriorPoints = geometry.getFlatInteriorPoints();
      this.drawText_(flatInteriorPoints, 0, flatInteriorPoints.length, 2);
    }
  }

  /**
   * @param {import("../canvas").FillState} fillState Fill state.
   * @private
   */
  private setContextFillState_(fillState: FillState): void {
    const context = this.context_;
    const contextFillState = this.contextFillState_;
    if (!contextFillState) {
      context.fillStyle = fillState.fillStyle;
      this.contextFillState_ = {
        fillStyle: fillState.fillStyle,
      };
    } else {
      if (contextFillState.fillStyle != fillState.fillStyle) {
        contextFillState.fillStyle = fillState.fillStyle;
        context.fillStyle = fillState.fillStyle;
      }
    }
  }

  /**
   * @param {import("../canvas").StrokeState} strokeState Stroke state.
   * @private
   */
  private setContextStrokeState_(strokeState: StrokeState): void {
    const context = this.context_;
    const contextStrokeState = this.contextStrokeState_;
    if (!contextStrokeState) {
      context.lineCap = strokeState.lineCap;
      context.setLineDash(strokeState.lineDash);
      context.lineDashOffset = strokeState.lineDashOffset;
      context.lineJoin = strokeState.lineJoin;
      context.lineWidth = strokeState.lineWidth;
      context.miterLimit = strokeState.miterLimit;
      context.strokeStyle = strokeState.strokeStyle;
      this.contextStrokeState_ = {
        lineCap: strokeState.lineCap,
        lineDash: strokeState.lineDash,
        lineDashOffset: strokeState.lineDashOffset,
        lineJoin: strokeState.lineJoin,
        lineWidth: strokeState.lineWidth,
        miterLimit: strokeState.miterLimit,
        strokeStyle: strokeState.strokeStyle,
      };
    } else {
      if (contextStrokeState.lineCap != strokeState.lineCap) {
        contextStrokeState.lineCap = strokeState.lineCap;
        context.lineCap = strokeState.lineCap;
      }
      if (!equals(contextStrokeState.lineDash, strokeState.lineDash)) {
        context.setLineDash(
            (contextStrokeState.lineDash = strokeState.lineDash)
        );
      }
      if (contextStrokeState.lineDashOffset != strokeState.lineDashOffset) {
        contextStrokeState.lineDashOffset = strokeState.lineDashOffset;
        context.lineDashOffset = strokeState.lineDashOffset;
      }
      if (contextStrokeState.lineJoin != strokeState.lineJoin) {
        contextStrokeState.lineJoin = strokeState.lineJoin;
        context.lineJoin = strokeState.lineJoin;
      }
      if (contextStrokeState.lineWidth != strokeState.lineWidth) {
        contextStrokeState.lineWidth = strokeState.lineWidth;
        context.lineWidth = strokeState.lineWidth;
      }
      if (contextStrokeState.miterLimit != strokeState.miterLimit) {
        contextStrokeState.miterLimit = strokeState.miterLimit;
        context.miterLimit = strokeState.miterLimit;
      }
      if (contextStrokeState.strokeStyle != strokeState.strokeStyle) {
        contextStrokeState.strokeStyle = strokeState.strokeStyle;
        context.strokeStyle = strokeState.strokeStyle;
      }
    }
  }

  /**
   * @param {import("../canvas").TextState} textState Text state.
   * @private
   */
  private setContextTextState_(textState: TextState): void {
    const context = this.context_;
    const contextTextState = this.contextTextState_;
    const textAlign = textState.textAlign
        ? textState.textAlign
        : defaultTextAlign;
    if (!contextTextState) {
      context.font = textState.font;
      context.textAlign = textAlign;
      context.textBaseline = textState.textBaseline;
      this.contextTextState_ = {
        font: textState.font,
        textAlign: textAlign,
        textBaseline: textState.textBaseline,
      };
    } else {
      if (contextTextState.font != textState.font) {
        contextTextState.font = textState.font;
        context.font = textState.font;
      }
      if (contextTextState.textAlign != textAlign) {
        contextTextState.textAlign = textAlign;
        context.textAlign = textAlign;
      }
      if (contextTextState.textBaseline != textState.textBaseline) {
        contextTextState.textBaseline = textState.textBaseline;
        context.textBaseline = textState.textBaseline;
      }
    }
  }

  /**
   * Set the fill and stroke style for subsequent draw operations.  To clear
   * either fill or stroke styles, pass null for the appropriate parameter.
   *
   * @param {import("../../style/Fill").default} fillStyle Fill style.
   * @param {import("../../style/Stroke").default} strokeStyle Stroke style.
   */
  public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke): void {
    if (!fillStyle) {
      this.fillState_ = null;
    } else {
      const fillStyleColor = fillStyle.getColor();
      this.fillState_ = {
        fillStyle: asColorLike(
            fillStyleColor ? fillStyleColor : defaultFillStyle
        ),
      };
    }
    if (!strokeStyle) {
      this.strokeState_ = null;
    } else {
      const strokeStyleColor = strokeStyle.getColor();
      const strokeStyleLineCap = strokeStyle.getLineCap();
      const strokeStyleLineDash = strokeStyle.getLineDash();
      const strokeStyleLineDashOffset = strokeStyle.getLineDashOffset();
      const strokeStyleLineJoin = strokeStyle.getLineJoin();
      const strokeStyleWidth = strokeStyle.getWidth();
      const strokeStyleMiterLimit = strokeStyle.getMiterLimit();
      const lineDash = strokeStyleLineDash
          ? strokeStyleLineDash
          : defaultLineDash;
      this.strokeState_ = {
        lineCap:
            strokeStyleLineCap !== undefined
                ? strokeStyleLineCap
                : defaultLineCap,
        lineDash:
            this.pixelRatio_ === 1
                ? lineDash
                : lineDash.map((n) => n * this.pixelRatio_),
        lineDashOffset:
            (strokeStyleLineDashOffset
                ? strokeStyleLineDashOffset
                : defaultLineDashOffset) * this.pixelRatio_,
        lineJoin:
            strokeStyleLineJoin !== undefined
                ? strokeStyleLineJoin
                : defaultLineJoin,
        lineWidth:
            (strokeStyleWidth !== undefined
                ? strokeStyleWidth
                : defaultLineWidth) * this.pixelRatio_,
        miterLimit:
            strokeStyleMiterLimit !== undefined
                ? strokeStyleMiterLimit
                : defaultMiterLimit,
        strokeStyle: asColorLike(
            strokeStyleColor ? strokeStyleColor : defaultStrokeStyle
        ),
      };
    }
  }

  /**
   * Set the image style for subsequent draw operations.  Pass null to remove
   * the image style.
   *
   * @param {import("../../style/Image").default} imageStyle Image style.
   */
  public setImageStyle(imageStyle: ImageStyle): void {
    let imageSize: number[];
    if (!imageStyle || !(imageSize = imageStyle.getSize())) {
      this.image_ = null;
      return;
    }
    const imagePixelRatio = imageStyle.getPixelRatio(this.pixelRatio_);
    const imageAnchor = imageStyle.getAnchor();
    const imageOrigin = imageStyle.getOrigin();
    this.image_ = imageStyle.getImage(this.pixelRatio_);
    this.imageAnchorX_ = imageAnchor[0] * imagePixelRatio;
    this.imageAnchorY_ = imageAnchor[1] * imagePixelRatio;
    this.imageHeight_ = imageSize[1] * imagePixelRatio;
    this.imageOpacity_ = imageStyle.getOpacity();
    this.imageOriginX_ = imageOrigin[0];
    this.imageOriginY_ = imageOrigin[1];
    this.imageRotateWithView_ = imageStyle.getRotateWithView();
    this.imageRotation_ = imageStyle.getRotation();
    const imageScale = imageStyle.getScaleArray();
    this.imageScale_ = [
      (imageScale[0] * this.pixelRatio_) / imagePixelRatio,
      (imageScale[1] * this.pixelRatio_) / imagePixelRatio,
    ];
    this.imageWidth_ = imageSize[0] * imagePixelRatio;
  }

  /**
   * Set the text style for subsequent draw operations.  Pass null to
   * remove the text style.
   *
   * @param {import("../../style/Text").default} textStyle Text style.
   */
  public setTextStyle(textStyle: Text): void {
    if (!textStyle) {
      this.text_ = '';
    } else {
      const textFillStyle = textStyle.getFill();
      if (!textFillStyle) {
        this.textFillState_ = null;
      } else {
        const textFillStyleColor = textFillStyle.getColor();
        this.textFillState_ = {
          fillStyle: asColorLike(
            textFillStyleColor ? textFillStyleColor : defaultFillStyle
          ),
        };
      }
      const textStrokeStyle = textStyle.getStroke();
      if (!textStrokeStyle) {
        this.textStrokeState_ = null;
      } else {
        const textStrokeStyleColor = textStrokeStyle.getColor();
        const textStrokeStyleLineCap = textStrokeStyle.getLineCap();
        const textStrokeStyleLineDash = textStrokeStyle.getLineDash();
        const textStrokeStyleLineDashOffset =
          textStrokeStyle.getLineDashOffset();
        const textStrokeStyleLineJoin = textStrokeStyle.getLineJoin();
        const textStrokeStyleWidth = textStrokeStyle.getWidth();
        const textStrokeStyleMiterLimit = textStrokeStyle.getMiterLimit();
        this.textStrokeState_ = {
          lineCap:
            textStrokeStyleLineCap !== undefined
              ? textStrokeStyleLineCap
              : defaultLineCap,
          lineDash: textStrokeStyleLineDash
            ? textStrokeStyleLineDash
            : defaultLineDash,
          lineDashOffset: textStrokeStyleLineDashOffset
            ? textStrokeStyleLineDashOffset
            : defaultLineDashOffset,
          lineJoin:
            textStrokeStyleLineJoin !== undefined
              ? textStrokeStyleLineJoin
              : defaultLineJoin,
          lineWidth:
            textStrokeStyleWidth !== undefined
              ? textStrokeStyleWidth
              : defaultLineWidth,
          miterLimit:
            textStrokeStyleMiterLimit !== undefined
              ? textStrokeStyleMiterLimit
              : defaultMiterLimit,
          strokeStyle: asColorLike(
            textStrokeStyleColor ? textStrokeStyleColor : defaultStrokeStyle
          ),
        };
      }
      const textFont = textStyle.getFont();
      const textOffsetX = textStyle.getOffsetX();
      const textOffsetY = textStyle.getOffsetY();
      const textRotateWithView = textStyle.getRotateWithView();
      const textRotation = textStyle.getRotation();
      const textScale = textStyle.getScaleArray();
      const textText = textStyle.getText();
      const textTextAlign = textStyle.getTextAlign();
      const textTextBaseline = textStyle.getTextBaseline();
      this.textState_ = {
        font: textFont !== undefined ? textFont : defaultFont,
        textAlign:
          textTextAlign !== undefined ? textTextAlign : defaultTextAlign,
        textBaseline:
          textTextBaseline !== undefined
            ? textTextBaseline
            : defaultTextBaseline,
      };
      this.text_ =
        textText !== undefined
          ? Array.isArray(textText)
            ? textText.reduce((acc, t, i) => (acc += i % 2 ? ' ' : t), '')
            : textText
          : '';
      this.textOffsetX_ =
        textOffsetX !== undefined ? this.pixelRatio_ * textOffsetX : 0;
      this.textOffsetY_ =
        textOffsetY !== undefined ? this.pixelRatio_ * textOffsetY : 0;
      this.textRotateWithView_ =
        textRotateWithView !== undefined ? textRotateWithView : false;
      this.textRotation_ = textRotation !== undefined ? textRotation : 0;
      this.textScale_ = [
        this.pixelRatio_ * textScale[0],
        this.pixelRatio_ * textScale[1],
      ];
    }
  }
}

export default CanvasImmediateRenderer;
