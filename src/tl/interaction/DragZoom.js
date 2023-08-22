/**
 * @module tl/interaction/DragZoom
 */
import DragBox from './DragBox';
import {easeOut} from '../easing';
import {shiftKeyOnly} from '../events/condition';

/**
 * @typedef {Object} Options
 * @property {string} [className='tl-dragzoom'] CSS class name for styling the
 * box.
 * @property {import("../events/condition").Condition} [condition] A function that
 * takes an {@link module:tl/MapBrowserEvent~MapBrowserEvent} and returns a
 * boolean to indicate whether that event should be handled.
 * Default is {@link module:tl/events/condition.shiftKeyOnly}.
 * @property {number} [duration=200] Animation duration in milliseconds.
 * @property {boolean} [out=false] Use interaction for zooming out.
 * @property {number} [minArea=64] The minimum area of the box in pixel, this value is used by the parent default
 * `boxEndCondition` function.
 */

/**
 * @classdesc
 * Allows the user to zoom the map by clicking and dragging on the map,
 * normally combined with an {@link module:tl/events/condition} that limits
 * it to when a key, shift by default, is held down.
 *
 * To change the style of the box, use CSS and the `.tl-dragzoom` selector, or
 * your custom one configured with `className`.
 * @api
 */
class DragZoom extends DragBox {
  /**
   * @param {Options} [options] Options.
   */
  constructor(options) {
    options = options ? options : {};

    const condition = options.condition ? options.condition : shiftKeyOnly;

    super({
      condition: condition,
      className: options.className || 'tl-dragzoom',
      minArea: options.minArea,
    });

    /**
     * @private
     * @type {number}
     */
    this.duration_ = options.duration !== undefined ? options.duration : 200;

    /**
     * @private
     * @type {boolean}
     */
    this.out_ = options.out !== undefined ? options.out : false;
  }

  /**
   * Function to execute just before `onboxend` is fired
   * @param {import("../MapBrowserEvent").default} event Event.
   */
  onBoxEnd(event) {
    const map = this.getMap();
    const view = /** @type {!import("../View").default} */ (map.getView());
    let geometry = this.getGeometry();

    if (this.out_) {
      const rotatedExtent = view.rotatedExtentForGeometry(geometry);
      const resolution = view.getResolutionForExtentInternal(rotatedExtent);
      const factor = view.getResolution() / resolution;
      geometry = geometry.clone();
      geometry.scale(factor * factor);
    }

    view.fitInternal(geometry, {
      duration: this.duration_,
      easing: easeOut,
    });
  }
}

export default DragZoom;
