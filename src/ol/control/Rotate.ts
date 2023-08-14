/**
 * @module ol/control/Rotate
 */
import Control from './Control';
import EventType from '../events/EventType';
import {CLASS_CONTROL, CLASS_HIDDEN, CLASS_UNSELECTABLE} from '../css';
import {easeOut} from '../easing';
import MapEvent from "../MapEvent";
import {FrameState} from "../Map";

interface RotateOptions {
  className?: string;
  label?: string | HTMLElement;
  tipLabel?: string;
  compassClassName?: string;
  duration?: number;
  autoHide?: boolean;
  render?: (mapEvent: MapEvent) => void;
  resetNorth?: () => void;
  target?: HTMLElement | string;
}

/**
 * @classdesc
 * A button control to reset rotation to 0.
 * To style this control use css selector `.ol-rotate`. A `.ol-hidden` css
 * selector is added to the button when the rotation is 0.
 *
 * @api
 */
class Rotate extends Control {
  /**
   * @param {Options} [options] Rotate options.
   */

  private label_?: HTMLElement;
  private callResetNorth_?: () => void;
  private duration_: number;
  private autoHide_: boolean;
  private rotation_?: number;

  constructor(options?: RotateOptions) {
    options = options ? options : {};

    super({
      element: document.createElement('div'),
      render: options.render,
      target: options.target,
    });

    const className =
      options.className !== undefined ? options.className : 'ol-rotate';

    const label = options.label !== undefined ? options.label : '\u21E7';

    const compassClassName =
      options.compassClassName !== undefined
        ? options.compassClassName
        : 'ol-compass';

    /**
     * @type {HTMLElement}
     * @private
     */
    this.label_ = null;

    if (typeof label === 'string') {
      this.label_ = document.createElement('span');
      this.label_.className = compassClassName;
      this.label_.textContent = label;
    } else {
      this.label_ = label;
      this.label_.classList.add(compassClassName);
    }

    const tipLabel = options.tipLabel ? options.tipLabel : 'Reset rotation';

    const button = document.createElement('button');
    button.className = className + '-reset';
    button.setAttribute('type', 'button');
    button.title = tipLabel;
    button.appendChild(this.label_);

    button.addEventListener(
      EventType.CLICK,
      this.handleClick_.bind(this),
      false
    );

    const cssClasses =
      className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;
    const element = this.element;
    element.className = cssClasses;
    element.appendChild(button);

    this.callResetNorth_ = options.resetNorth ? options.resetNorth : undefined;

    /**
     * @type {number}
     * @private
     */
    this.duration_ = options.duration !== undefined ? options.duration : 250;

    /**
     * @type {boolean}
     * @private
     */
    this.autoHide_ = options.autoHide !== undefined ? options.autoHide : true;

    /**
     * @private
     * @type {number|undefined}
     */
    this.rotation_ = undefined;

    if (this.autoHide_) {
      this.element.classList.add(CLASS_HIDDEN);
    }
  }

  /**
   * @param {MouseEvent} event The event to handle
   * @private
   */
  private handleClick_(event: MouseEvent): void {
    event.preventDefault();
    if (this.callResetNorth_ !== undefined) {
      this.callResetNorth_();
    } else {
      this.resetNorth_();
    }
  }

  /**
   * @private
   */
  private resetNorth_(): void {
    const map = this.getMap();
    const view = map.getView();
    if (!view) {
      // the map does not have a view, so we can't act
      // upon it
      return;
    }
    const rotation = view.getRotation();
    if (rotation !== undefined) {
      if (this.duration_ > 0 && rotation % (2 * Math.PI) !== 0) {
        view.animate({
          rotation: 0,
          duration: this.duration_,
          easing: easeOut,
        });
      } else {
        view.setRotation(0);
      }
    }
  }

  /**
   * Update the rotate control element.
   * @param {import("../MapEvent").default} mapEvent Map event.
   * @override
   */
  public render(mapEvent: MapEvent): void {
    const frameState: FrameState = mapEvent.frameState;
    if (!frameState) {
      return;
    }
    const rotation = frameState.viewState.rotation;
    if (rotation != this.rotation_) {
      const transform = 'rotate(' + rotation + 'rad)';
      if (this.autoHide_) {
        const contains = this.element.classList.contains(CLASS_HIDDEN);
        if (!contains && rotation === 0) {
          this.element.classList.add(CLASS_HIDDEN);
        } else if (contains && rotation !== 0) {
          this.element.classList.remove(CLASS_HIDDEN);
        }
      }
      this.label_.style.transform = transform;
    }
    this.rotation_ = rotation;
  }
}

export default Rotate;
