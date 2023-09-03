/**
 * @module tl/layer/BaseImage
 */
import Layer from './Layer';
import ImageSource from "../source/Image";
import LayerRenderer from "../renderer/Layer";
import {Extent} from "../extent";
import Map from "../Map";

export interface BaseImageLayerOptions<ImageSourceType extends ImageSource = ImageSource> {
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  map?: Map;
  source?: ImageSourceType;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * Server-rendered images that are available for arbitrary extents and
 * resolutions.
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Image").default} ImageSourceType
 * @template {import("../renderer/Layer").default} RendererType
 * @extends {Layer<ImageSourceType, RendererType>}
 * @api
 */
class BaseImageLayer<ImageSourceType extends ImageSource = ImageSource, RendererType extends LayerRenderer = LayerRenderer> extends Layer<ImageSourceType, RendererType> {
  /**
   * @param {Options<ImageSourceType>} [options] Layer options.
   */
  constructor(options?: BaseImageLayerOptions<ImageSourceType>) {
    options = options ? options : {};
    super(options);
  }
}

export default BaseImageLayer;
