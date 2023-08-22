/**
 * @module tl/layer/Tile
 */
import BaseTileLayer from './BaseTile';
import CanvasTileLayerRenderer from '../renderer/canvas/TileLayer';
import TileSource from "../source/Tile";

/**
 * @classdesc
 * For layer sources that provide pre-rendered, tiled images in grids that are
 * organized by zoom levels for specific resolutions.
 * Note that any property set in the options is set as a {@link module:tl/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @template {import("../source/Tile").default} TileSourceType
 * @extends BaseTileLayer<TileSourceType, CanvasTileLayerRenderer>
 * @api
 */
class TileLayer<TileSourceType extends TileSource> extends BaseTileLayer {
  /**
   * @param {import("./BaseTile").Options<TileSourceType>} [options] Tile layer options.
   */
  constructor(options) {
    super(options);
  }

  createRenderer() {
    return new CanvasTileLayerRenderer(this);
  }
}

export default TileLayer;
