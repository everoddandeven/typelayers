/**
 * @module tl/render/canvas/Instruction
 */

/**
 * @enum {number}
 */
export enum Instruction {
  BEGIN_GEOMETRY = 0,
  BEGIN_PATH = 1,
  CIRCLE = 2,
  CLOSE_PATH = 3,
  CUSTOM = 4,
  DRAW_CHARS = 5,
  DRAW_IMAGE = 6,
  END_GEOMETRY = 7,
  FILL = 8,
  MOVE_TO_LINE_TO = 9,
  SET_FILL_STYLE = 10,
  SET_STROKE_STYLE = 11,
  STROKE = 12,
}

/**
 * @type {Array<Instruction>}
 */
export const fillInstruction: Instruction[] = [Instruction.FILL];

/**
 * @type {Array<Instruction>}
 */
export const strokeInstruction: Instruction[] = [Instruction.STROKE];

/**
 * @type {Array<Instruction>}
 */
export const beginPathInstruction: Instruction[] = [Instruction.BEGIN_PATH];

/**
 * @type {Array<Instruction>}
 */
export const closePathInstruction: Instruction[] = [Instruction.CLOSE_PATH];

export default Instruction;
