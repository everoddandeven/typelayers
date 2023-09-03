/**
 * @module tl/source/TileArcGISRest
 */

import TileImageSource from './TileImageSource';
import {appendParams} from '../uri';
import {createEmpty, Extent} from '../extent';
import {modulo} from '../math';
import {scale as scaleSize, Size, toSize} from '../size';
import {hash as tileCoordHash, TileCoord} from '../tilecoord';
import {TileLoadFunction} from "../Tile";
import {ProjectionLike} from "../proj";
import TileGrid from "../tilegrid/TileGrid";
import {AttributionLike} from "./Source";
import {NearestDirectionFunction} from "../array";
import Projection from "../proj/Projection";

export interface TileArcGISRestOptions {
  attributions?: AttributionLike;
  cacheSize?: number;
  crossOrigin?: null | string;
  interpolate?: boolean;
  params?: {[key: string]: any};
  hidpi?: boolean;
  tileGrid?: TileGrid;
  projection?: ProjectionLike;
  reprojectionErrorThreshold?: number;
  tileLoadFunction?: TileLoadFunction;
  url?: string;
  wrapX?: boolean;
  transition?: number;
  urls?: string[];
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Layer source for tile data from ArcGIS Rest services. Map and Image
 * Services are supported.
 *
 * For cached ArcGIS services, better performance is available using the
 * {@link module:tl/source/XYZ~XYZ} data source.
 * @api
 */
class TileArcGISRest extends TileImageSource {
  private params_: { [p: string]: any };
  private hidpi_: boolean;
  private tmpExtent_: Extent;
  /**
   * @param {Options} [options] Tile ArcGIS Rest options.
   */
  constructor(options?: TileArcGISRestOptions) {
    options = options ? options : {};

    super({
      attributions: options.attributions,
      cacheSize: options.cacheSize,
      crossOrigin: options.crossOrigin,
      interpolate: options.interpolate,
      projection: options.projection,
      reprojectionErrorThreshold: options.reprojectionErrorThreshold,
      tileGrid: options.tileGrid,
      tileLoadFunction: options.tileLoadFunction,
      url: options.url,
      urls: options.urls,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      transition: options.transition,
      zDirection: options.zDirection,
    });

    /**
     * @private
     * @type {!Object}
     */
    this.params_ = options.params || {};

    /**
     * @private
     * @type {boolean}
     */
    this.hidpi_ = options.hidpi !== undefined ? options.hidpi : true;

    /**
     * @private
     * @type {import("../extent").Extent}
     */
    this.tmpExtent_ = createEmpty();

    this.setKey(this.getKeyForParams_());
  }

  /**
   * @private
   * @return {string} The key for the current params.
   */
  private getKeyForParams_(): string {
    let i = 0;
    const res = [];
    for (const key in this.params_) {
      res[i++] = key + '-' + this.params_[key];
    }
    return res.join('/');
  }

  /**
   * Get the user-provided params, i.e. those passed to the constructor through
   * the "params" option, and possibly updated using the updateParams method.
   * @return {Object} Params.
   * @api
   */
  public getParams(): { [p: string]: any } {
    return this.params_;
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord Tile coordinate.
   * @param {import("../size").Size} tileSize Tile size.
   * @param {import("../extent").Extent} tileExtent Tile extent.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {Object} params Params.
   * @return {string|undefined} Request URL.
   * @private
   */
  private getRequestUrl_(
    tileCoord: TileCoord,
    tileSize: Size,
    tileExtent: Extent,
    pixelRatio: number,
    projection: Projection,
    params: { [p: string]: any }
  ): string | undefined {
    const urls = this.urls;
    if (!urls) {
      return undefined;
    }

    // ArcGIS Server only wants the numeric portion of the projection ID.
    // (if there is no numeric portion the entire projection code must
    // form a valid ArcGIS SpatialReference definition).
    const srid = projection
      .getCode()
      .split(/:(?=\d+$)/)
      .pop();

    params['SIZE'] = tileSize[0] + ',' + tileSize[1];
    params['BBOX'] = tileExtent.join(',');
    params['BBOXSR'] = srid;
    params['IMAGESR'] = srid;
    params['DPI'] = Math.round(
      params['DPI'] ? params['DPI'] * pixelRatio : 90 * pixelRatio
    );

    let url;
    if (urls.length == 1) {
      url = urls[0];
    } else {
      const index = modulo(tileCoordHash(tileCoord), urls.length);
      url = urls[index];
    }

    const modifiedUrl = url
      .replace(/MapServer\/?$/, 'MapServer/export')
      .replace(/ImageServer\/?$/, 'ImageServer/exportImage');
    return appendParams(modifiedUrl, params);
  }

  /**
   * Get the tile pixel ratio for this source.
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} Tile pixel ratio.
   */
  public getTilePixelRatio(pixelRatio: number): number {
    return this.hidpi_ ? pixelRatio : 1;
  }

  /**
   * Update the user-provided params.
   * @param {Object} params Params.
   * @api
   */
  public updateParams(params: { [p: string]: any }): void {
    Object.assign(this.params_, params);
    this.setKey(this.getKeyForParams_());
  }

  /**
   * @param {import("../tilecoord").TileCoord} tileCoord The tile coordinate
   * @param {number} pixelRatio The pixel ratio
   * @param {import("../proj/Projection").default} projection The projection
   * @return {string|undefined} The tile URL
   * @override
   */
  public tileUrlFunction(tileCoord: TileCoord, pixelRatio: number, projection: Projection): string | undefined {
    let tileGrid = this.getTileGrid();
    if (!tileGrid) {
      tileGrid = this.getTileGridForProjection(projection);
    }

    if (tileGrid.getResolutions().length <= tileCoord[0]) {
      return undefined;
    }

    if (pixelRatio != 1 && !this.hidpi_) {
      pixelRatio = 1;
    }

    const tileExtent = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent_);
    let tileSize = toSize(tileGrid.getTileSize(tileCoord[0]), this.tmpSize);

    if (pixelRatio != 1) {
      tileSize = scaleSize(tileSize, pixelRatio, this.tmpSize);
    }

    // Apply default params and override with user specified values.
    const baseParams = {
      'F': 'image',
      'FORMAT': 'PNG32',
      'TRANSPARENT': true,
    };
    Object.assign(baseParams, this.params_);

    return this.getRequestUrl_(
      tileCoord,
      tileSize,
      tileExtent,
      pixelRatio,
      projection,
      baseParams
    );
  }
}

export default TileArcGISRest;
