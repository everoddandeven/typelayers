/**
 * @module tl/interaction/Pointer
 */
import Interaction, {InteractionOptions} from './Interaction';
import MapBrowserEventType from '../MapBrowserEventType';
import {MapBrowserEvent} from "../index";

export interface PointerInteractionOptions {
  handleDownEvent?: (event: MapBrowserEvent) => boolean;
  handleDragEvent?: (event: MapBrowserEvent) => void;
  handleEvent?: (event: MapBrowserEvent) => boolean;
  handleMoveEvent?: (event: MapBrowserEvent) => void;
  handleUpEvent?: (event: MapBrowserEvent) => boolean;
  stopDown?: (shouldPropagate: boolean) => boolean;
}
/**
 * @classdesc
 * Base class that calls user-defined functions on `down`, `move` and `up`
 * events. This class also manages "drag sequences".
 *
 * When the `handleDownEvent` user function returns `true` a drag sequence is
 * started. During a drag sequence the `handleDragEvent` user function is
 * called on `move` events. The drag sequence ends when the `handleUpEvent`
 * user function is called and returns `false`.
 * @api
 */
abstract class PointerInteraction extends Interaction {
  protected handlingDownUpSequence: boolean;
  protected targetPointers: PointerEvent[];
  /**
   * @param {Options} [options] Options.
   */
  protected constructor(options?: PointerInteractionOptions) {
    options = options ? options : {};

    super(
      /** @type {import("./Interaction").InteractionOptions} */ (<InteractionOptions>options)
    );

    if (options.handleDownEvent) {
      this.handleDownEvent = options.handleDownEvent;
    }

    if (options.handleDragEvent) {
      this.handleDragEvent = options.handleDragEvent;
    }

    if (options.handleMoveEvent) {
      this.handleMoveEvent = options.handleMoveEvent;
    }

    if (options.handleUpEvent) {
      this.handleUpEvent = options.handleUpEvent;
    }

    if (options.stopDown) {
      this.stopDown = options.stopDown;
    }

    /**
     * @type {boolean}
     * @protected
     */
    this.handlingDownUpSequence = false;

    /**
     * @type {Array<PointerEvent>}
     * @protected
     */
    this.targetPointers = [];
  }

  /**
   * Returns the current number of pointers involved in the interaction,
   * e.g. `2` when two fingers are used.
   * @return {number} The number of pointers.
   * @api
   */
  public getPointerCount(): number {
    return this.targetPointers.length;
  }

  /**
   * Handle pointer down events.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Event.
   * @return {boolean} If the event was consumed.
   * @protected
   */
  protected handleDownEvent(mapBrowserEvent: MapBrowserEvent): boolean {
    return false;
  }

  /**
   * Handle pointer drag events.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Event.
   * @protected
   */
  protected abstract handleDragEvent(mapBrowserEvent: MapBrowserEvent): void;

  /**
   * Handles the {@link module:tl/MapBrowserEvent~MapBrowserEvent map browser event} and may call into
   * other functions, if event sequences like e.g. 'drag' or 'down-up' etc. are
   * detected.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Map browser event.
   * @return {boolean} `false` to stop event propagation.
   * @api
   */
  public handleEvent(mapBrowserEvent: MapBrowserEvent): boolean {
    if (!mapBrowserEvent.originalEvent) {
      return true;
    }

    let stopEvent = false;
    this.updateTrackedPointers_(mapBrowserEvent);
    if (this.handlingDownUpSequence) {
      if (mapBrowserEvent.type == MapBrowserEventType.POINTERDRAG) {
        this.handleDragEvent(mapBrowserEvent);
        // prevent page scrolling during dragging
        mapBrowserEvent.originalEvent.preventDefault();
      } else if (mapBrowserEvent.type == MapBrowserEventType.POINTERUP) {
        const handledUp = this.handleUpEvent(mapBrowserEvent);
        this.handlingDownUpSequence =
          handledUp && this.targetPointers.length > 0;
      }
    } else {
      if (mapBrowserEvent.type == MapBrowserEventType.POINTERDOWN) {
        const handled = this.handleDownEvent(mapBrowserEvent);
        this.handlingDownUpSequence = handled;
        stopEvent = this.stopDown(handled);
      } else if (mapBrowserEvent.type == MapBrowserEventType.POINTERMOVE) {
        this.handleMoveEvent(mapBrowserEvent);
      }
    }
    return !stopEvent;
  }

  /**
   * Handle pointer move events.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Event.
   * @protected
   */
  protected abstract handleMoveEvent(mapBrowserEvent: MapBrowserEvent): void;

  /**
   * Handle pointer up events.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Event.
   * @return {boolean} If the event was consumed.
   * @protected
   */
  protected handleUpEvent(mapBrowserEvent: MapBrowserEvent): boolean {
    return false;
  }

  /**
   * This function is used to determine if "down" events should be propagated
   * to other interactions or should be stopped.
   * @param {boolean} handled Was the event handled by the interaction?
   * @return {boolean} Should the `down` event be stopped?
   */
  public stopDown(handled: boolean): boolean {
    return handled;
  }

  /**
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Event.
   * @private
   */
  private updateTrackedPointers_(mapBrowserEvent: MapBrowserEvent): void {
    if (mapBrowserEvent.activePointers) {
      this.targetPointers = mapBrowserEvent.activePointers;
    }
  }
}

/**
 * @param {Array<PointerEvent>} pointerEvents List of events.
 * @return {{clientX: number, clientY: number}} Centroid pixel.
 */
export function centroid(pointerEvents: PointerEvent[]): {clientX: number, clientY: number} {
  const length = pointerEvents.length;
  let clientX = 0;
  let clientY = 0;
  for (let i = 0; i < length; i++) {
    clientX += pointerEvents[i].clientX;
    clientY += pointerEvents[i].clientY;
  }
  return {clientX: clientX / length, clientY: clientY / length};
}

export default PointerInteraction;
