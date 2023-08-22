/**
 * @module tl/interaction/defaults
 */
import Collection from '../Collection';
import DoubleClickZoom from './DoubleClickZoom';
import DragPan from './DragPan';
import DragRotate from './DragRotate';
import DragZoom from './DragZoom';
import KeyboardPan from './KeyboardPan';
import KeyboardZoom from './KeyboardZoom';
import Kinetic from '../Kinetic';
import MouseWheelZoom from './MouseWheelZoom';
import PinchRotate from './PinchRotate';
import PinchZoom from './PinchZoom';
import Interaction from "./Interaction";

export interface DefaultsOptions {
  altShiftDragRotate?: boolean;
  onFocusOnly?: boolean;
  doubleClickZoom?: boolean;
  keyboard?: boolean;
  mouseWheelZoom?: boolean;
  shiftDragZoom?: boolean;
  dragPan?: boolean;
  pinchRotate?: boolean;
  pinchZoom?: boolean;
  zoomDelta?: number;
  zoomDuration?: number;
}

/**
 * Set of interactions included in maps by default. Specific interactions can be
 * excluded by setting the appropriate option to false in the constructor
 * options, but the order of the interactions is fixed.  If you want to specify
 * a different order for interactions, you will need to create your own
 * {@link module:tl/interaction/Interaction~Interaction} instances and insert
 * them into a {@link module:tl/Collection~Collection} in the order you want
 * before creating your {@link module:tl/Map~Map} instance. Changing the order can
 * be of interest if the event propagation needs to be stopped at a point.
 * The default set of interactions, in sequence, is:
 * * {@link module:tl/interaction/DragRotate~DragRotate}
 * * {@link module:tl/interaction/DoubleClickZoom~DoubleClickZoom}
 * * {@link module:tl/interaction/DragPan~DragPan}
 * * {@link module:tl/interaction/PinchRotate~PinchRotate}
 * * {@link module:tl/interaction/PinchZoom~PinchZoom}
 * * {@link module:tl/interaction/KeyboardPan~KeyboardPan}
 * * {@link module:tl/interaction/KeyboardZoom~KeyboardZoom}
 * * {@link module:tl/interaction/MouseWheelZoom~MouseWheelZoom}
 * * {@link module:tl/interaction/DragZoom~DragZoom}
 *
 * @param {DefaultsOptions} [options] Defaults options.
 * @return {Collection<import("./Interaction").default>}
 * A collection of interactions to be used with the {@link module:tl/Map~Map}
 * constructor's `interactions` option.
 * @api
 */
export function defaults(options: DefaultsOptions): Collection<Interaction> {
  options = options ? options : {};

  /** @type {Collection<import("./Interaction").default>} */
  const interactions: Collection<Interaction> = new Collection<Interaction>();

  const kinetic = new Kinetic(-0.005, 0.05, 100);

  const altShiftDragRotate =
    options.altShiftDragRotate !== undefined
      ? options.altShiftDragRotate
      : true;
  if (altShiftDragRotate) {
    interactions.push(new DragRotate());
  }

  const doubleClickZoom =
    options.doubleClickZoom !== undefined ? options.doubleClickZoom : true;
  if (doubleClickZoom) {
    interactions.push(
      new DoubleClickZoom({
        delta: options.zoomDelta,
        duration: options.zoomDuration,
      })
    );
  }

  const dragPan = options.dragPan !== undefined ? options.dragPan : true;
  if (dragPan) {
    interactions.push(
      new DragPan({
        onFocusOnly: options.onFocusOnly,
        kinetic: kinetic,
      })
    );
  }

  const pinchRotate =
    options.pinchRotate !== undefined ? options.pinchRotate : true;
  if (pinchRotate) {
    interactions.push(new PinchRotate());
  }

  const pinchZoom = options.pinchZoom !== undefined ? options.pinchZoom : true;
  if (pinchZoom) {
    interactions.push(
      new PinchZoom({
        duration: options.zoomDuration,
      })
    );
  }

  const keyboard = options.keyboard !== undefined ? options.keyboard : true;
  if (keyboard) {
    interactions.push(new KeyboardPan());
    interactions.push(
      new KeyboardZoom({
        delta: options.zoomDelta,
        duration: options.zoomDuration,
      })
    );
  }

  const mouseWheelZoom =
    options.mouseWheelZoom !== undefined ? options.mouseWheelZoom : true;
  if (mouseWheelZoom) {
    interactions.push(
      new MouseWheelZoom({
        onFocusOnly: options.onFocusOnly,
        duration: options.zoomDuration,
      })
    );
  }

  const shiftDragZoom =
    options.shiftDragZoom !== undefined ? options.shiftDragZoom : true;
  if (shiftDragZoom) {
    interactions.push(
      new DragZoom({
        duration: options.zoomDuration,
      })
    );
  }

  return interactions;
}
