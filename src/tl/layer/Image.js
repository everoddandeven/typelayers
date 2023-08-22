/**
 * @module tl/layer/Image
 */
import BaseImageLayer from './BaseImage';
import CanvasImageLayerRenderer from '../renderer/canvas/ImageLayer';

/**
 * @classdesc
 * Server-rendered images that are available for arbitrary extents and
 * resolutions.
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Image").default} ImageSourceType
 * @extends {BaseImageLayer<ImageSourceType, CanvasImageLayerRenderer>}
 * @api
 */
class ImageLayer extends BaseImageLayer {
  /**
   * @param {import("./BaseImage").Options<ImageSourceType>} [options] Layer options.
   */
  constructor(options) {
    super(options);
  }

  createRenderer() {
    return new CanvasImageLayerRenderer(this);
  }

  /**
   * Get data for a pixel location.  A four element RGBA array will be returned.  For requests outside the
   * layer extent, `null` will be returned.  Data for an image can only be retrieved if the
   * source's `crossOrigin` property is set.
   *
   * ```js
   * // display layer data on every pointer move
   * map.on('pointermove', (event) => {
   *   console.log(layer.getData(event.pixel));
   * });
   * ```
   * @param {import("../pixel").Pixel} pixel Pixel.
   * @return {Uint8ClampedArray|Uint8Array|Float32Array|DataView|null} Pixel data.
   * @api
   */
  getData(pixel) {
    return super.getData(pixel);
  }
}

export default ImageLayer;
