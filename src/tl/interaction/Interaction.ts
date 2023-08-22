/**
 * @module tl/interaction/Interaction
 */
import BaseObject, {ObjectEvent} from '../Object';
import InteractionProperty from './Property';
import {easeOut, linear} from '../easing';
import BaseEvent from "../events/Event";
import ObjectEventType from "../ObjectEventType";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import MapBrowserEvent from "../MapBrowserEvent";
import {EventsKey} from "../events";
import Map from "../Map";
import View from "../View";
import {Coordinate} from "../coordinate";

export type InteractionOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<ObjectEventType | 'change:active', ObjectEvent, Return> &
    CombinedOnSignature<EventTypes | ObjectEventType | 'change:active', Return>;


export interface InteractionOptions {
  handleEvent: (event: MapBrowserEvent) => boolean;
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * User actions that change the state of the map. Some are similar to controls,
 * but are not associated with a DOM element.
 * For example, {@link module:tl/interaction/KeyboardZoom~KeyboardZoom} is
 * functionally the same as {@link module:tl/contrtl/Zoom~Zoom}, but triggered
 * by a keyboard event not a button element event.
 * Although interactions do not have a DOM element, some of them do render
 * vectors and so are visible on the screen.
 * @api
 */
class Interaction extends BaseObject {
  /**
   * @param {InteractionOptions} [options] Options.
   */

  public on: InteractionOnSignature<EventsKey>;
  public once: InteractionOnSignature<EventsKey>;
  public un: InteractionOnSignature<void>;
  private map_: Map | null;

  constructor(options?: InteractionOptions) {
    super();

    if (options && options.handleEvent) {
      this.handleEvent = options.handleEvent;
    }

    /**
     * @private
     * @type {import("../Map").default|null}
     */
    this.map_ = null;

    this.setActive(true);
  }

  /**
   * Return whether the interaction is currently active.
   * @return {boolean} `true` if the interaction is active, `false` otherwise.
   * @observable
   * @api
   */
  public getActive(): boolean {
    return /** @type {boolean} */ (this.get(InteractionProperty.ACTIVE));
  }

  /**
   * Get the map associated with this interaction.
   * @return {import("../Map").default|null} Map.
   * @api
   */
  public getMap(): Map {
    return this.map_;
  }

  /**
   * Handles the {@link module:tl/MapBrowserEvent~MapBrowserEvent map browser event}.
   * @param {import("../MapBrowserEvent").default} mapBrowserEvent Map browser event.
   * @return {boolean} `false` to stop event propagation.
   * @api
   */
  public handleEvent(mapBrowserEvent: MapBrowserEvent): boolean {
    return true;
  }

  /**
   * Activate or deactivate the interaction.
   * @param {boolean} active Active.
   * @observable
   * @api
   */
  public setActive(active: boolean): void {
    this.set(InteractionProperty.ACTIVE, active);
  }

  /**
   * Remove the interaction from its current map and attach it to the new map.
   * Subclasses may set up event handlers to get notified about changes to
   * the map here.
   * @param {import("../Map").default|null} map Map.
   */
  public setMap(map: Map): void {
    this.map_ = map;
  }
}

/**
 * @param {import("../View").default} view View.
 * @param {import("../coordinate").Coordinate} delta Delta.
 * @param {number} [duration] Duration.
 */
export function pan(view: View, delta: Coordinate, duration?: number): void {
  const currentCenter = view.getCenterInternal();
  if (currentCenter) {
    const center: Coordinate = [currentCenter[0] + delta[0], currentCenter[1] + delta[1]];
    view.animateInternal({
      duration: duration !== undefined ? duration : 250,
      easing: linear,
      center: view.getConstrainedCenter(center),
    });
  }
}

/**
 * @param {import("../View").default} view View.
 * @param {number} delta Delta from previous zoom level.
 * @param {import("../coordinate").Coordinate} [anchor] Anchor coordinate in the user projection.
 * @param {number} [duration] Duration.
 */
export function zoomByDelta(view: View, delta: Coordinate, anchor?: Coordinate, duration?: number): void {
  const currentZoom = view.getZoom();

  if (currentZoom === undefined) {
    return;
  }

  const newZoom = view.getConstrainedZoom(currentZoom + delta);
  const newResolution = view.getResolutionForZoom(newZoom);

  if (view.getAnimating()) {
    view.cancelAnimations();
  }
  view.animate({
    resolution: newResolution,
    anchor: anchor,
    duration: duration !== undefined ? duration : 250,
    easing: easeOut,
  });
}

export default Interaction;
