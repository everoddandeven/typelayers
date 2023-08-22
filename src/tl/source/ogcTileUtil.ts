/**
 * @module tl/source/ogcTileUtil
 */

import TileGrid from '../tilegrid/TileGrid';
import {getJSON, resolveUrl} from '../net';
import {get as getProjection} from '../proj';
import {Extent, getIntersection as intersectExtents} from '../extent';
import {UrlFunction} from "../Tile";
import Projection from "../proj/Projection";
import {TileCoord} from "../tilecoord";

/**
 * See https://ogcapi.ogc.org/tiles/.
 */

type TileType = 'map' | 'vector';

type CornerOfOrigin = 'topLeft' | 'bottomLeft';

interface TileSet {
  dataType: TileType;
  tileMatrixSetDefinition?: string;
  tileMatrixSet?: TileMatrixSet;
  tileMatrixSetLimits?: TileMatrixSetLimit[];
  links: Link[];
}

interface Link {
  rel: string;
  href: string;
  type: string;
}

interface TileMatrixSetLimit {
  tileMatrix: string;
  minTileRow: number;
  maxTileRow: number;
  minTileCol: number;
  maxTileCol: number;
}

interface TileMatrixSet {
  id: string;
  crs: string;
  tileMatrices: TileMatrix[];
}

interface TileMatrix {
  id: string;
  cellSize: number;
  pointOfOrigin: number[];
  cornerOfOrigin?: CornerOfOrigin;
  matrixWidth: number;
  matrixHeight: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * @type {Object<string, boolean>}
 */
const knownMapMediaTypes: {[key: string]: boolean} = {
  'image/png': true,
  'image/jpeg': true,
  'image/gif': true,
  'image/webp': true,
};

/**
 * @type {Object<string, boolean>}
 */
const knownVectorMediaTypes: {[key: string]: boolean} = {
  'application/vnd.mapbox-vector-tile': true,
  'application/geo+json': true,
};

export interface TileSetInfo {
  urlTemplate: string;
  grid: TileGrid
  urlFunction: UrlFunction;
}

export interface SourceInfo {
  url: string;
  mediaType: string;
  supportedMediaTypes?: string[];
  projection: Projection
  context?: Object;
}

/**
 * @param {Array<Link>} links Tileset links.
 * @param {string} [mediaType] The preferred media type.
 * @return {string} The tile URL template.
 */
export function getMapTileUrlTemplate(links: Link[], mediaType?: string): string {
  let tileUrlTemplate: string;
  let fallbackUrlTemplate: string;
  for (let i = 0; i < links.length; ++i) {
    const link = links[i];
    if (link.rel === 'item') {
      if (link.type === mediaType) {
        tileUrlTemplate = link.href;
        break;
      }
      if (knownMapMediaTypes[link.type]) {
        fallbackUrlTemplate = link.href;
      } else if (!fallbackUrlTemplate && link.type.startsWith('image/')) {
        fallbackUrlTemplate = link.href;
      }
    }
  }

  if (!tileUrlTemplate) {
    if (fallbackUrlTemplate) {
      tileUrlTemplate = fallbackUrlTemplate;
    } else {
      throw new Error('Could not find "item" link');
    }
  }

  return tileUrlTemplate;
}

/**
 * @param {Array<Link>} links Tileset links.
 * @param {string} [mediaType] The preferred media type.
 * @param {Array<string>} [supportedMediaTypes] The media types supported by the parser.
 * @return {string} The tile URL template.
 */
export function getVectorTileUrlTemplate(
  links: Link[],
  mediaType?: string,
  supportedMediaTypes?: string[]
): string {
  let tileUrlTemplate: string;
  let fallbackUrlTemplate: string;

  /**
   * Lookup of URL by media type.
   * @type {Object<string, string>}
   */
  const hrefLookup: {[key: string]: string} = {};

  for (let i = 0; i < links.length; ++i) {
    const link = links[i];
    hrefLookup[link.type] = link.href;
    if (link.rel === 'item') {
      if (link.type === mediaType) {
        tileUrlTemplate = link.href;
        break;
      }
      if (knownVectorMediaTypes[link.type]) {
        fallbackUrlTemplate = link.href;
      }
    }
  }

  if (!tileUrlTemplate && supportedMediaTypes) {
    for (let i = 0; i < supportedMediaTypes.length; ++i) {
      const supportedMediaType = supportedMediaTypes[i];
      if (hrefLookup[supportedMediaType]) {
        tileUrlTemplate = hrefLookup[supportedMediaType];
        break;
      }
    }
  }

  if (!tileUrlTemplate) {
    if (fallbackUrlTemplate) {
      tileUrlTemplate = fallbackUrlTemplate;
    } else {
      throw new Error('Could not find "item" link');
    }
  }

  return tileUrlTemplate;
}

/**
 * @param {SourceInfo} sourceInfo The source info.
 * @param {TileMatrixSet} tileMatrixSet Tile matrix set.
 * @param {string} tileUrlTemplate Tile URL template.
 * @param {Array<TileMatrixSetLimit>} [tileMatrixSetLimits] Tile matrix set limits.
 * @return {TileSetInfo} Tile set info.
 */
function parseTileMatrixSet(
  sourceInfo: SourceInfo,
  tileMatrixSet: TileMatrixSet,
  tileUrlTemplate: string,
  tileMatrixSetLimits?: TileMatrixSetLimit[]
): TileSetInfo {
  let projection = sourceInfo.projection;
  if (!projection) {
    projection = getProjection(tileMatrixSet.crs);
    if (!projection) {
      throw new Error(`Unsupported CRS: ${tileMatrixSet.crs}`);
    }
  }
  const backwards = projection.getAxisOrientation().substr(0, 2) !== 'en';

  const matrices = tileMatrixSet.tileMatrices;

  /**
   * @type {Object<string, TileMatrix>}
   */
  const matrixLookup: {[key: string]: TileMatrix} = {};
  for (let i = 0; i < matrices.length; ++i) {
    const matrix = matrices[i];
    matrixLookup[matrix.id] = matrix;
  }

  /**
   * @type {Object<string, TileMatrixSetLimit>}
   */
  const limitLookup: {[key: string]: TileMatrixSetLimit} = {};

  /**
   * @type {Array<string>}
   */
  const matrixIds: string[] = [];

  if (tileMatrixSetLimits) {
    for (let i = 0; i < tileMatrixSetLimits.length; ++i) {
      const limit = tileMatrixSetLimits[i];
      const id = limit.tileMatrix;
      matrixIds.push(id);
      limitLookup[id] = limit;
    }
  } else {
    for (let i = 0; i < matrices.length; ++i) {
      const id = matrices[i].id;
      matrixIds.push(id);
    }
  }

  const length = matrixIds.length;
  const origins = new Array(length);
  const resolutions = new Array(length);
  const sizes = new Array(length);
  const tileSizes = new Array(length);
  const extent: Extent = [-Infinity, -Infinity, Infinity, Infinity];

  for (let i = 0; i < length; ++i) {
    const id = matrixIds[i];
    const matrix = matrixLookup[id];
    const origin = matrix.pointOfOrigin;
    if (backwards) {
      origins[i] = [origin[1], origin[0]];
    } else {
      origins[i] = origin;
    }
    resolutions[i] = matrix.cellSize;
    sizes[i] = [matrix.matrixWidth, matrix.matrixHeight];
    tileSizes[i] = [matrix.tileWidth, matrix.tileHeight];
    const limit = limitLookup[id];
    if (limit) {
      const tileMapWidth = matrix.cellSize * matrix.tileWidth;
      const minX = origins[i][0] + limit.minTileCol * tileMapWidth;
      const maxX = origins[i][0] + (limit.maxTileCol + 1) * tileMapWidth;

      const tileMapHeight = matrix.cellSize * matrix.tileHeight;
      const upsideDown = matrix.cornerOfOrigin === 'bottomLeft';

      let minY: number;
      let maxY: number;
      if (upsideDown) {
        minY = origins[i][1] + limit.minTileRow * tileMapHeight;
        maxY = origins[i][1] + (limit.maxTileRow + 1) * tileMapHeight;
      } else {
        minY = origins[i][1] - (limit.maxTileRow + 1) * tileMapHeight;
        maxY = origins[i][1] - limit.minTileRow * tileMapHeight;
      }

      intersectExtents(extent, [minX, minY, maxX, maxY], extent);
    }
  }

  const tileGrid = new TileGrid({
    origins: origins,
    resolutions: resolutions,
    sizes: sizes,
    tileSizes: tileSizes,
    extent: tileMatrixSetLimits ? extent : undefined,
  });

  const context = sourceInfo.context;
  const base = sourceInfo.url;

  function tileUrlFunction(tileCoord: TileCoord, pixelRatio: number, projection: Projection): string {
    if (!tileCoord) {
      return undefined;
    }

    const id = matrixIds[tileCoord[0]];
    const matrix = matrixLookup[id];
    const upsideDown = matrix.cornerOfOrigin === 'bottomLeft';

    const localContext = {
      tileMatrix: id,
      tileCol: tileCoord[1],
      tileRow: upsideDown ? -tileCoord[2] - 1 : tileCoord[2],
    };

    if (tileMatrixSetLimits) {
      const limit = limitLookup[matrix.id];
      if (
        localContext.tileCol < limit.minTileCol ||
        localContext.tileCol > limit.maxTileCol ||
        localContext.tileRow < limit.minTileRow ||
        localContext.tileRow > limit.maxTileRow
      ) {
        return undefined;
      }
    }

    Object.assign(localContext, context);

    const url = tileUrlTemplate.replace(/\{(\w+?)\}/g, function (m, p) {
      return localContext[p];
    });

    return resolveUrl(base, url);
  }

  return {
    grid: tileGrid,
    urlTemplate: tileUrlTemplate,
    urlFunction: tileUrlFunction,
  };
}

/**
 * @param {SourceInfo} sourceInfo The source info.
 * @param {TileSet} tileSet Tile set.
 * @return {TileSetInfo|Promise<TileSetInfo>} Tile set info.
 */
function parseTileSetMetadata(sourceInfo: SourceInfo, tileSet: TileSet): TileSetInfo | Promise<TileSetInfo> {
  const tileMatrixSetLimits = tileSet.tileMatrixSetLimits;
  let tileUrlTemplate: string;

  if (tileSet.dataType === 'map') {
    tileUrlTemplate = getMapTileUrlTemplate(
      tileSet.links,
      sourceInfo.mediaType
    );
  } else if (tileSet.dataType === 'vector') {
    tileUrlTemplate = getVectorTileUrlTemplate(
      tileSet.links,
      sourceInfo.mediaType,
      sourceInfo.supportedMediaTypes
    );
  } else {
    throw new Error('Expected tileset data type to be "map" or "vector"');
  }

  if (tileSet.tileMatrixSet) {
    return parseTileMatrixSet(
      sourceInfo,
      tileSet.tileMatrixSet,
      tileUrlTemplate,
      tileMatrixSetLimits
    );
  }

  const tileMatrixSetLink = tileSet.links.find(
    (link) =>
      link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme'
  );
  if (!tileMatrixSetLink) {
    throw new Error(
      'Expected http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme link or tileMatrixSet'
    );
  }
  const tileMatrixSetDefinition = tileMatrixSetLink.href;

  const url = resolveUrl(sourceInfo.url, tileMatrixSetDefinition);
  return getJSON(url).then(function (tileMatrixSet) {
    return parseTileMatrixSet(
      sourceInfo,
      tileMatrixSet,
      tileUrlTemplate,
      tileMatrixSetLimits
    );
  });
}

/**
 * @param {SourceInfo} sourceInfo Source info.
 * @return {Promise<TileSetInfo>} Tile set info.
 */
export function getTileSetInfo(sourceInfo: SourceInfo): Promise<TileSetInfo> {
  return getJSON(sourceInfo.url).then(function (tileSet) {
    return parseTileSetMetadata(sourceInfo, tileSet);
  });
}
