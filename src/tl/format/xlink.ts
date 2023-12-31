/**
 * @module tl/format/xlink
 */

/**
 * @const
 * @type {string}
 */
const NAMESPACE_URI: string = 'http://www.w3.org/1999/xlink';

/**
 * @param {Element} node Node.
 * @return {string|undefined} href.
 */
export function readHref(node: Element): string | undefined {
  return node.getAttributeNS(NAMESPACE_URI, 'href');
}
