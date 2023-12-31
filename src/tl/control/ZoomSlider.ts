/**
 * @module tl/contrtl/ZoomSlider
 */

import Control from './Control';
import EventType from '../events/EventType';
import PointerEventType from '../pointer/EventType';
import {CLASS_CONTROL, CLASS_UNSELECTABLE} from '../css';
import {clamp} from '../math';
import {easeOut} from '../easing';
import {EventsKey, listen, unlistenByKey} from '../events';
import {stopPropagation} from '../events/Event';
import MapEvent from "../MapEvent";
import Map from "../Map";
import {Size} from "../size";

/**
 * The enum for available directions.
 *
 * @enum {number}
 */
export enum Direction {
  VERTICAL = 0,
  HORIZONTAL = 1,
}

interface ZoomSliderOptions {
  className?: string;
  duration?: number;
  render?: (mapEvent: MapEvent) => void;
  target?: HTMLElement | string;
}

/**
 * @classdesc
 * A slider type of control for zooming.
 *
 * Example:
 *
 *     map.addControl(new ZoomSlider());
 *
 * @api
 */
class ZoomSlider extends Control {
  /**
   * @param {Options} [options] Zoom slider options.
   */

  private dragListenerKeys_: EventsKey[];
  private currentResolution_?: number;
  private direction_: Direction;
  private dragging_?: boolean;
  private heightLimit_: number;
  private widthLimit_: number;
  private startX_?: number;
  private startY_?: number;
  private thumbSize_?: Size;
  private sliderInitialized_: boolean;
  private duration_: number;

  constructor(options?: ZoomSliderOptions) {
    options = options ? options : {};

    super({
      target: options.target,
      element: document.createElement('div'),
      render: options.render,
    });

    /**
     * @type {!Array<import("../events").EventsKey>}
     * @private
     */
    this.dragListenerKeys_ = [];

    /**
     * Will hold the current resolution of the view.
     *
     * @type {number|undefined}
     * @private
     */
    this.currentResolution_ = undefined;

    /**
     * The direction of the slider. Will be determined from actual display of the
     * container and defaults to Direction.VERTICAL.
     *
     * @type {Direction}
     * @private
     */
    this.direction_ = Direction.VERTICAL;

    /**
     * @type {boolean}
     * @private
     */
    this.dragging_ = false;

    /**
     * @type {number}
     * @private
     */
    this.heightLimit_ = 0;

    /**
     * @type {number}
     * @private
     */
    this.widthLimit_ = 0;

    /**
     * @type {number|undefined}
     * @private
     */
    this.startX_ = null;

    /**
     * @type {number|undefined}
     * @private
     */
    this.startY_ = null;

    /**
     * The calculated thumb size (border box plus margins).  Set when initSlider_
     * is called.
     * @type {import("../size").Size}
     * @private
     */
    this.thumbSize_ = null;

    /**
     * Whether the slider is initialized.
     * @type {boolean}
     * @private
     */
    this.sliderInitialized_ = false;

    /**
     * @type {number}
     * @private
     */
    this.duration_ = options.duration !== undefined ? options.duration : 200;

    const className =
      options.className !== undefined ? options.className : 'tl-zoomslider';
    const thumbElement = document.createElement('button');
    thumbElement.setAttribute('type', 'button');
    thumbElement.className = className + '-thumb ' + CLASS_UNSELECTABLE;
    const containerElement = this.element;
    containerElement.className =
      className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;
    containerElement.appendChild(thumbElement);

    containerElement.addEventListener(
      PointerEventType.POINTERDOWN,
      this.handleDraggerStart_.bind(this),
      false
    );
    containerElement.addEventListener(
      PointerEventType.POINTERMOVE,
      this.handleDraggerDrag_.bind(this),
      false
    );
    containerElement.addEventListener(
      PointerEventType.POINTERUP,
      this.handleDraggerEnd_.bind(this),
      false
    );

    containerElement.addEventListener(
      EventType.CLICK,
      this.handleContainerClick_.bind(this),
      false
    );
    thumbElement.addEventListener(EventType.CLICK, stopPropagation, false);
  }

  /**
   * Remove the control from its current map and attach it to the new map.
   * Pass `null` to just remove the control from the current map.
   * Subclasses may set up event handlers to get notified about changes to
   * the map here.
   * @param {import("../Map").default|null} map Map.
   * @api
   */
  public setMap(map: Map): void {
    super.setMap(map);
    if (map) {
      map.render();
    }
  }

  /**
   * Initializes the slider element. This will determine and set this controls
   * direction_ and also constrain the dragging of the thumb to always be within
   * the bounds of the container.
   *
   * @return {boolean} Initialization successful
   * @private
   */
  private initSlider_(): boolean {
    const container = this.element;
    let containerWidth = container.offsetWidth;
    let containerHeight = container.offsetHeight;
    if (containerWidth === 0 && containerHeight === 0) {
      return (this.sliderInitialized_ = false);
    }

    const containerStyle = getComputedStyle(container);
    containerWidth -=
      parseFloat(containerStyle['paddingRight']) +
      parseFloat(containerStyle['paddingLeft']);
    containerHeight -=
      parseFloat(containerStyle['paddingTop']) +
      parseFloat(containerStyle['paddingBottom']);
    const thumb = (<HTMLElement>container.firstElementChild);
    const thumbStyle = getComputedStyle(thumb);
    const thumbWidth =
      thumb.offsetWidth +
      parseFloat(thumbStyle['marginRight']) +
      parseFloat(thumbStyle['marginLeft']);
    const thumbHeight =
      thumb.offsetHeight +
      parseFloat(thumbStyle['marginTop']) +
      parseFloat(thumbStyle['marginBottom']);
    this.thumbSize_ = [thumbWidth, thumbHeight];

    if (containerWidth > containerHeight) {
      this.direction_ = Direction.HORIZONTAL;
      this.widthLimit_ = containerWidth - thumbWidth;
    } else {
      this.direction_ = Direction.VERTICAL;
      this.heightLimit_ = containerHeight - thumbHeight;
    }
    return (this.sliderInitialized_ = true);
  }

  /**
   * @param {PointerEvent} event The browser event to handle.
   * @private
   */
  private handleContainerClick_(event: PointerEvent): void {
    const view = this.getMap().getView();

    const relativePosition = this.getRelativePosition_(
      event.offsetX - this.thumbSize_[0] / 2,
      event.offsetY - this.thumbSize_[1] / 2
    );

    const resolution = this.getResolutionForPosition_(relativePosition);
    const zoom = view.getConstrainedZoom(view.getZoomForResolution(resolution));

    view.animateInternal({
      zoom: zoom,
      duration: this.duration_,
      easing: easeOut,
    });
  }

  /**
   * Handle dragger start events.
   * @param {PointerEvent} event The drag event.
   * @private
   */
  private handleDraggerStart_(event: PointerEvent): void {
    if (!this.dragging_ && event.target === this.element.firstElementChild) {
      const element = <HTMLElement>this.element.firstElementChild
      this.getMap().getView().beginInteraction();
      this.startX_ = event.clientX - parseFloat(element.style.left);
      this.startY_ = event.clientY - parseFloat(element.style.top);
      this.dragging_ = true;

      if (this.dragListenerKeys_.length === 0) {
        const drag = this.handleDraggerDrag_;
        const end = this.handleDraggerEnd_;
        const doc = this.getMap().getOwnerDocument();
        this.dragListenerKeys_.push(
          listen(doc, PointerEventType.POINTERMOVE, drag, this),
          listen(doc, PointerEventType.POINTERUP, end, this)
        );
      }
    }
  }

  /**
   * Handle dragger drag events.
   *
   * @param {PointerEvent} event The drag event.
   * @private
   */
  private handleDraggerDrag_(event: PointerEvent): void {
    if (this.dragging_) {
      const deltaX = event.clientX - this.startX_;
      const deltaY = event.clientY - this.startY_;
      const relativePosition = this.getRelativePosition_(deltaX, deltaY);
      this.currentResolution_ =
        this.getResolutionForPosition_(relativePosition);
      this.getMap().getView().setResolution(this.currentResolution_);
    }
  }

  /**
   * Handle dragger end events.
   * @param {PointerEvent} event The drag event.
   * @private
   */
  private handleDraggerEnd_(event: PointerEvent): void {
    if (this.dragging_) {
      const view = this.getMap().getView();
      view.endInteraction();

      this.dragging_ = false;
      this.startX_ = undefined;
      this.startY_ = undefined;
      this.dragListenerKeys_.forEach(unlistenByKey);
      this.dragListenerKeys_.length = 0;
    }
  }

  /**
   * Positions the thumb inside its container according to the given resolution.
   *
   * @param {number} res The res.
   * @private
   */
  private setThumbPosition_(res: number): void {
    const position = this.getPositionForResolution_(res);
    const thumb = <HTMLElement> this.element.firstElementChild;

    if (this.direction_ == Direction.HORIZONTAL) {
      thumb.style.left = this.widthLimit_ * position + 'px';
    } else {
      thumb.style.top = this.heightLimit_ * position + 'px';
    }
  }

  /**
   * Calculates the relative position of the thumb given x and y offsets.  The
   * relative position scales from 0 to 1.  The x and y offsets are assumed to be
   * in pixel units within the dragger limits.
   *
   * @param {number} x Pixel position relative to the left of the slider.
   * @param {number} y Pixel position relative to the top of the slider.
   * @return {number} The relative position of the thumb.
   * @private
   */
  private getRelativePosition_(x: number, y: number): number {
    let amount: number;
    if (this.direction_ === Direction.HORIZONTAL) {
      amount = x / this.widthLimit_;
    } else {
      amount = y / this.heightLimit_;
    }
    return clamp(amount, 0, 1);
  }

  /**
   * Calculates the corresponding resolution of the thumb given its relative
   * position (where 0 is the minimum and 1 is the maximum).
   *
   * @param {number} position The relative position of the thumb.
   * @return {number} The corresponding resolution.
   * @private
   */
  private getResolutionForPosition_(position: number): number {
    const fn = this.getMap().getView().getResolutionForValueFunction();
    return fn(1 - position);
  }

  /**
   * Determines the relative position of the slider for the given resolution.  A
   * relative position of 0 corresponds to the minimum view resolution.  A
   * relative position of 1 corresponds to the maximum view resolution.
   *
   * @param {number} res The resolution.
   * @return {number} The relative position value (between 0 and 1).
   * @private
   */
  private getPositionForResolution_(res: number): number {
    const fn = this.getMap().getView().getValueForResolutionFunction();
    return clamp(1 - fn(res), 0, 1);
  }

  /**
   * Update the zoomslider element.
   * @param {import("../MapEvent").default} mapEvent Map event.
   * @override
   */
  public render(mapEvent: MapEvent): void {
    if (!mapEvent.frameState) {
      return;
    }
    if (!this.sliderInitialized_ && !this.initSlider_()) {
      return;
    }
    const res = mapEvent.frameState.viewState.resolution;
    this.currentResolution_ = res;
    this.setThumbPosition_(res);
  }
}

export default ZoomSlider;
