/**
 * @module tl/xml
 */
import {extend} from './array';

export interface NodeStackItem {
  node: Element;
}

export type Parser = (element: Element, array: any[]) => void;

/**
 * @typedef {function(Element, *, Array<*>): void} Serializer
 */

export type Serializer = (element: Element, array: any[]) => void;

/**
 * @type {string}
 */
export const XML_SCHEMA_INSTANCE_URI: string =
  'http://www.w3.org/2001/XMLSchema-instance';

/**
 * @param {string} namespaceURI Namespace URI.
 * @param {string} qualifiedName Qualified name.
 * @return {Element} Node.
 */
export function createElementNS(namespaceURI: string, qualifiedName: string): Element {
  return getDocument().createElementNS(namespaceURI, qualifiedName);
}

/**
 * Recursively grab all text content of child nodes into a single string.
 * @param {Node} node Node.
 * @param {boolean} normalizeWhitespace Normalize whitespace: remove all line
 * breaks.
 * @return {string} All text content.
 * @api
 */
export function getAllTextContent(node: Node, normalizeWhitespace: boolean): string {
  return getAllTextContent_(node, normalizeWhitespace, []).join('');
}

/**
 * Recursively grab all text content of child nodes into a single string.
 * @param {Node} node Node.
 * @param {boolean} normalizeWhitespace Normalize whitespace: remove all line
 * breaks.
 * @param {Array<string>} accumulator Accumulator.
 * @private
 * @return {Array<string>} Accumulator.
 */
export function getAllTextContent_(node: Node, normalizeWhitespace: boolean, accumulator: string[]): string[] {
  if (
    node.nodeType == Node.CDATA_SECTION_NODE ||
    node.nodeType == Node.TEXT_NODE
  ) {
    if (normalizeWhitespace) {
      accumulator.push(String(node.nodeValue).replace(/(\r\n|\r|\n)/g, ''));
    } else {
      accumulator.push(node.nodeValue);
    }
  } else {
    let n;
    for (n = node.firstChild; n; n = n.nextSibling) {
      getAllTextContent_(n, normalizeWhitespace, accumulator);
    }
  }
  return accumulator;
}

/**
 * @param {Object} object Object.
 * @return {boolean} Is a document.
 */
export function isDocument(object: any): boolean {
  return 'documentElement' in object;
}

/**
 * @param {Element} node Node.
 * @param {?string} namespaceURI Namespace URI.
 * @param {string} name Attribute name.
 * @return {string} Value
 */
export function getAttributeNS(node: Element, namespaceURI: string, name: string): string {
  return node.getAttributeNS(namespaceURI, name) || '';
}

/**
 * Parse an XML string to an XML Document.
 * @param {string} xml XML.
 * @return {Document} Document.
 * @api
 */
export function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

export type ValueNodeReader<T>= (this: T, node: Node, objectStack: any[]) => any;

/**
 * Make an array extender function for extending the array at the top of the
 * object stack.
 * @param {function(this: T, Node, Array<*>): (Array<*>|undefined)} valueReader Value reader.
 * @param {T} [thisArg] The object to use as `this` in `valueReader`.
 * @return {Parser} Parser.
 * @template T
 */
export function makeArrayExtender<T>(valueReader: ValueNodeReader<T>, thisArg: T): Parser {
  return (
    /**
     * @param {Node} node Node.
     * @param {Array<*>} objectStack Object stack.
     */
    function (node, objectStack) {
      const value = valueReader.call(
        thisArg !== undefined ? thisArg : this,
        node,
        objectStack
      );
      if (value !== undefined) {
        const array = /** @type {Array<*>} */ (
          objectStack[objectStack.length - 1]
        );
        extend(array, value);
      }
    }
  );
}

export type ValueElementReader<T> = (this: T, element: Element, objectStack: any[]) => any;

/**
 * Make an array pusher function for pushing to the array at the top of the
 * object stack.
 * @param {function(this: T, Element, Array<*>): *} valueReader Value reader.
 * @param {T} [thisArg] The object to use as `this` in `valueReader`.
 * @return {Parser} Parser.
 * @template T
 */
export function makeArrayPusher<T>(valueReader: ValueElementReader<T>, thisArg: T): Parser {
  return (
    /**
     * @param {Element} node Node.
     * @param {Array<*>} objectStack Object stack.
     */
    function (node: Element, objectStack: any[]): void {
      const value = valueReader.call(
        thisArg !== undefined ? thisArg : this,
        node,
        objectStack
      );
      if (value !== undefined) {
        const array = /** @type {Array<*>} */ (
          objectStack[objectStack.length - 1]
        );
        array.push(value);
      }
    }
  );
}

/**
 * Make an object stack replacer function for replacing the object at the
 * top of the stack.
 * @param {function(this: T, Node, Array<*>): *} valueReader Value reader.
 * @param {T} [thisArg] The object to use as `this` in `valueReader`.
 * @return {Parser} Parser.
 * @template T
 */
export function makeReplacer<T>(valueReader: ValueNodeReader<T>, thisArg: T): Parser {
  return (
    /**
     * @param {Node} node Node.
     * @param {Array<*>} objectStack Object stack.
     */
    function (node, objectStack) {
      const value = valueReader.call(
        thisArg !== undefined ? thisArg : this,
        node,
        objectStack
      );
      if (value !== undefined) {
        objectStack[objectStack.length - 1] = value;
      }
    }
  );
}

/**
 * Make an object property pusher function for adding a property to the
 * object at the top of the stack.
 * @param {function(this: T, Element, Array<*>): *} valueReader Value reader.
 * @param {string} [property] Property.
 * @param {T} [thisArg] The object to use as `this` in `valueReader`.
 * @return {Parser} Parser.
 * @template T
 */
export function makeObjectPropertyPusher<T>(valueReader: ValueElementReader<T>, property?: string, thisArg?: T): Parser {
  return (
    /**
     * @param {Element} node Node.
     * @param {Array<*>} objectStack Object stack.
     */
    function (node, objectStack) {
      const value = valueReader.call(
        thisArg !== undefined ? thisArg : this,
        node,
        objectStack
      );
      if (value !== undefined) {
        const object = /** @type {!Object} */ (
          objectStack[objectStack.length - 1]
        );
        const name = property !== undefined ? property : node.localName;
        let array;
        if (name in object) {
          array = object[name];
        } else {
          array = [];
          object[name] = array;
        }
        array.push(value);
      }
    }
  );
}

/**
 * Make an object property setter function.
 * @param {function(this: T, Element, Array<*>): *} valueReader Value reader.
 * @param {string} [property] Property.
 * @param {T} [thisArg] The object to use as `this` in `valueReader`.
 * @return {Parser} Parser.
 * @template T
 */
export function makeObjectPropertySetter<T>(valueReader: ValueElementReader<T>, property?: string, thisArg?: T): Parser {
  return (
    /**
     * @param {Element} node Node.
     * @param {Array<*>} objectStack Object stack.
     */
    function (node, objectStack) {
      const value = valueReader.call(
        thisArg !== undefined ? thisArg : this,
        node,
        objectStack
      );
      if (value !== undefined) {
        const object = /** @type {!Object} */ (
          objectStack[objectStack.length - 1]
        );
        const name = property !== undefined ? property : node.localName;
        object[name] = value;
      }
    }
  );
}

export type ValueNodeWriter<T,V> = (this: T, node: Node, value: V, objectStack: any[]) => void;

/**
 * Create a serializer that appends nodes written by its `nodeWriter` to its
 * designated parent. The parent is the `node` of the
 * {@link module:tl/xml~NodeStackItem} at the top of the `objectStack`.
 * @param {function(this: T, Node, V, Array<*>): void} nodeWriter Node writer.
 * @param {T} [thisArg] The object to use as `this` in `nodeWriter`.
 * @return {Serializer} Serializer.
 * @template T, V
 */

export function makeChildAppender<T,V>(nodeWriter: ValueNodeWriter<T, V>, thisArg?: T): Serializer {
  return function (node, value, objectStack) {
    nodeWriter.call(
      thisArg !== undefined ? thisArg : this,
      node,
      value,
      objectStack
    );
    const parent = /** @type {NodeStackItem} */ (
      objectStack[objectStack.length - 1]
    );
    const parentNode = parent.node;
    parentNode.appendChild(node);
  };
}



/**
 * Create a serializer that calls the provided `nodeWriter` from
 * {@link module:tl/xml.serialize}. This can be used by the parent writer to have the
 * `nodeWriter` called with an array of values when the `nodeWriter` was
 * designed to serialize a single item. An example would be a LineString
 * geometry writer, which could be reused for writing MultiLineString
 * geometries.
 * @param {function(this: T, Element, V, Array<*>): void} nodeWriter Node writer.
 * @param {T} [thisArg] The object to use as `this` in `nodeWriter`.
 * @return {Serializer} Serializer.
 * @template T, V
 */
export function makeArraySerializer(nodeWriter, thisArg) {
  let serializersNS, nodeFactory;
  return function (node, value, objectStack) {
    if (serializersNS === undefined) {
      serializersNS = {};
      const serializers = {};
      serializers[node.localName] = nodeWriter;
      serializersNS[node.namespaceURI] = serializers;
      nodeFactory = makeSimpleNodeFactory(node.localName);
    }
    serialize(serializersNS, nodeFactory, value, objectStack);
  };
}

/**
 * Create a node factory which can use the `keys` passed to
 * {@link module:tl/xml.serialize} or {@link module:tl/xml.pushSerializeAndPop} as node names,
 * or a fixed node name. The namespace of the created nodes can either be fixed,
 * or the parent namespace will be used.
 * @param {string} [fixedNodeName] Fixed node name which will be used for all
 *     created nodes. If not provided, the 3rd argument to the resulting node
 *     factory needs to be provided and will be the nodeName.
 * @param {string} [fixedNamespaceURI] Fixed namespace URI which will be used for
 *     all created nodes. If not provided, the namespace of the parent node will
 *     be used.
 * @return {function(*, Array<*>, string=): (Node|undefined)} Node factory.
 */
export function makeSimpleNodeFactory(fixedNodeName?: string, fixedNamespaceURI?: string) {
  return (
    /**
     * @param {*} value Value.
     * @param {Array<*>} objectStack Object stack.
     * @param {string} [newNodeName] Node name.
     * @return {Node} Node.
     */
    function (value, objectStack, newNodeName) {
      const context = /** @type {NodeStackItem} */ (
        objectStack[objectStack.length - 1]
      );
      const node = context.node;
      let nodeName = fixedNodeName;
      if (nodeName === undefined) {
        nodeName = newNodeName;
      }

      const namespaceURI =
        fixedNamespaceURI !== undefined ? fixedNamespaceURI : node.namespaceURI;
      return createElementNS(namespaceURI, /** @type {string} */ (nodeName));
    }
  );
}

/**
 * A node factory that creates a node using the parent's `namespaceURI` and the
 * `nodeName` passed by {@link module:tl/xml.serialize} or
 * {@link module:tl/xml.pushSerializeAndPop} to the node factory.
 * @const
 * @type {function(*, Array<*>, string=): (Node|undefined)}
 */
export const OBJECT_PROPERTY_NODE_FACTORY = makeSimpleNodeFactory();

/**
 * Create an array of `values` to be used with {@link module:tl/xml.serialize} or
 * {@link module:tl/xml.pushSerializeAndPop}, where `orderedKeys` has to be provided as
 * `key` argument.
 * @param {Object<string, *>} object Key-value pairs for the sequence. Keys can
 *     be a subset of the `orderedKeys`.
 * @param {Array<string>} orderedKeys Keys in the order of the sequence.
 * @return {Array<*>} Values in the order of the sequence. The resulting array
 *     has the same length as the `orderedKeys` array. Values that are not
 *     present in `object` will be `undefined` in the resulting array.
 */
export function makeSequence(object, orderedKeys) {
  const length = orderedKeys.length;
  const sequence = new Array(length);
  for (let i = 0; i < length; ++i) {
    sequence[i] = object[orderedKeys[i]];
  }
  return sequence;
}

/**
 * Create a namespaced structure, using the same values for each namespace.
 * This can be used as a starting point for versioned parsers, when only a few
 * values are version specific.
 * @param {Array<string>} namespaceURIs Namespace URIs.
 * @param {T} structure Structure.
 * @param {Object<string, T>} [structureNS] Namespaced structure to add to.
 * @return {Object<string, T>} Namespaced structure.
 * @template T
 */
export function makeStructureNS<Type>(namespaceURIs: string[], structure: Type, structureNS?: {[key: string]: Type }): {[key: string]: Type } {
  structureNS = structureNS !== undefined ? structureNS : {};
  let i, ii;
  for (i = 0, ii = namespaceURIs.length; i < ii; ++i) {
    structureNS[namespaceURIs[i]] = structure;
  }
  return structureNS;
}

/**
 * Parse a node using the parsers and object stack.
 * @param {Object<string, Object<string, Parser>>} parsersNS
 *     Parsers by namespace.
 * @param {Element} node Node.
 * @param {Array<*>} objectStack Object stack.
 * @param {*} [thisArg] The object to use as `this`.
 */
export function parseNode(parsersNS, node, objectStack, thisArg) {
  let n;
  for (n = node.firstElementChild; n; n = n.nextElementSibling) {
    const parsers = parsersNS[n.namespaceURI];
    if (parsers !== undefined) {
      const parser = parsers[n.localName];
      if (parser !== undefined) {
        parser.call(thisArg, n, objectStack);
      }
    }
  }
}

/**
 * Push an object on top of the stack, parse and return the popped object.
 * @param {T} object Object.
 * @param {Object<string, Object<string, Parser>>} parsersNS
 *     Parsers by namespace.
 * @param {Element} node Node.
 * @param {Array<*>} objectStack Object stack.
 * @param {*} [thisArg] The object to use as `this`.
 * @return {T} Object.
 * @template T
 */
export function pushParseAndPop(object, parsersNS, node, objectStack, thisArg) {
  objectStack.push(object);
  parseNode(parsersNS, node, objectStack, thisArg);
  return /** @type {T} */ (objectStack.pop());
}

/**
 * Walk through an array of `values` and call a serializer for each value.
 * @param {Object<string, Object<string, Serializer>>} serializersNS
 *     Namespaced serializers.
 * @param {function(this: T, *, Array<*>, (string|undefined)): (Node|undefined)} nodeFactory
 *     Node factory. The `nodeFactory` creates the node whose namespace and name
 *     will be used to choose a node writer from `serializersNS`. This
 *     separation allows us to decide what kind of node to create, depending on
 *     the value we want to serialize. An example for this would be different
 *     geometry writers based on the geometry type.
 * @param {Array<*>} values Values to serialize. An example would be an array
 *     of {@link module:tl/Feature~Feature} instances.
 * @param {Array<*>} objectStack Node stack.
 * @param {Array<string>} [keys] Keys of the `values`. Will be passed to the
 *     `nodeFactory`. This is used for serializing object literals where the
 *     node name relates to the property key. The array length of `keys` has
 *     to match the length of `values`. For serializing a sequence, `keys`
 *     determines the order of the sequence.
 * @param {T} [thisArg] The object to use as `this` for the node factory and
 *     serializers.
 * @template T
 */
export function serialize(
  serializersNS,
  nodeFactory,
  values,
  objectStack,
  keys,
  thisArg
) {
  const length = (keys !== undefined ? keys : values).length;
  let value, node;
  for (let i = 0; i < length; ++i) {
    value = values[i];
    if (value !== undefined) {
      node = nodeFactory.call(
        thisArg !== undefined ? thisArg : this,
        value,
        objectStack,
        keys !== undefined ? keys[i] : undefined
      );
      if (node !== undefined) {
        serializersNS[node.namespaceURI][node.localName].call(
          thisArg,
          node,
          value,
          objectStack
        );
      }
    }
  }
}

/**
 * @param {O} object Object.
 * @param {Object<string, Object<string, Serializer>>} serializersNS
 *     Namespaced serializers.
 * @param {function(this: T, *, Array<*>, (string|undefined)): (Node|undefined)} nodeFactory
 *     Node factory. The `nodeFactory` creates the node whose namespace and name
 *     will be used to choose a node writer from `serializersNS`. This
 *     separation allows us to decide what kind of node to create, depending on
 *     the value we want to serialize. An example for this would be different
 *     geometry writers based on the geometry type.
 * @param {Array<*>} values Values to serialize. An example would be an array
 *     of {@link module:tl/Feature~Feature} instances.
 * @param {Array<*>} objectStack Node stack.
 * @param {Array<string>} [keys] Keys of the `values`. Will be passed to the
 *     `nodeFactory`. This is used for serializing object literals where the
 *     node name relates to the property key. The array length of `keys` has
 *     to match the length of `values`. For serializing a sequence, `keys`
 *     determines the order of the sequence.
 * @param {T} [thisArg] The object to use as `this` for the node factory and
 *     serializers.
 * @return {O|undefined} Object.
 * @template O, T
 */
export function pushSerializeAndPop(
  object,
  serializersNS,
  nodeFactory,
  values,
  objectStack,
  keys,
  thisArg
) {
  objectStack.push(object);
  serialize(serializersNS, nodeFactory, values, objectStack, keys, thisArg);
  return /** @type {O|undefined} */ (objectStack.pop());
}

let xmlSerializer_ = undefined;

/**
 * Register a XMLSerializer. Can be used  to inject a XMLSerializer
 * where there is no globally available implementation.
 *
 * @param {XMLSerializer} xmlSerializer A XMLSerializer.
 * @api
 */
export function registerXMLSerializer(xmlSerializer) {
  xmlSerializer_ = xmlSerializer;
}

/**
 * @return {XMLSerializer} The XMLSerializer.
 */
export function getXMLSerializer() {
  if (xmlSerializer_ === undefined && typeof XMLSerializer !== 'undefined') {
    xmlSerializer_ = new XMLSerializer();
  }
  return xmlSerializer_;
}

let document_ = undefined;

/**
 * Register a Document to use when creating nodes for XML serializations. Can be used
 * to inject a Document where there is no globally available implementation.
 *
 * @param {Document} document A Document.
 * @api
 */
export function registerDocument(document) {
  document_ = document;
}

/**
 * Get a document that should be used when creating nodes for XML serializations.
 * @return {Document} The document.
 */
export function getDocument() {
  if (document_ === undefined && typeof document !== 'undefined') {
    document_ = document.implementation.createDocument('', '', null);
  }
  return document_;
}
