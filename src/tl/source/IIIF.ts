/**
 * @module tl/source/IIIF
 */

import TileGrid from '../tilegrid/TileGrid';
import TileImageSource from './TileImageSource';
import {CustomTile} from './Zoomify';
import {DEFAULT_TILE_SIZE} from '../tilegrid/common';
import {IIIFVersions} from '../format/IIIFInfo';
import {assert} from '../asserts';
import {Extent, getTopLeft} from '../extent';
import {Size, toSize} from '../size';
import {AttributionLike, SourceState} from "./Source";
import {ProjectionLike} from "../proj";
import {NearestDirectionFunction} from "../array";
import {TileCoord} from "../tilecoord";

export interface IIIFOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  crossOrigin?: null | string;
  extent?: Extent;
  format?: string;
  interpolate?: boolean;
  projection?: ProjectionLike;
  quality?: string;
  reprojectionErrorThreshold?: number;
  resolutions?: number[];
  size: Size;
  sizes?: Size[];
  state?: SourceState;
  supports?: string[];
  tilePixelRatio?: number;
  tileSize?: number | Size;
  transition?: number;
  url?: string;
  version?: IIIFVersions;
  zDirection?: number | NearestDirectionFunction;
}

export function formatPercentage(percentage: number) {
  return percentage.toLocaleString('en', {maximumFractionDigits: 10});
}

/**
 * @classdesc
 * Layer source for IIIF Image API services.
 * @api
 */
class IIIF extends TileImageSource {
  /**
   * @param {Options} [options] Tile source options. Use {@link import("../format/IIIFInfo").IIIFInfo}
   * to parse Image API service information responses into constructor options.
   * @api
   */
  constructor(options?: IIIFOptions) {
    /**
     * @type {Partial<Options>}
     */
    let partialOptions: Partial<IIIFOptions> = options || {};

    let baseUrl = partialOptions.url || '';
    baseUrl =
      baseUrl +
      (baseUrl.lastIndexOf('/') === baseUrl.length - 1 || baseUrl === ''
        ? ''
        : '/');
    let version = partialOptions.version || IIIFVersions.VERSION2;
    let sizes = partialOptions.sizes || [];
    let size = partialOptions.size;
    assert(
      size != undefined &&
        Array.isArray(size) &&
        size.length == 2 &&
        !isNaN(size[0]) &&
        size[0] > 0 &&
        !isNaN(size[1]) &&
        size[1] > 0,
      60
    );
    let width = size[0];
    let height = size[1];
    let tileSize: number | Size = partialOptions.tileSize;
    let tilePixelRatio = partialOptions.tilePixelRatio || 1;
    let format = partialOptions.format || 'jpg';
    let quality =
      partialOptions.quality ||
      (partialOptions.version == IIIFVersions.VERSION1 ? 'native' : 'default');
    let resolutions = partialOptions.resolutions || [];
    let supports = partialOptions.supports || [];
    let extent = partialOptions.extent || [0, -height, width, 0];

    let supportsListedSizes =
      sizes != undefined && Array.isArray(sizes) && sizes.length > 0;
    let supportsListedTiles =
      tileSize !== undefined &&
      ((typeof tileSize === 'number' &&
        Number.isInteger(tileSize) &&
        tileSize > 0) ||
        (Array.isArray(tileSize) && tileSize.length > 0));
    let supportsArbitraryTiling =
      supports != undefined &&
      Array.isArray(supports) &&
      (supports.includes('regionByPx') || supports.includes('regionByPct')) &&
      (supports.includes('sizeByWh') ||
        supports.includes('sizeByH') ||
        supports.includes('sizeByW') ||
        supports.includes('sizeByPct'));

    let tileWidth: number, tileHeight: number, maxZoom: number;

    resolutions.sort(function (a, b) {
      return b - a;
    });

    if (supportsListedTiles || supportsArbitraryTiling) {
      if (tileSize != undefined) {
        if (
          typeof tileSize === 'number' &&
          Number.isInteger(tileSize) &&
          tileSize > 0
        ) {
          tileWidth = tileSize;
          tileHeight = tileSize;
        } else if (Array.isArray(tileSize) && tileSize.length > 0) {
          if (
              (<number[]>tileSize).length == 1 ||
            (tileSize[1] == undefined && Number.isInteger(tileSize[0]))
          ) {
            tileWidth = tileSize[0];
            tileHeight = tileSize[0];
          }
          if (tileSize.length == 2) {
            if (
              Number.isInteger(tileSize[0]) &&
              Number.isInteger(tileSize[1])
            ) {
              tileWidth = tileSize[0];
              tileHeight = tileSize[1];
            } else if (
              tileSize[0] == undefined &&
              Number.isInteger(tileSize[1])
            ) {
              tileWidth = tileSize[1];
              tileHeight = tileSize[1];
            }
          }
        }
      }
      if (tileWidth === undefined || tileHeight === undefined) {
        tileWidth = DEFAULT_TILE_SIZE;
        tileHeight = DEFAULT_TILE_SIZE;
      }
      if (resolutions.length == 0) {
        maxZoom = Math.max(
          Math.ceil(Math.log(width / tileWidth) / Math.LN2),
          Math.ceil(Math.log(height / tileHeight) / Math.LN2)
        );
        for (let i = maxZoom; i >= 0; i--) {
          resolutions.push(Math.pow(2, i));
        }
      } else {
        let maxScaleFactor = Math.max(...resolutions);
        // TODO maxScaleFactor might not be a power to 2
        maxZoom = Math.round(Math.log(maxScaleFactor) / Math.LN2);
      }
    } else {
      // No tile support.
      tileWidth = width;
      tileHeight = height;
      resolutions = [];
      if (supportsListedSizes) {
        /*
         * 'sizes' provided. Use full region in different resolutions. Every
         * resolution has only one tile.
         */
        sizes.sort(function (a, b) {
          return a[0] - b[0];
        });
        maxZoom = -1;
        let ignoredSizesIndex = [];
        for (let i = 0; i < sizes.length; i++) {
          let resolution = width / sizes[i][0];
          if (
            resolutions.length > 0 &&
            resolutions[resolutions.length - 1] == resolution
          ) {
            ignoredSizesIndex.push(i);
            continue;
          }
          resolutions.push(resolution);
          maxZoom++;
        }
        if (ignoredSizesIndex.length > 0) {
          for (let i = 0; i < ignoredSizesIndex.length; i++) {
            sizes.splice(ignoredSizesIndex[i] - i, 1);
          }
        }
      } else {
        // No useful image information at all. Try pseudo tile with full image.
        resolutions.push(1);
        sizes.push([width, height]);
        maxZoom = 0;
      }
    }

    let tileGrid = new TileGrid({
      tileSize: [tileWidth, tileHeight],
      extent: extent,
      origin: getTopLeft(extent),
      resolutions: resolutions,
    });

    let tileUrlFunction = function (tileCoord: TileCoord, pixelRatio: number, projection: ProjectionLike): undefined | string {
      let regionParam: string, sizeParam: string;
      let zoom = tileCoord[0];
      if (zoom > maxZoom) {
        return;
      }
      let tileX = tileCoord[1],
        tileY = tileCoord[2],
        scale = resolutions[zoom];
      if (
        tileX === undefined ||
        tileY === undefined ||
        scale === undefined ||
        tileX < 0 ||
        Math.ceil(width / scale / tileWidth) <= tileX ||
        tileY < 0 ||
        Math.ceil(height / scale / tileHeight) <= tileY
      ) {
        return;
      }
      if (supportsArbitraryTiling || supportsListedTiles) {
        let regionX = tileX * tileWidth * scale,
          regionY = tileY * tileHeight * scale;
        let regionW = tileWidth * scale,
          regionH = tileHeight * scale,
          sizeW = tileWidth,
          sizeH = tileHeight;
        if (regionX + regionW > width) {
          regionW = width - regionX;
        }
        if (regionY + regionH > height) {
          regionH = height - regionY;
        }
        if (regionX + tileWidth * scale > width) {
          sizeW = Math.floor((width - regionX + scale - 1) / scale);
        }
        if (regionY + tileHeight * scale > height) {
          sizeH = Math.floor((height - regionY + scale - 1) / scale);
        }
        if (
          regionX == 0 &&
          regionW == width &&
          regionY == 0 &&
          regionH == height
        ) {
          // canonical full image region parameter is 'full', not 'x,y,w,h'
          regionParam = 'full';
        } else if (
          !supportsArbitraryTiling ||
          supports.includes('regionByPx')
        ) {
          regionParam = regionX + ',' + regionY + ',' + regionW + ',' + regionH;
        } else if (supports.includes('regionByPct')) {
          let pctX = formatPercentage((regionX / width) * 100),
            pctY = formatPercentage((regionY / height) * 100),
            pctW = formatPercentage((regionW / width) * 100),
            pctH = formatPercentage((regionH / height) * 100);
          regionParam = 'pct:' + pctX + ',' + pctY + ',' + pctW + ',' + pctH;
        }
        if (
          version == IIIFVersions.VERSION3 &&
          (!supportsArbitraryTiling || supports.includes('sizeByWh'))
        ) {
          sizeParam = sizeW + ',' + sizeH;
        } else if (!supportsArbitraryTiling || supports.includes('sizeByW')) {
          sizeParam = sizeW + ',';
        } else if (supports.includes('sizeByH')) {
          sizeParam = ',' + sizeH;
        } else if (supports.includes('sizeByWh')) {
          sizeParam = sizeW + ',' + sizeH;
        } else if (supports.includes('sizeByPct')) {
          sizeParam = 'pct:' + formatPercentage(100 / scale);
        }
      } else {
        regionParam = 'full';
        if (supportsListedSizes) {
          let regionWidth = sizes[zoom][0],
            regionHeight = sizes[zoom][1];
          if (version == IIIFVersions.VERSION3) {
            if (regionWidth == width && regionHeight == height) {
              sizeParam = 'max';
            } else {
              sizeParam = regionWidth + ',' + regionHeight;
            }
          } else {
            if (regionWidth == width) {
              sizeParam = 'full';
            } else {
              sizeParam = regionWidth + ',';
            }
          }
        } else {
          sizeParam = version == IIIFVersions.VERSION3 ? 'max' : 'full';
        }
      }
      return (
        baseUrl + regionParam + '/' + sizeParam + '/0/' + quality + '.' + format
      );
    };

    let IiifTileClass = CustomTile.bind(
      null,
      toSize(tileSize || 256).map(function (size) {
        return size * tilePixelRatio;
      })
    );

    super({
      attributions: partialOptions.attributions,
      attributionsCollapsible: partialOptions.attributionsCollapsible,
      cacheSize: partialOptions.cacheSize,
      crossOrigin: partialOptions.crossOrigin,
      interpolate: partialOptions.interpolate,
      projection: partialOptions.projection,
      reprojectionErrorThreshold: partialOptions.reprojectionErrorThreshold,
      state: partialOptions.state,
      tileClass: IiifTileClass,
      tileGrid: tileGrid,
      tilePixelRatio: partialOptions.tilePixelRatio,
      tileUrlFunction: tileUrlFunction,
      transition: partialOptions.transition,
    });

    /**
     * @type {number|import("../array").NearestDirectionFunction}
     */
    this.zDirection = partialOptions.zDirection;
  }
}

export default IIIF;
