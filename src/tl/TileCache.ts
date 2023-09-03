/**
 * @module tl/TileCache
 */
import LRUCache from './structs/LRUCache';
import {fromKey, getKey} from './tilecoord';
import Tile from "./layer/Tile";

class TileCache extends LRUCache<Tile> {
  clear() {
    while (this.getCount() > 0) {
      this.pop().release();
    }
    super.clear();
  }

  /**
   * @param {!Object<string, boolean>} usedTiles Used tiles.
   */
  expireCache(usedTiles: {[key: string]: boolean}): void {
    while (this.canExpireCache()) {
      const tile = this.peekLast();
      if (tile.getKey() in usedTiles) {
        break;
      } else {
        this.pop().release();
      }
    }
  }

  /**
   * Prune all tiles from the cache that don't have the same z as the newest tile.
   */
  pruneExceptNewestZ() {
    if (this.getCount() === 0) {
      return;
    }
    const key = this.peekFirstKey();
    const tileCoord = fromKey(key);
    const z = tileCoord[0];
    this.forEach((tile) => {
      if (tile.tileCoord[0] !== z) {
        this.remove(getKey(tile.tileCoord));
        tile.release();
      }
    });
  }
}

export default TileCache;
