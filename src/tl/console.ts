/**
 * @module tl/console
 */

/**
 * @typedef {'info'|'warn'|'error'|'none'} Level
 */

export type Level = 'info' | 'warn' | 'error' | 'none';

/**
 * @type {Object<Level, number>}
 */
const levels = {
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

/**
 * @type {number}
 */
let level: number = levels.info;

/**
 * Set the logging level.  By default, the level is set to 'info' and all
 * messages will be logged.  Set to 'warn' to only display warnings and errors.
 * Set to 'error' to only display errors.  Set to 'none' to silence all messages.
 *
 * @param {Level} l The new level.
 */
export function setLevel(l: Level): void {
  level = levels[l];
}

export function log(...args: any[]): void {
  if (level > levels.info) {
    return;
  }
  console.log(...args); // eslint-disable-line no-console
}

export function warn(...args: any[]): void {
  if (level > levels.warn) {
    return;
  }
  console.warn(...args); // eslint-disable-line no-console
}

export function error(...args: any[]): void {
  if (level > levels.error) {
    return;
  }
  console.error(...args); // eslint-disable-line no-console
}
