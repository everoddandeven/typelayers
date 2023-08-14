/**
 * @module ol/control/Attribution
 */
import Control from './Control';
import EventType from '../events/EventType';
import {CLASS_COLLAPSED, CLASS_CONTROL, CLASS_UNSELECTABLE} from '../css';
import {equals} from '../array';
import {removeChildren, replaceNode} from '../dom';
import MapEvent from "../MapEvent";

export interface AttributionOptions {
  className?: string;
  target?: HTMLElement | string;
  collapsible?: boolean;
  collapsed?: boolean;
  tipLabel?: string;
  label?: string | HTMLElement;
  expandClassName?: string;
  collapseLabel?: string | HTMLElement;
  collapseClassName?: string;
  render?: (event: MapEvent) => void;
}

/**
 * @classdesc
 * Control to show all the attributions associated with the layer sources
 * in the map. This control is one of the default controls included in maps.
 * By default it will show in the bottom right portion of the map, but this can
 * be changed by using a css selector for `.ol-attribution`.
 *
 * @api
 */
class Attribution extends Control {
  /**
   * @param {Options} [options] Attribution options.
   */

  private ulElement_: HTMLElement;
  private collapsed_: boolean;
  private userCollapsed_: boolean;
  private overrideCollapsible_: boolean;
  private collapsible_: boolean;
  private collapseLabel_: HTMLElement;
  private label_: HTMLElement;
  private toggleButton_: HTMLElement;
  private renderedAttributions_: string[];
  private renderedVisible_: boolean;

  constructor(options: AttributionOptions) {
    options = options ? options : {};

    super({
      element: document.createElement('div'),
      render: options.render,
      target: options.target,
    });

    /**
     * @private
     * @type {HTMLElement}
     */
    this.ulElement_ = document.createElement('ul');

    /**
     * @private
     * @type {boolean}
     */
    this.collapsed_ =
      options.collapsed !== undefined ? options.collapsed : true;

    /**
     * @private
     * @type {boolean}
     */
    this.userCollapsed_ = this.collapsed_;

    /**
     * @private
     * @type {boolean}
     */
    this.overrideCollapsible_ = options.collapsible !== undefined;

    /**
     * @private
     * @type {boolean}
     */
    this.collapsible_ =
      options.collapsible !== undefined ? options.collapsible : true;

    if (!this.collapsible_) {
      this.collapsed_ = false;
    }

    const className =
      options.className !== undefined ? options.className : 'ol-attribution';

    const tipLabel =
      options.tipLabel !== undefined ? options.tipLabel : 'Attributions';

    const expandClassName =
      options.expandClassName !== undefined
        ? options.expandClassName
        : className + '-expand';

    const collapseLabel =
      options.collapseLabel !== undefined ? options.collapseLabel : '\u203A';

    const collapseClassName =
      options.collapseClassName !== undefined
        ? options.collapseClassName
        : className + '-collapse';

    if (typeof collapseLabel === 'string') {
      /**
       * @private
       * @type {HTMLElement}
       */
      this.collapseLabel_ = document.createElement('span');
      this.collapseLabel_.textContent = collapseLabel;
      this.collapseLabel_.className = collapseClassName;
    } else {
      this.collapseLabel_ = collapseLabel;
    }

    const label = options.label !== undefined ? options.label : 'i';

    if (typeof label === 'string') {
      /**
       * @private
       * @type {HTMLElement}
       */
      this.label_ = document.createElement('span');
      this.label_.textContent = label;
      this.label_.className = expandClassName;
    } else {
      this.label_ = label;
    }

    const activeLabel =
      this.collapsible_ && !this.collapsed_ ? this.collapseLabel_ : this.label_;

    /**
     * @private
     * @type {HTMLElement}
     */
    this.toggleButton_ = document.createElement('button');
    this.toggleButton_.setAttribute('type', 'button');
    this.toggleButton_.setAttribute('aria-expanded', String(!this.collapsed_));
    this.toggleButton_.title = tipLabel;
    this.toggleButton_.appendChild(activeLabel);

    this.toggleButton_.addEventListener(
      EventType.CLICK,
      this.handleClick_.bind(this),
      false
    );

    const cssClasses =
      className +
      ' ' +
      CLASS_UNSELECTABLE +
      ' ' +
      CLASS_CONTROL +
      (this.collapsed_ && this.collapsible_ ? ' ' + CLASS_COLLAPSED : '') +
      (this.collapsible_ ? '' : ' ol-uncollapsible');
    const element = this.element;
    element.className = cssClasses;
    element.appendChild(this.toggleButton_);
    element.appendChild(this.ulElement_);

    /**
     * A list of currently rendered resolutions.
     * @type {Array<string>}
     * @private
     */
    this.renderedAttributions_ = [];

    /**
     * @private
     * @type {boolean}
     */
    this.renderedVisible_ = true;
  }

  /**
   * Collect a list of visible attributions and set the collapsible state.
   * @param {import("../Map").FrameState} frameState Frame state.
   * @return {Array<string>} Attributions.
   * @private
   */
  private collectSourceAttributions_(frameState): string[] {
    const visibleAttributions = Array.from(
      new Set(
        this.getMap()
          .getAllLayers()
          .flatMap((layer) => layer.getAttributions(frameState))
      )
    );

    const collapsible = !this.getMap()
      .getAllLayers()
      .some(
        (layer) =>
          layer.getSource() &&
          layer.getSource().getAttributionsCollapsible() === false
      );
    if (!this.overrideCollapsible_) {
      this.setCollapsible(collapsible);
    }
    return visibleAttributions;
  }

  /**
   * @private
   * @param {?import("../Map").FrameState} frameState Frame state.
   */
  updateElement_(frameState) {
    if (!frameState) {
      if (this.renderedVisible_) {
        this.element.style.display = 'none';
        this.renderedVisible_ = false;
      }
      return;
    }

    const attributions = this.collectSourceAttributions_(frameState);

    const visible = attributions.length > 0;
    if (this.renderedVisible_ != visible) {
      this.element.style.display = visible ? '' : 'none';
      this.renderedVisible_ = visible;
    }

    if (equals(attributions, this.renderedAttributions_)) {
      return;
    }

    removeChildren(this.ulElement_);

    // append the attributions
    for (let i = 0, ii = attributions.length; i < ii; ++i) {
      const element = document.createElement('li');
      element.innerHTML = attributions[i];
      this.ulElement_.appendChild(element);
    }

    this.renderedAttributions_ = attributions;
  }

  /**
   * @param {MouseEvent} event The event to handle
   * @private
   */
  private handleClick_(event: MouseEvent): void {
    event.preventDefault();
    this.handleToggle_();
    this.userCollapsed_ = this.collapsed_;
  }

  /**
   * @private
   */
  handleToggle_(): void {
    this.element.classList.toggle(CLASS_COLLAPSED);
    if (this.collapsed_) {
      replaceNode(this.collapseLabel_, this.label_);
    } else {
      replaceNode(this.label_, this.collapseLabel_);
    }
    this.collapsed_ = !this.collapsed_;
    this.toggleButton_.setAttribute('aria-expanded', String(!this.collapsed_));
  }

  /**
   * Return `true` if the attribution is collapsible, `false` otherwise.
   * @return {boolean} True if the widget is collapsible.
   * @api
   */
  public getCollapsible(): boolean {
    return this.collapsible_;
  }

  /**
   * Set whether the attribution should be collapsible.
   * @param {boolean} collapsible True if the widget is collapsible.
   * @api
   */
  public setCollapsible(collapsible: boolean): void {
    if (this.collapsible_ === collapsible) {
      return;
    }
    this.collapsible_ = collapsible;
    this.element.classList.toggle('ol-uncollapsible');
    if (this.userCollapsed_) {
      this.handleToggle_();
    }
  }

  /**
   * Collapse or expand the attribution according to the passed parameter. Will
   * not do anything if the attribution isn't collapsible or if the current
   * collapsed state is already the one requested.
   * @param {boolean} collapsed True if the widget is collapsed.
   * @api
   */
  public setCollapsed(collapsed: boolean): void {
    this.userCollapsed_ = collapsed;
    if (!this.collapsible_ || this.collapsed_ === collapsed) {
      return;
    }
    this.handleToggle_();
  }

  /**
   * Return `true` when the attribution is currently collapsed or `false`
   * otherwise.
   * @return {boolean} True if the widget is collapsed.
   * @api
   */
  public getCollapsed(): boolean {
    return this.collapsed_;
  }

  /**
   * Update the attribution element.
   * @param {import("../MapEvent").default} mapEvent Map event.
   * @override
   */
  public render(mapEvent: MapEvent): void {
    this.updateElement_(mapEvent.frameState);
  }
}

export default Attribution;
