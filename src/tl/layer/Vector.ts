/**
 * @module tl/layer/Vector
 */
import BaseVectorLayer, {BaseVectorLayerOptions} from './BaseVector';
import CanvasVectorLayerRenderer from '../renderer/canvas/VectorLayer';
import VectorSource from "../source/Vector";

/**
 * @classdesc
 * Vector data is rendered client-side, as vectors. This layer type provides most accurate rendering
 * even during animations. Points and labels stay upright on rotated views. For very large
 * amounts of vector data, performance may suffer during pan and zoom animations. In this case,
 * try {@link module:tl/layer/VectorImage~VectorImageLayer}.
 *
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Vector").default} VectorSourceType
 * @extends {BaseVectorLayer<VectorSourceType, CanvasVectorLayerRenderer>}
 * @api
 */
class VectorLayer<VectorSourceType extends VectorSource = VectorSource> extends BaseVectorLayer<VectorSourceType, CanvasVectorLayerRenderer> {
  /**
   * @param {import("./BaseVector").Options<VectorSourceType>} [options] Options.
   */
  constructor(options?: BaseVectorLayerOptions<VectorSourceType>) {
    super(options);
  }

  public createRenderer(): CanvasVectorLayerRenderer {
    return new CanvasVectorLayerRenderer(this);
  }
}

export default VectorLayer;
