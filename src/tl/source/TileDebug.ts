/**
 * @module tl/source/TileDebug
 */

import XYZ from './XYZ';
import {createCanvasContext2D} from '../dom';
import {toSize} from '../size';
import {ProjectionLike} from "../proj";
import TileGrid from "../tilegrid/TileGrid";
import {NearestDirectionFunction} from "../array";

interface TileDebugOptions {
  projection?: ProjectionLike;
  tileGrid?: TileGrid;
  wrapX?: boolean;
  zDirection?: number | NearestDirectionFunction;
  template?: string;
}

/**
 * @classdesc
 * A pseudo tile source, which does not fetch tiles from a server, but renders
 * a grid outline for the tile grid/projection along with the coordinates for
 * each tile. See examples/canvas-tiles for an example.
 * @api
 */
class TileDebug extends XYZ {
  /**
   * @param {Options} [options] Debug tile options.
   */
  constructor(options?: TileDebugOptions) {
    /**
     * @type {Options}
     */
    options = options || {};

    super({
      opaque: false,
      projection: options.projection,
      tileGrid: options.tileGrid,
      wrapX: options.wrapX !== undefined ? options.wrapX : true,
      zDirection: options.zDirection,
      url: options.template || 'z:{z} x:{x} y:{y}',

      tileLoadFunction: (tile, text: string): void => {
        const z = tile.getTileCoord()[0];
        const tileSize = toSize(this.tileGrid.getTileSize(z));
        const context = createCanvasContext2D(tileSize[0], tileSize[1]);

        context.strokeStyle = 'grey';
        context.strokeRect(0.5, 0.5, tileSize[0] + 0.5, tileSize[1] + 0.5);

        context.fillStyle = 'grey';
        context.strokeStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '24px sans-serif';
        context.lineWidth = 4;
        context.strokeText(text, tileSize[0] / 2, tileSize[1] / 2, tileSize[0]);
        context.fillText(text, tileSize[0] / 2, tileSize[1] / 2, tileSize[0]);

        /** @type {import("../ImageTile").default} */ (tile).setImage(
          context.canvas
        );
      },
    });
  }
}

export default TileDebug;
