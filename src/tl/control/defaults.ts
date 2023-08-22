/**
 * @module tl/contrtl/defaults
 */
import Attribution, {AttributionOptions} from './Attribution';
import Collection from '../Collection';
import Rotate from './Rotate';
import Zoom, {ZoomOptions} from './Zoom';
import Control from "./Control";

class RotateOptions {
}

export interface DefaultsOptions {
  attribution?: boolean;
  attributionOptions?: AttributionOptions;
  rotate?: boolean;
  rotateOptions?: RotateOptions;
  zoom?: boolean;
  zoomOptions?: ZoomOptions;
}

/**
 * Set of controls included in maps by default. Unless configured otherwise,
 * this returns a collection containing an instance of each of the following
 * controls:
 * * {@link module:tl/contrtl/Zoom~Zoom}
 * * {@link module:tl/contrtl/Rotate~Rotate}
 * * {@link module:tl/contrtl/Attribution~Attribution}
 *
 * @param {DefaultsOptions} [options] Options for the default controls.
 * @return {Collection<import("./Control").default>} A collection of controls
 * to be used with the {@link module:tl/Map~Map} constructor's `controls` option.
 * @api
 */
export function defaults(options?: DefaultsOptions): Collection<Control> {
  options = options ? options : {};

  /** @type {Collection<import("./Control").default>} */
  const controls: Collection<Control> = new Collection<Control>();

  const zoomControl = options.zoom !== undefined ? options.zoom : true;
  if (zoomControl) {
    controls.push(new Zoom(options.zoomOptions));
  }

  const rotateControl = options.rotate !== undefined ? options.rotate : true;
  if (rotateControl) {
    controls.push(new Rotate(options.rotateOptions));
  }

  const attributionControl =
    options.attribution !== undefined ? options.attribution : true;
  if (attributionControl) {
    controls.push(new Attribution(options.attributionOptions));
  }

  return controls;
}
