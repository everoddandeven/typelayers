/**
 * @module tl/source/OGCVectorTile
 */

import VectorTile from './VectorTile';
import {getTileSetInfo, TileSetInfo} from './ogcTileUtil';
import {error as logError} from '../console';

export interface OGCVectorTileOptions {
  url: string;
  context?: Object;
  format: import("../format/Feature").default;
  mediaType?: string;
  attributions?: import("./Source").AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  overlaps?: boolean;
  projection?: import("../proj").ProjectionLike;
  tileClass?: typeof import("../VectorTile").default;
  transition?: number;
  wrapX?: boolean;
  zDirection?: number | import("../array").NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for map tiles from an [OGC API - Tiles](https://ogcapi.ogc.org/tiles/) service that provides "vector" type tiles.
 * The service must conform to at least the core (http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/core)
 * and tileset (http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/tileset) conformance classes.
 *
 * Vector tile sets may come in a variety of formats (e.g. GeoJSON, MVT).  The `format` option is used to determine
 * which of the advertised media types is used.  If you need to force the use of a particular media type, you can
 * provide the `mediaType` option.
 * @api
 */
class OGCVectorTile extends VectorTile {
  /**
   * @param {Options} options OGC vector tile options.
   */
  constructor(options?: OGCVectorTileOptions) {
    super({
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      cacheSize: options.cacheSize,
      format: options.format,
      overlaps: options.overlaps,
      projection: options.projection,
      tileClass: options.tileClass,
      transition: options.transition,
      wrapX: options.wrapX,
      zDirection: options.zDirection,
      state: 'loading',
    });

    const sourceInfo = {
      url: options.url,
      projection: this.getProjection(),
      mediaType: options.mediaType,
      supportedMediaTypes: options.format.supportedMediaTypes,
      context: options.context || null,
    };

    getTileSetInfo(sourceInfo)
      .then(this.handleTileSetInfo_.bind(this))
      .catch(this.handleError_.bind(this));
  }

  /**
   * @param {import("./ogcTileUtil").TileSetInfo} tileSetInfo Tile set info.
   * @private
   */
  private handleTileSetInfo_(tileSetInfo: TileSetInfo): void {
    this.tileGrid = tileSetInfo.grid;
    this.setTileUrlFunction(tileSetInfo.urlFunction, tileSetInfo.urlTemplate);
    this.setState('ready');
  }

  /**
   * @private
   * @param {Error} error The error.
   */
  private handleError_(error: Error): void {
    logError(error);
    this.setState('error');
  }
}

export default OGCVectorTile;
