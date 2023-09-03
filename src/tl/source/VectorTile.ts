/**
 * @module tl/source/VectorTile
 */

import EventType from '../events/EventType';
import Tile from '../VectorTile';
import TileCache from '../TileCache';
import TileGrid from '../tilegrid/TileGrid';
import TileState from '../TileState';
import UrlTileSource from './UrlTileSource';
import VectorRenderTile from '../VectorRenderTile';
import {DEFAULT_MAX_ZOOM} from '../tilegrid/common';
import {
  buffer as bufferExtent, Extent,
  getIntersection,
  intersects,
} from '../extent';
import {createXYZ, extentFromProjection} from '../tilegrid';
import {fromKey, getCacheKeyForTileKey, getKeyZXY} from '../tilecoord';
import {isEmpty} from '../obj';
import {loadFeaturesXhr} from '../featureloader';
import {Size, toSize} from '../size';
import FeatureFormat from "../format/Feature";
import {AttributionLike, SourceState} from "./Source";
import {ProjectionLike} from "../proj";
import {TileLoadFunction, UrlFunction} from "../Tile";
import {NearestDirectionFunction} from "../array";
import Projection from "../proj/Projection";
import VectorTile from "../VectorTile";
import Feature, {FeatureLike} from "../Feature";

export interface VectorTileOptions {
  attributions?: AttributionLike;
  attributionsCollapsible?: boolean;
  cacheSize?: number;
  extent?: Extent;
  format?: FeatureFormat;
  overlaps?: boolean;
  projection?: ProjectionLike;
  state?: SourceState;
  tileClass?: typeof VectorTile;
  maxZoom?: number;
  minZoom?: number;
  tileSize?: number | Size;
  maxResolution?: number;
  tileGrid?: TileGrid;
  tileLoadFunction?: TileLoadFunction;
  tileUrlFunction?: UrlFunction;
  url?: string;
  transition?: number;
  urls?: string[];
  wrapX?: boolean;
  zDirection?: number | NearestDirectionFunction;
}

/**
 * @classdesc
 * Class for layer sources providing vector data divided into a tile grid, to be
 * used with {@link module:tl/layer/VectorTile~VectorTileLayer}. Although this source receives tiles
 * with vector features from the server, it is not meant for feature editing.
 * Features are optimized for rendering, their geometries are clipped at or near
 * tile boundaries and simplified for a view resolution. See
 * {@link module:tl/source/Vector~VectorSource} for vector sources that are suitable for feature
 * editing.
 *
 * @fires import("./Tile").TileSourceEvent
 * @api
 */
class VectorTileSource extends UrlTileSource {
  private format_: FeatureFormat;
  private sourceTileCache: TileCache;
  private overlaps_: boolean;
  protected tileClass: typeof VectorTile;
  private tileGrids_: {[key: string]: TileGrid};
  /**
   * @param {!Options} options Vector tile options.
   */
  constructor(options: VectorTileOptions) {
    const projection = options.projection || 'EPSG:3857';

    const extent = options.extent || extentFromProjection(projection);

    const tileGrid =
      options.tileGrid ||
      createXYZ({
        extent: extent,
        maxResolution: options.maxResolution,
        maxZoom: options.maxZoom !== undefined ? options.maxZoom : 22,
        minZoom: options.minZoom,
        tileSize: options.tileSize || 512,
      });

    super({
      attributions: options.attributions,
      attributionsCollapsible: options.attributionsCollapsible,
      cacheSize: options.cacheSize,
      interpolate: true,
      opaque: false,
      projection: projection,
      state: options.state,
      tileGrid: tileGrid,
      tileLoadFunction: options.tileLoadFunction
        ? options.tileLoadFunction
        : defaultLoadFunction,
      tileUrlFunction: options.tileUrlFunction,
      url: options.url,
      urls: options.urls,
      wrapX: options.wrapX === undefined ? true : options.wrapX,
      transition: options.transition,
      zDirection: options.zDirection === undefined ? 1 : options.zDirection,
    });

    /**
     * @private
     * @type {import("../format/Feature").default|null}
     */
    this.format_ = options.format ? options.format : null;

    /**
     * @private
     * @type {TileCache}
     */
    this.sourceTileCache = new TileCache(this.tileCache.highWaterMark);

    /**
     * @private
     * @type {boolean}
     */
    this.overlaps_ = options.overlaps == undefined ? true : options.overlaps;

    /**
     * @protected
     * @type {typeof import("../VectorTile").default}
     */
    this.tileClass = options.tileClass ? options.tileClass : Tile;

    /**
     * @private
     * @type {Object<string, import("../tilegrid/TileGrid").default>}
     */
    this.tileGrids_ = {};
  }

  /**
   * Get features whose bounding box intersects the provided extent. Only features for cached
   * tiles for the last rendered zoom level are available in the source. So this method is only
   * suitable for requesting tiles for extents that are currently rendered.
   *
   * Features are returned in random tile order and as they are included in the tiles. This means
   * they can be clipped, duplicated across tiles, and simplified to the render resolution.
   *
   * @param {import("../extent").Extent} extent Extent.
   * @return {Array<import("../Feature").FeatureLike>} Features.
   * @api
   */
  public getFeaturesInExtent(extent: Extent): FeatureLike[] {
    const features: Feature[] = [];
    const tileCache = this.tileCache;
    if (tileCache.getCount() === 0) {
      return features;
    }
    const z = fromKey(tileCache.peekFirstKey())[0];
    const tileGrid = this.tileGrid;
    tileCache.forEach(function (tile) {
      if (tile.tileCoord[0] !== z || tile.getState() !== TileState.LOADED) {
        return;
      }
      const sourceTiles = tile.getSourceTiles();
      for (let i = 0, ii = sourceTiles.length; i < ii; ++i) {
        const sourceTile = sourceTiles[i];
        const tileCoord = sourceTile.tileCoord;
        if (intersects(extent, tileGrid.getTileCoordExtent(tileCoord))) {
          const tileFeatures = sourceTile.getFeatures();
          if (tileFeatures) {
            for (let j = 0, jj = tileFeatures.length; j < jj; ++j) {
              const candidate = tileFeatures[j];
              const geometry = candidate.getGeometry();
              if (intersects(extent, geometry.getExtent())) {
                features.push(candidate);
              }
            }
          }
        }
      }
    });
    return features;
  }

  /**
   * @return {boolean} The source can have overlapping geometries.
   */
  getOverlaps() {
    return this.overlaps_;
  }

  /**
   * clear {@link module:tl/TileCache~TileCache} and delete all source tiles
   * @api
   */
  clear() {
    this.tileCache.clear();
    this.sourceTileCache.clear();
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {!Object<string, boolean>} usedTiles Used tiles.
   */
  expireCache(projection, usedTiles) {
    const tileCache = this.getTileCacheForProjection(projection);
    const usedSourceTiles = Object.keys(usedTiles).reduce((acc, key) => {
      const cacheKey = getCacheKeyForTileKey(key);
      const tile = tileCache.peek(cacheKey);
      if (tile) {
        const sourceTiles = tile.sourceTiles;
        for (let i = 0, ii = sourceTiles.length; i < ii; ++i) {
          acc[sourceTiles[i].getKey()] = true;
        }
      }
      return acc;
    }, {});
    super.expireCache(projection, usedTiles);
    this.sourceTileCache.expireCache(usedSourceTiles);
  }

  /**
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @param {VectorRenderTile} tile Vector image tile.
   * @return {Array<import("../VectorTile").default>} Tile keys.
   */
  getSourceTiles(pixelRatio, projection, tile) {
    if (tile.getState() === TileState.IDLE) {
      tile.setState(TileState.LOADING);
      const urlTileCoord = tile.wrappedTileCoord;
      const tileGrid = this.getTileGridForProjection(projection);
      const extent = tileGrid.getTileCoordExtent(urlTileCoord);
      const z = urlTileCoord[0];
      const resolution = tileGrid.getResolution(z);
      // make extent 1 pixel smaller so we don't load tiles for < 0.5 pixel render space
      bufferExtent(extent, -resolution, extent);
      const sourceTileGrid = this.tileGrid;
      const sourceExtent = sourceTileGrid.getExtent();
      if (sourceExtent) {
        getIntersection(extent, sourceExtent, extent);
      }
      const sourceZ = sourceTileGrid.getZForResolution(
        resolution,
        this.zDirection
      );

      sourceTileGrid.forEachTileCoord(extent, sourceZ, (sourceTileCoord) => {
        const tileUrl = this.tileUrlFunction(
          sourceTileCoord,
          pixelRatio,
          projection
        );
        const sourceTile = this.sourceTileCache.containsKey(tileUrl)
          ? this.sourceTileCache.get(tileUrl)
          : new this.tileClass(
              sourceTileCoord,
              tileUrl ? TileState.IDLE : TileState.EMPTY,
              tileUrl,
              this.format_,
              this.tileLoadFunction
            );
        tile.sourceTiles.push(sourceTile);
        const sourceTileState = sourceTile.getState();
        if (sourceTileState < TileState.LOADED) {
          const listenChange = (event) => {
            this.handleTileChange(event);
            const state = sourceTile.getState();
            if (state === TileState.LOADED || state === TileState.ERROR) {
              const sourceTileKey = sourceTile.getKey();
              if (sourceTileKey in tile.errorTileKeys) {
                if (sourceTile.getState() === TileState.LOADED) {
                  delete tile.errorTileKeys[sourceTileKey];
                }
              } else {
                tile.loadingSourceTiles--;
              }
              if (state === TileState.ERROR) {
                tile.errorTileKeys[sourceTileKey] = true;
              } else {
                sourceTile.removeEventListener(EventType.CHANGE, listenChange);
              }
              if (tile.loadingSourceTiles === 0) {
                tile.setState(
                  isEmpty(tile.errorTileKeys)
                    ? TileState.LOADED
                    : TileState.ERROR
                );
              }
            }
          };
          sourceTile.addEventListener(EventType.CHANGE, listenChange);
          tile.loadingSourceTiles++;
        }
        if (sourceTileState === TileState.IDLE) {
          sourceTile.extent =
            sourceTileGrid.getTileCoordExtent(sourceTileCoord);
          sourceTile.projection = projection;
          sourceTile.resolution = sourceTileGrid.getResolution(
            sourceTileCoord[0]
          );
          this.sourceTileCache.set(tileUrl, sourceTile);
          sourceTile.load();
        }
      });
      if (!tile.loadingSourceTiles) {
        tile.setState(
          tile.sourceTiles.some(
            (sourceTile) => sourceTile.getState() === TileState.ERROR
          )
            ? TileState.ERROR
            : TileState.LOADED
        );
      }
    }

    return tile.sourceTiles;
  }

  /**
   * @param {number} z Tile coordinate z.
   * @param {number} x Tile coordinate x.
   * @param {number} y Tile coordinate y.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!VectorRenderTile} Tile.
   */
  getTile(z, x, y, pixelRatio, projection) {
    const coordKey = getKeyZXY(z, x, y);
    const key = this.getKey();
    let tile;
    if (this.tileCache.containsKey(coordKey)) {
      tile = this.tileCache.get(coordKey);
      if (tile.key === key) {
        return tile;
      }
    }
    const tileCoord = [z, x, y];
    let urlTileCoord = this.getTileCoordForTileUrlFunction(
      tileCoord,
      projection
    );
    const sourceExtent = this.getTileGrid().getExtent();
    const tileGrid = this.getTileGridForProjection(projection);
    if (urlTileCoord && sourceExtent) {
      const tileExtent = tileGrid.getTileCoordExtent(urlTileCoord);
      // make extent 1 pixel smaller so we don't load tiles for < 0.5 pixel render space
      bufferExtent(tileExtent, -tileGrid.getResolution(z), tileExtent);
      if (!intersects(sourceExtent, tileExtent)) {
        urlTileCoord = null;
      }
    }
    let empty = true;
    if (urlTileCoord !== null) {
      const sourceTileGrid = this.tileGrid;
      const resolution = tileGrid.getResolution(z);
      const sourceZ = sourceTileGrid.getZForResolution(resolution, 1);
      // make extent 1 pixel smaller so we don't load tiles for < 0.5 pixel render space
      const extent = tileGrid.getTileCoordExtent(urlTileCoord);
      bufferExtent(extent, -resolution, extent);
      sourceTileGrid.forEachTileCoord(extent, sourceZ, (sourceTileCoord) => {
        empty =
          empty &&
          !this.tileUrlFunction(sourceTileCoord, pixelRatio, projection);
      });
    }
    const newTile = new VectorRenderTile(
      tileCoord,
      empty ? TileState.EMPTY : TileState.IDLE,
      urlTileCoord,
      this.getSourceTiles.bind(this, pixelRatio, projection)
    );

    newTile.key = key;
    if (tile) {
      newTile.interimTile = tile;
      newTile.refreshInterimChain();
      this.tileCache.replace(coordKey, newTile);
    } else {
      this.tileCache.set(coordKey, newTile);
    }
    return newTile;
  }

  /**
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {!import("../tilegrid/TileGrid").default} Tile grid.
   */
  getTileGridForProjection(projection) {
    const code = projection.getCode();
    let tileGrid = this.tileGrids_[code];
    if (!tileGrid) {
      // A tile grid that matches the tile size of the source tile grid is more
      // likely to have 1:1 relationships between source tiles and rendered tiles.
      const sourceTileGrid = this.tileGrid;
      const resolutions = sourceTileGrid.getResolutions().slice();
      const origins = resolutions.map(function (resolution, z) {
        return sourceTileGrid.getOrigin(z);
      });
      const tileSizes = resolutions.map(function (resolution, z) {
        return sourceTileGrid.getTileSize(z);
      });
      const length = DEFAULT_MAX_ZOOM + 1;
      for (let z = resolutions.length; z < length; ++z) {
        resolutions.push(resolutions[z - 1] / 2);
        origins.push(origins[z - 1]);
        tileSizes.push(tileSizes[z - 1]);
      }
      tileGrid = new TileGrid({
        extent: sourceTileGrid.getExtent(),
        origins: origins,
        resolutions: resolutions,
        tileSizes: tileSizes,
      });
      this.tileGrids_[code] = tileGrid;
    }
    return tileGrid;
  }

  /**
   * Get the tile pixel ratio for this source.
   * @param {number} pixelRatio Pixel ratio.
   * @return {number} Tile pixel ratio.
   */
  getTilePixelRatio(pixelRatio) {
    return pixelRatio;
  }

  /**
   * @param {number} z Z.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection").default} projection Projection.
   * @return {import("../size").Size} Tile size.
   */
  getTilePixelSize(z, pixelRatio, projection) {
    const tileGrid = this.getTileGridForProjection(projection);
    const tileSize = toSize(tileGrid.getTileSize(z), this.tmpSize);
    return [
      Math.round(tileSize[0] * pixelRatio),
      Math.round(tileSize[1] * pixelRatio),
    ];
  }

  /**
   * Increases the cache size if needed
   * @param {number} tileCount Minimum number of tiles needed.
   * @param {import("../proj/Projection").default} projection Projection.
   */
  updateCacheSize(tileCount, projection) {
    super.updateCacheSize(tileCount * 2, projection);
    this.sourceTileCache.highWaterMark =
      this.getTileCacheForProjection(projection).highWaterMark;
  }
}

export default VectorTileSource;

/**
 * Sets the loader for a tile.
 * @param {import("../VectorTile").default} tile Vector tile.
 * @param {string} url URL.
 */
export function defaultLoadFunction(tile: VectorTile, url: string): void {
  tile.setLoader(
    /**
     * @param {import("../extent").Extent} extent Extent.
     * @param {number} resolution Resolution.
     * @param {import("../proj/Projection").default} projection Projection.
     */
    function (extent: Extent, resolution: number, projection: Projection): void {
      loadFeaturesXhr(
        url,
        tile.getFormat(),
        extent,
        resolution,
        projection,
        tile.onLoad.bind(tile),
        tile.onError.bind(tile)
      );
    }
  );
}
