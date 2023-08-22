/**
 * @module tl/style/IconImageCache
 */
import {asString, Color} from '../color';
import IconImage from "./IconImage";

/**
 * @classdesc
 * Singleton class. Available through {@link module:tl/style/IconImageCache.shared}.
 */
class IconImageCache {

  private cache_: {[key: string]: IconImage};
  private cacheSize_: number;
  private maxCacheSize_: number;

  constructor() {
    /**
     * @type {!Object<string, import("./IconImage").default>}
     * @private
     */
    this.cache_ = {};

    /**
     * @type {number}
     * @private
     */
    this.cacheSize_ = 0;

    /**
     * @type {number}
     * @private
     */
    this.maxCacheSize_ = 32;
  }

  /**
   * FIXME empty description for jsdoc
   */
  public clear(): void {
    this.cache_ = {};
    this.cacheSize_ = 0;
  }

  /**
   * @return {boolean} Can expire cache.
   */
  public canExpireCache(): boolean {
    return this.cacheSize_ > this.maxCacheSize_;
  }

  /**
   * FIXME empty description for jsdoc
   */
  public expire(): void {
    if (this.canExpireCache()) {
      let i = 0;
      for (const key in this.cache_) {
        const iconImage = this.cache_[key];
        if ((i++ & 3) === 0 && !iconImage.hasListener()) {
          delete this.cache_[key];
          --this.cacheSize_;
        }
      }
    }
  }

  /**
   * @param {string} src Src.
   * @param {?string} crossOrigin Cross origin.
   * @param {import("../color").Color} color Color.
   * @return {import("./IconImage").default} Icon image.
   */
  public get(src: string, crossOrigin: string, color: Color): IconImage {
    const key = getKey(src, crossOrigin, color);
    return key in this.cache_ ? this.cache_[key] : null;
  }

  /**
   * @param {string} src Src.
   * @param {?string} crossOrigin Cross origin.
   * @param {import("../color").Color} color Color.
   * @param {import("./IconImage").default} iconImage Icon image.
   */
  public set(src: string, crossOrigin: string, color: Color, iconImage: IconImage): void {
    const key = getKey(src, crossOrigin, color);
    this.cache_[key] = iconImage;
    ++this.cacheSize_;
  }

  /**
   * Set the cache size of the icon cache. Default is `32`. Change this value when
   * your map uses more than 32 different icon images and you are not caching icon
   * styles on the application level.
   * @param {number} maxCacheSize Cache max size.
   * @api
   */
  public setSize(maxCacheSize: number): void {
    this.maxCacheSize_ = maxCacheSize;
    this.expire();
  }
}

/**
 * @param {string} src Src.
 * @param {?string} crossOrigin Cross origin.
 * @param {import("../color").Color} color Color.
 * @return {string} Cache key.
 */
function getKey(src: string, crossOrigin: string, color: Color): string {
  const colorString = color ? asString(color) : 'null';
  return crossOrigin + ':' + src + ':' + colorString;
}

export default IconImageCache;

/**
 * The {@link module:tl/style/IconImageCache~IconImageCache} for
 * {@link module:tl/style/Icon~Icon} images.
 * @api
 */
export const shared = new IconImageCache();
