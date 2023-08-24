/**
 * @module tl/source/BingMaps
 */

import TileImage from './TileImage';
import {applyTransform, Extent, intersects} from '../extent';
import {createFromTileUrlFunctions} from '../tileurlfunction';
import {createOrUpdate, TileCoord} from '../tilecoord';
import {createXYZ, extentFromProjection} from '../tilegrid';
import {get as getProjection, getTransformFromProjections} from '../proj';
import {TileLoadFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";
import {Size} from "../size";
import Projection from "../proj/Projection";

/**
 * @param {import('../tilecoord').TileCoord} tileCoord Tile coord.
 * @return {string} Quad key.
 */
export function quadKey(tileCoord) {
  const z = tileCoord[0];
  const digits = new Array(z);
  let mask = 1 << (z - 1);
  let i, charCode;
  for (i = 0; i < z; ++i) {
    // 48 is charCode for 0 - '0'.charCodeAt(0)
    charCode = 48;
    if (tileCoord[1] & mask) {
      charCode += 1;
    }
    if (tileCoord[2] & mask) {
      charCode += 2;
    }
    digits[i] = String.fromCharCode(charCode);
    mask >>= 1;
  }
  return digits.join('');
}

/**
 * The attribution containing a link to the Microsoft® Bing™ Maps Platform APIs’
 * Terms Of Use.
 * @const
 * @type {string}
 */
const TOS_ATTRIBUTION =
  '<a class="tl-attribution-bing-tos" ' +
  'href="https://www.microsoft.com/maps/product/terms.html" target="_blank">' +
  'Terms of Use</a>';

export interface BingMpOptions {
  cacheSize?: number;
  hidpi?: boolean;
  culture?: string;
  key: string;
  imagerySet: string;
  interpolate?: boolean;
  maxZoom?: number;
  reprojectionErrorThreshold?: number;
  tileLoadFunction?: TileLoadFunction;
  wrapX?: boolean;
  transition?: number;
  zDirection?: number | NearestDirectionFunction;
  placeholderTiles: boolean;
}

export interface BingMapsImageryMetadataResponse {
  statusCode: number;
  statusDescription: string;
  authenticationResultCode: string;
  resourceSets: ResourceSet[];
}

interface ImageryProvider {
  coverageAreas: CoverageArea[];
  attribution?: string;
}
interface Resource {
  imageHeight: number;
  imageWidth: number;
  zoomMin: number;
  zoomMax: number;
  imageUrl: string;
  imageUrlSubdomains: string[];
  imageryProviders?: ImageryProvider[];
}

export interface ResourceSet {
    resources: Resource[];
}

export interface CoverageArea {
  zoomMin: number;
  zoomMax: number;
  bbox: number[];
}

/**
 * @classdesc
 * Layer source for Bing Maps tile data.
 * @api
 */
class BingMaps extends TileImage {
  private hidpi_: boolean;
  private culture_: string;
  private maxZoom_: number;
  private apiKey_: string;
  private imagerySet_: string;
  private placeholderTiles_: boolean;
  /**
   * @param {Options} options Bing Maps options.
   */
  constructor(options: BingMpOptions) {
    const hidpi = options.hidpi !== undefined ? options.hidpi : false;

    super({
      cacheSize: options.cacheSize,
      crossOrigin: 'anonymous',
      interpolate: options.interpolate,
      opaque: true,
      projection: getProjection('EPSG:3857'),
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      state: 'loading',
      tileLoadFunction: options.tileLoadFunction,
      tilePixelRatio: hidpi ? 2 : 1,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      transition: options.transition,
      zDirection: options.zDirection,
    });

    /**
     * @private
     * @type {boolean}
     */
    this.hidpi_ = hidpi;

    /**
     * @private
     * @type {string}
     */
    this.culture_ = options.culture !== undefined ? options.culture : 'en-us';

    /**
     * @private
     * @type {number}
     */
    this.maxZoom_ = options.maxZoom !== undefined ? options.maxZoom : -1;

    /**
     * @private
     * @type {string}
     */
    this.apiKey_ = options.key;

    /**
     * @private
     * @type {string}
     */
    this.imagerySet_ = options.imagerySet;

    /**
     * @private
     * @type {boolean}
     */
    this.placeholderTiles_ = options.placeholderTiles;

    const url =
      'https://dev.virtualearth.net/REST/v1/Imagery/Metadata/' +
      this.imagerySet_ +
      '?uriScheme=https&include=ImageryProviders&key=' +
      this.apiKey_ +
      '&c=' +
      this.culture_;

    fetch(url)
      .then((response) => responseon() )
      .then((json) => this.handleImageryMetadataResponse(json));
  }

  /**
   * Get the api key used for this source.
   *
   * @return {string} The api key.
   * @api
   */
  public getApiKey(): string {
    return this.apiKey_;
  }

  /**
   * Get the imagery set associated with this source.
   *
   * @return {string} The imagery set.
   * @api
   */
  public getImagerySet(): string {
    return this.imagerySet_;
  }

  /**
   * @param {BingMapsImageryMetadataResponse} response Response.
   */
  public handleImageryMetadataResponse(response: BingMapsImageryMetadataResponse): void {
    if (
      response.statusCode != 200 ||
      response.statusDescription != 'OK' ||
      response.authenticationResultCode != 'ValidCredentials' ||
      response.resourceSets.length != 1 ||
      response.resourceSets[0].resources.length != 1
    ) {
      this.setState('error');
      return;
    }

    const resource = response.resourceSets[0].resources[0];
    const maxZoom = this.maxZoom_ == -1 ? resource.zoomMax : this.maxZoom_;

    const sourceProjection = this.getProjection();
    const extent = extentFromProjection(sourceProjection);
    const scale = this.hidpi_ ? 2 : 1;
    const tileSize =
      resource.imageWidth == resource.imageHeight
        ? resource.imageWidth / scale
        : <Size>[resource.imageWidth / scale, resource.imageHeight / scale];

    this.tileGrid = createXYZ({
      extent: extent,
      minZoom: resource.zoomMin,
      maxZoom: maxZoom,
      tileSize: tileSize,
    });

    const culture = this.culture_;
    const hidpi = this.hidpi_;
    const placeholderTiles = this.placeholderTiles_;
    this.tileUrlFunction = createFromTileUrlFunctions(
      resource.imageUrlSubdomains.map(function (subdomain) {
        /** @type {import('../tilecoord').TileCoord} */
        const quadKeyTileCoord: TileCoord = [0, 0, 0];
        const imageUrl = resource.imageUrl
          .replace('{subdomain}', subdomain)
          .replace('{culture}', culture);
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
            createOrUpdate(
              tileCoord[0],
              tileCoord[1],
              tileCoord[2],
              quadKeyTileCoord
            );
            const url = new URL(
              imageUrl.replace('{quadkey}', quadKey(quadKeyTileCoord))
            );
            const params = url.searchParams;
            if (hidpi) {
              params.set('dpi', 'd1');
              params.set('device', 'mobile');
            }
            if (placeholderTiles === true) {
              params.delete('n');
            } else if (placeholderTiles === false) {
              params.set('n', 'z');
            }
            return url.toString();
          }
        );
      })
    );

    if (resource.imageryProviders) {
      const transform = getTransformFromProjections(
        getProjection('EPSG:4326'),
        this.getProjection()
      );

      this.setAttributions((frameState) => {
        const attributions = [];
        const viewState = frameState.viewState;
        const tileGrid = this.getTileGrid();
        const z = tileGrid.getZForResolution(
          viewState.resolution,
          this.zDirection
        );
        const tileCoord = tileGrid.getTileCoordForCoordAndZ(
          viewState.center,
          z
        );
        const zoom = tileCoord[0];
        resource.imageryProviders.map(function (imageryProvider) {
          let intersecting = false;
          const coverageAreas = imageryProvider.coverageAreas;
          for (let i = 0, ii = coverageAreas.length; i < ii; ++i) {
            const coverageArea = coverageAreas[i];
            if (zoom >= coverageArea.zoomMin && zoom <= coverageArea.zoomMax) {
              const bbox = coverageArea.bbox;
              const epsg4326Extent: Extent = [bbox[1], bbox[0], bbox[3], bbox[2]];
              const extent = applyTransform(epsg4326Extent, transform);
              if (intersects(extent, frameState.extent)) {
                intersecting = true;
                break;
              }
            }
          }
          if (intersecting) {
            attributions.push(imageryProvider.attribution);
          }
        });

        attributions.push(TOS_ATTRIBUTION);
        return attributions;
      });
    }

    this.setState('ready');
  }
}

export default BingMaps;
