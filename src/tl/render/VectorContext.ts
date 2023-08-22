/**
 * @module tl/render/VectorContext
 */

import Geometry from "../geom/Geometry";
import Feature, {FeatureLike} from "../Feature";
import Circle from "../geom/Circle";
import GeometryCollection from "../geom/GeometryCollection";
import {LineString} from "../geom";
import RenderFeature from "./Feature";
import MultiLineString from "../geom/MultiLineString";
import {DeclutterImageWithText} from "./canvas";
import Text from "../style/Text";
import ImageStyle from "../style/Image";
import Fill from "../style/Fill";
import Stroke from "../style/Stroke";
import SimpleGeometry from "../geom/SimpleGeometry";
import {Style} from "../style";
import MultiPolygon from "../geom/MultiPolygon";
import Point from "../geom/Point";
import Polygon from "../geom/Polygon";
import MultiPoint from "../geom/MultiPoint";

/**
 * @classdesc
 * Context for drawing geometries.  A vector context is available on render
 * events and does not need to be constructed directly.
 * @api
 */
class VectorContext {
  /**
   * Render a geometry with a custom renderer.
   *
   * @param {import("../geom/SimpleGeometry").default} geometry Geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   * @param {Function} renderer Renderer.
   * @param {Function} hitDetectionRenderer Renderer.
   */
  public drawCustom(geometry: Geometry, feature: FeatureLike, renderer: Function, hitDetectionRenderer: Function): void {}

  /**
   * Render a geometry.
   *
   * @param {import("../geom/Geometry").default} geometry The geometry to render.
   */
  public drawGeometry(geometry: Geometry): void {}

  /**
   * Set the rendering style.
   *
   * @param {import("../style/Style").default} style The rendering style.
   */
  public setStyle(style: Style): void {}

  /**
   * @param {import("../geom/Circle").default} circleGeometry Circle geometry.
   * @param {import("../Feature").default} feature Feature.
   */
  public drawCircle(circleGeometry: Circle, feature: Feature): void {}

  /**
   * @param {import("../Feature").default} feature Feature.
   * @param {import("../style/Style").default} style Style.
   */
  public drawFeature(feature: Feature, style: Style) {}

  /**
   * @param {import("../geom/GeometryCollection").default} geometryCollectionGeometry Geometry collection.
   * @param {import("../Feature").default} feature Feature.
   */
  public drawGeometryCollection(geometryCollectionGeometry: GeometryCollection, feature: Feature): void {}

  /**
   * @param {import("../geom/LineString").default|import("./Feature").default} lineStringGeometry Line string geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  public drawLineString(lineStringGeometry: LineString | RenderFeature, feature: Feature): void {}

  /**
   * @param {import("../geom/MultiLineString").default|import("./Feature").default} multiLineStringGeometry MultiLineString geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  public drawMultiLineString(multiLineStringGeometry: MultiLineString | RenderFeature, feature: Feature): void {}

  /**
   * @param {import("../geom/MultiPoint").default|import("./Feature").default} multiPointGeometry MultiPoint geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  public drawMultiPoint(multiPointGeometry: MultiPoint | RenderFeature, feature: FeatureLike): void {}

  /**
   * @param {import("../geom/MultiPolygon").default} multiPolygonGeometry MultiPolygon geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  public drawMultiPolygon(multiPolygonGeometry: MultiPolygon, feature: FeatureLike): void {}

  /**
   * @param {import("../geom/Point").default|import("./Feature").default} pointGeometry Point geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  drawPoint(pointGeometry: Point | RenderFeature, feature: FeatureLike): void {}

  /**
   * @param {import("../geom/Polygon").default|import("./Feature").default} polygonGeometry Polygon geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  public drawPolygon(polygonGeometry: Polygon | RenderFeature, feature: FeatureLike) {}

  /**
   * @param {import("../geom/SimpleGeometry").default|import("./Feature").default} geometry Geometry.
   * @param {import("../Feature").FeatureLike} feature Feature.
   */
  public drawText(geometry: SimpleGeometry | RenderFeature, feature: FeatureLike): void {}

  /**
   * @param {import("../style/Fill").default} fillStyle Fill style.
   * @param {import("../style/Stroke").default} strokeStyle Stroke style.
   */
  public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke) {}

  /**
   * @param {import("../style/Image").default} imageStyle Image style.
   * @param {import("./canvas").DeclutterImageWithText} [declutterImageWithText] Shared data for combined decluttering with a text style.
   */
  public setImageStyle(imageStyle: ImageStyle, declutterImageWithText?: DeclutterImageWithText): void {}

  /**
   * @param {import("../style/Text").default} textStyle Text style.
   * @param {import("./canvas").DeclutterImageWithText} [declutterImageWithText] Shared data for combined decluttering with an image style.
   */
  public setTextStyle(textStyle: Text, declutterImageWithText?: DeclutterImageWithText): void {}
}

export default VectorContext;
