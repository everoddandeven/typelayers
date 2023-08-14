/**
 * @module ol/control/Zoom
 */
import Control from './Control';
import EventType from '../events/EventType';
import {CLASS_CONTROL, CLASS_UNSELECTABLE} from '../css';
import {easeOut} from '../easing';

export interface ZoomOptions {
  duration?: number;
  className?: string;
  zoomInClassName?: string;
  zoomOutClassName?: string;
  zoomInLabel?: string | HTMLElement;
  zoomOutLabel?: string | HTMLElement;
  zoomInTipLabel?: string;
  zoomOutTipLabel?: string;
  delta?: number;
  target?: HTMLElement | string;
}

/**
 * @classdesc
 * A control with 2 buttons, one for zoom in and one for zoom out.
 * This control is one of the default controls of a map. To style this control
 * use css selectors `.ol-zoom-in` and `.ol-zoom-out`.
 *
 * @api
 */
class Zoom extends Control {
  /**
   * @param {Options} [options] Zoom options.
   */

  private duration_: number;

  constructor(options: ZoomOptions) {
    options = options ? options : {};

    super({
      element: document.createElement('div'),
      target: options.target,
    });

    const className =
      options.className !== undefined ? options.className : 'ol-zoom';

    const delta = options.delta !== undefined ? options.delta : 1;

    const zoomInClassName =
      options.zoomInClassName !== undefined
        ? options.zoomInClassName
        : className + '-in';

    const zoomOutClassName =
      options.zoomOutClassName !== undefined
        ? options.zoomOutClassName
        : className + '-out';

    const zoomInLabel =
      options.zoomInLabel !== undefined ? options.zoomInLabel : '+';
    const zoomOutLabel =
      options.zoomOutLabel !== undefined ? options.zoomOutLabel : '\u2013';

    const zoomInTipLabel =
      options.zoomInTipLabel !== undefined ? options.zoomInTipLabel : 'Zoom in';
    const zoomOutTipLabel =
      options.zoomOutTipLabel !== undefined
        ? options.zoomOutTipLabel
        : 'Zoom out';

    const inElement = document.createElement('button');
    inElement.className = zoomInClassName;
    inElement.setAttribute('type', 'button');
    inElement.title = zoomInTipLabel;
    inElement.appendChild(
      typeof zoomInLabel === 'string'
        ? document.createTextNode(zoomInLabel)
        : zoomInLabel
    );

    inElement.addEventListener(
      EventType.CLICK,
      this.handleClick_.bind(this, delta),
      false
    );

    const outElement = document.createElement('button');
    outElement.className = zoomOutClassName;
    outElement.setAttribute('type', 'button');
    outElement.title = zoomOutTipLabel;
    outElement.appendChild(
      typeof zoomOutLabel === 'string'
        ? document.createTextNode(zoomOutLabel)
        : zoomOutLabel
    );

    outElement.addEventListener(
      EventType.CLICK,
      this.handleClick_.bind(this, -delta),
      false
    );

    const cssClasses =
      className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;
    const element = this.element;
    element.className = cssClasses;
    element.appendChild(inElement);
    element.appendChild(outElement);

    /**
     * @type {number}
     * @private
     */
    this.duration_ = options.duration !== undefined ? options.duration : 250;
  }

  /**
   * @param {number} delta Zoom delta.
   * @param {MouseEvent} event The event to handle
   * @private
   */
  private handleClick_(delta: number, event: MouseEvent): void {
    event.preventDefault();
    this.zoomByDelta_(delta);
  }

  /**
   * @param {number} delta Zoom delta.
   * @private
   */
  private zoomByDelta_(delta: number): void {
    const map = this.getMap();
    const view = map.getView();
    if (!view) {
      // the map does not have a view, so we can't act
      // upon it
      return;
    }
    const currentZoom = view.getZoom();
    if (currentZoom !== undefined) {
      const newZoom = view.getConstrainedZoom(currentZoom + delta);
      if (this.duration_ > 0) {
        if (view.getAnimating()) {
          view.cancelAnimations();
        }
        view.animate({
          zoom: newZoom,
          duration: this.duration_,
          easing: easeOut,
        });
      } else {
        view.setZoom(newZoom);
      }
    }
  }
}

export default Zoom;
