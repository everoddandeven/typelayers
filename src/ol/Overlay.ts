/**
 * @module ol/Overlay
 */
import BaseObject, {ObjectEvent} from './Object';
import MapEventType from './MapEventType';
import {CLASS_SELECTABLE} from './css';
import {containsExtent, Extent} from './extent';
import {EventsKey, listen, unlistenByKey} from './events';
import {outerHeight, outerWidth, removeChildren, removeNode} from './dom';
import {Coordinate} from "./coordinate";
import ObjectEventType from "./ObjectEventType";
import {CombinedOnSignature, EventTypes, OnSignature} from "./Observable";
import BaseEvent from "./events/Event";
import {Size} from "./size";
import {Pixel} from "./pixel";
import Map from "./Map";

export type Positioning =
    'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'center-left'
    | 'center-center'
    | 'center-right'
    | 'top-left'
    | 'top-center'
    | 'top-right';

export interface OverlayOptions {
  id?: number | string;
  element?: HTMLElement;
  offset?: number[];
  position?: Coordinate;
  positioning?: Positioning;
  stopEvent?: boolean;
  insertFirst?: boolean;
  autoPan?: PanIntoViewOptions | boolean;
  className?: string;
}

export interface PanOptions {
  duration?: number;
  easing?: (t: number) => number;
}

export interface PanIntoViewOptions {
  animation?: PanOptions;
  margin?: number;
}

/**
 * @enum {string}
 * @protected
 */
enum Property {
  ELEMENT = 'element',
  MAP = 'map',
  OFFSET = 'offset',
  POSITION = 'position',
  POSITIONING = 'positioning',
}

export type OverlayObjectEventTypes =
    ObjectEventType
    | 'change:element'
    | 'change:map'
    | 'change:offset'
    | 'change:position'
    |
    'change:positioning';

export type OverlayOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<EventTypes, ObjectEvent, Return> &
    CombinedOnSignature<EventTypes, Return>;

/**
 * @classdesc
 * An element to be displayed over the map and attached to a single map
 * location.  Like {@link module:ol/control/Control~Control}, Overlays are
 * visible widgets. Unlike Controls, they are not in a fixed position on the
 * screen, but are tied to a geographical coordinate, so panning the map will
 * move an Overlay but not a Control.
 *
 * Example:
 *
 *     import Overlay from 'ol/Overlay';
 *
 *     // ...
 *     const popup = new Overlay({
 *       element: document.getElementById('popup'),
 *     });
 *     popup.setPosition(coordinate);
 *     map.addOverlay(popup);
 *
 * @api
 */
class Overlay extends BaseObject {
  /**
   * @param {Options} options Overlay options.
   */

  protected options: OverlayOptions;
  protected id: number | string | undefined;
  protected insertFirst: boolean;
  protected stopEvent: boolean;
  protected element: HTMLElement;
  protected autoPan: PanIntoViewOptions;
  protected rendered: { transform_: string, visible: boolean };
  protected mapPostrenderListenerKey?: EventsKey;

  public on: OverlayOnSignature<EventsKey>;
  public once: OverlayOnSignature<EventsKey>;
  public un: OverlayOnSignature<void>;

  constructor(options: OverlayOptions) {
    super();

    /***
     * @type {OverlayOnSignature<import("./events").EventsKey>}
     */
    this.on;

    /***
     * @type {OverlayOnSignature<import("./events").EventsKey>}
     */
    this.once;

    /***
     * @type {OverlayOnSignature<void>}
     */
    this.un;

    /**
     * @protected
     * @type {Options}
     */
    this.options = options;

    /**
     * @protected
     * @type {number|string|undefined}
     */
    this.id = options.id;

    /**
     * @protected
     * @type {boolean}
     */
    this.insertFirst =
      options.insertFirst !== undefined ? options.insertFirst : true;

    /**
     * @protected
     * @type {boolean}
     */
    this.stopEvent = options.stopEvent !== undefined ? options.stopEvent : true;

    /**
     * @protected
     * @type {HTMLElement}
     */
    this.element = document.createElement('div');
    this.element.className =
      options.className !== undefined
        ? options.className
        : 'ol-overlay-container ' + CLASS_SELECTABLE;
    this.element.style.position = 'absolute';
    this.element.style.pointerEvents = 'auto';

    /**
     * @protected
     * @type {PanIntoViewOptions|undefined}
     */
    this.autoPan = options.autoPan === true ? {} : options.autoPan || undefined;

    /**
     * @protected
     * @type {{transform_: string,
     *         visible: boolean}}
     */
    this.rendered = {
      transform_: '',
      visible: true,
    };

    /**
     * @protected
     * @type {?import("./events").EventsKey}
     */
    this.mapPostrenderListenerKey = null;

    this.addChangeListener(Property.ELEMENT, this.handleElementChanged);
    this.addChangeListener(Property.MAP, this.handleMapChanged);
    this.addChangeListener(Property.OFFSET, this.handleOffsetChanged);
    this.addChangeListener(Property.POSITION, this.handlePositionChanged);
    this.addChangeListener(Property.POSITIONING, this.handlePositioningChanged);

    if (options.element !== undefined) {
      this.setElement(options.element);
    }

    this.setOffset(options.offset !== undefined ? options.offset : [0, 0]);

    this.setPositioning(options.positioning || 'top-left');

    if (options.position !== undefined) {
      this.setPosition(options.position);
    }
  }

  /**
   * Get the DOM element of this overlay.
   * @return {HTMLElement|undefined} The Element containing the overlay.
   * @observable
   * @api
   */
  public getElement(): HTMLElement {
    return /** @type {HTMLElement|undefined} */ (this.get(Property.ELEMENT));
  }

  /**
   * Get the overlay identifier which is set on constructor.
   * @return {number|string|undefined} Id.
   * @api
   */
  public getId(): string | number | undefined {
    return this.id;
  }

  /**
   * Get the map associated with this overlay.
   * @return {import("./Map").default|null} The map that the
   * overlay is part of.
   * @observable
   * @api
   */
  public getMap(): Map | null {
    return /** @type {import("./Map").default|null} */ (
      <Map>this.get(Property.MAP) || null
    );
  }

  /**
   * Get the offset of this overlay.
   * @return {Array<number>} The offset.
   * @observable
   * @api
   */
  public getOffset(): number[] {
    return /** @type {Array<number>} */ (this.get(Property.OFFSET));
  }

  /**
   * Get the current position of this overlay.
   * @return {import("./coordinate").Coordinate|undefined} The spatial point that the overlay is
   *     anchored at.
   * @observable
   * @api
   */
  public getPosition(): Coordinate | null {
    return /** @type {import("./coordinate").Coordinate|undefined} */ (
      this.get(Property.POSITION)
    );
  }

  /**
   * Get the current positioning of this overlay.
   * @return {Positioning} How the overlay is positioned
   *     relative to its point on the map.
   * @observable
   * @api
   */
  public getPositioning(): Positioning {
    return /** @type {Positioning} */ (this.get(Property.POSITIONING));
  }

  /**
   * @protected
   */
  protected handleElementChanged(): void {
    removeChildren(this.element);
    const element = this.getElement();
    if (element) {
      this.element.appendChild(element);
    }
  }

  /**
   * @protected
   */
  protected handleMapChanged(): void {
    if (this.mapPostrenderListenerKey) {
      removeNode(this.element);
      unlistenByKey(this.mapPostrenderListenerKey);
      this.mapPostrenderListenerKey = null;
    }
    const map = this.getMap();
    if (map) {
      this.mapPostrenderListenerKey = listen(
        map,
        MapEventType.POSTRENDER,
        this.render,
        this
      );
      this.updatePixelPosition();
      const container = this.stopEvent
        ? map.getOverlayContainerStopEvent()
        : map.getOverlayContainer();
      if (this.insertFirst) {
        container.insertBefore(this.element, container.childNodes[0] || null);
      } else {
        container.appendChild(this.element);
      }
      this.performAutoPan();
    }
  }

  /**
   * @protected
   */
  protected render(): void {
    this.updatePixelPosition();
  }

  /**
   * @protected
   */
  protected handleOffsetChanged(): void {
    this.updatePixelPosition();
  }

  /**
   * @protected
   */
  protected handlePositionChanged(): void {
    this.updatePixelPosition();
    this.performAutoPan();
  }

  /**
   * @protected
   */
  protected handlePositioningChanged(): void {
    this.updatePixelPosition();
  }

  /**
   * Set the DOM element to be associated with this overlay.
   * @param {HTMLElement|undefined} element The Element containing the overlay.
   * @observable
   * @api
   */
  setElement(element) {
    this.set(Property.ELEMENT, element);
  }

  /**
   * Set the map to be associated with this overlay.
   * @param {import("./Map").default|null} map The map that the
   * overlay is part of. Pass `null` to just remove the overlay from the current map.
   * @observable
   * @api
   */
  setMap(map) {
    this.set(Property.MAP, map);
  }

  /**
   * Set the offset for this overlay.
   * @param {Array<number>} offset Offset.
   * @observable
   * @api
   */
  setOffset(offset) {
    this.set(Property.OFFSET, offset);
  }

  /**
   * Set the position for this overlay. If the position is `undefined` the
   * overlay is hidden.
   * @param {import("./coordinate").Coordinate|undefined} position The spatial point that the overlay
   *     is anchored at.
   * @observable
   * @api
   */
  setPosition(position) {
    this.set(Property.POSITION, position);
  }

  /**
   * Pan the map so that the overlay is entirely visible in the current viewport
   * (if necessary) using the configured autoPan parameters
   * @protected
   */
  protected performAutoPan(): void {
    if (this.autoPan) {
      this.panIntoView(this.autoPan);
    }
  }

  /**
   * Pan the map so that the overlay is entirely visible in the current viewport
   * (if necessary).
   * @param {PanIntoViewOptions} [panIntoViewOptions] Options for the pan action
   * @api
   */
  panIntoView(panIntoViewOptions) {
    const map = this.getMap();

    if (!map || !map.getTargetElement() || !this.get(Property.POSITION)) {
      return;
    }

    const mapRect = this.getRect(map.getTargetElement(), map.getSize());
    const element = this.getElement();
    const overlayRect = this.getRect(element, [
      outerWidth(element),
      outerHeight(element),
    ]);

    panIntoViewOptions = panIntoViewOptions || {};

    const myMargin =
      panIntoViewOptions.margin === undefined ? 20 : panIntoViewOptions.margin;
    if (!containsExtent(mapRect, overlayRect)) {
      // the overlay is not completely inside the viewport, so pan the map
      const offsetLeft = overlayRect[0] - mapRect[0];
      const offsetRight = mapRect[2] - overlayRect[2];
      const offsetTop = overlayRect[1] - mapRect[1];
      const offsetBottom = mapRect[3] - overlayRect[3];

      const delta = [0, 0];
      if (offsetLeft < 0) {
        // move map to the left
        delta[0] = offsetLeft - myMargin;
      } else if (offsetRight < 0) {
        // move map to the right
        delta[0] = Math.abs(offsetRight) + myMargin;
      }
      if (offsetTop < 0) {
        // move map up
        delta[1] = offsetTop - myMargin;
      } else if (offsetBottom < 0) {
        // move map down
        delta[1] = Math.abs(offsetBottom) + myMargin;
      }

      if (delta[0] !== 0 || delta[1] !== 0) {
        const center = /** @type {import("./coordinate").Coordinate} */ (
          map.getView().getCenterInternal()
        );
        const centerPx = map.getPixelFromCoordinateInternal(center);
        if (!centerPx) {
          return;
        }
        const newCenterPx = [centerPx[0] + delta[0], centerPx[1] + delta[1]];

        const panOptions = panIntoViewOptions.animation || {};
        map.getView().animateInternal({
          center: map.getCoordinateFromPixelInternal(newCenterPx),
          duration: panOptions.duration,
          easing: panOptions.easing,
        });
      }
    }
  }

  /**
   * Get the extent of an element relative to the document
   * @param {HTMLElement} element The element.
   * @param {import("./size").Size} size The size of the element.
   * @return {import("./extent").Extent} The extent.
   * @protected
   */
  protected getRect(element: HTMLElement, size: Size): Extent {
    const box = element.getBoundingClientRect();
    const offsetX = box.left + window.pageXOffset;
    const offsetY = box.top + window.pageYOffset;
    return [offsetX, offsetY, offsetX + size[0], offsetY + size[1]];
  }

  /**
   * Set the positioning for this overlay.
   * @param {Positioning} positioning how the overlay is
   *     positioned relative to its point on the map.
   * @observable
   * @api
   */
  setPositioning(positioning) {
    this.set(Property.POSITIONING, positioning);
  }

  /**
   * Modify the visibility of the element.
   * @param {boolean} visible Element visibility.
   * @protected
   */
  protected setVisible(visible: boolean): void {
    if (this.rendered.visible !== visible) {
      this.element.style.display = visible ? '' : 'none';
      this.rendered.visible = visible;
    }
  }

  /**
   * Update pixel position.
   * @protected
   */
  protected updatePixelPosition(): void {
    const map = this.getMap();
    const position = this.getPosition();
    if (!map || !map.isRendered() || !position) {
      this.setVisible(false);
      return;
    }

    const pixel = map.getPixelFromCoordinate(position);
    const mapSize = map.getSize();
    this.updateRenderedPosition(pixel, mapSize);
  }

  /**
   * @param {import("./pixel").Pixel} pixel The pixel location.
   * @param {import("./size").Size|undefined} mapSize The map size.
   * @protected
   */
  protected updateRenderedPosition(pixel: Pixel, mapSize?: Size): void {
    const style = this.element.style;
    const offset = this.getOffset();

    const positioning = this.getPositioning();

    this.setVisible(true);

    const x = Math.round(pixel[0] + offset[0]) + 'px';
    const y = Math.round(pixel[1] + offset[1]) + 'px';
    let posX = '0%';
    let posY = '0%';
    if (
      positioning == 'bottom-right' ||
      positioning == 'center-right' ||
      positioning == 'top-right'
    ) {
      posX = '-100%';
    } else if (
      positioning == 'bottom-center' ||
      positioning == 'center-center' ||
      positioning == 'top-center'
    ) {
      posX = '-50%';
    }
    if (
      positioning == 'bottom-left' ||
      positioning == 'bottom-center' ||
      positioning == 'bottom-right'
    ) {
      posY = '-100%';
    } else if (
      positioning == 'center-left' ||
      positioning == 'center-center' ||
      positioning == 'center-right'
    ) {
      posY = '-50%';
    }
    const transform = `translate(${posX}, ${posY}) translate(${x}, ${y})`;
    if (this.rendered.transform_ != transform) {
      this.rendered.transform_ = transform;
      style.transform = transform;
    }
  }

  /**
   * returns the options this Overlay has been created with
   * @return {Options} overlay options
   */
  public getOptions(): OverlayOptions {
    return this.options;
  }
}

export default Overlay;
