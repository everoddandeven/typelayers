/**
 * @module ol/control/ScaleLine
 */
import Control from './Control';
import {CLASS_UNSELECTABLE} from '../css';
import {METERS_PER_UNIT, getPointResolution} from '../proj';
import {assert} from '../asserts';
import MapEvent from "../MapEvent";
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import BaseEvent from "../events/Event";
import {ObjectEvent} from "../Object";
import ObjectEventType from "../ObjectEventType";
import {EventsKey} from "../events";
import {ViewState} from "../View";

/**
 * @type {string}
 */
export const UNITS_PROP: string = 'units';
export type Units = 'degrees' | 'imperial' | 'nautical' | 'metric' | 'us';

/**
 * @const
 * @type {Array<number>}
 */
export const LEADING_DIGITS: number[] = [1, 2, 5];

/**
 * @const
 * @type {number}
 */
export const DEFAULT_DPI: number = 25.4 / 0.28;

interface ScaleLineOptions {
  className?: string;
  minWidth?: number;
  maxWidth?: number;
  render?: (event: MapEvent) => void;
  target?: HTMLElement | string;
  units?: Units;
  bar?: boolean;
  steps?: number;
  text?: boolean;
  dpi?: number | undefined;
}

export type ScaleLineOnSignature<Return> =
    OnSignature<EventTypes, BaseEvent, Return> &
    OnSignature<'change:units' | ObjectEventType, ObjectEvent, Return> &
    CombinedOnSignature<EventTypes | 'change:units', Return>

/**
 * @classdesc
 * A control displaying rough y-axis distances, calculated for the center of the
 * viewport. For conformal projections (e.g. EPSG:3857, the default view
 * projection in OpenLayers), the scale is valid for all directions.
 * No scale line will be shown when the y-axis distance of a pixel at the
 * viewport center cannot be calculated in the view projection.
 * By default the scale line will show in the bottom left portion of the map,
 * but this can be changed by using the css selector `.ol-scale-line`.
 * When specifying `bar` as `true`, a scalebar will be rendered instead
 * of a scaleline.
 *
 * @api
 */
class ScaleLine extends Control {
  /**
   * @param {Options} [options] Scale line options.
   */

  public on: ScaleLineOnSignature<EventsKey>;
  public once: ScaleLineOnSignature<EventsKey>;
  public un: ScaleLineOnSignature<void>;

  private innerElement_: HTMLElement;
  private viewState_: ViewState;
  private minWidth_: number;
  private maxWidth_: number;
  private renderedVisible_: boolean;
  private renderedWidth_?: number;
  private renderedHTML_: string;
  private scaleBar_: boolean;
  private scaleBarSteps_: number;
  private scaleBarText_: boolean;
  private dpi_?: number;

  constructor(options?: ScaleLineOptions) {
    options = options ? options : {};

    const element = document.createElement('div');
    element.style.pointerEvents = 'none';

    super({
      element: element,
      render: options.render,
      target: options.target,
    });

    const className =
      options.className !== undefined
        ? options.className
        : options.bar
        ? 'ol-scale-bar'
        : 'ol-scale-line';

    /**
     * @private
     * @type {HTMLElement}
     */
    this.innerElement_ = document.createElement('div');
    this.innerElement_.className = className + '-inner';

    this.element.className = className + ' ' + CLASS_UNSELECTABLE;
    this.element.appendChild(this.innerElement_);

    /**
     * @private
     * @type {?import("../View").State}
     */
    this.viewState_ = null;

    /**
     * @private
     * @type {number}
     */
    this.minWidth_ = options.minWidth !== undefined ? options.minWidth : 64;

    /**
     * @private
     * @type {number|undefined}
     */
    this.maxWidth_ = options.maxWidth;

    /**
     * @private
     * @type {boolean}
     */
    this.renderedVisible_ = false;

    /**
     * @private
     * @type {number|undefined}
     */
    this.renderedWidth_ = undefined;

    /**
     * @private
     * @type {string}
     */
    this.renderedHTML_ = '';

    this.addChangeListener(UNITS_PROP, this.handleUnitsChanged_);

    this.setUnits(options.units || 'metric');

    /**
     * @private
     * @type {boolean}
     */
    this.scaleBar_ = options.bar || false;

    /**
     * @private
     * @type {number}
     */
    this.scaleBarSteps_ = options.steps || 4;

    /**
     * @private
     * @type {boolean}
     */
    this.scaleBarText_ = options.text || false;

    /**
     * @private
     * @type {number|undefined}
     */
    this.dpi_ = options.dpi || undefined;
  }

  /**
   * Return the units to use in the scale line.
   * @return {Units} The units
   * to use in the scale line.
   * @observable
   * @api
   */
  public getUnits(): Units {
    return this.get(UNITS_PROP);
  }

  /**
   * @private
   */
  private handleUnitsChanged_(): void {
    this.updateElement_();
  }

  /**
   * Set the units to use in the scale line.
   * @param {Units} units The units to use in the scale line.
   * @observable
   * @api
   */
  public setUnits(units: Units): void {
    this.set(UNITS_PROP, units);
  }

  /**
   * Specify the dpi of output device such as printer.
   * @param {number|undefined} dpi The dpi of output device.
   * @api
   */
  public setDpi(dpi?: number): void {
    this.dpi_ = dpi;
  }

  /**
   * @private
   */
  private updateElement_(): void {
    const viewState = this.viewState_;

    if (!viewState) {
      if (this.renderedVisible_) {
        this.element.style.display = 'none';
        this.renderedVisible_ = false;
      }
      return;
    }

    const center = viewState.center;
    const projection = viewState.projection;
    const units = this.getUnits();
    const pointResolutionUnits = units == 'degrees' ? 'degrees' : 'm';
    let pointResolution = getPointResolution(
      projection,
      viewState.resolution,
      center,
      pointResolutionUnits
    );

    const minWidth =
      (this.minWidth_ * (this.dpi_ || DEFAULT_DPI)) / DEFAULT_DPI;

    const maxWidth =
      this.maxWidth_ !== undefined
        ? (this.maxWidth_ * (this.dpi_ || DEFAULT_DPI)) / DEFAULT_DPI
        : undefined;

    let nominalCount = minWidth * pointResolution;
    let suffix = '';
    if (units == 'degrees') {
      const metersPerDegree = METERS_PER_UNIT.degrees;
      nominalCount *= metersPerDegree;
      if (nominalCount < metersPerDegree / 60) {
        suffix = '\u2033'; // seconds
        pointResolution *= 3600;
      } else if (nominalCount < metersPerDegree) {
        suffix = '\u2032'; // minutes
        pointResolution *= 60;
      } else {
        suffix = '\u00b0'; // degrees
      }
    } else if (units == 'imperial') {
      if (nominalCount < 0.9144) {
        suffix = 'in';
        pointResolution /= 0.0254;
      } else if (nominalCount < 1609.344) {
        suffix = 'ft';
        pointResolution /= 0.3048;
      } else {
        suffix = 'mi';
        pointResolution /= 1609.344;
      }
    } else if (units == 'nautical') {
      pointResolution /= 1852;
      suffix = 'NM';
    } else if (units == 'metric') {
      if (nominalCount < 0.001) {
        suffix = 'μm';
        pointResolution *= 1000000;
      } else if (nominalCount < 1) {
        suffix = 'mm';
        pointResolution *= 1000;
      } else if (nominalCount < 1000) {
        suffix = 'm';
      } else {
        suffix = 'km';
        pointResolution /= 1000;
      }
    } else if (units == 'us') {
      if (nominalCount < 0.9144) {
        suffix = 'in';
        pointResolution *= 39.37;
      } else if (nominalCount < 1609.344) {
        suffix = 'ft';
        pointResolution /= 0.30480061;
      } else {
        suffix = 'mi';
        pointResolution /= 1609.3472;
      }
    } else {
      assert(false, 33); // Invalid units
    }

    let i = 3 * Math.floor(Math.log(minWidth * pointResolution) / Math.log(10));
    let count, width, decimalCount;
    let previousCount, previousWidth, previousDecimalCount;
    while (true) {
      decimalCount = Math.floor(i / 3);
      const decimal = Math.pow(10, decimalCount);
      count = LEADING_DIGITS[((i % 3) + 3) % 3] * decimal;
      width = Math.round(count / pointResolution);
      if (isNaN(width)) {
        this.element.style.display = 'none';
        this.renderedVisible_ = false;
        return;
      }
      if (maxWidth !== undefined && width >= maxWidth) {
        count = previousCount;
        width = previousWidth;
        decimalCount = previousDecimalCount;
        break;
      } else if (width >= minWidth) {
        break;
      }
      previousCount = count;
      previousWidth = width;
      previousDecimalCount = decimalCount;
      ++i;
    }
    const html = this.scaleBar_
      ? this.createScaleBar(width, count, suffix)
      : count.toFixed(decimalCount < 0 ? -decimalCount : 0) + ' ' + suffix;

    if (this.renderedHTML_ != html) {
      this.innerElement_.innerHTML = html;
      this.renderedHTML_ = html;
    }

    if (this.renderedWidth_ != width) {
      this.innerElement_.style.width = width + 'px';
      this.renderedWidth_ = width;
    }

    if (!this.renderedVisible_) {
      this.element.style.display = '';
      this.renderedVisible_ = true;
    }
  }

  /**
   * @private
   * @param {number} width The current width of the scalebar.
   * @param {number} scale The current scale.
   * @param {string} suffix The suffix to append to the scale text.
   * @return {string} The stringified HTML of the scalebar.
   */
  private createScaleBar(width: number, scale: number, suffix: string): string {
    const resolutionScale = this.getScaleForResolution();
    const mapScale =
      resolutionScale < 1
        ? Math.round(1 / resolutionScale).toLocaleString() + ' : 1'
        : '1 : ' + Math.round(resolutionScale).toLocaleString();
    const steps = this.scaleBarSteps_;
    const stepWidth = width / steps;
    const scaleSteps = [this.createMarker('absolute')];
    for (let i = 0; i < steps; ++i) {
      const cls =
        i % 2 === 0 ? 'ol-scale-singlebar-odd' : 'ol-scale-singlebar-even';
      scaleSteps.push(
        '<div>' +
          '<div ' +
          `class="ol-scale-singlebar ${cls}" ` +
          `style="width: ${stepWidth}px;"` +
          '>' +
          '</div>' +
          this.createMarker('relative') +
          // render text every second step, except when only 2 steps
          (i % 2 === 0 || steps === 2
            ? this.createStepText(i, width, false, scale, suffix)
            : '') +
          '</div>'
      );
    }
    // render text at the end
    scaleSteps.push(this.createStepText(steps, width, true, scale, suffix));

    const scaleBarText = this.scaleBarText_
      ? `<div class="ol-scale-text" style="width: ${width}px;">` +
        mapScale +
        '</div>'
      : '';
    return scaleBarText + scaleSteps.join('');
  }

  /**
   * Creates a marker at given position
   * @param {'absolute'|'relative'} position The position, absolute or relative
   * @return {string} The stringified div containing the marker
   */
  public createMarker(position: 'absolute' | 'relative'): string {
    const top = position === 'absolute' ? 3 : -10;
    return (
      '<div ' +
      'class="ol-scale-step-marker" ' +
      `style="position: ${position}; top: ${top}px;"` +
      '></div>'
    );
  }

  /**
   * Creates the label for a marker marker at given position
   * @param {number} i The iterator
   * @param {number} width The width the scalebar will currently use
   * @param {boolean} isLast Flag indicating if we add the last step text
   * @param {number} scale The current scale for the whole scalebar
   * @param {string} suffix The suffix for the scale
   * @return {string} The stringified div containing the step text
   */
  public createStepText(i: number, width: number, isLast: boolean, scale: number, suffix: string): string {
    const length =
      i === 0 ? 0 : Math.round((scale / this.scaleBarSteps_) * i * 100) / 100;
    const lengthString = length + (i === 0 ? '' : ' ' + suffix);
    const margin = i === 0 ? -3 : (width / this.scaleBarSteps_) * -1;
    const minWidth = i === 0 ? 0 : (width / this.scaleBarSteps_) * 2;
    return (
      '<div ' +
      'class="ol-scale-step-text" ' +
      'style="' +
      `margin-left: ${margin}px;` +
      `text-align: ${i === 0 ? 'left' : 'center'};` +
      `min-width: ${minWidth}px;` +
      `left: ${isLast ? width + 'px' : 'unset'};` +
      '">' +
      lengthString +
      '</div>'
    );
  }

  /**
   * Returns the appropriate scale for the given resolution and units.
   * @return {number} The appropriate scale.
   */
  public getScaleForResolution(): number {
    const resolution = getPointResolution(
      this.viewState_.projection,
      this.viewState_.resolution,
      this.viewState_.center,
      'm'
    );
    const dpi = this.dpi_ || DEFAULT_DPI;
    const inchesPerMeter = 1000 / 25.4;
    return resolution * inchesPerMeter * dpi;
  }

  /**
   * Update the scale line element.
   * @param {import("../MapEvent").default} mapEvent Map event.
   * @override
   */
  public render(mapEvent: MapEvent): void {
    const frameState = mapEvent.frameState;
    if (!frameState) {
      this.viewState_ = null;
    } else {
      this.viewState_ = frameState.viewState;
    }
    this.updateElement_();
  }
}

export default ScaleLine;
