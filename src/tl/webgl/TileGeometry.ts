/**
 * @module tl/webgl/TileGeometry
 */

import BaseTileRepresentation from './BaseTileRepresentation';
import MixedGeometryBatch from '../render/webgl/MixedGeometryBatch';
import {
  create as createTransform,
  translate as translateTransform,
} from '../transform';
import VectorStyleRenderer from "../render/webgl/VectorStyleRenderer";

/**
 * @typedef {import("../VectorRenderTile").default} TileType
 */

/**
 * @extends {BaseTileRepresentation<TileType>}
 */
class TileGeometry extends BaseTileRepresentation {
  /**
   * @param {import("./BaseTileRepresentation").TileRepresentationOptions<TileType>} options The tile texture options.
   * @param {Array<import("../render/webgl/VectorStyleRenderer").default>} styleRenderers Array of vector style renderers
   */

  private batch_: MixedGeometryBatch;
  private styleRenderers_: VectorStyleRenderer[];
  public buffers: []

  constructor(options, styleRenderers: VectorStyleRenderer[]) {
    super(options);

    /**
     * @private
     */
    this.batch_ = new MixedGeometryBatch();

    /**
     * @private
     */
    this.styleRenderers_ = styleRenderers;

    /**
     * @type {Array<import("../render/webgl/VectorStyleRenderer").WebGLBuffers>}
     */
    this.buffers = [];

    this.setTile(options.tile);
  }

  uploadTile() {
    this.batch_.clear();
    const sourceTiles = this.tile.getSourceTiles();
    const features = sourceTiles.reduce(
      (accumulator, sourceTile) => accumulator.concat(sourceTile.getFeatures()),
      []
    );
    this.batch_.addFeatures(features);

    const tileOriginX = sourceTiles[0].extent[0];
    const tileOriginY = sourceTiles[0].extent[1];
    const transform = translateTransform(
      createTransform(),
      -tileOriginX,
      -tileOriginY
    );

    const generatePromises = this.styleRenderers_.map((renderer, i) =>
      renderer.generateBuffers(this.batch_, transform).then((buffers) => {
        this.buffers[i] = buffers;
      })
    );
    Promise.all(generatePromises).then(() => {
      this.setReady();
    });
  }
}

export default TileGeometry;
