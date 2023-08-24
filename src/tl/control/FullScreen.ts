/**
 * @module tl/contrtl/FullScreen
 */
import Control from './Control';
import EventType from '../events/EventType';
import MapProperty from '../MapProperty';
import {CLASS_CONTROL, CLASS_UNSELECTABLE, CLASS_UNSUPPORTED} from '../css';
import {EventsKey, listen, unlistenByKey} from '../events';
import {replaceNode} from '../dom';
import {CombinedOnSignature, EventTypes, OnSignature} from "../Observable";
import BaseEvent from "../events/Event";
import ObjectEventType from "../ObjectEventType";
import {ObjectEvent} from "../Object";
import Map from "../Map";
import MapEvent from '../MapEvent';

const events: string[] = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'MSFullscreenChange',
];

/**
 * @enum {string}
 */
export enum FullScreenEventType {
  /**
   * Triggered after the map entered fullscreen.
   * @event FullScreenEventType#enterfullscreen
   * @api
   */
  ENTERFULLSCREEN = 'enterfullscreen',

  /**
   * Triggered after the map leave fullscreen.
   * @event FullScreenEventType#leavefullscreen
   * @api
   */
  LEAVEFULLSCREEN = 'leavefullscreen',
}

export type FullScreenEventTypes = 'enterfullscreen' | 'leavefullscreen';

export type FullScreenOnSignature<Return> =
    OnSignature<EventTypes | FullScreenEventTypes, BaseEvent, Return> &
    OnSignature<ObjectEventType, ObjectEvent, Return> &
    CombinedOnSignature<EventTypes | FullScreenEventTypes, Return>;

export interface FullScreenOptions {
  className?: string;
  label?: string | Text | HTMLElement;
  labelActive?: string | Text | HTMLElement;
  activeClassName?: string;
  inactiveClassName?: string;
  tipLabel?: string;
  keys?: boolean;
  target?: HTMLElement | string;
  source?: HTMLElement | string;
}

/**
 * @classdesc
 * Provides a button that when clicked fills up the full screen with the map.
 * The full screen source element is by default the element containing the map viewport unless
 * overridden by providing the `source` option. In which case, the dom
 * element introduced using this parameter will be displayed in full screen.
 *
 * When in full screen mode, a close button is shown to exit full screen mode.
 * The [Fullscreen API](https://www.w3.org/TR/fullscreen/) is used to
 * toggle the map in full screen mode.
 *
 * @fires 'ENTERFULLSCREEN'
 * @fires 'LEAVEFULLSCREEN'
 * @api
 */
class FullScreen extends Control {

  /**
   * @param {Options} [options] Options.
   */

  public on: FullScreenOnSignature<EventsKey>;
  public once: FullScreenOnSignature<EventsKey>;
  public un: FullScreenOnSignature<void>;
  private keys_: boolean;
  private source_: HTMLElement | string;
  private isInFullscreen_: boolean;
  private boundHandleMapTargetChange_: any;
  private cssClassName_: string;
  private documentListeners_: EventsKey[];
  private activeClassName_: string[];
  private inactiveClassName_: string[];
  private labelNode_: Text | HTMLElement;
  private labelActiveNode_: Text | HTMLElement;
  private button_: HTMLButtonElement;

  constructor(options?: FullScreenOptions) {
    options = options ? options : {};

    super({
      element: document.createElement('div'),
      target: options.target,
    });

    /***
     * @type {FullScreenOnSignature<import("../events").EventsKey>}
     */
    this.on = null;

    /***
     * @type {FullScreenOnSignature<import("../events").EventsKey>}
     */
    this.once = null;

    /***
     * @type {FullScreenOnSignature<void>}
     */
    this.un = null;

    /**
     * @private
     * @type {boolean}
     */
    this.keys_ = options.keys !== undefined ? options.keys : false;

    /**
     * @private
     * @type {HTMLElement|string|undefined}
     */
    this.source_ = options.source;

    /**
     * @type {boolean}
     * @private
     */
    this.isInFullscreen_ = false;

    /**
     * @private
     */
    this.boundHandleMapTargetChange_ = this.handleMapTargetChange_.bind(this);

    /**
     * @private
     * @type {string}
     */
    this.cssClassName_ =
      options.className !== undefined ? options.className : 'tl-full-screen';

    /**
     * @private
     * @type {Array<import("../events").EventsKey>}
     */
    this.documentListeners_ = [];

    /**
     * @private
     * @type {Array<string>}
     */
    this.activeClassName_ =
      options.activeClassName !== undefined
        ? options.activeClassName.split(' ')
        : [this.cssClassName_ + '-true'];

    /**
     * @private
     * @type {Array<string>}
     */
    this.inactiveClassName_ =
      options.inactiveClassName !== undefined
        ? options.inactiveClassName.split(' ')
        : [this.cssClassName_ + '-false'];

    const label = options.label !== undefined ? options.label : '\u2922';

    /**
     * @private
     * @type {Text|HTMLElement}
     */
    this.labelNode_ =
      typeof label === 'string' ? document.createTextNode(label) : label;

    const labelActive =
      options.labelActive !== undefined ? options.labelActive : '\u00d7';

    /**
     * @private
     * @type {Text|HTMLElement}
     */
    this.labelActiveNode_ =
      typeof labelActive === 'string'
        ? document.createTextNode(labelActive)
        : labelActive;

    const tipLabel = options.tipLabel ? options.tipLabel : 'Toggle full-screen';

    /**
     * @private
     * @type {HTMLElement}
     */
    this.button_ = document.createElement('button');
    this.button_.title = tipLabel;
    this.button_.setAttribute('type', 'button');
    this.button_.appendChild(this.labelNode_);
    this.button_.addEventListener(
      EventType.CLICK,
      this.handleClick_.bind(this),
      false
    );
    this.setClassName_(this.button_, this.isInFullscreen_);

    this.element.className = `${this.cssClassName_} ${CLASS_UNSELECTABLE} ${CLASS_CONTROL}`;
    this.element.appendChild(this.button_);
  }

  /**
   * @param {MouseEvent} event The event to handle
   * @private
   */
  private handleClick_(event: MouseEvent): void {
    event.preventDefault();
    this.handleFullScreen_();
  }

  /**
   * @private
   */
  private handleFullScreen_(): void {
    const map = this.getMap();
    if (!map) {
      return;
    }
    const doc = map.getOwnerDocument();
    if (!isFullScreenSupported(doc)) {
      return;
    }
    if (isFullScreen(doc)) {
      exitFullScreen(doc);
    } else {
      let element: HTMLElement;
      if (this.source_) {
        element =
          typeof this.source_ === 'string'
            ? doc.getElementById(this.source_)
            : this.source_;
      } else {
        element = map.getTargetElement();
      }
      if (this.keys_) {
        requestFullScreenWithKeys(element);
      } else {
        requestFullScreen(element);
      }
    }
  }

  /**
   * @private
   */
  private handleFullScreenChange_() {
    const map = this.getMap();
    if (!map) {
      return;
    }
    const wasInFullscreen = this.isInFullscreen_;
    this.isInFullscreen_ = isFullScreen(map.getOwnerDocument());
    if (wasInFullscreen !== this.isInFullscreen_) {
      this.setClassName_(this.button_, this.isInFullscreen_);
      if (this.isInFullscreen_) {
        replaceNode(this.labelActiveNode_, this.labelNode_);
        this.dispatchEvent(FullScreenEventType.ENTERFULLSCREEN);
      } else {
        replaceNode(this.labelNode_, this.labelActiveNode_);
        this.dispatchEvent(FullScreenEventType.LEAVEFULLSCREEN);
      }
      map.updateSize();
    }
  }

  /**
   * @param {HTMLElement} element Target element
   * @param {boolean} fullscreen True if fullscreen class name should be active
   * @private
   */
  private setClassName_(element: HTMLElement, fullscreen: boolean): void {
    if (fullscreen) {
      element.classList.remove(...this.inactiveClassName_);
      element.classList.add(...this.activeClassName_);
    } else {
      element.classList.remove(...this.activeClassName_);
      element.classList.add(...this.inactiveClassName_);
    }
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
    const oldMap = this.getMap();
    if (oldMap) {
      oldMap.removeChangeListener(
        MapProperty.TARGET,
        this.boundHandleMapTargetChange_
      );
    }

    super.setMap(map);

    this.handleMapTargetChange_();
    if (map) {
      map.addChangeListener(
        MapProperty.TARGET,
        this.boundHandleMapTargetChange_
      );
    }
  }

  /**
   * @private
   */
  private handleMapTargetChange_(): void {
    const listeners = this.documentListeners_;
    for (let i = 0, ii = listeners.length; i < ii; ++i) {
      unlistenByKey(listeners[i]);
    }
    listeners.length = 0;

    const map = this.getMap();
    if (map) {
      const doc = map.getOwnerDocument();
      if (isFullScreenSupported(doc)) {
        this.element.classList.remove(CLASS_UNSUPPORTED);
      } else {
        this.element.classList.add(CLASS_UNSUPPORTED);
      }

      for (let i = 0, ii = events.length; i < ii; ++i) {
        listeners.push(
          listen(doc, events[i], this.handleFullScreenChange_, this)
        );
      }
      this.handleFullScreenChange_();
    }
  }

  public render(mapEvent: MapEvent): void { };
}

/**
 * @param {Document} doc The root document to check.
 * @return {boolean} Fullscreen is supported by the current platform.
 */
function isFullScreenSupported(doc: Document): boolean {
  const body = doc.body;
  return !!(
    body['webkitRequestFullscreen'] ||
    (body.requestFullscreen && doc.fullscreenEnabled)
  );
}

/**
 * @param {Document} doc The root document to check.
 * @return {boolean} Element is currently in fullscreen.
 */
function isFullScreen(doc: Document): boolean {
  return !!(doc['webkitIsFullScreen'] || doc.fullscreenElement);
}

/**
 * Request to fullscreen an element.
 * @param {HTMLElement} element Element to request fullscreen
 * @param onEnterFullScreen
 */
function requestFullScreen(element: HTMLElement, onEnterFullScreen: () => void = () => {}): void {
  if (element.requestFullscreen) {
    element.requestFullscreen().then((): void => { onEnterFullScreen(); });
  } else if (element['webkitRequestFullscreen']) {
    element['webkitRequestFullscreen']();
  }
}

/**
 * Request to fullscreen an element with keyboard input.
 * @param {HTMLElement} element Element to request fullscreen
 */
function requestFullScreenWithKeys(element: HTMLElement): void {
  if (element['webkitRequestFullscreen']) {
    element['webkitRequestFullscreen']();
  } else {
    requestFullScreen(element);
  }
}

/**
 * Exit fullscreen.
 * @param {Document} doc The document to exit fullscreen from
 * @param onExitFullScreen
 */
function exitFullScreen(doc: Document, onExitFullScreen: () => void = (): void => {}): void {
  if (doc.exitFullscreen) {
    doc.exitFullscreen().then((): void => { onExitFullScreen(); });
  } else if (doc['webkitExitFullscreen']) {
    doc['webkitExitFullscreen']();
  }
}



export default FullScreen;
