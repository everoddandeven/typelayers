/**
 * @module ol/format/XML
 */
import {isDocument, parse} from '../xml';

export type XMLSource = Document | Element | string;

/**
 * @classdesc
 * Generic format for reading non-feature XML data
 *
 * @abstract
 */
abstract class XML {
  /**
   * Read the source document.
   *
   * @param {Document|Element|string} source The XML source.
   * @return {Object} An object representing the source.
   * @api
   */
  public read(source: XMLSource): Object {
    if (!source) {
      return null;
    }
    if (typeof source === 'string') {
      const doc = parse(source);
      return this.readFromDocument(doc);
    }
    if (isDocument(source)) {
      return this.readFromDocument((<Document>source));
    }
    return this.readFromNode((<Element>source));
  }

  /**
   * @param {Document} doc Document.
   * @return {Object} Object
   */
  public readFromDocument(doc: Document): Object | null {
    for (let n = doc.firstChild; n; n = n.nextSibling) {
      if (n.nodeType == Node.ELEMENT_NODE) {
        return this.readFromNode((<Element>n));
      }
    }
    return null;
  }

  /**
   * @abstract
   * @param {Element} node Node.
   * @return {Object} Object
   */
  public abstract readFromNode(node: Element): Object;
}

export default XML;
