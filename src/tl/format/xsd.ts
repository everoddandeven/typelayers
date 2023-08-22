/**
 * @module tl/format/xsd
 */
import {getAllTextContent, getDocument} from '../xml';
import {padNumber} from '../string';

/**
 * @param {Node} node Node.
 * @return {boolean|undefined} Boolean.
 */
export function readBoolean(node: Node): boolean | undefined {
  const s = getAllTextContent(node, false);
  return readBooleanString(s);
}

/**
 * @param {string} string String.
 * @return {boolean|undefined} Boolean.
 */
export function readBooleanString(string: string): boolean | undefined {
  const m = /^\s*(true|1)|(false|0)\s*$/.exec(string);
  if (m) {
    return m[1] !== undefined || false;
  }
  return undefined;
}

/**
 * @param {Node} node Node.
 * @return {number|undefined} DateTime in seconds.
 */
export function readDateTime(node: Node): number {
  const s = getAllTextContent(node, false);
  const dateTime = Date.parse(s);
  return isNaN(dateTime) ? undefined : dateTime / 1000;
}

/**
 * @param {Node} node Node.
 * @return {number|undefined} Decimal.
 */
export function readDecimal(node: Node): number {
  const s = getAllTextContent(node, false);
  return readDecimalString(s);
}

/**
 * @param {string} string String.
 * @return {number|undefined} Decimal.
 */
export function readDecimalString(string: string): number {
  // FIXME check spec
  const m = /^\s*([+\-]?\d*\.?\d+(?:e[+\-]?\d+)?)\s*$/i.exec(string);
  if (m) {
    return parseFloat(m[1]);
  }
  return undefined;
}

/**
 * @param {Node} node Node.
 * @return {number|undefined} Non negative integer.
 */
export function readPositiveInteger(node: Node): number | undefined {
  const s = getAllTextContent(node, false);
  return readNonNegativeIntegerString(s);
}

/**
 * @param {string} string String.
 * @return {number|undefined} Non negative integer.
 */
export function readNonNegativeIntegerString(string: string): number | undefined {
  const m = /^\s*(\d+)\s*$/.exec(string);
  if (m) {
    return parseInt(m[1], 10);
  }
  return undefined;
}

/**
 * @param {Node} node Node.
 * @return {string|undefined} String.
 */
export function readString(node: Node): string | undefined {
  return getAllTextContent(node, false).trim();
}

/**
 * @param {Node} node Node to append a TextNode with the boolean to.
 * @param {boolean} bool Boolean.
 */
export function writeBooleanTextNode(node: Node, bool: boolean): void {
  writeStringTextNode(node, bool ? '1' : '0');
}

/**
 * @param {Node} node Node to append a CDATA Section with the string to.
 * @param {string} string String.
 */
export function writeCDATASection(node: Node, string: string): void {
  node.appendChild(getDocument().createCDATASection(string));
}

/**
 * @param {Node} node Node to append a TextNode with the dateTime to.
 * @param {number} dateTime DateTime in seconds.
 */
export function writeDateTimeTextNode(node: Node, dateTime: number): void {
  const date: Date = new Date(dateTime * 1000);
  const string: string =
    date.getUTCFullYear() +
    '-' +
    padNumber(date.getUTCMonth() + 1, 2) +
    '-' +
    padNumber(date.getUTCDate(), 2) +
    'T' +
    padNumber(date.getUTCHours(), 2) +
    ':' +
    padNumber(date.getUTCMinutes(), 2) +
    ':' +
    padNumber(date.getUTCSeconds(), 2) +
    'Z';
  node.appendChild(getDocument().createTextNode(string));
}

/**
 * @param {Node} node Node to append a TextNode with the decimal to.
 * @param {number} decimal Decimal.
 */
export function writeDecimalTextNode(node: Node, decimal: number): void {
  const string = decimal.toPrecision();
  node.appendChild(getDocument().createTextNode(string));
}

/**
 * @param {Node} node Node to append a TextNode with the decimal to.
 * @param {number} nonNegativeInteger Non negative integer.
 */
export function writeNonNegativeIntegerTextNode(node: Node, nonNegativeInteger: number): void {
  const string = nonNegativeInteger.toString();
  node.appendChild(getDocument().createTextNode(string));
}

/**
 * @param {Node} node Node to append a TextNode with the string to.
 * @param {string} string String.
 */
export function writeStringTextNode(node: Node, string: string): void {
  node.appendChild(getDocument().createTextNode(string));
}
