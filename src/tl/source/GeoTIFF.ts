/**
 * @module tl/source/GeoTIFF
 */
import DataTile from './DataTile';
import TileGrid from '../tilegrid/TileGrid';
import {
  Pool,
  globals as geotiffGlobals,
  fromBlob as tiffFromBlob,
  fromUrl as tiffFromUrl,
  fromUrls as tiffFromUrls,
    GeoTIFFImage, GeoTIFF, MultiGeoTIFF
} from 'geotiff';
import {
  Projection,
  get as getCachedProjection,
  toUserCoordinate,
  toUserExtent,
} from '../proj';
import {clamp} from '../math';
import {getCenter, getIntersection} from '../extent';
import {error as logError} from '../console';
import {fromCode as unitsFromCode} from '../proj/Units';
import {Size} from "../size";
import {Data} from "../DataTile";

/**
 * Determine if an image type is a mask.
 * See https://www.awaresystems.be/imaging/tiff/tifftags/newsubfiletype.html
 * @param {GeoTIFFImage} image The image.
 * @return {boolean} The image is a mask.
 */
export function isMask(image: GeoTIFFImage): boolean {
  const fileDirectory = image.fileDirectory;
  const type = fileDirectory.NewSubfileType || 0;
  return (type & 4) === 4;
}

/**
 * @param {true|false|'auto'} preference The convertToRGB option.
 * @param {GeoTIFFImage} image The image.
 * @return {boolean} Use the `image.readRGB()` method.
 */
export function readRGB(preference: boolean | 'auto', image: GeoTIFFImage): boolean {
  if (!preference) {
    return false;
  }
  if (preference === true) {
    return true;
  }
  if (image.getSamplesPerPixel() !== 3) {
    return false;
  }
  const interpretation = image.fileDirectory.PhotometricInterpretation;
  const interpretations = geotiffGlobals.photometricInterpretations;
  return (
    interpretation === interpretations.CMYK ||
    interpretation === interpretations.YCbCr ||
    interpretation === interpretations.CIELab ||
    interpretation === interpretations.ICCLab
  );
}

export interface SourceInfo {
  url?: string;
  overviews?: Array<string>;
  blob?: Blob;
  min?: number;
  max?: number;
  nodata?: number;
  bands?: Array<number>;
}

export interface GeoKeys {
  GTModelTypeGeoKey: number;
  GTRasterTypeGeoKey: number;
  GeogAngularUnitsGeoKey: number;
  GeogInvFlatteningGeoKey: number;
  GeogSemiMajorAxisGeoKey: number;
  GeographicTypeGeoKey: number;
  ProjLinearUnitsGeoKey: number;
  ProjectedCSTypeGeoKey: number;
}

/**
 * @typedef {import("geotiff").GeoTIFF} GeoTIFF
 */

/**
 * @typedef {import("geotiff").GeoTIFFImage} GeoTIFFImage
 */

/**
 * @typedef {import("geotiff").MultiGeoTIFF} MultiGeoTIFF
 */

export {MultiGeoTIFF, GeoTIFF, GeoTIFFImage};

interface GDALMetadata {
  STATISTICS_MINIMUM: string;
  STATISTICS_MAXIMUM: string;
}

const STATISTICS_MAXIMUM: string = 'STATISTICS_MAXIMUM';
const STATISTICS_MINIMUM: string = 'STATISTICS_MINIMUM';

const defaultTileSize = 256;

let workerPool: Pool;
export function getWorkerPool(): Pool {
  if (!workerPool) {
    workerPool = new Pool();
  }
  return workerPool;
}

/**
 * Get the bounding box of an image.  If the image does not have an affine transform,
 * the pixel bounds are returned.
 * @param {GeoTIFFImage} image The image.
 * @return {Array<number>} The image bounding box.
 */
export function getBoundingBox(image: GeoTIFFImage): number[] {
  try {
    return image.getBoundingBox();
  } catch (_) {
    return [0, 0, image.getWidth(), image.getHeight()];
  }
}

/**
 * Get the origin of an image.  If the image does not have an affine transform,
 * the top-left corner of the pixel bounds is returned.
 * @param {GeoTIFFImage} image The image.
 * @return {Array<number>} The image origin.
 */
export function getOrigin(image: GeoTIFFImage): number[] {
  try {
    return image.getOrigin().slice(0, 2);
  } catch (_) {
    return [0, image.getHeight()];
  }
}

/**
 * Get the resolution of an image.  If the image does not have an affine transform,
 * the width of the image is compared with the reference image.
 * @param {GeoTIFFImage} image The image.
 * @param {GeoTIFFImage} referenceImage The reference image.
 * @return {Array<number>} The map x and y units per pixel.
 */
export function getResolutions(image: GeoTIFFImage, referenceImage: GeoTIFFImage): number[] {
  try {
    return image.getResolution(referenceImage);
  } catch (_) {
    return [
      referenceImage.getWidth() / image.getWidth(),
      referenceImage.getHeight() / image.getHeight(),
    ];
  }
}

/**
 * @param {GeoTIFFImage} image A GeoTIFF.
 * @return {import("../proj/Projection").default} The image projection.
 */
export function getProjection(image: GeoTIFFImage): Projection {
  const geoKeys = image.geoKeys;
  if (!geoKeys) {
    return null;
  }

  if (
    geoKeys.ProjectedCSTypeGeoKey &&
    geoKeys.ProjectedCSTypeGeoKey !== 32767
  ) {
    const code = 'EPSG:' + geoKeys.ProjectedCSTypeGeoKey;
    let projection = getCachedProjection(code);
    if (!projection) {
      const units = unitsFromCode(geoKeys.ProjLinearUnitsGeoKey);
      if (units) {
        projection = new Projection({
          code: code,
          units: units,
        });
      }
    }
    return projection;
  }

  if (geoKeys.GeographicTypeGeoKey && geoKeys.GeographicTypeGeoKey !== 32767) {
    const code = 'EPSG:' + geoKeys.GeographicTypeGeoKey;
    let projection = getCachedProjection(code);
    if (!projection) {
      const units = unitsFromCode(geoKeys.GeogAngularUnitsGeoKey);
      if (units) {
        projection = new Projection({
          code: code,
          units: units,
        });
      }
    }
    return projection;
  }

  return null;
}

/**
 * @param {GeoTIFF|MultiGeoTIFF} tiff A GeoTIFF.
 * @return {Promise<Array<GeoTIFFImage>>} Resolves to a list of images.
 */
export async function getImagesForTIFF(tiff: GeoTIFF | MultiGeoTIFF): Promise<GeoTIFFImage[]> {
  return tiff.getImageCount().then(function (count) {
    const requests = new Array(count);
    for (let i = 0; i < count; ++i) {
      requests[i] = tiff.getImage(i);
    }
    return Promise.all<GeoTIFFImage>(requests);
  });
}

/**
 * @param {SourceInfo} source The GeoTIFF source.
 * @param {Object} options Options for the GeoTIFF source.
 * @return {Promise<Array<GeoTIFFImage>>} Resolves to a list of images.
 */
export async function getImagesForSource(source: SourceInfo, options: Object): Promise<GeoTIFFImage[]> {
  let request: Promise<GeoTIFF | MultiGeoTIFF>;
  if (source.blob) {
    request = tiffFromBlob(source.blob);
  } else if (source.overviews) {
    request = tiffFromUrls(source.url, source.overviews, options);
  } else {
    request = tiffFromUrl(source.url, options);
  }
  const tiff = await request;
  return getImagesForTIFF(tiff);
}

/**
 * @param {number|Array<number>|Array<Array<number>>} expected Expected value.
 * @param {number|Array<number>|Array<Array<number>>} got Actual value.
 * @param {number} tolerance Accepted tolerance in fraction of expected between expected and got.
 * @param {string} message The error message.
 * @param {function(Error):void} rejector A function to be called with any error.
 */
export function assertEqual(
    expected: number | number[] | number[][],
    got: number | number[] | number[][],
    tolerance: number,
    message: string,
    rejector: (error: Error) => void): void {
  if (Array.isArray(expected)) {
    const length = expected.length;
    if (!Array.isArray(got) || length != got.length) {
      const error = new Error(message);
      rejector(error);
      throw error;
    }
    for (let i = 0; i < length; ++i) {
      assertEqual(expected[i], got[i], tolerance, message, rejector);
    }
    return;
  }

  got = /** @type {number} */ (<number>got);
  if (Math.abs(expected - got) > tolerance * expected) {
    throw new Error(message);
  }
}

/**
 * @param {Array} array The data array.
 * @return {number} The minimum value.
 */
export function getMinForDataType(array: any[]): number {
  if (array instanceof Int8Array) {
    return -128;
  }
  if (array instanceof Int16Array) {
    return -32768;
  }
  if (array instanceof Int32Array) {
    return -2147483648;
  }
  if (array instanceof Float32Array) {
    return 1.2e-38;
  }
  return 0;
}

/**
 * @param {Array} array The data array.
 * @return {number} The maximum value.
 */
function getMaxForDataType(array: any[]): number {
  if (array instanceof Int8Array) {
    return 127;
  }
  if (array instanceof Uint8Array) {
    return 255;
  }
  if (array instanceof Uint8ClampedArray) {
    return 255;
  }
  if (array instanceof Int16Array) {
    return 32767;
  }
  if (array instanceof Uint16Array) {
    return 65535;
  }
  if (array instanceof Int32Array) {
    return 2147483647;
  }
  if (array instanceof Uint32Array) {
    return 4294967295;
  }
  if (array instanceof Float32Array) {
    return 3.4e38;
  }
  return 255;
}

export interface GeoTIFFSourceOptions {
  forceXHR?: boolean;
  headers?: {[key: string]: string};
  credentials?: string;
  maxRanges?: number;
  allowFullFile?: boolean;
  blockSize?: number;
  cacheSize?: number;
}

export interface GeoTIFFSourceOptions {
  sources: SourceInfo[];
  sourceOptions?: GeoTIFFSourceOptions;
  convertToRGB?: boolean | 'auto';
  normalize?: boolean;
  opaque?: boolean;
  transition?: number;
  wrapX?: boolean;
  interpolate?: boolean;
}

/**
 * @classdesc
 * A source for working with GeoTIFF data.
 * **Note for users of the full build**: The `GeoTIFF` source requires the
 * [geotiff](https://github.com/geotiffjs/geotiff) library to be loaded as well.
 *
 * @api
 */
class GeoTIFFSource extends DataTile {
  private sourceInfo_: SourceInfo[];
  private sourceOptions_: Object;
  private sourceImagery_: GeoTIFFImage[][];
  private sourceMasks_: GeoTIFFImage[][];
  private resolutionFactors_: number[];
    private samplesPerPixel_: number[];
    private nodataValues_: number[][];
    private metadata_: GDALMetadata[][];
    private normalize_: boolean;
    private addAlpha_: boolean;
    private error_: Error;
    private convertToRGB_: boolean | 'auto';

  /**
   * @param {Options} options Data tile options.
   */
  constructor(options: GeoTIFFSourceOptions) {
    super({
      state: 'loading',
      tileGrid: null,
      projection: null,
      opaque: options.opaque,
      transition: options.transition,
      interpolate: options.interpolate !== false,
      wrapX: options.wrapX,
    });

    /**
     * @type {Array<SourceInfo>}
     * @private
     */
    this.sourceInfo_ = options.sources;

    const numSources = this.sourceInfo_.length;

    /**
     * @type {Object}
     * @private
     */
    this.sourceOptions_ = options.sourceOptions;

    /**
     * @type {Array<Array<GeoTIFFImage>>}
     * @private
     */
    this.sourceImagery_ = new Array(numSources);

    /**
     * @type {Array<Array<GeoTIFFImage>>}
     * @private
     */
    this.sourceMasks_ = new Array(numSources);

    /**
     * @type {Array<number>}
     * @private
     */
    this.resolutionFactors_ = new Array(numSources);

    /**
     * @type {Array<number>}
     * @private
     */
    this.samplesPerPixel_;

    /**
     * @type {Array<Array<number>>}
     * @private
     */
    this.nodataValues_;

    /**
     * @type {Array<Array<GDALMetadata>>}
     * @private
     */
    this.metadata_;

    /**
     * @type {boolean}
     * @private
     */
    this.normalize_ = options.normalize !== false;

    /**
     * @type {boolean}
     * @private
     */
    this.addAlpha_ = false;

    /**
     * @type {Error}
     * @private
     */
    this.error_ = null;

    /**
     * @type {true|false|'auto'}
     */
    this.convertToRGB_ = options.convertToRGB || false;

    this.setKey(this.sourceInfo_.map((source) => source.url).join(','));

    const self = this;
    const requests = new Array(numSources);
    for (let i = 0; i < numSources; ++i) {
      requests[i] = getImagesForSource(
        this.sourceInfo_[i],
        this.sourceOptions_
      );
    }
    Promise.all(requests)
      .then(function (sources) {
        self.configure_(sources);
      })
      .catch(function (error) {
        logError(error);
        self.error_ = error;
        self.setState('error');
      });
  }

  /**
   * @return {Error} A source loading error. When the source state is `error`, use this function
   * to get more information about the error. To debug a faulty configuration, you may want to use
   * a listener like
   * ```js
   * geotiffSource.on('change', () => {
   *   if (geotiffSource.getState() === 'error') {
   *     console.error(geotiffSource.getError());
   *   }
   * });
   * ```
   */
  public getError(): Error {
    return this.error_;
  }

  /**
   * Determine the projection of the images in this GeoTIFF.
   * The default implementation looks at the ProjectedCSTypeGeoKey and the GeographicTypeGeoKey
   * of each image in turn.
   * You can override this method in a subclass to support more projections.
   *
   * @param {Array<Array<GeoTIFFImage>>} sources Each source is a list of images
   * from a single GeoTIFF.
   */
  public determineProjection(sources: GeoTIFFImage[][]): void {
    const firstSource = sources[0];
    for (let i = firstSource.length - 1; i >= 0; --i) {
      const image = firstSource[i];
      const projection = getProjection(image);
      if (projection) {
        this.projection = projection;
        break;
      }
    }
  }

  /**
   * Configure the tile grid based on images within the source GeoTIFFs.  Each GeoTIFF
   * must have the same internal tiled structure.
   * @param {Array<Array<GeoTIFFImage>>} sources Each source is a list of images
   * from a single GeoTIFF.
   * @private
   */
  private configure_(sources: GeoTIFFImage[][]): void {
    let extent;
    let origin;
    let commonRenderTileSizes;
    let commonSourceTileSizes;
    let resolutions;
    const samplesPerPixel = new Array(sources.length);
    const nodataValues = new Array(sources.length);
    const metadata = new Array(sources.length);
    let minZoom = 0;

    const sourceCount = sources.length;
    for (let sourceIndex = 0; sourceIndex < sourceCount; ++sourceIndex) {
      const images = [];
      const masks = [];
      sources[sourceIndex].forEach((item) => {
        if (isMask(item)) {
          masks.push(item);
        } else {
          images.push(item);
        }
      });

      const imageCount = images.length;
      if (masks.length > 0 && masks.length !== imageCount) {
        throw new Error(
          `Expected one mask per image found ${masks.length} masks and ${imageCount} images`
        );
      }

      let sourceExtent;
      let sourceOrigin;
      const sourceTileSizes = new Array(imageCount);
      const renderTileSizes = new Array(imageCount);
      const sourceResolutions = new Array(imageCount);

      nodataValues[sourceIndex] = new Array(imageCount);
      metadata[sourceIndex] = new Array(imageCount);

      for (let imageIndex = 0; imageIndex < imageCount; ++imageIndex) {
        const image = images[imageIndex];
        const nodataValue = image.getGDALNoData();
        metadata[sourceIndex][imageIndex] = image.getGDALMetadata(0);
        nodataValues[sourceIndex][imageIndex] = nodataValue;

        const wantedSamples = this.sourceInfo_[sourceIndex].bands;
        samplesPerPixel[sourceIndex] = wantedSamples
          ? wantedSamples.length
          : image.getSamplesPerPixel();
        const level = imageCount - (imageIndex + 1);

        if (!sourceExtent) {
          sourceExtent = getBoundingBox(image);
        }

        if (!sourceOrigin) {
          sourceOrigin = getOrigin(image);
        }

        const imageResolutions = getResolutions(image, images[0]);
        sourceResolutions[level] = imageResolutions[0];

        const sourceTileSize = [image.getTileWidth(), image.getTileHeight()];

        // request larger blocks for untiled layouts
        if (
          sourceTileSize[0] !== sourceTileSize[1] &&
          sourceTileSize[1] < defaultTileSize
        ) {
          sourceTileSize[0] = defaultTileSize;
          sourceTileSize[1] = defaultTileSize;
        }

        sourceTileSizes[level] = sourceTileSize;

        const aspectRatio = imageResolutions[0] / Math.abs(imageResolutions[1]);
        renderTileSizes[level] = [
          sourceTileSize[0],
          sourceTileSize[1] / aspectRatio,
        ];
      }

      if (!extent) {
        extent = sourceExtent;
      } else {
        getIntersection(extent, sourceExtent, extent);
      }

      if (!origin) {
        origin = sourceOrigin;
      } else {
        const message = `Origin mismatch for source ${sourceIndex}, got [${sourceOrigin}] but expected [${origin}]`;
        assertEqual(origin, sourceOrigin, 0, message, this.viewRejector);
      }

      if (!resolutions) {
        resolutions = sourceResolutions;
        this.resolutionFactors_[sourceIndex] = 1;
      } else {
        if (resolutions.length - minZoom > sourceResolutions.length) {
          minZoom = resolutions.length - sourceResolutions.length;
        }
        const resolutionFactor =
          resolutions[resolutions.length - 1] /
          sourceResolutions[sourceResolutions.length - 1];
        this.resolutionFactors_[sourceIndex] = resolutionFactor;
        const scaledSourceResolutions = sourceResolutions.map(
          (resolution) => (resolution *= resolutionFactor)
        );
        const message = `Resolution mismatch for source ${sourceIndex}, got [${scaledSourceResolutions}] but expected [${resolutions}]`;
        assertEqual(
          resolutions.slice(minZoom, resolutions.length),
          scaledSourceResolutions,
          0.02,
          message,
          this.viewRejector
        );
      }

      if (!commonRenderTileSizes) {
        commonRenderTileSizes = renderTileSizes;
      } else {
        assertEqual(
          commonRenderTileSizes.slice(minZoom, commonRenderTileSizes.length),
          renderTileSizes,
          0.01,
          `Tile size mismatch for source ${sourceIndex}`,
          this.viewRejector
        );
      }

      if (!commonSourceTileSizes) {
        commonSourceTileSizes = sourceTileSizes;
      } else {
        assertEqual(
          commonSourceTileSizes.slice(minZoom, commonSourceTileSizes.length),
          sourceTileSizes,
          0,
          `Tile size mismatch for source ${sourceIndex}`,
          this.viewRejector
        );
      }

      this.sourceImagery_[sourceIndex] = images.reverse();
      this.sourceMasks_[sourceIndex] = masks.reverse();
    }

    for (let i = 0, ii = this.sourceImagery_.length; i < ii; ++i) {
      const sourceImagery = this.sourceImagery_[i];
      while (sourceImagery.length < resolutions.length) {
        sourceImagery.unshift(undefined);
      }
    }

    if (!this.getProjection()) {
      this.determineProjection(sources);
    }

    this.samplesPerPixel_ = samplesPerPixel;
    this.nodataValues_ = nodataValues;
    this.metadata_ = metadata;

    // decide if we need to add an alpha band to handle nodata
    outer: for (let sourceIndex = 0; sourceIndex < sourceCount; ++sourceIndex) {
      // option 1: source is configured with a nodata value
      if (this.sourceInfo_[sourceIndex].nodata !== undefined) {
        this.addAlpha_ = true;
        break;
      }
      if (this.sourceMasks_[sourceIndex].length) {
        this.addAlpha_ = true;
        break;
      }

      const values = nodataValues[sourceIndex];

      // option 2: check image metadata for limited bands
      const bands = this.sourceInfo_[sourceIndex].bands;
      if (bands) {
        for (let i = 0; i < bands.length; ++i) {
          if (values[bands[i] - 1] !== null) {
            this.addAlpha_ = true;
            break outer;
          }
        }
        continue;
      }

      // option 3: check image metadata for all bands
      for (let imageIndex = 0; imageIndex < values.length; ++imageIndex) {
        if (values[imageIndex] !== null) {
          this.addAlpha_ = true;
          break outer;
        }
      }
    }

    let bandCount = this.addAlpha_ ? 1 : 0;
    for (let sourceIndex = 0; sourceIndex < sourceCount; ++sourceIndex) {
      bandCount += samplesPerPixel[sourceIndex];
    }
    this.bandCount = bandCount;

    const tileGrid = new TileGrid({
      extent: extent,
      minZoom: minZoom,
      origin: origin,
      resolutions: resolutions,
      tileSizes: commonRenderTileSizes,
    });

    this.tileGrid = tileGrid;
    this.setTileSizes(commonSourceTileSizes);

    this.setLoader(this.loadTile_.bind(this));
    this.setState('ready');

    const zoom = 1;
    if (resolutions.length === 2) {
      resolutions = [resolutions[0], resolutions[1], resolutions[1] / 2];
    } else if (resolutions.length === 1) {
      resolutions = [resolutions[0] * 2, resolutions[0], resolutions[0] / 2];
    }

    this.viewResolver({
      showFullExtent: true,
      projection: this.projection,
      resolutions: resolutions,
      center: toUserCoordinate(getCenter(extent), this.projection),
      extent: toUserExtent(extent, this.projection),
      zoom: zoom,
    });
  }

  /**
   * @param {number} z The z tile index.
   * @param {number} x The x tile index.
   * @param {number} y The y tile index.
   * @return {Promise} The composed tile data.
   * @private
   */
  private loadTile_(z: number, x: number, y: number): Promise<any> {
    const sourceTileSize = this.getTileSize(z);
    const sourceCount = this.sourceImagery_.length;
    const requests = new Array(sourceCount * 2);
    const nodataValues = this.nodataValues_;
    const sourceInfo = this.sourceInfo_;
    const pool = getWorkerPool();
    for (let sourceIndex = 0; sourceIndex < sourceCount; ++sourceIndex) {
      const source = sourceInfo[sourceIndex];
      const resolutionFactor = this.resolutionFactors_[sourceIndex];
      const pixelBounds = [
        Math.round(x * (sourceTileSize[0] * resolutionFactor)),
        Math.round(y * (sourceTileSize[1] * resolutionFactor)),
        Math.round((x + 1) * (sourceTileSize[0] * resolutionFactor)),
        Math.round((y + 1) * (sourceTileSize[1] * resolutionFactor)),
      ];
      const image = this.sourceImagery_[sourceIndex][z];
      let samples;
      if (source.bands) {
        samples = source.bands.map(function (bandNumber) {
          return bandNumber - 1;
        });
      }

      /** @type {number|Array<number>} */
      let fillValue;
      if ('nodata' in source && source.nodata !== null) {
        fillValue = source.nodata;
      } else {
        if (!samples) {
          fillValue = nodataValues[sourceIndex];
        } else {
          fillValue = samples.map(function (sampleIndex) {
            return nodataValues[sourceIndex][sampleIndex];
          });
        }
      }

      const readOptions = {
        window: pixelBounds,
        width: sourceTileSize[0],
        height: sourceTileSize[1],
        samples: samples,
        fillValue: fillValue,
        pool: pool,
        interleave: false,
      };
      if (readRGB(this.convertToRGB_, image)) {
        requests[sourceIndex] = image.readRGB(readOptions);
      } else {
        requests[sourceIndex] = image.readRasters(readOptions);
      }

      // requests after `sourceCount` are for mask data (if any)
      const maskIndex = sourceCount + sourceIndex;
      const mask = this.sourceMasks_[sourceIndex][z];
      if (!mask) {
        requests[maskIndex] = Promise.resolve(null);
        continue;
      }

      requests[maskIndex] = mask.readRasters({
        window: pixelBounds,
        width: sourceTileSize[0],
        height: sourceTileSize[1],
        samples: [0],
        pool: pool,
        interleave: false,
      });
    }

    return Promise.all(requests)
      .then(this.composeTile_.bind(this, sourceTileSize))
      .catch(function (error) {
        logError(error);
        throw error;
      });
  }

  /**
   * @param {import("../size").Size} sourceTileSize The source tile size.
   * @param {Array} sourceSamples The source samples.
   * @return {import("../DataTile").Data} The composed tile data.
   * @private
   */
  private composeTile_(sourceTileSize: Size, sourceSamples: any[]): Data {
    const metadata = this.metadata_;
    const sourceInfo = this.sourceInfo_;
    const sourceCount = this.sourceImagery_.length;
    const bandCount = this.bandCount;
    const samplesPerPixel = this.samplesPerPixel_;
    const nodataValues = this.nodataValues_;
    const normalize = this.normalize_;
    const addAlpha = this.addAlpha_;

    const pixelCount = sourceTileSize[0] * sourceTileSize[1];
    const dataLength = pixelCount * bandCount;

    /** @type {Uint8Array|Float32Array} */
    let data: Uint8Array | Float32Array;
    if (normalize) {
      data = new Uint8Array(dataLength);
    } else {
      data = new Float32Array(dataLength);
    }

    let dataIndex = 0;
    for (let pixelIndex = 0; pixelIndex < pixelCount; ++pixelIndex) {
      let transparent = addAlpha;
      for (let sourceIndex = 0; sourceIndex < sourceCount; ++sourceIndex) {
        const source = sourceInfo[sourceIndex];

        let min = source.min;
        let max = source.max;
        let gain, bias;
        if (normalize) {
          const stats = metadata[sourceIndex][0];
          if (min === undefined) {
            if (stats && STATISTICS_MINIMUM in stats) {
              min = parseFloat(stats[STATISTICS_MINIMUM]);
            } else {
              min = getMinForDataType(sourceSamples[sourceIndex][0]);
            }
          }
          if (max === undefined) {
            if (stats && STATISTICS_MAXIMUM in stats) {
              max = parseFloat(stats[STATISTICS_MAXIMUM]);
            } else {
              max = getMaxForDataType(sourceSamples[sourceIndex][0]);
            }
          }

          gain = 255 / (max - min);
          bias = -min * gain;
        }

        for (
          let sampleIndex = 0;
          sampleIndex < samplesPerPixel[sourceIndex];
          ++sampleIndex
        ) {
          const sourceValue =
            sourceSamples[sourceIndex][sampleIndex][pixelIndex];

          let value;
          if (normalize) {
            value = clamp(gain * sourceValue + bias, 0, 255);
          } else {
            value = sourceValue;
          }

          if (!addAlpha) {
            data[dataIndex] = value;
          } else {
            let nodata = source.nodata;
            if (nodata === undefined) {
              let bandIndex;
              if (source.bands) {
                bandIndex = source.bands[sampleIndex] - 1;
              } else {
                bandIndex = sampleIndex;
              }
              nodata = nodataValues[sourceIndex][bandIndex];
            }

            const nodataIsNaN = isNaN(nodata);
            if (
              (!nodataIsNaN && sourceValue !== nodata) ||
              (nodataIsNaN && !isNaN(sourceValue))
            ) {
              transparent = false;
              data[dataIndex] = value;
            }
          }
          dataIndex++;
        }
        if (!transparent) {
          const maskIndex = sourceCount + sourceIndex;
          const mask = sourceSamples[maskIndex];
          if (mask && !mask[0][pixelIndex]) {
            transparent = true;
          }
        }
      }
      if (addAlpha) {
        if (!transparent) {
          data[dataIndex] = 255;
        }
        dataIndex++;
      }
    }

    return data;
  }
}

/**
 * Get a promise for view properties based on the source.  Use the result of this function
 * as the `view` option in a map constructor.
 *
 *     const source = new GeoTIFF(options);
 *
 *     const map = new Map({
 *       target: 'map',
 *       layers: [
 *         new TileLayer({
 *           source: source,
 *         }),
 *       ],
 *       view: source.getView(),
 *     });
 *
 * @function
 * @return {Promise<import("../View").ViewOptions>} A promise for view-related properties.
 * @api
 *
 */
GeoTIFFSource.prototype.getView;

export default GeoTIFFSource;
