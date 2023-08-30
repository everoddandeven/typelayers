/**
 * Utilities for parsing literal style objects
 * @module tl/webgl/styleparser
 */
import {ShaderBuilder} from './ShaderBuilder';
import {
  ValueTypes,
  expressionToGlsl,
  getStringNumberEquivalent,
  uniformNameForVariable, ParsingContext,
} from '../style/expressions';
import {asArray, Color} from '../color';
import {LiteralStyle, SymbolType} from "../style/literal";
import {UniformValue} from "./Helper";
import {AttributeDefinitions, UniformDefinitions} from "../render/webgl/VectorStyleRenderer";

/**
 * @param {import('../style/literal').SymbolType} type Symbol type
 * @param {string} sizeExpressionGlsl Size expression
 * @return {string} The GLSL opacity function
 */
export function getSymbolOpacityGlslFunction(type: SymbolType, sizeExpressionGlsl: string): string {
  switch (type) {
    case 'square':
    case 'image':
      return '1.0';
    // taken from https://thebookofshaders.com/07/
    case 'circle':
      return `(1.0-smoothstep(1.-4./${sizeExpressionGlsl},1.,dot(v_quadCoord-.5,v_quadCoord-.5)*4.))`;
    case 'triangle':
      const st = '(v_quadCoord*2.-1.)';
      const a = `(atan(${st}.x,${st}.y))`;
      return `(1.0-smoothstep(.5-3./${sizeExpressionGlsl},.5,cos(floor(.5+${a}/2.094395102)*2.094395102-${a})*length(${st})))`;
    default:
      throw new Error(`Unexpected symbol type: ${type}`);
  }
}

/**
 * Packs all components of a color into a two-floats array
 * @param {import("../color").Color|string} color Color as array of numbers or string
 * @return {Array<number>} Vec2 array containing the color in compressed form
 */
export function packColor(color: Color | string): number[] {
  const array = asArray(color);
  const r = array[0] * 256;
  const g = array[1];
  const b = array[2] * 256;
  const a = Math.round(array[3] * 255);
  return [r + g, b + a];
}

const UNPACK_COLOR_FN: string = `vec4 unpackColor(vec2 packedColor) {
  return fract(packedColor[1] / 256.0) * vec4(
    fract(floor(packedColor[0] / 256.0) / 256.0),
    fract(packedColor[0] / 256.0),
    fract(floor(packedColor[1] / 256.0) / 256.0),
    1.0
  );
}`;

/**
 * @param {ValueTypes} type Value type
 * @return {1|2|3|4} The amount of components for this value
 */
function getGlslSizeFromType(type: ValueTypes): 1 | 2 | 3 | 4 {
  if (type === ValueTypes.COLOR) {
    return 2;
  }
  if (type === ValueTypes.NUMBER_ARRAY) {
    return 4;
  }
  return 1;
}

/**
 * @param {ValueTypes} type Value type
 * @return {'float'|'vec2'|'vec3'|'vec4'} The corresponding GLSL type for this value
 */
function getGlslTypeFromType(type: ValueTypes): string {
  const size = getGlslSizeFromType(type);
  if (size > 1) {
    return /** @type {'vec2'|'vec3'|'vec4'} */ (`vec${size}`);
  }
  return 'float';
}

/**
 * @param {import("../style/literal").LiteralStyle} style Style
 * @param {ShaderBuilder} builder Shader builder
 * @param {Object<string,import("./Helper").UniformValue>} uniforms Uniforms
 * @param {import("../style/expressions").ParsingContext} vertContext Vertex shader parsing context
 * @param {import("../style/expressions").ParsingContext} fragContext Fragment shader parsing context
 */
function parseSymbolProperties(
  style: LiteralStyle,
  builder: ShaderBuilder,
  uniforms: {[key: string]: UniformValue},
  vertContext: ParsingContext,
  fragContext: ParsingContext
): void {
  if (!('symbol' in style)) {
    return;
  }

  const symbolStyle = style.symbol;
  if ('color' in symbolStyle) {
    const color = symbolStyle.color;
    const opacity = symbolStyle.opacity !== undefined ? symbolStyle.opacity : 1;
    const parsedColor = expressionToGlsl(fragContext, color, ValueTypes.COLOR);
    const parsedOpacity = expressionToGlsl(
      fragContext,
      opacity,
      ValueTypes.NUMBER
    );
    builder.setSymbolColorExpression(
      `vec4(${parsedColor}.rgb, ${parsedColor}.a * ${parsedOpacity})`
    );
  }
  if (symbolStyle.symbolType === 'image' && symbolStyle.src) {
    const texture = new Image();
    texture.crossOrigin =
      symbolStyle.crossOrigin === undefined
        ? 'anonymous'
        : symbolStyle.crossOrigin;
    texture.src = symbolStyle.src;
    builder
      .addUniform('sampler2D u_texture')
      .setSymbolColorExpression(
        `${builder.getSymbolColorExpression()} * texture2D(u_texture, v_texCoord)`
      );
    uniforms['u_texture'] = texture;
  } else if ('symbolType' in symbolStyle) {
    let visibleSize = builder.getSymbolSizeExpression();
    if ('size' in symbolStyle) {
      visibleSize = expressionToGlsl(
        fragContext,
        symbolStyle.size,
        ValueTypes.NUMBER_ARRAY | ValueTypes.NUMBER
      );
    }
    const symbolOpacity = getSymbolOpacityGlslFunction(
      symbolStyle.symbolType,
      `vec2(${visibleSize}).x`
    );
    builder.setSymbolColorExpression(
      `${builder.getSymbolColorExpression()} * vec4(1.0, 1.0, 1.0, ${symbolOpacity})`
    );
  }
  if ('size' in symbolStyle) {
    const size = symbolStyle.size;
    const parsedSize = expressionToGlsl(
      vertContext,
      size,
      ValueTypes.NUMBER_ARRAY | ValueTypes.NUMBER
    );
    builder.setSymbolSizeExpression(`vec2(${parsedSize})`);
  }
  if ('textureCoord' in symbolStyle) {
    builder.setTextureCoordinateExpression(
      expressionToGlsl(
        vertContext,
        symbolStyle.textureCoord,
        ValueTypes.NUMBER_ARRAY
      )
    );
  }
  if ('offset' in symbolStyle) {
    builder.setSymbolOffsetExpression(
      expressionToGlsl(vertContext, symbolStyle.offset, ValueTypes.NUMBER_ARRAY)
    );
  }
  if ('rotation' in symbolStyle) {
    builder.setSymbolRotationExpression(
      expressionToGlsl(vertContext, symbolStyle.rotation, ValueTypes.NUMBER)
    );
  }
  if ('rotateWithView' in symbolStyle) {
    builder.setSymbolRotateWithView(!!symbolStyle.rotateWithView);
  }
}

/**
 * @param {import("../style/literal").LiteralStyle} style Style
 * @param {ShaderBuilder} builder Shader Builder
 * @param {Object<string,import("./Helper").UniformValue>} uniforms Uniforms
 * @param {import("../style/expressions").ParsingContext} vertContext Vertex shader parsing context
 * @param {import("../style/expressions").ParsingContext} fragContext Fragment shader parsing context
 */
function parseStrokeProperties(
  style: LiteralStyle,
  builder: ShaderBuilder,
  uniforms: {[key: string]: UniformValue},
  vertContext: ParsingContext,
  fragContext: ParsingContext
): void {
  if ('stroke-color' in style || 'strokeColor' in style) {
    builder.setStrokeColorExpression(
      expressionToGlsl(fragContext, style.strokeColor, ValueTypes.COLOR)
    );
  }

  if ('stroke-width' in style || 'strokeWidth' in style) {
    builder.setStrokeWidthExpression(
      expressionToGlsl(vertContext, style.strokeWidth, ValueTypes.NUMBER)
    );
  }
}

/**
 * @param {import("../style/literal").LiteralStyle} style Style
 * @param {ShaderBuilder} builder Shader Builder
 * @param {Object<string,import("./Helper").UniformValue>} uniforms Uniforms
 * @param {import("../style/expressions").ParsingContext} vertContext Vertex shader parsing context
 * @param {import("../style/expressions").ParsingContext} fragContext Fragment shader parsing context
 */
function parseFillProperties(
  style: LiteralStyle,
  builder: ShaderBuilder,
  uniforms: {[key: string]: UniformValue},
  vertContext: ParsingContext,
  fragContext: ParsingContext
): void {
  if ('fill-color' in style || 'fillColor' in style) {
    builder.setFillColorExpression(
      expressionToGlsl(fragContext, style.fillColor, ValueTypes.COLOR)
    );
  }
}

export interface StyleParseResult {
  builder: ShaderBuilder;
  uniforms: UniformDefinitions;
  attributes: AttributeDefinitions;
}

/**
 * Parses a {@link import("../style/literal").LiteralStyle} object and returns a {@link ShaderBuilder}
 * object that has been configured according to the given style, as well as `attributes` and `uniforms`
 * arrays to be fed to the `WebGLPointsRenderer` class.
 *
 * Also returns `uniforms` and `attributes` properties as expected by the
 * {@link module:tl/renderer/webgl/PointsLayer~WebGLPointsLayerRenderer}.
 *
 * @param {import("../style/literal").LiteralStyle} style Literal style.
 * @return {StyleParseResult} Result containing shader params, attributes and uniforms.
 */
export function parseLiteralStyle(style: LiteralStyle): StyleParseResult {
  /**
   * @type {import("../style/expressions").ParsingContext}
   */
  const vertContext = {
    inFragmentShader: false,
    variables: [],
    attributes: [],
    stringLiteralsMap: {},
    functions: {},
    style: style,
  };

  /**
   * @type {import("../style/expressions").ParsingContext}
   */
  const fragContext = {
    inFragmentShader: true,
    variables: vertContext.variables,
    attributes: [],
    stringLiteralsMap: vertContext.stringLiteralsMap,
    functions: {},
    style: style,
  };

  const builder = new ShaderBuilder();

  /** @type {Object<string,import("./Helper").UniformValue>} */
  const uniforms = {};

  parseSymbolProperties(style, builder, uniforms, vertContext, fragContext);
  parseStrokeProperties(style, builder, uniforms, vertContext, fragContext);
  parseFillProperties(style, builder, uniforms, vertContext, fragContext);

  if (style.filter) {
    const parsedFilter = expressionToGlsl(
      fragContext,
      style.filter,
      ValueTypes.BOOLEAN
    );
    builder.setFragmentDiscardExpression(`!${parsedFilter}`);
  }

  // define one uniform per variable
  fragContext.variables.forEach(function (variable) {
    const uniformName = uniformNameForVariable(variable.name);
    builder.addUniform(`${getGlslTypeFromType(variable.type)} ${uniformName}`);

    let callback;
    if (variable.type === ValueTypes.STRING) {
      callback = () =>
        getStringNumberEquivalent(
          vertContext,
          /** @type {string} */ (style.variables[variable.name])
        );
    } else if (variable.type === ValueTypes.COLOR) {
      callback = () =>
        packColor([
          ...asArray(
            /** @type {string|Array<number>} */ (
              style.variables[variable.name]
            ) || '#eee'
          ),
        ]);
    } else if (variable.type === ValueTypes.BOOLEAN) {
      callback = () =>
        /** @type {boolean} */ (style.variables[variable.name]) ? 1.0 : 0.0;
    } else {
      callback = () => /** @type {number} */ (style.variables[variable.name]);
    }
    uniforms[uniformName] = callback;
  });

  // for each feature attribute used in the fragment shader, define a varying that will be used to pass data
  // from the vertex to the fragment shader, as well as an attribute in the vertex shader (if not already present)
  fragContext.attributes.forEach(function (attribute) {
    if (!vertContext.attributes.find((a) => a.name === attribute.name)) {
      vertContext.attributes.push(attribute);
    }
    let type = getGlslTypeFromType(attribute.type);
    let expression = `a_${attribute.name}`;
    if (attribute.type === ValueTypes.COLOR) {
      type = 'vec4';
      expression = `unpackColor(${expression})`;
      builder.addVertexShaderFunction(UNPACK_COLOR_FN);
    }
    builder.addVarying(`v_${attribute.name}`, <"float" | "vec2" | "vec3" | "vec4">type, expression);
  });

  // for each feature attribute used in the vertex shader, define an attribute in the vertex shader.
  vertContext.attributes.forEach(function (attribute) {
    builder.addAttribute(
      `${getGlslTypeFromType(attribute.type)} a_${attribute.name}`
    );
  });

  const attributes = vertContext.attributes.map(function (attribute) {
    let callback;
    if (attribute.callback) {
      callback = attribute.callback;
    } else if (attribute.type === ValueTypes.STRING) {
      callback = (feature) =>
        getStringNumberEquivalent(vertContext, feature.get(attribute.name));
    } else if (attribute.type === ValueTypes.COLOR) {
      callback = (feature) =>
        packColor([...asArray(feature.get(attribute.name) || '#eee')]);
    } else if (attribute.type === ValueTypes.BOOLEAN) {
      callback = (feature) => (feature.get(attribute.name) ? 1.0 : 0.0);
    } else {
      callback = (feature) => feature.get(attribute.name);
    }

    return {
      name: attribute.name,
      size: getGlslSizeFromType(attribute.type),
      callback,
    };
  });

  // add functions that were collected in the parsing contexts
  for (const functionName in vertContext.functions) {
    builder.addVertexShaderFunction(vertContext.functions[functionName]);
  }
  for (const functionName in fragContext.functions) {
    builder.addFragmentShaderFunction(fragContext.functions[functionName]);
  }

  return {
    builder: builder,
    attributes: attributes.reduce(
      (prev, curr) => ({
        ...prev,
        [curr.name]: {callback: curr.callback, size: curr.size},
      }),
      {}
    ),
    uniforms: uniforms,
  };
}
