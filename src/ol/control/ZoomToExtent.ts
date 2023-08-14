/**
 * @module ol/control/ZoomToExtent
 */
import Control from './Control';
import EventType from '../events/EventType';
import {CLASS_CONTROL, CLASS_UNSELECTABLE} from '../css';
import {fromExtent as polygonFromExtent} from '../geom/Polygon';
import {Extent} from "../extent/Extent";

export interface ZoomToExtentOptions {
  className?: string;
  target?: HTMLElement | string;
  label?: string | HTMLElement;
  tipLabel?: string;
  extent?: import("../extent").Extent;
}

/**
 * @classdesc
 * A button control which, when pressed, changes the map view to a specific
 * extent. To style this control use the css selector `.ol-zoom-extent`.
 *
 * @api
 */
class ZoomToExtent extends Control {
  /**
   * @param {Options} [options] Options.
   */

  protected extent?: Extent;

  constructor(options: ZoomToExtentOptions) {
    options = options ? options : {};

    super({
      element: document.createElement('div'),
      target: options.target,
    });

    /**
     * @type {?import("../extent").Extent|null}
     * @protected
     */
    this.extent = options.extent ? options.extent : null;

    const className =
      options.className !== undefined ? options.className : 'ol-zoom-extent';

    const label = options.label !== undefined ? options.label : 'E';
    const tipLabel =
      options.tipLabel !== undefined ? options.tipLabel : 'Fit to extent';
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.title = tipLabel;
    button.appendChild(
      typeof label === 'string' ? document.createTextNode(label) : label
    );

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
  }

  /**
   * @param {MouseEvent} event The event to handle
   * @private
   */
  private handleClick_(event: MouseEvent): void {
    event.preventDefault();
    this.handleZoomToExtent();
  }

  /**
   * @protected
   */
  protected handleZoomToExtent(): void {
    const map = this.getMap();
    const view = map.getView();
    const extent = !this.extent
      ? view.getProjection().getExtent()
      : this.extent;
    view.fitInternal(polygonFromExtent(extent));
  }
}

export default ZoomToExtent;
