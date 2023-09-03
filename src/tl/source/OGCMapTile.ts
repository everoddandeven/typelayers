/**
 * @module tl/source/OGCMapTile
 */
import TileImageSource from './TileImageSource';
import {TileLoadFunction} from '../Tile';
import {getTileSetInfo, SourceInfo, TileSetInfo} from './ogcTileUtil';
import {error as logError} from '../console';
import {ProjectionLike} from "../proj";
import {AttributionLike} from "./Source";

export interface OGCMapTileOptions {
  url: string;
  context?: Object;
  mediaType?: string;
  projection?: ProjectionLike;
  attributions?: AttributionLike;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  reprojectionErrorThreshold?: number;
  tileLoadFunction?: TileLoadFunction;
  wrapX?: boolean;
  transition?: number;
}

/**
 * @classdesc
 * Layer source for map tiles from an [OGC API - Tiles](https://ogcapi.ogc.org/tiles/) service that provides "map" type tiles.
 * The service must conform to at least the core (http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/core)
 * and tileset (http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/tileset) conformance classes.
 * @api
 */
class OGCMapTile extends TileImageSource {
  /**
   * @param {Options} options OGC map tile options.
   */
  constructor(options: OGCMapTileOptions) {
    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      projection: options.projection,
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      state: 'loading',
      tileLoadFunction: options.tileLoadFunction,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      transition: options.transition,
    });

    const sourceInfo: SourceInfo = {
      url: options.url,
      projection: this.getProjection(),
      mediaType: options.mediaType,
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

export default OGCMapTile;
