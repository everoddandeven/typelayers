/**
 * @module tl/source/WMTS
 */

import TileImageSource from './TileImageSource';
import {appendParams} from '../uri';
import {containsExtent, Extent} from '../extent';
import WMTSTileGrid, {createFromCapabilitiesMatrixSet} from '../tilegrid/WMTS';
import {createFromTileUrlFunctions, expandUrl} from '../tileurlfunction';
import {equivalent, get as getProjection, ProjectionLike, transformExtent} from '../proj';
import {AttributionLike} from "./Source";
import {ImageTile} from "../index";
import {TileLoadFunction, UrlFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";
import {TileCoord} from "../tilecoord";
import Projection from "../proj/Projection";

export type RequestEncoding = 'KVP' | 'REST';

export interface WMTSOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  tileGrid: WMTSTileGrid;
  projection?: ProjectionLike;
  reprojectionErrorThreshold?: number;
  requestEncoding?: RequestEncoding;
  layer: string;
  style: string;
  tileClass?: typeof ImageTile;
  tilePixelRatio?: number;
  format?: string;
  version?: string;
  matrixSet: string;
  dimensions?: {[key: string]: any};
  url?: string;
  tileLoadFunction?: TileLoadFunction;
  urls?: Array<string>;
  wrapX?: boolean;
  transition?: number;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for tile data from WMTS servers.
 * @api
 */
class WMTS extends TileImageSource {
  private version_: string;
  private format_: string;
  private dimensions_: { [p: string]: any };
  private layer_: string;
  private matrixSet_: string;
  private style_: string;
  private requestEncoding_: RequestEncoding;
  /**
   * @param {Options} options WMTS options.
   */
  constructor(options: WMTSOptions) {
    // TODO: add support for TileMatrixLimits

    const requestEncoding: RequestEncoding =
      options.requestEncoding !== undefined ? options.requestEncoding : 'KVP';

    // FIXME: should we create a default tileGrid?
    // we could issue a getCapabilities xhr to retrieve missing configuration
    const tileGrid = options.tileGrid;

    let urls = options.urls;
    if (urls === undefined && options.url !== undefined) {
      urls = expandUrl(options.url);
    }

    super({
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      projection: options.projection,
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      tileClass: options.tileClass,
      tileGrid: tileGrid,
      tileLoadFunction: options.tileLoadFunction,
      tilePixelRatio: options.tilePixelRatio,
      urls: urls,
      wrapX: options.wrapX !== undefined ? options.wrapX : false,
      transition: options.transition,
      zDirection: options.zDirection,
    });

    /**
     * @private
     * @type {string}
     */
    this.version_ = options.version !== undefined ? options.version : '1.0.0';

    /**
     * @private
     * @type {string}
     */
    this.format_ = options.format !== undefined ? options.format : 'image/jpeg';

    /**
     * @private
     * @type {!Object}
     */
    this.dimensions_ =
      options.dimensions !== undefined ? options.dimensions : {};

    /**
     * @private
     * @type {string}
     */
    this.layer_ = options.layer;

    /**
     * @private
     * @type {string}
     */
    this.matrixSet_ = options.matrixSet;

    /**
     * @private
     * @type {string}
     */
    this.style_ = options.style;

    // FIXME: should we guess this requestEncoding from options.url(s)
    //        structure? that would mean KVP only if a template is not provided.

    /**
     * @private
     * @type {RequestEncoding}
     */
    this.requestEncoding_ = requestEncoding;

    this.setKey(this.getKeyForDimensions_());

    if (urls && urls.length > 0) {
      this.tileUrlFunction = createFromTileUrlFunctions(
        urls.map(this.createFromWMTSTemplate.bind(this))
      );
    }
  }

  /**
   * Set the URLs to use for requests.
   * URLs may contain OGC conform URL Template Variables: {TileMatrix}, {TileRow}, {TileCol}.
   * @param {Array<string>} urls URLs.
   */
  public setUrls(urls: string[]): void {
    this.urls = urls;
    const key = urls.join('\n');
    this.setTileUrlFunction(
      createFromTileUrlFunctions(
        urls.map(this.createFromWMTSTemplate.bind(this))
      ),
      key
    );
  }

  /**
   * Get the dimensions, i.e. those passed to the constructor through the
   * "dimensions" option, and possibly updated using the updateDimensions
   * method.
   * @return {!Object} Dimensions.
   * @api
   */
  public getDimensions(): {[key: string]: any} {
    return this.dimensions_;
  }

  /**
   * Return the image format of the WMTS source.
   * @return {string} Format.
   * @api
   */
  public getFormat(): string {
    return this.format_;
  }

  /**
   * Return the layer of the WMTS source.
   * @return {string} Layer.
   * @api
   */
  public getLayer(): string {
    return this.layer_;
  }

  /**
   * Return the matrix set of the WMTS source.
   * @return {string} MatrixSet.
   * @api
   */
  public getMatrixSet(): string {
    return this.matrixSet_;
  }

  /**
   * Return the request encoding, either "KVP" or "REST".
   * @return {RequestEncoding} Request encoding.
   * @api
   */
  public getRequestEncoding(): RequestEncoding {
    return this.requestEncoding_;
  }

  /**
   * Return the style of the WMTS source.
   * @return {string} Style.
   * @api
   */
  public getStyle(): string {
    return this.style_;
  }

  /**
   * Return the version of the WMTS source.
   * @return {string} Version.
   * @api
   */
  public getVersion(): string {
    return this.version_;
  }

  /**
   * @private
   * @return {string} The key for the current dimensions.
   */
  private getKeyForDimensions_(): string {
    const res = this.urls ? this.urls.slice(0) : [];
    for (const key in this.dimensions_) {
      res.push(key + '-' + this.dimensions_[key]);
    }
    return res.join('/');
  }

  /**
   * Update the dimensions.
   * @param {Object} dimensions Dimensions.
   * @api
   */
  public updateDimensions(dimensions: {[key: string]: any}): void {
    Object.assign(this.dimensions_, dimensions);
    this.setKey(this.getKeyForDimensions_());
  }

  /**
   * @param {string} template Template.
   * @return {import("../Tile").UrlFunction} Tile URL function.
   */
  public createFromWMTSTemplate(template: string): UrlFunction {
    const requestEncoding = this.requestEncoding_;

    // context property names are lower case to allow for a case-insensitive
    // replacement as some services use different naming conventions
    const context = {
      'layer': this.layer_,
      'style': this.style_,
      'tilematrixset': this.matrixSet_,
    };

    if (requestEncoding == 'KVP') {
      Object.assign(context, {
        'Service': 'WMTS',
        'Request': 'GetTile',
        'Version': this.version_,
        'Format': this.format_,
      });
    }

    // TODO: we may want to create our own appendParams function so that params
    // order conforms to wmts spec guidance, and so that we can avoid to escape
    // special template params

    template =
      requestEncoding == 'KVP'
        ? appendParams(template, context)
        : template.replace(/\{(\w+?)\}/g, function (m, p) {
            return p.toLowerCase() in context ? context[p.toLowerCase()] : m;
          });

    const tileGrid = /** @type {import("../tilegrid/WMTS").default} */ (
      <WMTSTileGrid>this.tileGrid
    );
    const dimensions = this.dimensions_;

    return (
      /**
       * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
       * @param {number} pixelRatio Pixel ratio.
       * @param {import("../proj/Projection").default} projection Projection.
       * @return {string|undefined} Tile URL.
       */
      function (tileCoord: TileCoord, pixelRatio: number, projection: Projection): string | undefined {
        if (!tileCoord) {
          return undefined;
        }
        const localContext = {
          'TileMatrix': tileGrid.getMatrixId(tileCoord[0]),
          'TileCol': tileCoord[1],
          'TileRow': tileCoord[2],
        };
        Object.assign(localContext, dimensions);
        let url = template;
        if (requestEncoding == 'KVP') {
          url = appendParams(url, localContext);
        } else {
          url = url.replace(/\{(\w+?)\}/g, function (m, p) {
            return localContext[p];
          });
        }
        return url;
      }
    );
  }
}

export default WMTS;

/**
 * Generate source options from a capabilities object.
 * @param {Object} wmtsCap An object representing the capabilities document.
 * @param {!Object} config Configuration properties for the layer.  Defaults for
 *                  the layer will apply if not provided.
 *
 * Required config properties:
 *  - layer - {string} The layer identifier.
 *
 * Optional config properties:
 *  - matrixSet - {string} The matrix set identifier, required if there is
 *       more than one matrix set in the layer capabilities.
 *  - projection - {string} The desired CRS when no matrixSet is specified.
 *       eg: "EPSG:3857". If the desired projection is not available,
 *       an error is thrown.
 *  - requestEncoding - {string} url encoding format for the layer. Default is
 *       the first tile url format found in the GetCapabilities response.
 *  - style - {string} The name of the style
 *  - format - {string} Image format for the layer. Default is the first
 *       format returned in the GetCapabilities response.
 *  - crossOrigin - {string|null|undefined} Cross origin. Default is `undefined`.
 * @return {Options|null} WMTS source options object or `null` if the layer was not found.
 * @api
 */
export function optionsFromCapabilities(wmtsCap: {[key: string]: any}, config: {[key: string]: any}): WMTSOptions {
  const layers = wmtsCap['Contents']['Layer'];
  const l = layers.find(function (elt) {
    return elt['Identifier'] == config['layer'];
  });
  if (!l) {
    return null;
  }
  const tileMatrixSets = wmtsCap['Contents']['TileMatrixSet'];
  let idx;
  if (l['TileMatrixSetLink'].length > 1) {
    if ('projection' in config) {
      idx = l['TileMatrixSetLink'].findIndex(function (elt) {
        const tileMatrixSet = tileMatrixSets.find(function (el) {
          return el['Identifier'] == elt['TileMatrixSet'];
        });
        const supportedCRS = tileMatrixSet['SupportedCRS'];
        const proj1 = getProjection(supportedCRS);
        const proj2 = getProjection(config['projection']);
        if (proj1 && proj2) {
          return equivalent(proj1, proj2);
        }
        return supportedCRS == config['projection'];
      });
    } else {
      idx = l['TileMatrixSetLink'].findIndex(function (elt) {
        return elt['TileMatrixSet'] == config['matrixSet'];
      });
    }
  } else {
    idx = 0;
  }
  if (idx < 0) {
    idx = 0;
  }
  const matrixSet =
    /** @type {string} */
    (l['TileMatrixSetLink'][idx]['TileMatrixSet']);
  const matrixLimits =
    /** @type {Array<Object>} */
    (<{[key: string]: any}[]>l['TileMatrixSetLink'][idx]['TileMatrixSetLimits']);

  let format = /** @type {string} */ (l['Format'][0]);
  if ('format' in config) {
    format = config['format'];
  }
  idx = l['Style'].findIndex(function (elt) {
    if ('style' in config) {
      return elt['Title'] == config['style'];
    }
    return elt['isDefault'];
  });
  if (idx < 0) {
    idx = 0;
  }
  const style = /** @type {string} */ (l['Style'][idx]['Identifier']);

  const dimensions = {};
  if ('Dimension' in l) {
    l['Dimension'].forEach(function (elt, index, array) {
      const key = elt['Identifier'];
      let value = elt['Default'];
      if (value === undefined) {
        value = elt['Value'][0];
      }
      dimensions[key] = value;
    });
  }

  const matrixSets = wmtsCap['Contents']['TileMatrixSet'];
  const matrixSetObj = matrixSets.find(function (elt) {
    return elt['Identifier'] == matrixSet;
  });

  let projection;
  const code = matrixSetObj['SupportedCRS'];
  if (code) {
    projection = getProjection(code);
  }
  if ('projection' in config) {
    const projConfig = getProjection(config['projection']);
    if (projConfig) {
      if (!projection || equivalent(projConfig, projection)) {
        projection = projConfig;
      }
    }
  }

  let wrapX = false;
  const switchXY = projection.getAxisOrientation().substr(0, 2) == 'ne';

  let matrix = matrixSetObj.TileMatrix[0];

  // create default matrixLimit
  let selectedMatrixLimit: {[key: string]: any} = {
    MinTileCol: 0,
    MinTileRow: 0,
    // subtract one to end up at tile top left
    MaxTileCol: matrix.MatrixWidth - 1,
    MaxTileRow: matrix.MatrixHeight - 1,
  };

  //in case of matrix limits, use matrix limits to calculate extent
  if (matrixLimits) {
    selectedMatrixLimit = matrixLimits[matrixLimits.length - 1];
    const m = matrixSetObj.TileMatrix.find(
      (tileMatrixValue) =>
        tileMatrixValue.Identifier === selectedMatrixLimit.TileMatrix ||
        matrixSetObj.Identifier + ':' + tileMatrixValue.Identifier ===
          selectedMatrixLimit.TileMatrix
    );
    if (m) {
      matrix = m;
    }
  }

  const resolution =
    (matrix.ScaleDenominator * 0.00028) / projection.getMetersPerUnit(); // WMTS 1.0.0: standardized rendering pixel size
  const origin = switchXY
    ? [matrix.TopLeftCorner[1], matrix.TopLeftCorner[0]]
    : matrix.TopLeftCorner;
  const tileSpanX = matrix.TileWidth * resolution;
  const tileSpanY = matrix.TileHeight * resolution;
  let matrixSetExtent = matrixSetObj['BoundingBox'];
  if (matrixSetExtent && switchXY) {
    matrixSetExtent = [
      matrixSetExtent[1],
      matrixSetExtent[0],
      matrixSetExtent[3],
      matrixSetExtent[2],
    ];
  }
  let extent: Extent = [
    origin[0] + tileSpanX * selectedMatrixLimit.MinTileCol,
    // add one to get proper bottom/right coordinate
    origin[1] - tileSpanY * (1 + selectedMatrixLimit.MaxTileRow),
    origin[0] + tileSpanX * (1 + selectedMatrixLimit.MaxTileCol),
    origin[1] - tileSpanY * selectedMatrixLimit.MinTileRow,
  ];

  if (
    matrixSetExtent !== undefined &&
    !containsExtent(matrixSetExtent, extent)
  ) {
    const wgs84BoundingBox = l['WGS84BoundingBox'];
    const wgs84ProjectionExtent = getProjection('EPSG:4326').getExtent();
    extent = matrixSetExtent;
    if (wgs84BoundingBox) {
      wrapX =
        wgs84BoundingBox[0] === wgs84ProjectionExtent[0] &&
        wgs84BoundingBox[2] === wgs84ProjectionExtent[2];
    } else {
      const wgs84MatrixSetExtent = transformExtent(
        matrixSetExtent,
        matrixSetObj['SupportedCRS'],
        'EPSG:4326'
      );
      // Ignore slight deviation from the correct x limits
      wrapX =
        wgs84MatrixSetExtent[0] - 1e-10 <= wgs84ProjectionExtent[0] &&
        wgs84MatrixSetExtent[2] + 1e-10 >= wgs84ProjectionExtent[2];
    }
  }

  const tileGrid = createFromCapabilitiesMatrixSet(
    matrixSetObj,
    extent,
    matrixLimits
  );

  /** @type {!Array<string>} */
  const urls: string[] = [];
  let requestEncoding = config['requestEncoding'];
  requestEncoding = requestEncoding !== undefined ? requestEncoding : '';

  if (
    'OperationsMetadata' in wmtsCap &&
    'GetTile' in wmtsCap['OperationsMetadata']
  ) {
    const gets = wmtsCap['OperationsMetadata']['GetTile']['DCP']['HTTP']['Get'];

    for (let i = 0, ii = gets.length; i < ii; ++i) {
      if (gets[i]['Constraint']) {
        const constraint = gets[i]['Constraint'].find(function (element) {
          return element['name'] == 'GetEncoding';
        });
        const encodings = constraint['AllowedValues']['Value'];

        if (requestEncoding === '') {
          // requestEncoding not provided, use the first encoding from the list
          requestEncoding = encodings[0];
        }
        if (requestEncoding === 'KVP') {
          if (encodings.includes('KVP')) {
            urls.push(/** @type {string} */ (gets[i]['href']));
          }
        } else {
          break;
        }
      } else if (gets[i]['href']) {
        requestEncoding = 'KVP';
        urls.push(/** @type {string} */ (gets[i]['href']));
      }
    }
  }
  if (urls.length === 0) {
    requestEncoding = 'REST';
    l['ResourceURL'].forEach(function (element) {
      if (element['resourceType'] === 'tile') {
        format = element['format'];
        urls.push(/** @type {string} */ (element['template']));
      }
    });
  }

  return {
    urls: urls,
    layer: config['layer'],
    matrixSet: matrixSet,
    format: format,
    projection: projection,
    requestEncoding: requestEncoding,
    tileGrid: tileGrid,
    style: style,
    dimensions: dimensions,
    wrapX: wrapX,
    crossOrigin: config['crossOrigin'],
  };
}
