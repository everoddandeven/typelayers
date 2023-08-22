/**
 * @module tl/MapBrowserEvent
 */
import MapEvent from './MapEvent';
import Map, {FrameState} from './Map';
import {Pixel} from "./pixel";
import {Coordinate} from "./coordinate";

/**
 * @classdesc
 * Events emitted as map browser events are instances of this type.
 * See {@link module:tl/Map~Map} for which events trigger a map browser event.
 * @template {UIEvent} EVENT
 */
class MapBrowserEvent extends MapEvent {
  /**
   * @param {string} type Event type.
   * @param {import("./Map").default} map Map.
   * @param {UIEvent} originalEvent Original event.
   * @param {boolean} [dragging] Is the map currently being dragged?
   * @param {import("./Map").FrameState} [frameState] Frame state.
   * @param {Array<PointerEvent>} [activePointers] Active pointers.
   */

  private pixel_?: Pixel;
  private coordinate_: Coordinate;

  public dragging: boolean;
  public originalEvent: UIEvent;
  public activePointers?: PointerEvent[];

  constructor(
      type: string,
      map: Map,
      originalEvent: UIEvent,
      dragging?: boolean,
      frameState?: FrameState,
      activePointers?: PointerEvent[]
  ) {
    super(type, map, frameState);

    /**
     * The original browser event.
     * @const
     * @type {EVENT}
     * @api
     */
    this.originalEvent = originalEvent;

    /**
     * The map pixel relative to the viewport corresponding to the original browser event.
     * @type {?import("./pixel").Pixel}
     */
    this.pixel_ = null;

    /**
     * The coordinate in the user projection corresponding to the original browser event.
     * @type {?import("./coordinate").Coordinate}
     */
    this.coordinate_ = null;

    /**
     * Indicates if the map is currently being dragged. Only set for
     * `POINTERDRAG` and `POINTERMOVE` events. Default is `false`.
     *
     * @type {boolean}
     * @api
     */
    this.dragging = dragging !== undefined ? dragging : false;

    /**
     * @type {Array<PointerEvent>|undefined}
     */
    this.activePointers = activePointers;
  }

  /**
   * The map pixel relative to the viewport corresponding to the original event.
   * @type {import("./pixel").Pixel}
   * @api
   */
  get pixel() {
    if (!this.pixel_) {
      this.pixel_ = this.map.getEventPixel(this.originalEvent);
    }
    return this.pixel_;
  }
  set pixel(pixel) {
    this.pixel_ = pixel;
  }

  /**
   * The coordinate corresponding to the original browser event.  This will be in the user
   * projection if one is set.  Otherwise it will be in the view projection.
   * @type {import("./coordinate").Coordinate}
   * @api
   */
  public get coordinate(): Coordinate {
    if (!this.coordinate_) {
      this.coordinate_ = this.map.getCoordinateFromPixel(this.pixel);
    }
    return this.coordinate_;
  }
  public set coordinate(coordinate: Coordinate) {
    this.coordinate_ = coordinate;
  }

  /**
   * Prevents the default browser action.
   * See https://developer.mozilla.org/en-US/docs/Web/API/event.preventDefault.
   * @api
   */
  public preventDefault(): void {
    super.preventDefault();
    if ('preventDefault' in this.originalEvent) {
      /** @type {UIEvent} */ (this.originalEvent).preventDefault();
    }
  }

  /**
   * Prevents further propagation of the current event.
   * See https://developer.mozilla.org/en-US/docs/Web/API/event.stopPropagation.
   * @api
   */
  public stopPropagation(): void {
    super.stopPropagation();
    if ('stopPropagation' in this.originalEvent) {
      /** @type {UIEvent} */ (this.originalEvent).stopPropagation();
    }
  }
}

export default MapBrowserEvent;
