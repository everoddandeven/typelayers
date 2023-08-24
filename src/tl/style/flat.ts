/**
 * @module tl/style/flat
 */

import Circle from './Circle';
import Fill from './Fill';
import Icon from './Icon';
import RegularShape from './RegularShape';
import Stroke from './Stroke';
import Style from './Style';
import Text, {TextJustify, TextPlacement} from './Text';
import {Color} from "../color";
import {ColorLike} from "../colorlike";
import {Size} from "../size";
import Image from "./Image";

export type FlatStyle = FlatFill & FlatStroke & FlatText & FlatIcon & FlatShape & FlatCircle;

export type FlatStyleLike = FlatStyle | Array<FlatStyle>;

export interface FlatText
{
  textValue?: string | string[];
  textFont?: string;
  textMaxAngle?: number;
  textOffsetX?: number;
  textOffsetY?: number;
  textOverflow?: boolean;
  textPlacement?: TextPlacement;
  textRepeat?: number;
  textScale?: Size;
  textRotateWithView?: boolean;
  textRotation?: number;
  textAlign?: CanvasTextAlign;
  textJustify?: TextJustify;
  textBaseLine?: CanvasTextBaseline;
  textPadding?: number[];
  textFillColor?: Color | ColorLike;
  textBackgroundFillColor?: Color | ColorLike;
  textStrokeColor?: Color | ColorLike;
  textStrokeLineCap?: CanvasLineCap;
  textStrokeLineJoin?: CanvasLineJoin;
  textStrokeLineDash?: number[];
  textStrokeLineDashOffset?: number;
  textStrokeMiterLimit?: number;
  textStrokeWidth?: number;
  textBackgroundStrokeColor?: Color | ColorLike;
  textBackgroundStrokeLineCap?: CanvasLineCap;
  textBackgroundStrokeLineJoin?: CanvasLineJoin;
  textBackgroundStrokeLineDash?: number[];
  textBackgroundStrokeLineDashOffset?: number;
  textBackgroundStrokeMiterLimit?: number;
  textBackgroundStrokeWidth?: number;
}

interface FlatFill {
  fillColor?: Color | ColorLike;
}

export interface FlatStroke
{
  strokeColor?: Color | ColorLike;
  strokeWidth?: number;
  strokeLineCap?: CanvasLineCap;
  strokeLineJoin?: CanvasLineJoin;
  strokeLineDash?: number[];
  strokeLineDashOffset?: number;
  strokeMiterLimit?: number;
}


export interface FlatIcon {
  iconSrc?: string;
  iconImg?: HTMLImageElement | HTMLCanvasElement;
  iconImgSize?: import("../size").Size;
  iconAnchor?: Array<number>;
  iconAnchorOrigin?: import("./Icon").IconOrigin;
  iconAnchorXUnits?: import("./Icon").IconAnchorUnits;
  iconAnchorYUnits?: import("./Icon").IconAnchorUnits;
  iconColor?: import("../color").Color | string;
  iconCrossOrigin?: null | string;
  iconOffset?: Array<number>;
  iconDisplacement?: Array<number>;
  iconOffsetOrigin?: import("./Icon").IconOrigin;
  iconOpacity?: number;
  iconScale?: number | import("../size").Size;
  iconWidth?: number;
  iconHeight?: number;
  iconRotation?: number;
  iconRotateWithView?: boolean;
  iconSize?: import("../size").Size;
  iconDeclutterMode?: "declutter" | "obstacle" | "none" | undefined;
}

export interface FlatShape {
  shapePoints?: number;
  shapeFillColor?: Color | ColorLike;
  shapeStrokeColor?: Color | ColorLike;
  shapeStrokeWidth?: number;
  shapeStrokeLineCap?: CanvasLineCap;
  shapeStrokeLineJoin?: CanvasLineJoin;
  shapeStrokeLineSash?: Array<number>;
  shapeStrokeLineDashOffset?: number;
  shapeStrokeMiterLimit?: number;
  shapeRadius?: number;
  shapeRadius1?: number;
  shapeRadius2?: number;
  shapeAngle?: number;
  shapeDisplacement?: Array<number>;
  shapeRotation?: number;
  shapeRotateWithView?: boolean;
  shapeScale?: number | Size;
  shapeDeclutterMode?: "declutter" | "obstacle" | "none" | undefined;
}

export interface FlatCircle {
  circleRadius?: number;
  circleFillColor?: Color | ColorLike;
  circleStrokeColor?: Color | ColorLike;
  circleStrokeWidth?: number;
  circleStrokeLineCap?: CanvasLineCap;
  circleStrokeLineJoin?: CanvasLineJoin;
  circleStrokeLineDash?: Array<number>;
  circleStrokeLineDashOffset?: number;
  circleStrokeMiterLimit?: number;
  circleDisplacement?: Array<number>;
  circleScale?: number | Size;
  circleRotation?: number;
  circleRotateWithView?: boolean;
  circleDeclutterMode?: "declutter" | "obstacle" | "none" | undefined;
}

/**
 * @param {FlatStyle} flatStyle A flat style literal.
 * @return {import("./Style").default} A style instance.
 */
export function toStyle(flatStyle: FlatStyle): Style {
  return new Style({
    fill: getFill(flatStyle, ''),
    stroke: getStroke(flatStyle, ''),
    text: getText(flatStyle),
    image: getImage(flatStyle),
  });
}

/**
 * @param {FlatStyle} flatStyle The flat style.
 * @param {string} prefix The property prefix.
 * @return {Fill|null|undefined} The fill (if any).
 */
function getFill(flatStyle: FlatStyle, prefix: string): Fill | null {
  const color = flatStyle[prefix + 'fill-color'];
  if (!color) {
    return color;
  }

  return new Fill({color: color});
}

/**
 * @param {FlatStyle} flatStyle The flat style.
 * @param {string} prefix The property prefix.
 * @return {Stroke|undefined} The stroke (if any).
 */
function getStroke(flatStyle: FlatStyle, prefix: string): Stroke {
  const width = flatStyle[prefix + 'stroke-width'];
  const color = flatStyle[prefix + 'stroke-color'];
  if (!width && !color) {
    return;
  }

  return new Stroke({
    width: width,
    color: color,
    lineCap: flatStyle[prefix + 'stroke-line-cap'],
    lineJoin: flatStyle[prefix + 'stroke-line-join'],
    lineDash: flatStyle[prefix + 'stroke-line-dash'],
    lineDashOffset: flatStyle[prefix + 'stroke-line-dash-offset'],
    miterLimit: flatStyle[prefix + 'stroke-miter-limit'],
  });
}

/**
 * @param {FlatStyle} flatStyle The flat style.
 * @return {Text|undefined} The text (if any).
 */
function getText(flatStyle: FlatStyle): Text {
  const value = flatStyle['text-value'];
  if (!value) {
    return;
  }

  return new Text({
    text: value,
    font: flatStyle['text-font'],
    maxAngle: flatStyle['text-max-angle'],
    offsetX: flatStyle['text-offset-x'],
    offsetY: flatStyle['text-offset-y'],
    overflow: flatStyle['text-overflow'],
    placement: flatStyle['text-placement'],
    repeat: flatStyle['text-repeat'],
    scale: flatStyle['text-scale'],
    rotateWithView: flatStyle['text-rotate-with-view'],
    rotation: flatStyle['text-rotation'],
    textAlign: flatStyle['text-align'],
    justify: flatStyle['text-justify'],
    textBaseline: flatStyle['text-baseline'],
    padding: flatStyle['text-padding'],
    fill: getFill(flatStyle, 'text-'),
    backgroundFill: getFill(flatStyle, 'text-background-'),
    stroke: getStroke(flatStyle, 'text-'),
    backgroundStroke: getStroke(flatStyle, 'text-background-'),
  });
}

/**
 * @param {FlatStyle} flatStyle The flat style.
 * @return {import("./Image").default|undefined} The image (if any).
 */
function getImage(flatStyle: FlatStyle): Image {
  const iconSrc = flatStyle['icon-src'];
  const iconImg = flatStyle['icon-img'];
  if (iconSrc || iconImg) {
    return new Icon({
      src: iconSrc,
      img: iconImg,
      imgSize: flatStyle['icon-img-size'],
      anchor: flatStyle['icon-anchor'],
      anchorOrigin: flatStyle['icon-anchor-origin'],
      anchorXUnits: flatStyle['icon-anchor-x-units'],
      anchorYUnits: flatStyle['icon-anchor-y-units'],
      color: flatStyle['icon-color'],
      crossOrigin: flatStyle['icon-cross-origin'],
      offset: flatStyle['icon-offset'],
      displacement: flatStyle['icon-displacement'],
      opacity: flatStyle['icon-opacity'],
      scale: flatStyle['icon-scale'],
      width: flatStyle['icon-width'],
      height: flatStyle['icon-height'],
      rotation: flatStyle['icon-rotation'],
      rotateWithView: flatStyle['icon-rotate-with-view'],
      size: flatStyle['icon-size'],
      declutterMode: flatStyle['icon-declutter-mode'],
    });
  }

  const shapePoints = flatStyle['shape-points'];
  if (shapePoints) {
    const prefix = 'shape-';
    return new RegularShape({
      points: shapePoints,
      fill: getFill(flatStyle, prefix),
      stroke: getStroke(flatStyle, prefix),
      radius: flatStyle['shape-radius'],
      radius1: flatStyle['shape-radius1'],
      radius2: flatStyle['shape-radius2'],
      angle: flatStyle['shape-angle'],
      displacement: flatStyle['shape-displacement'],
      rotation: flatStyle['shape-rotation'],
      rotateWithView: flatStyle['shape-rotate-with-view'],
      scale: flatStyle['shape-scale'],
      declutterMode: flatStyle['shape-declutter-mode'],
    });
  }

  const circleRadius = flatStyle['circle-radius'];
  if (circleRadius) {
    const prefix = 'circle-';
    return new Circle({
      radius: circleRadius,
      fill: getFill(flatStyle, prefix),
      stroke: getStroke(flatStyle, prefix),
      displacement: flatStyle['circle-displacement'],
      scale: flatStyle['circle-scale'],
      rotation: flatStyle['circle-rotation'],
      rotateWithView: flatStyle['circle-rotate-with-view'],
      declutterMode: flatStyle['circle-declutter-mode'],
    });
  }

  return;
}

/**
 * @return {import('./flat').FlatStyle} The default flat style.
 */
export function createDefaultStyle(): FlatStyle {
  return {
    'fillColor': 'rgba(255,255,255,0.4)',
    'strokeColor': '#3399CC',
    'strokeWidth': 1.25,
    'circleRadius': 5,
    'circleFillColor': 'rgba(255,255,255,0.4)',
    'circleStrokeWidth': 1.25,
    'circleStrokeColor': '#3399CC',
  };
}
