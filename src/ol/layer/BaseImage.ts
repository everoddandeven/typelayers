/**
 * @module ol/layer/BaseImage
 */
import Layer from './Layer';
import ImageSource from "../source/Image";

export interface BaseImageLayerOptions<ImageSourceType = ImageSource> {
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: import("../extent").Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  map?: import("../Map").default;
  source?: ImageSourceType;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * Server-rendered images that are available for arbitrary extents and
 * resolutions.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Image").default} ImageSourceType
 * @template {import("../renderer/Layer").default} RendererType
 * @extends {Layer<ImageSourceType, RendererType>}
 * @api
 */
class BaseImageLayer extends Layer {
  /**
   * @param {Options<ImageSourceType>} [options] Layer options.
   */
  constructor(options?: BaseImageLayerOptions) {
    options = options ? options : {};
    super(options);
  }
}

export default BaseImageLayer;
