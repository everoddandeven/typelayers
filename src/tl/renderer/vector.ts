/**
 * @module tl/renderer/vector
 */
import ImageState from '../ImageState';
import {getUid} from '../util';
import Feature, {FeatureLike} from "../Feature";
import BuilderGroup from "../render/canvas/BuilderGroup";
import Circle from "../geom/Circle";
import Style from "../style/Style";
import Layer from "../layer/Layer";
import Source from "../source/Source";
import SimpleGeometry from "../geom/SimpleGeometry";

/**
 * Feature callback. The callback will be called with three arguments. The first
 * argument is one {@link module:tl/Feature~Feature feature} or {@link module:tl/render/Feature~RenderFeature render feature}
 * at the pixel, the second is the {@link module:tl/layer/Layer~Layer layer} of the feature and will be null for
 * unmanaged layers. The third is the {@link module:tl/geom/SimpleGeometry~SimpleGeometry} of the feature. For features
 * with a GeometryCollection geometry, it will be the first detected geometry from the collection.
 * @template T
 * @typedef {function(import("../Feature").FeatureLike, import("../layer/Layer").default<import("../source/Source").default>, import("../geom/SimpleGeometry").default): T} FeatureCallback
 */

export type FeatureCallback<T> = (feature: FeatureLike, layer: Layer, source: Source, geometry: SimpleGeometry) => T;

/**
 * Tolerance for geometry simplification in device pixels.
 * @type {number}
 */
export const SIMPLIFY_TOLERANCE: number = 0.5;

/**
 * @const
 * @type {Object<import("../geom/Geometry").Type,
 *                function(import("../render/canvas/BuilderGroup").default, import("../geom/Geometry").default,
 *                         import("../style/Style").default, Object): void>}
 */
export const GEOMETRY_RENDERERS = {
  'Point': renderPointGeometry,
  'LineString': renderLineStringGeometry,
  'Polygon': renderPolygonGeometry,
  'MultiPoint': renderMultiPointGeometry,
  'MultiLineString': renderMultiLineStringGeometry,
  'MultiPolygon': renderMultiPolygonGeometry,
  'GeometryCollection': renderGeometryCollectionGeometry,
  'Circle': renderCircleGeometry,
};

/**
 * @param {import("../Feature").FeatureLike} feature1 Feature 1.
 * @param {import("../Feature").FeatureLike} feature2 Feature 2.
 * @return {number} Order.
 */
export function defaultOrder(feature1: FeatureLike, feature2: FeatureLike): number {
  return parseInt(getUid(feature1), 10) - parseInt(getUid(feature2), 10);
}

/**
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @return {number} Squared pixel tolerance.
 */
export function getSquaredTolerance(resolution: number, pixelRatio: number): number {
  const tolerance = getTolerance(resolution, pixelRatio);
  return tolerance * tolerance;
}

/**
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @return {number} Pixel tolerance.
 */
export function getTolerance(resolution: number, pixelRatio: number): number {
  return (SIMPLIFY_TOLERANCE * resolution) / pixelRatio;
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Builder group.
 * @param {import("../geom/Circle").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").default} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderCircleGeometry(
  builderGroup: BuilderGroup,
  geometry: Circle,
  style: Style,
  feature: Feature,
  declutterBuilderGroup?: BuilderGroup
) {
  const fillStyle = style.getFill();
  const strokeStyle = style.getStroke();
  if (fillStyle || strokeStyle) {
    const circleReplay = builderGroup.getBuilder(style.getZIndex(), 'Circle');
    circleReplay.setFillStrokeStyle(fillStyle, strokeStyle);
    circleReplay.drawCircle(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle && textStyle.getText()) {
    const textReplay = (declutterBuilderGroup || builderGroup).getBuilder(
      style.getZIndex(),
      'Text'
    );
    textReplay.setTextStyle(textStyle);
    textReplay.drawText(geometry, feature);
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} replayGroup Replay group.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../style/Style").default} style Style.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {function(import("../events/Event").default): void} listener Listener function.
 * @param {import("../proj").TransformFunction} [transform] Transform from user to view projection.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 * @return {boolean} `true` if style is loading.
 */
export function renderFeature(
  replayGroup,
  feature,
  style,
  squaredTolerance,
  listener,
  transform,
  declutterBuilderGroup
) {
  let loading = false;
  const imageStyle = style.getImage();
  if (imageStyle) {
    const imageState = imageStyle.getImageState();
    if (imageState == ImageState.LOADED || imageState == ImageState.ERROR) {
      imageStyle.unlistenImageChange(listener);
    } else {
      if (imageState == ImageState.IDLE) {
        imageStyle.load();
      }
      imageStyle.listenImageChange(listener);
      loading = true;
    }
  }
  renderFeatureInternal(
    replayGroup,
    feature,
    style,
    squaredTolerance,
    transform,
    declutterBuilderGroup
  );

  return loading;
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} replayGroup Replay group.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../style/Style").default} style Style.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {import("../proj").TransformFunction} [transform] Optional transform function.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderFeatureInternal(
  replayGroup,
  feature,
  style,
  squaredTolerance,
  transform,
  declutterBuilderGroup
) {
  const geometry = style.getGeometryFunction()(feature);
  if (!geometry) {
    return;
  }
  const simplifiedGeometry = geometry.simplifyTransformed(
    squaredTolerance,
    transform
  );
  const renderer = style.getRenderer();
  if (renderer) {
    renderGeometry(replayGroup, simplifiedGeometry, style, feature);
  } else {
    const geometryRenderer = GEOMETRY_RENDERERS[simplifiedGeometry.getType()];
    geometryRenderer(
      replayGroup,
      simplifiedGeometry,
      style,
      feature,
      declutterBuilderGroup
    );
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} replayGroup Replay group.
 * @param {import("../geom/Geometry").default|import("../render/Feature").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").FeatureLike} feature Feature.
 */
function renderGeometry(replayGroup, geometry, style, feature) {
  if (geometry.getType() == 'GeometryCollection') {
    const geometries =
      /** @type {import("../geom/GeometryCollection").default} */ (
        geometry
      ).getGeometries();
    for (let i = 0, ii = geometries.length; i < ii; ++i) {
      renderGeometry(replayGroup, geometries[i], style, feature);
    }
    return;
  }
  const replay = replayGroup.getBuilder(style.getZIndex(), 'Default');
  replay.drawCustom(
    /** @type {import("../geom/SimpleGeometry").default} */ (geometry),
    feature,
    style.getRenderer(),
    style.getHitDetectionRenderer()
  );
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} replayGroup Replay group.
 * @param {import("../geom/GeometryCollection").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").default} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderGeometryCollectionGeometry(
  replayGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const geometries = geometry.getGeometriesArray();
  let i, ii;
  for (i = 0, ii = geometries.length; i < ii; ++i) {
    const geometryRenderer = GEOMETRY_RENDERERS[geometries[i].getType()];
    geometryRenderer(
      replayGroup,
      geometries[i],
      style,
      feature,
      declutterBuilderGroup
    );
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Replay group.
 * @param {import("../geom/LineString").default|import("../render/Feature").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderLineStringGeometry(
  builderGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const strokeStyle = style.getStroke();
  if (strokeStyle) {
    const lineStringReplay = builderGroup.getBuilder(
      style.getZIndex(),
      'LineString'
    );
    lineStringReplay.setFillStrokeStyle(null, strokeStyle);
    lineStringReplay.drawLineString(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle && textStyle.getText()) {
    const textReplay = (declutterBuilderGroup || builderGroup).getBuilder(
      style.getZIndex(),
      'Text'
    );
    textReplay.setTextStyle(textStyle);
    textReplay.drawText(geometry, feature);
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Replay group.
 * @param {import("../geom/MultiLineString").default|import("../render/Feature").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderMultiLineStringGeometry(
  builderGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const strokeStyle = style.getStroke();
  if (strokeStyle) {
    const lineStringReplay = builderGroup.getBuilder(
      style.getZIndex(),
      'LineString'
    );
    lineStringReplay.setFillStrokeStyle(null, strokeStyle);
    lineStringReplay.drawMultiLineString(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle && textStyle.getText()) {
    const textReplay = (declutterBuilderGroup || builderGroup).getBuilder(
      style.getZIndex(),
      'Text'
    );
    textReplay.setTextStyle(textStyle);
    textReplay.drawText(geometry, feature);
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Replay group.
 * @param {import("../geom/MultiPolygon").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").default} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderMultiPolygonGeometry(
  builderGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const fillStyle = style.getFill();
  const strokeStyle = style.getStroke();
  if (strokeStyle || fillStyle) {
    const polygonReplay = builderGroup.getBuilder(style.getZIndex(), 'Polygon');
    polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
    polygonReplay.drawMultiPolygon(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle && textStyle.getText()) {
    const textReplay = (declutterBuilderGroup || builderGroup).getBuilder(
      style.getZIndex(),
      'Text'
    );
    textReplay.setTextStyle(textStyle);
    textReplay.drawText(geometry, feature);
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Replay group.
 * @param {import("../geom/Point").default|import("../render/Feature").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderPointGeometry(
  builderGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const imageStyle = style.getImage();
  const textStyle = style.getText();
  /** @type {import("../render/canvas").DeclutterImageWithText} */
  let declutterImageWithText;
  if (imageStyle) {
    if (imageStyle.getImageState() != ImageState.LOADED) {
      return;
    }
    let imageBuilderGroup = builderGroup;
    if (declutterBuilderGroup) {
      const declutterMode = imageStyle.getDeclutterMode();
      if (declutterMode !== 'none') {
        imageBuilderGroup = declutterBuilderGroup;
        if (declutterMode === 'obstacle') {
          // draw in non-declutter group:
          const imageReplay = builderGroup.getBuilder(
            style.getZIndex(),
            'Image'
          );
          imageReplay.setImageStyle(imageStyle, declutterImageWithText);
          imageReplay.drawPoint(geometry, feature);
        } else if (textStyle && textStyle.getText()) {
          declutterImageWithText = {};
        }
      }
    }
    const imageReplay = imageBuilderGroup.getBuilder(
      style.getZIndex(),
      'Image'
    );
    imageReplay.setImageStyle(imageStyle, declutterImageWithText);
    imageReplay.drawPoint(geometry, feature);
  }
  if (textStyle && textStyle.getText()) {
    let textBuilderGroup = builderGroup;
    if (declutterBuilderGroup) {
      textBuilderGroup = declutterBuilderGroup;
    }
    const textReplay = textBuilderGroup.getBuilder(style.getZIndex(), 'Text');
    textReplay.setTextStyle(textStyle, declutterImageWithText);
    textReplay.drawText(geometry, feature);
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Replay group.
 * @param {import("../geom/MultiPoint").default|import("../render/Feature").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderMultiPointGeometry(
  builderGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const imageStyle = style.getImage();
  const textStyle = style.getText();
  /** @type {import("../render/canvas").DeclutterImageWithText} */
  let declutterImageWithText;
  if (imageStyle) {
    if (imageStyle.getImageState() != ImageState.LOADED) {
      return;
    }
    let imageBuilderGroup = builderGroup;
    if (declutterBuilderGroup) {
      const declutterMode = imageStyle.getDeclutterMode();
      if (declutterMode !== 'none') {
        imageBuilderGroup = declutterBuilderGroup;
        if (declutterMode === 'obstacle') {
          // draw in non-declutter group:
          const imageReplay = builderGroup.getBuilder(
            style.getZIndex(),
            'Image'
          );
          imageReplay.setImageStyle(imageStyle, declutterImageWithText);
          imageReplay.drawMultiPoint(geometry, feature);
        } else if (textStyle && textStyle.getText()) {
          declutterImageWithText = {};
        }
      }
    }
    const imageReplay = imageBuilderGroup.getBuilder(
      style.getZIndex(),
      'Image'
    );
    imageReplay.setImageStyle(imageStyle, declutterImageWithText);
    imageReplay.drawMultiPoint(geometry, feature);
  }
  if (textStyle && textStyle.getText()) {
    let textBuilderGroup = builderGroup;
    if (declutterBuilderGroup) {
      textBuilderGroup = declutterBuilderGroup;
    }
    const textReplay = textBuilderGroup.getBuilder(style.getZIndex(), 'Text');
    textReplay.setTextStyle(textStyle, declutterImageWithText);
    textReplay.drawText(geometry, feature);
  }
}

/**
 * @param {import("../render/canvas/BuilderGroup").default} builderGroup Replay group.
 * @param {import("../geom/Polygon").default|import("../render/Feature").default} geometry Geometry.
 * @param {import("../style/Style").default} style Style.
 * @param {import("../Feature").FeatureLike} feature Feature.
 * @param {import("../render/canvas/BuilderGroup").default} [declutterBuilderGroup] Builder for decluttering.
 */
function renderPolygonGeometry(
  builderGroup,
  geometry,
  style,
  feature,
  declutterBuilderGroup
) {
  const fillStyle = style.getFill();
  const strokeStyle = style.getStroke();
  if (fillStyle || strokeStyle) {
    const polygonReplay = builderGroup.getBuilder(style.getZIndex(), 'Polygon');
    polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
    polygonReplay.drawPolygon(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle && textStyle.getText()) {
    const textReplay = (declutterBuilderGroup || builderGroup).getBuilder(
      style.getZIndex(),
      'Text'
    );
    textReplay.setTextStyle(textStyle);
    textReplay.drawText(geometry, feature);
  }
}
