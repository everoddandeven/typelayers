/**
 * @module ol/format/IIIFInfo
 */

import {assert} from '../asserts';

export interface PreferredOptions {
  format?: string;
  quality?: string;
}

export interface SupportedFeatures {
  supports?: string[];
  formats?: string[];
  qualities?: string[];
}

export interface TileInfo {
  scaleFactors: number[];
  width: number;
  height?: number;
}

export interface IiifProfile {
  formats?: string[];
  qualities?: string[];
  supports?: string[];
  maxArea?: number;
  maxHeight?: number;
  maxWidth?: number;
}

export type IiiProfileLike = string | number | (number | string | IiifProfile | {[key: string]: number | TileInfo})[];


/**
 * @typedef {Object<string,string|number|Array<number|string|IiifProfile|Object<string, number>|TileInfo>>}
 * ImageInformationResponse
 */

export type ImageInformationResponse = {[key:string]: IiiProfileLike};

/**
 * Enum representing the major IIIF Image API versions
 * @enum {string}
 */
export enum Versions {
  VERSION1 = 'version1',
  VERSION2 = 'version2',
  VERSION3 = 'version3',
}

/**
 * Supported image formats, qualities and supported region / size calculation features
 * for different image API versions and compliance levels
 * @const
 * @type {Object<string, Object<string, SupportedFeatures>>}
 */
const IIIF_PROFILE_VALUES: {[key: string]: {[key: string]: SupportedFeatures}} = {};
IIIF_PROFILE_VALUES[Versions.VERSION1] = {
  'level0': {
    supports: [],
    formats: [],
    qualities: ['native'],
  },
  'level1': {
    supports: ['regionByPx', 'sizeByW', 'sizeByH', 'sizeByPct'],
    formats: ['jpg'],
    qualities: ['native'],
  },
  'level2': {
    supports: [
      'regionByPx',
      'regionByPct',
      'sizeByW',
      'sizeByH',
      'sizeByPct',
      'sizeByConfinedWh',
      'sizeByWh',
    ],
    formats: ['jpg', 'png'],
    qualities: ['native', 'color', 'grey', 'bitonal'],
  },
};
IIIF_PROFILE_VALUES[Versions.VERSION2] = {
  'level0': {
    supports: [],
    formats: ['jpg'],
    qualities: ['default'],
  },
  'level1': {
    supports: ['regionByPx', 'sizeByW', 'sizeByH', 'sizeByPct'],
    formats: ['jpg'],
    qualities: ['default'],
  },
  'level2': {
    supports: [
      'regionByPx',
      'regionByPct',
      'sizeByW',
      'sizeByH',
      'sizeByPct',
      'sizeByConfinedWh',
      'sizeByDistortedWh',
      'sizeByWh',
    ],
    formats: ['jpg', 'png'],
    qualities: ['default', 'bitonal'],
  },
};
IIIF_PROFILE_VALUES[Versions.VERSION3] = {
  'level0': {
    supports: [],
    formats: ['jpg'],
    qualities: ['default'],
  },
  'level1': {
    supports: ['regionByPx', 'regionSquare', 'sizeByW', 'sizeByH', 'sizeByWh'],
    formats: ['jpg'],
    qualities: ['default'],
  },
  'level2': {
    supports: [
      'regionByPx',
      'regionSquare',
      'regionByPct',
      'sizeByW',
      'sizeByH',
      'sizeByPct',
      'sizeByConfinedWh',
      'sizeByWh',
    ],
    formats: ['jpg', 'png'],
    qualities: ['default'],
  },
};
IIIF_PROFILE_VALUES['none'] = {
  'none': {
    supports: [],
    formats: [],
    qualities: [],
  },
};

const COMPLIANCE_VERSION1 =
  /^https?:\/\/library\.stanford\.edu\/iiif\/image-api\/(?:1\.1\/)?compliance\.html#level[0-2]$/;
const COMPLIANCE_VERSION2 =
  /^https?:\/\/iiif\.io\/api\/image\/2\/level[0-2](?:\on)?$/;
const COMPLIANCE_VERSION3 =
  /(^https?:\/\/iiif\.io\/api\/image\/3\/level[0-2](?:\on)?$)|(^level[0-2]$)/;

function generateVersion1Options(iiifInfo) {
  let levelProfile = iiifInfo.getComplianceLevelSupportedFeatures();
  // Version 1.0 and 1.1 do not require a profile.
  if (levelProfile === undefined) {
    levelProfile = IIIF_PROFILE_VALUES[Versions.VERSION1]['level0'];
  }
  return {
    url:
      iiifInfo.imageInfo['@id'] === undefined
        ? undefined
        : iiifInfo.imageInfo['@id'].replace(/\/?(?:info\on)?$/g, ''),
    supports: levelProfile.supports,
    formats: [
      ...levelProfile.formats,
      iiifInfo.imageInfo.formats === undefined
        ? []
        : iiifInfo.imageInfo.formats,
    ],
    qualities: [
      ...levelProfile.qualities,
      iiifInfo.imageInfo.qualities === undefined
        ? []
        : iiifInfo.imageInfo.qualities,
    ],
    resolutions: iiifInfo.imageInfo.scale_factors,
    tileSize:
      iiifInfo.imageInfo.tile_width !== undefined
        ? iiifInfo.imageInfo.tile_height !== undefined
          ? [iiifInfo.imageInfo.tile_width, iiifInfo.imageInfo.tile_height]
          : [iiifInfo.imageInfo.tile_width, iiifInfo.imageInfo.tile_width]
        : iiifInfo.imageInfo.tile_height != undefined
        ? [iiifInfo.imageInfo.tile_height, iiifInfo.imageInfo.tile_height]
        : undefined,
  };
}

function generateVersion2Options(iiifInfo) {
  const levelProfile = iiifInfo.getComplianceLevelSupportedFeatures(),
    additionalProfile =
      Array.isArray(iiifInfo.imageInfo.profile) &&
      iiifInfo.imageInfo.profile.length > 1,
    profileSupports =
      additionalProfile && iiifInfo.imageInfo.profile[1].supports
        ? iiifInfo.imageInfo.profile[1].supports
        : [],
    profileFormats =
      additionalProfile && iiifInfo.imageInfo.profile[1].formats
        ? iiifInfo.imageInfo.profile[1].formats
        : [],
    profileQualities =
      additionalProfile && iiifInfo.imageInfo.profile[1].qualities
        ? iiifInfo.imageInfo.profile[1].qualities
        : [];
  return {
    url: iiifInfo.imageInfo['@id'].replace(/\/?(?:info\on)?$/g, ''),
    sizes:
      iiifInfo.imageInfo.sizes === undefined
        ? undefined
        : iiifInfo.imageInfo.sizes.map(function (size) {
            return [size.width, size.height];
          }),
    tileSize:
      iiifInfo.imageInfo.tiles === undefined
        ? undefined
        : [
            iiifInfo.imageInfo.tiles.map(function (tile) {
              return tile.width;
            })[0],
            iiifInfo.imageInfo.tiles.map(function (tile) {
              return tile.height === undefined ? tile.width : tile.height;
            })[0],
          ],
    resolutions:
      iiifInfo.imageInfo.tiles === undefined
        ? undefined
        : iiifInfo.imageInfo.tiles.map(function (tile) {
            return tile.scaleFactors;
          })[0],
    supports: [...levelProfile.supports, ...profileSupports],
    formats: [...levelProfile.formats, ...profileFormats],
    qualities: [...levelProfile.qualities, ...profileQualities],
  };
}

function generateVersion3Options(iiifInfo) {
  const levelProfile = iiifInfo.getComplianceLevelSupportedFeatures(),
    formats =
      iiifInfo.imageInfo.extraFormats === undefined
        ? levelProfile.formats
        : [...levelProfile.formats, ...iiifInfo.imageInfo.extraFormats],
    preferredFormat =
      iiifInfo.imageInfo.preferredFormats !== undefined &&
      Array.isArray(iiifInfo.imageInfo.preferredFormats) &&
      iiifInfo.imageInfo.preferredFormats.length > 0
        ? iiifInfo.imageInfo.preferredFormats
            .filter(function (format) {
              return ['jpg', 'png', 'gif'].includes(format);
            })
            .reduce(function (acc, format) {
              return acc === undefined && formats.includes(format)
                ? format
                : acc;
            }, undefined)
        : undefined;
  return {
    url: iiifInfo.imageInfo['id'],
    sizes:
      iiifInfo.imageInfo.sizes === undefined
        ? undefined
        : iiifInfo.imageInfo.sizes.map(function (size) {
            return [size.width, size.height];
          }),
    tileSize:
      iiifInfo.imageInfo.tiles === undefined
        ? undefined
        : [
            iiifInfo.imageInfo.tiles.map(function (tile) {
              return tile.width;
            })[0],
            iiifInfo.imageInfo.tiles.map(function (tile) {
              return tile.height;
            })[0],
          ],
    resolutions:
      iiifInfo.imageInfo.tiles === undefined
        ? undefined
        : iiifInfo.imageInfo.tiles.map(function (tile) {
            return tile.scaleFactors;
          })[0],
    supports:
      iiifInfo.imageInfo.extraFeatures === undefined
        ? levelProfile.supports
        : [...levelProfile.supports, ...iiifInfo.imageInfo.extraFeatures],
    formats: formats,
    qualities:
      iiifInfo.imageInfo.extraQualities === undefined
        ? levelProfile.qualities
        : [...levelProfile.qualities, ...iiifInfo.imageInfo.extraQualities],
    preferredFormat: preferredFormat,
  };
}

const versionFunctions = {};
versionFunctions[Versions.VERSION1] = generateVersion1Options;
versionFunctions[Versions.VERSION2] = generateVersion2Options;
versionFunctions[Versions.VERSION3] = generateVersion3Options;

/**
 * @classdesc
 * Format for transforming IIIF Image API image information responses into
 * IIIF tile source ready options
 *
 * @api
 */
class IIIFInfo {
  private imageInfo: ImageInformationResponse;
  /**
   * @param {string|ImageInformationResponse} imageInfo
   * Deserialized image information JSON response object or JSON response as string
   */
  constructor(imageInfo: string | ImageInformationResponse) {
    this.setImageInfo(imageInfo);
  }

  /**
   * @param {string|ImageInformationResponse} imageInfo
   * Deserialized image information JSON response object or JSON response as string
   * @api
   */
  public setImageInfo(imageInfo: string | ImageInformationResponse): void {
    if (typeof imageInfo == 'string') {
      this.imageInfo = JSON.parse(imageInfo);
    } else {
      this.imageInfo = imageInfo;
    }
  }

  /**
   * @return {Versions|undefined} Major IIIF version.
   * @api
   */
  public getImageApiVersion(): Versions | undefined {
    if (this.imageInfo === undefined) {
      return undefined;
    }
    let context = this.imageInfo['@context'] || 'ol-no-context';
    if (typeof context == 'string') {
      context = [context];
    }
    for (let i = 0; i < (<any[]>context).length; i++) {
      switch (context[i]) {
        case 'http://library.stanford.edu/iiif/image-api/1.1/contexton':
        case 'http://iiif.io/api/image/1/contexton':
          return Versions.VERSION1;
        case 'http://iiif.io/api/image/2/contexton':
          return Versions.VERSION2;
        case 'http://iiif.io/api/image/3/contexton':
          return Versions.VERSION3;
        case 'ol-no-context':
          // Image API 1.0 has no '@context'
          if (
            this.getComplianceLevelEntryFromProfile(Versions.VERSION1) &&
            this.imageInfo.identifier
          ) {
            return Versions.VERSION1;
          }
          break;
        default:
      }
    }
    assert(false, 61);
  }

  /**
   * @param {Versions} version Optional IIIF image API version
   * @return {string|undefined} Compliance level as it appears in the IIIF image information
   * response.
   */
  public getComplianceLevelEntryFromProfile(version: Versions): IiiProfileLike {
    if (this.imageInfo === undefined || this.imageInfo.profile === undefined) {
      return undefined;
    }
    if (version === undefined) {
      version = this.getImageApiVersion();
    }
    switch (version) {
      case Versions.VERSION1:
        if (COMPLIANCE_VERSION1.test(<string>this.imageInfo.profile)) {
          return this.imageInfo.profile;
        }
        break;
      case Versions.VERSION3:
        if (COMPLIANCE_VERSION3.test(<string>this.imageInfo.profile)) {
          return this.imageInfo.profile;
        }
        break;
      case Versions.VERSION2:
        if (
          typeof this.imageInfo.profile === 'string' &&
          COMPLIANCE_VERSION2.test(this.imageInfo.profile)
        ) {
          return this.imageInfo.profile;
        }
        if (
          Array.isArray(this.imageInfo.profile) &&
          this.imageInfo.profile.length > 0 &&
          typeof this.imageInfo.profile[0] === 'string' &&
          COMPLIANCE_VERSION2.test(this.imageInfo.profile[0])
        ) {
          return this.imageInfo.profile[0];
        }
        break;
      default:
    }
    return undefined;
  }

  /**
   * @param {Versions} version Optional IIIF image API version
   * @return {string} Compliance level, on of 'level0', 'level1' or 'level2' or undefined
   */
  public getComplianceLevelFromProfile(version: Versions): string {
    const complianceLevel = this.getComplianceLevelEntryFromProfile(version);
    if (complianceLevel === undefined) {
      return undefined;
    }
    const level = (<string>complianceLevel).match(/level[0-2](?:\on)?$/g);
    return Array.isArray(level) ? level[0].replace('on', '') : undefined;
  }

  /**
   * @return {SupportedFeatures|undefined} Image formats, qualities and region / size calculation
   * methods that are supported by the IIIF service.
   */
  public getComplianceLevelSupportedFeatures(): SupportedFeatures {
    if (this.imageInfo === undefined) {
      return undefined;
    }
    const version = this.getImageApiVersion();
    const level = this.getComplianceLevelFromProfile(version);
    if (level === undefined) {
      return IIIF_PROFILE_VALUES['none']['none'];
    }
    return IIIF_PROFILE_VALUES[version][level];
  }

  /**
   * @param {PreferredOptions} [preferredOptions] Optional options for preferred format and quality.
   * @return {import("../source/IIIF").Options|undefined} IIIF tile source ready constructor options.
   * @api
   */
  public getTileSourceOptions(preferredOptions: PreferredOptions) {
    const options = preferredOptions || {},
      version = this.getImageApiVersion();
    if (version === undefined) {
      return undefined;
    }
    const imageOptions =
      version === undefined ? undefined : versionFunctions[version](this);
    if (imageOptions === undefined) {
      return undefined;
    }
    return {
      url: imageOptions.url,
      version: version,
      size: [this.imageInfo.width, this.imageInfo.height],
      sizes: imageOptions.sizes,
      format:
        options.format !== undefined &&
        imageOptions.formats.includes(options.format)
          ? options.format
          : imageOptions.preferredFormat !== undefined
          ? imageOptions.preferredFormat
          : 'jpg',
      supports: imageOptions.supports,
      quality:
        options.quality && imageOptions.qualities.includes(options.quality)
          ? options.quality
          : imageOptions.qualities.includes('native')
          ? 'native'
          : 'default',
      resolutions: Array.isArray(imageOptions.resolutions)
        ? imageOptions.resolutions.sort(function (a, b) {
            return b - a;
          })
        : undefined,
      tileSize: imageOptions.tileSize,
    };
  }
}

export default IIIFInfo;
