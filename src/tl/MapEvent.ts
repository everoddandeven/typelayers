/**
 * @module tl/MapEvent
 */
import Event from './events/Event';
import Map from './Map';
import {FrameState} from './Map';

/**
 * @classdesc
 * Events emitted as map events are instances of this type.
 * See {@link module:tl/Map~Map} for which events trigger a map event.
 */
class MapEvent extends Event {
  /**
   * @param {string} type Event type.
   * @param {import("./Map").default} map Map.
   * @param {?import("./Map").FrameState} [frameState] Frame state.
   */

  public map: Map;
  public frameState: FrameState;

  constructor(type: string, map: Map, frameState: FrameState) {
    super(type);

    /**
     * The map where the event occurred.
     * @type {import("./Map").default}
     * @api
     */
    this.map = map;

    /**
     * The frame state at the time of the event.
     * @type {?import("./Map").FrameState}
     * @api
     */
    this.frameState = frameState !== undefined ? frameState : null;
  }
}

export default MapEvent;
