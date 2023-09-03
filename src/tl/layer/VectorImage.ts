/**
 * @module tl/layer/VectorImage
 */
import BaseVectorLayer from './BaseVector';
import CanvasVectorImageLayerRenderer from '../renderer/canvas/VectorImageLayer';
import VectorSource from "../source/Vector";
import {Extent} from "../extent";
import {RenderOrderFunction} from "../render";
import {StyleLike} from "../style/Style";
import Map from "../Map";

export interface VectorImageLayerOptions<VectorSourceType extends VectorSource = VectorSource> {
  className?: string;
  opacity?: number;
  visible?: boolean;
  extent?: Extent;
  zIndex?: number;
  minResolution?: number;
  maxResolution?: number;
  minZoom?: number;
  maxZoom?: number;
  renderOrder?: RenderOrderFunction;
  renderBuffer?: number;
  source?: VectorSourceType;
  map?: Map;
  declutter?: boolean;
  style?: StyleLike | null;
  imageRatio?: number;
  properties?: {[key: string]: any};
}

/**
 * @classdesc
 * Vector data is rendered client-side, to an image. This layer type provides great performance
 * during panning and zooming, but point symbols and texts are always rotated with the view and
 * pixels are scaled during zoom animations. For more accurate rendering of vector data, use
 * {@link module:tl/layer/Vector~VectorLayer} instead.
 *
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Vector").default} VectorSourceType
 * @extends {BaseVectorLayer<VectorSourceType, CanvasVectorImageLayerRenderer>}
 * @api
 */
class VectorImageLayer extends BaseVectorLayer {
  private imageRatio_: number;
  /**
   * @param {Options<VectorSourceType>} [options] Options.
   */
  constructor(options?: VectorImageLayerOptions) {
    options = options ? options : {};

    const baseOptions = Object.assign({}, options);
    delete baseOptions.imageRatio;
    super(baseOptions);

    /**
     * @type {number}
     * @private
     */
    this.imageRatio_ =
      options.imageRatio !== undefined ? options.imageRatio : 1;
  }

  /**
   * @return {number} Ratio between rendered extent size and viewport extent size.
   */
  public getImageRatio(): number {
    return this.imageRatio_;
  }

  public createRenderer(): CanvasVectorImageLayerRenderer {
    return new CanvasVectorImageLayerRenderer(this);
  }
}

export default VectorImageLayer;
