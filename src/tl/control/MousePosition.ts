/**
 * @module tl/contrtl/MousePosition
 */

import Control from './Control';
import EventType from '../pointer/EventType';
import {
  get as getProjection,
  getTransformFromProjections,
  getUserProjection,
  identityTransform, TransformFunction,
} from '../proj';
import {listen} from '../events';
import {wrapX} from '../coordinate';
import BaseEvent from "../events/Event";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import ObjectEventType from "../ObjectEventType";
import {ObjectEvent} from "../Object";
import MapEvent from "../MapEvent";
import Projection from "../proj/Projection";
import {Pixel} from "../pixel";

/**
 * @type {string}
 */
const PROJECTION: string = 'projection';

/**
 * @type {string}
 */
const COORDINATE_FORMAT: string = 'coordinateFormat';

export type MousePositionOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<ObjectEventType | 'change:coordinateFormat' | 'change:projection', ObjectEvent, Return> &
    CombinedOnSignature<EventTypes | ObjectEventType | 'change:coordinateFormat' | 'change:projection', Return>;

interface MousePositionOptions {
  className?: string;
  coordinateFormat?: import("../coordinate").CoordinateFormat;
  projection?: import("../proj").ProjectionLike;
  render?: (event: MapEvent) => void;
  target?: HTMLElement | string;
  placeholder?: string;
  wrapX?: boolean;
}

/**
 * @classdesc
 * A control to show the 2D coordinates of the mouse cursor. By default, these
 * are in the view projection, but can be in any supported projection.
 * By default the control is shown in the top right corner of the map, but this
 * can be changed by using the css selector `.tl-mouse-position`.
 *
 * On touch devices, which usually do not have a mouse cursor, the coordinates
 * of the currently touched position are shown.
 *
 * @api
 */
class MousePosition extends Control {
  private renderOnMouseOut_: boolean;
  private placeholder_: string;
  private renderedHTML_: string;
  private mapProjection_: Projection;
  private transform_: TransformFunction;
  private wrapX_: boolean;

  /**
   * @param {Options} [options] Mouse position options.
   */
  constructor(options?: MousePositionOptions) {
    options = options ? options : {};

    const element = document.createElement('div');
    element.className =
      options.className !== undefined ? options.className : 'tl-mouse-position';

    super({
      element: element,
      render: options.render,
      target: options.target,
    });

    /***
     * @type {MousePositionOnSignature<import("../events").EventsKey>}
     */
    this.on;

    /***
     * @type {MousePositionOnSignature<import("../events").EventsKey>}
     */
    this.once;

    /***
     * @type {MousePositionOnSignature<void>}
     */
    this.un;

    this.addChangeListener(PROJECTION, this.handleProjectionChanged_);

    if (options.coordinateFormat) {
      this.setCoordinateFormat(options.coordinateFormat);
    }
    if (options.projection) {
      this.setProjection(options.projection);
    }

    /**
     * @private
     * @type {boolean}
     */
    this.renderOnMouseOut_ = options.placeholder !== undefined;

    /**
     * @private
     * @type {string}
     */
    this.placeholder_ = this.renderOnMouseOut_ ? options.placeholder : '&#160;';

    /**
     * @private
     * @type {string}
     */
    this.renderedHTML_ = element.innerHTML;

    /**
     * @private
     * @type {?import("../proj/Projection").default}
     */
    this.mapProjection_ = null;

    /**
     * @private
     * @type {?import("../proj").TransformFunction}
     */
    this.transform_ = null;

    /**
     * @private
     * @type {boolean}
     */
    this.wrapX_ = options.wrapX !== false;
  }

  /**
   * @private
   */
  handleProjectionChanged_() {
    this.transform_ = null;
  }

  /**
   * Return the coordinate format type used to render the current position or
   * undefined.
   * @return {import("../coordinate").CoordinateFormat|undefined} The format to render the current
   *     position in.
   * @observable
   * @api
   */
  getCoordinateFormat() {
    return /** @type {import("../coordinate").CoordinateFormat|undefined} */ (
      this.get(COORDINATE_FORMAT)
    );
  }

  /**
   * Return the projection that is used to report the mouse position.
   * @return {import("../proj/Projection").default|undefined} The projection to report mouse
   *     position in.
   * @observable
   * @api
   */
  getProjection() {
    return /** @type {import("../proj/Projection").default|undefined} */ (
      this.get(PROJECTION)
    );
  }

  /**
   * @param {MouseEvent} event Browser event.
   * @protected
   */
  handleMouseMove(event) {
    const map = this.getMap();
    this.updateHTML_(map.getEventPixel(event));
  }

  /**
   * @param {Event} event Browser event.
   * @protected
   */
  handleMouseOut(event) {
    this.updateHTML_(null);
  }

  /**
   * Remove the control from its current map and attach it to the new map.
   * Pass `null` to just remove the control from the current map.
   * Subclasses may set up event handlers to get notified about changes to
   * the map here.
   * @param {import("../Map").default|null} map Map.
   * @api
   */
  setMap(map) {
    super.setMap(map);
    if (map) {
      const viewport = map.getViewport();
      this.listenerKeys.push(
        listen(viewport, EventType.POINTERMOVE, this.handleMouseMove, this)
      );
      if (this.renderOnMouseOut_) {
        this.listenerKeys.push(
          listen(viewport, EventType.POINTEROUT, this.handleMouseOut, this)
        );
      }
      this.updateHTML_(null);
    }
  }

  /**
   * Set the coordinate format type used to render the current position.
   * @param {import("../coordinate").CoordinateFormat} format The format to render the current
   *     position in.
   * @observable
   * @api
   */
  setCoordinateFormat(format) {
    this.set(COORDINATE_FORMAT, format);
  }

  /**
   * Set the projection that is used to report the mouse position.
   * @param {import("../proj").ProjectionLike} projection The projection to report mouse
   *     position in.
   * @observable
   * @api
   */
  setProjection(projection) {
    this.set(PROJECTION, getProjection(projection));
  }

  /**
   * @param {?import("../pixel").Pixel} pixel Pixel.
   * @private
   */
  private updateHTML_(pixel: Pixel): void {
    let html = this.placeholder_;
    if (pixel && this.mapProjection_) {
      if (!this.transform_) {
        const projection = this.getProjection();
        if (projection) {
          this.transform_ = getTransformFromProjections(
            this.mapProjection_,
            projection
          );
        } else {
          this.transform_ = identityTransform;
        }
      }
      const map = this.getMap();
      const coordinate = map.getCoordinateFromPixelInternal(pixel);
      if (coordinate) {
        const userProjection = getUserProjection();
        if (userProjection) {
          this.transform_ = getTransformFromProjections(
            this.mapProjection_,
            userProjection
          );
        }
        this.transform_(coordinate, coordinate);
        if (this.wrapX_) {
          const projection =
            userProjection || this.getProjection() || this.mapProjection_;
          wrapX(coordinate, projection);
        }
        const coordinateFormat = this.getCoordinateFormat();
        if (coordinateFormat) {
          html = coordinateFormat(coordinate);
        } else {
          html = coordinate.toString();
        }
      }
    }
    if (!this.renderedHTML_ || html !== this.renderedHTML_) {
      this.element.innerHTML = html;
      this.renderedHTML_ = html;
    }
  }

  /**
   * Update the projection. Rendering of the coordinates is done in
   * `handleMouseMove` and `handleMouseUp`.
   * @param {import("../MapEvent").default} mapEvent Map event.
   * @override
   */
  render(mapEvent) {
    const frameState = mapEvent.frameState;
    if (!frameState) {
      this.mapProjection_ = null;
    } else {
      if (this.mapProjection_ != frameState.viewState.projection) {
        this.mapProjection_ = frameState.viewState.projection;
        this.transform_ = null;
      }
    }
  }
}

export default MousePosition;
