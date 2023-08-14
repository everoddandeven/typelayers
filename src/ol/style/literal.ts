/**
 * Literal style objects differ from standard styles in that they cannot
 * be functions and are made up of simple objects instead of classes.
 * @module ol/style/literal
 */

/**
 * @typedef {import("./expressions").ExpressionValue} ExpressionValue
 */

import {ExpressionValue} from "./expressions";

export type ColorExpression = import("../color").Color | string | ExpressionValue[];

export interface BaseProps {
  filter?: ExpressionValue;
  variables?: {[key: string]: number | number[] | string | boolean};
  symbol?: LiteralSymbolStyle;
}

/**
 * @enum {string}
 */
export enum SymbolType {
  CIRCLE = 'circle',
  SQUARE = 'square',
  TRIANGLE = 'triangle',
  IMAGE = 'image',
}

export interface LiteralSymbolStyle {
  size: ExpressionValue | Array<ExpressionValue>;
  symbolType: SymbolType;
  src?: string;
  crossOrigin?: string;
  color?: ColorExpression;
  opacity?: ExpressionValue;
  rotation?: ExpressionValue;
  offset?: [ExpressionValue, ExpressionValue];
  textureCoord?: [ExpressionValue, ExpressionValue, ExpressionValue, ExpressionValue];
  rotateWithView?: boolean;
}

/**
 * @typedef {Object} FillProps
 * @property {ColorExpression} [fill-color] The fill color.
 */

export interface FillProps
{
  fillColor?: ColorExpression;
}

/**
 * @typedef {Object} StrokeProps
 * @property {ColorExpression} [stroke-color] The stroke color.
 * @property {number|ExpressionValue} [stroke-width] Stroke pixel width.
 */

export interface StrokeProps
{
  strokeColor: ColorExpression;
  strokeWidth: number | ExpressionValue;
}

export interface IconProps {
  iconSrc?: string;
  iconImg?: HTMLImageElement | HTMLCanvasElement;
  iconImgSize?: import("../size").Size;
  iconAnchor?: Array<number>;
  iconAnchorOrigin?: import("./Icon").IconOrigin;
  iconAnchorXUnits?: import("./Icon").IconAnchorUnits;
  iconAnchorYUnits?: import("./Icon").IconAnchorUnits;
  iconColor?: ColorExpression;
  iconCrossOrigin?: null | string;
  iconOffset?: Array<number> | Array<ExpressionValue>;
  iconDisplacement?: Array<number> | Array<ExpressionValue>;
  iconOffsetOrigin?: import("./Icon").IconOrigin;
  iconOpacity?: number;
  iconScale?: ExpressionValue | Array<ExpressionValue> | number | import("../size").Size;
  iconWidth?: ExpressionValue | number;
  iconHeight?: ExpressionValue | number;
  iconRotation?: ExpressionValue | number;
  iconRotateWithView?: boolean;
  iconSize?: Array<ExpressionValue> | import("../size").Size;
}

export interface ShapeProps {
  shapePoints?: number;
  shapeFillColor?: ColorExpression;
  shapeStrokeColor?: ColorExpression;
  shapeStrokeWidth?: ExpressionValue | number;
  shapeRadius?: ExpressionValue | number;
  shapeRadius1?: ExpressionValue | number;
  shapeRadius2?: ExpressionValue | number;
  shapeAngle?: ExpressionValue | number;
  shapeDisplacement?: Array<ExpressionValue> | Array<number>;
  shapeRotation?: ExpressionValue | number;
  shapeRotateWithView?: boolean;
  shapeScale?: ExpressionValue | Array<ExpressionValue> | number | import("../size").Size;
}

export interface CircleProps {
  circleRadius?: ExpressionValue | number;
  circleFillColor?: ColorExpression;
  circleStrokeColor?: ColorExpression;
  circleStrokeWidth?: ExpressionValue | number;
  circleDisplacement?: Array<ExpressionValue> | Array<number>;
  circleScale?: ExpressionValue | Array<ExpressionValue> | number | import("../size").Size;
  circleRotation?: ExpressionValue | number;
  circleRotateWithView?: boolean;
}


// FIXME Present in flat style but not implemented in literal webgl style:
//  - color like (fill patterns etc.)
//  - stroke line cap/join/miter limit
//  - stroke dash pattern/offset
//  - icon declutter mode
//  - circle line cap/join/miter limit
//  - circle dash pattern/offset
//  - circle declutter mode
//  - shape line cap/join/miter limit
//  - shape dash pattern/offset
//  - shape declutter mode
//  - text style

export type LiteralStyle = BaseProps & IconProps & StrokeProps & FillProps & CircleProps & ShapeProps;
