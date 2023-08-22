/**
 * @module tl/format/WMSGetFeatureInfo
 */
import GML2 from './GML2';
import XMLFeature from './XMLFeature';
import {extend} from '../array';
import {makeArrayPusher, makeStructureNS, pushParseAndPop} from '../xml';
import Feature from "../Feature";
import {ReadOptions} from "./Feature";

interface WMSGetFeatureInfoOptions {
  layers?: string[];
}

/**
 * @const
 * @type {string}
 */
const featureIdentifier: string = '_feature';

/**
 * @const
 * @type {string}
 */
const layerIdentifier: string = '_layer';

/**
 * @classdesc
 * Format for reading WMSGetFeatureInfo format. It uses
 * {@link module:tl/format/GML2~GML2} to read features.
 *
 * @api
 */
class WMSGetFeatureInfo extends XMLFeature {
  private featureNS_: string;
  private gmlFormat_: GML2;
  private layers_?: string[];
  /**
   * @param {Options} [options] Options.
   */
  constructor(options?: WMSGetFeatureInfoOptions) {
    super();

    options = options ? options : {};

    /**
     * @private
     * @type {string}
     */
    this.featureNS_ = 'http://mapserver.gis.umn.edu/mapserver';

    /**
     * @private
     * @type {GML2}
     */
    this.gmlFormat_ = new GML2();

    /**
     * @private
     * @type {Array<string>|null}
     */
    this.layers_ = options.layers ? options.layers : null;
  }

  /**
   * @return {Array<string>|null} layers
   */
  public getLayers(): string[] | null {
    return this.layers_;
  }

  /**
   * @param {Array<string>|null} layers Layers to parse.
   */
  public setLayers(layers: string[] | null): void {
    this.layers_ = layers;
  }

  /**
   * @param {Element} node Node.
   * @param {Array<*>} objectStack Object stack.
   * @return {Array<import("../Feature").default>} Features.
   * @private
   */
  private readFeatures_(node: Element, objectStack: any[]): Feature[] {
    node.setAttribute('namespaceURI', this.featureNS_);
    const localName = node.localName;
    /** @type {Array<import("../Feature").default>} */
    let features: Feature[] = [];
    if (node.childNodes.length === 0) {
      return features;
    }
    if (localName == 'msGMLOutput') {
      for (let i = 0, ii = node.childNodes.length; i < ii; i++) {
        const layer = node.childNodes[i];
        if (layer.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        const layerElement = <Element>(layer);
        const context = objectStack[0];

        const toRemove = layerIdentifier;
        const layerName = layerElement.localName.replace(toRemove, '');

        if (this.layers_ && !this.layers_.includes(layerName)) {
          continue;
        }

        const featureType = layerName + featureIdentifier;

        context['featureType'] = featureType;
        context['featureNS'] = this.featureNS_;

        /** @type {Object<string, import("../xml").Parser>} */
        const parsers = {};
        parsers[featureType] = makeArrayPusher(
          this.gmlFormat_.readFeatureElement,
          this.gmlFormat_
        );
        const parsersNS = makeStructureNS(
          [context['featureNS'], null],
          parsers
        );
        layerElement.setAttribute('namespaceURI', this.featureNS_);
        const layerFeatures = pushParseAndPop(
          [],
          // @ts-ignore
          parsersNS,
          layerElement,
          objectStack,
          this.gmlFormat_
        );
        if (layerFeatures) {
          extend(features, layerFeatures);
        }
      }
    }
    if (localName == 'FeatureCollection') {
      const gmlFeatures = pushParseAndPop(
        [],
        this.gmlFormat_.FEATURE_COLLECTION_PARSERS,
        node,
        [{}],
        this.gmlFormat_
      );
      if (gmlFeatures) {
        features = gmlFeatures;
      }
    }
    return features;
  }

  /**
   * @protected
   * @param {Element} node Node.
   * @param {import("./Feature").ReadOptions} [options] Options.
   * @return {Array<import("../Feature").default>} Features.
   */
  protected readFeaturesFromNode(node: Element, options?: ReadOptions): Feature[] {
    const internalOptions = {};
    if (options) {
      Object.assign(internalOptions, this.getReadOptions(node, options));
    }
    return this.readFeatures_(node, [internalOptions]);
  }
}

export default WMSGetFeatureInfo;
