/**
 * @module tl/contrtl/OverviewMap
 */
import Collection from '../Collection';
import Control from './Control';
import EventType from '../events/EventType';
import Map from '../Map';
import MapEventType from '../MapEventType';
import MapProperty from '../MapProperty';
import ObjectEventType from '../ObjectEventType';
import Overlay from '../Overlay';
import View from '../View';
import ViewProperty from '../ViewProperty';
import {CLASS_COLLAPSED, CLASS_CONTROL, CLASS_UNSELECTABLE} from '../css';
import {containsExtent, equals as equalsExtent, Extent, getBottomRight, getTopLeft, scaleFromCenter,} from '../extent';
import {EventsKey, listen, listenOnce} from '../events';
import {fromExtent as polygonFromExtent} from '../geom/Polygon';
import {replaceNode} from '../dom';
import BaseLayer from "../layer/Base";
import {MapEvent} from "../index";
import {ObjectEvent} from "../Object";

/**
 * Maximum width and/or height extent ratio that determines when the overview
 * map should be zoomed out.
 * @type {number}
 */
const MAX_RATIO: number = 0.75;

/**
 * Minimum width and/or height extent ratio that determines when the overview
 * map should be zoomed in.
 * @type {number}
 */
const MIN_RATIO: number = 0.1;

interface OverviewMapOptions {
  className?: string;
  collapsed?: boolean;
  collapseLabel?: string | HTMLElement;
  collapsible?: boolean;
  label?: string | HTMLElement;
  layers?: BaseLayer[] | Collection<BaseLayer>;
  render?: (event: MapEvent) => void;
  rotateWithView?: boolean;
  target?: HTMLElement | string;
  tipLabel?: string;
  view?: View;
}

/**
 * Create a new control with a map acting as an overview map for another
 * defined map.
 *
 * @api
 */
class OverviewMap extends Control {
  private boundHandleRotationChanged_: any;
  private collapsed_: boolean;
  private collapsible_: boolean;
  private rotateWithView_: boolean;
  private viewExtent_?: Extent;
  private collapseLabel_: HTMLSpanElement;
  private label_: HTMLSpanElement;
  private ovmapDiv_: HTMLDivElement;
  private view_: View;
  private ovmap_: Map;
  private boxOverlay_: Overlay;
  private ovmapPostrenderKey_: EventsKey;
  /**
   * @param {Options} [options] OverviewMap options.
   */
  constructor(options?: OverviewMapOptions) {
    options = options ? options : {};

    super({
      element: document.createElement('div'),
      render: options.render,
      target: options.target,
    });

    /**
     * @private
     */
    this.boundHandleRotationChanged_ = this.handleRotationChanged_.bind(this);

    /**
     * @type {boolean}
     * @private
     */
    this.collapsed_ =
      options.collapsed !== undefined ? options.collapsed : true;

    /**
     * @private
     * @type {boolean}
     */
    this.collapsible_ =
      options.collapsible !== undefined ? options.collapsible : true;

    if (!this.collapsible_) {
      this.collapsed_ = false;
    }

    /**
     * @private
     * @type {boolean}
     */
    this.rotateWithView_ =
      options.rotateWithView !== undefined ? options.rotateWithView : false;

    /**
     * @private
     * @type {import("../extent").Extent|undefined}
     */
    this.viewExtent_ = undefined;

    const className =
      options.className !== undefined ? options.className : 'tl-overviewmap';

    const tipLabel =
      options.tipLabel !== undefined ? options.tipLabel : 'Overview map';

    const collapseLabel =
      options.collapseLabel !== undefined ? options.collapseLabel : '\u2039';

    if (typeof collapseLabel === 'string') {
      /**
       * @private
       * @type {HTMLElement}
       */
      this.collapseLabel_ = document.createElement('span');
      this.collapseLabel_.textContent = collapseLabel;
    } else {
      this.collapseLabel_ = collapseLabel;
    }

    const label = options.label !== undefined ? options.label : '\u203A';

    if (typeof label === 'string') {
      /**
       * @private
       * @type {HTMLElement}
       */
      this.label_ = document.createElement('span');
      this.label_.textContent = label;
    } else {
      this.label_ = label;
    }

    const activeLabel =
      this.collapsible_ && !this.collapsed_ ? this.collapseLabel_ : this.label_;
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.title = tipLabel;
    button.appendChild(activeLabel);

    button.addEventListener(
      EventType.CLICK,
      this.handleClick_.bind(this),
      false
    );

    /**
     * @type {HTMLElement}
     * @private
     */
    this.ovmapDiv_ = document.createElement('div');
    this.ovmapDiv_.className = 'tl-overviewmap-map';

    /**
     * Explicitly given view to be used instead of a view derived from the main map.
     * @type {View}
     * @private
     */
    this.view_ = options.view;

    const ovmap = new Map({
      view: options.view,
      controls: new Collection(),
      interactions: new Collection(),
    });

    /**
     * @type {Map}
     * @private
     */
    this.ovmap_ = ovmap;

    if (options.layers) {
      options.layers.forEach(function (layer) {
        ovmap.addLayer(layer);
      });
    }

    const box = document.createElement('div');
    box.className = 'tl-overviewmap-box';
    box.style.boxSizing = 'border-box';

    /**
     * @type {import("../Overlay").default}
     * @private
     */
    this.boxOverlay_ = new Overlay({
      position: [0, 0],
      positioning: 'center-center',
      element: box,
    });
    this.ovmap_.addOverlay(this.boxOverlay_);

    const cssClasses =
      className +
      ' ' +
      CLASS_UNSELECTABLE +
      ' ' +
      CLASS_CONTROL +
      (this.collapsed_ && this.collapsible_ ? ' ' + CLASS_COLLAPSED : '') +
      (this.collapsible_ ? '' : ' tl-uncollapsible');
    const element = this.element;
    element.className = cssClasses;
    element.appendChild(this.ovmapDiv_);
    element.appendChild(button);

    /* Interactive map */

    const scope = this;

    const overlay = this.boxOverlay_;
    const overlayBox = this.boxOverlay_.getElement();

    /* Functions definition */

    const computeDesiredMousePosition = function (mousePosition: MouseEvent): { clientX: number, clientY: number} {
      return {
        clientX: mousePosition.clientX,
        clientY: mousePosition.clientY,
      };
    };

    const move = function (event: MouseEvent) {
      const position = /** @type {?} */ (<MouseEvent>computeDesiredMousePosition(event));
      const coordinates = ovmap.getEventCoordinateInternal(
        /** @type {MouseEvent} */ (position)
      );

      overlay.setPosition(coordinates);
    };

    const endMoving = function (event: MouseEvent): void {
      const coordinates = ovmap.getEventCoordinateInternal(event);

      scope.getMap().getView().setCenterInternal(coordinates);

      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', endMoving);
    };

    /* Binding */

    overlayBox.addEventListener('mousedown', function () {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', endMoving);
    });
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
    if (map === oldMap) {
      return;
    }
    if (oldMap) {
      const oldView = oldMap.getView();
      if (oldView) {
        this.unbindView_(oldView);
      }
      this.ovmap_.setTarget(null);
    }
    super.setMap(map);

    if (map) {
      this.ovmap_.setTarget(this.ovmapDiv_);
      this.listenerKeys.push(
        listen(
          map,
          ObjectEventType.PROPERTYCHANGE,
          this.handleMapPropertyChange_,
          this
        )
      );

      const view = map.getView();
      if (view) {
        this.bindView_(view);
        if (view.isDef()) {
          this.ovmap_.updateSize();
          this.resetExtent_();
        }
      }

      if (!this.ovmap_.isRendered()) {
        this.updateBoxAfterOvmapIsRendered_();
      }
    }
  }

  /**
   * Handle map property changes.  This only deals with changes to the map's view.
   * @param {import("../Object").ObjectEvent} event The propertychange event.
   * @private
   */
  private handleMapPropertyChange_(event: ObjectEvent): void {
    if (event.key === MapProperty.VIEW) {
      const oldView = /** @type {import("../View").default} */ (
        event.oldValue
      );
      if (oldView) {
        this.unbindView_(oldView);
      }
      const newView = this.getMap().getView();
      this.bindView_(newView);
    } else if (
      !this.ovmap_.isRendered() &&
      (event.key === MapProperty.TARGET || event.key === MapProperty.SIZE)
    ) {
      this.ovmap_.updateSize();
    }
  }

  /**
   * Register listeners for view property changes.
   * @param {import("../View").default} view The view.
   * @private
   */
  private bindView_(view: View): void {
    if (!this.view_) {
      // Unless an explicit view definition was given, derive default from whatever main map uses.
      const newView = new View({
        projection: view.getProjection(),
      });
      this.ovmap_.setView(newView);
    }

    view.addChangeListener(
      ViewProperty.ROTATION,
      this.boundHandleRotationChanged_
    );
    // Sync once with the new view
    this.handleRotationChanged_();
  }

  /**
   * Unregister listeners for view property changes.
   * @param {import("../View").default} view The view.
   * @private
   */
  private unbindView_(view: View): void {
    view.removeChangeListener(
      ViewProperty.ROTATION,
      this.boundHandleRotationChanged_
    );
  }

  /**
   * Handle rotation changes to the main map.
   * @private
   */
  private handleRotationChanged_(): void {
    if (this.rotateWithView_) {
      this.ovmap_.getView().setRotation(this.getMap().getView().getRotation());
    }
  }

  /**
   * Reset the overview map extent if the box size (width or
   * height) is less than the size of the overview map size times minRatio
   * or is greater than the size of the overview size times maxRatio.
   *
   * If the map extent was not reset, the box size can fit in the defined
   * ratio sizes. This method then checks if is contained inside the overview
   * map current extent. If not, recenter the overview map to the current
   * main map center location.
   * @private
   */
  private validateExtent_(): void {
    const map = this.getMap();
    const ovmap = this.ovmap_;

    if (!map.isRendered() || !ovmap.isRendered()) {
      return;
    }

    const mapSize = /** @type {import("../size").Size} */ (map.getSize());

    const view = map.getView();
    const extent = view.calculateExtentInternal(mapSize);

    if (this.viewExtent_ && equalsExtent(extent, this.viewExtent_)) {
      // repeats of the same extent may indicate constraint conflicts leading to an endless cycle
      return;
    }
    this.viewExtent_ = extent;

    const ovmapSize = /** @type {import("../size").Size} */ (
      ovmap.getSize()
    );

    const ovview = ovmap.getView();
    const ovextent = ovview.calculateExtentInternal(ovmapSize);

    const topLeftPixel = ovmap.getPixelFromCoordinateInternal(
      getTopLeft(extent)
    );
    const bottomRightPixel = ovmap.getPixelFromCoordinateInternal(
      getBottomRight(extent)
    );

    const boxWidth = Math.abs(topLeftPixel[0] - bottomRightPixel[0]);
    const boxHeight = Math.abs(topLeftPixel[1] - bottomRightPixel[1]);

    const ovmapWidth = ovmapSize[0];
    const ovmapHeight = ovmapSize[1];

    if (
      boxWidth < ovmapWidth * MIN_RATIO ||
      boxHeight < ovmapHeight * MIN_RATIO ||
      boxWidth > ovmapWidth * MAX_RATIO ||
      boxHeight > ovmapHeight * MAX_RATIO
    ) {
      this.resetExtent_();
    } else if (!containsExtent(ovextent, extent)) {
      this.recenter_();
    }
  }

  /**
   * Reset the overview map extent to half calculated min and max ratio times
   * the extent of the main map.
   * @private
   */
  private resetExtent_(): void {
    if (MAX_RATIO === 0 || MIN_RATIO === 0) {
      return;
    }

    const map = this.getMap();
    const ovmap = this.ovmap_;

    const mapSize = /** @type {import("../size").Size} */ (map.getSize());

    const view = map.getView();
    const extent = view.calculateExtentInternal(mapSize);

    const ovview = ovmap.getView();

    // get how many times the current map overview could hold different
    // box sizes using the min and max ratio, pick the step in the middle used
    // to calculate the extent from the main map to set it to the overview map,
    const steps = Math.log(MAX_RATIO / MIN_RATIO) / Math.LN2;
    const ratio = 1 / (Math.pow(2, steps / 2) * MIN_RATIO);
    scaleFromCenter(extent, ratio);
    ovview.fitInternal(polygonFromExtent(extent));
  }

  /**
   * Set the center of the overview map to the map center without changing its
   * resolution.
   * @private
   */
  private recenter_(): void {
    const map = this.getMap();
    const ovmap = this.ovmap_;

    const view = map.getView();

    const ovview = ovmap.getView();

    ovview.setCenterInternal(view.getCenterInternal());
  }

  /**
   * Update the box using the main map extent
   * @private
   */
  private updateBox_(): void {
    const map = this.getMap();
    const ovmap = this.ovmap_;

    if (!map.isRendered() || !ovmap.isRendered()) {
      return;
    }

    const mapSize = /** @type {import("../size").Size} */ (map.getSize());

    const view = map.getView();

    const ovview = ovmap.getView();

    const rotation = this.rotateWithView_ ? 0 : -view.getRotation();

    const overlay = this.boxOverlay_;
    const box = this.boxOverlay_.getElement();
    const center = view.getCenterInternal();
    const resolution = view.getResolution();
    const ovresolution = ovview.getResolution();
    const width = (mapSize[0] * resolution) / ovresolution;
    const height = (mapSize[1] * resolution) / ovresolution;

    // set position using center coordinates
    overlay.setPosition(center);

    // set box size calculated from map extent size and overview map resolution
    if (box) {
      box.style.width = width + 'px';
      box.style.height = height + 'px';
      box.style.transform = 'rotate(' + rotation + 'rad)';
    }
  }

  /**
   * @private
   */
  private updateBoxAfterOvmapIsRendered_(): void {
    if (this.ovmapPostrenderKey_) {
      return;
    }
    this.ovmapPostrenderKey_ = listenOnce(
      this.ovmap_,
      MapEventType.POSTRENDER,
      function (event): void {
        delete this.ovmapPostrenderKey_;
        this.updateBox_();
      },
      this
    );
  }

  /**
   * @param {MouseEvent} event The event to handle
   * @private
   */
  private handleClick_(event: MouseEvent): void {
    event.preventDefault();
    this.handleToggle_();
  }

  /**
   * @private
   */
  private handleToggle_(): void {
    this.element.classList.toggle(CLASS_COLLAPSED);
    if (this.collapsed_) {
      replaceNode(this.collapseLabel_, this.label_);
    } else {
      replaceNode(this.label_, this.collapseLabel_);
    }
    this.collapsed_ = !this.collapsed_;

    // manage overview map if it had not been rendered before and control
    // is expanded
    const ovmap = this.ovmap_;
    if (!this.collapsed_) {
      if (ovmap.isRendered()) {
        this.viewExtent_ = undefined;
        ovmap.render();
        return;
      }
      ovmap.updateSize();
      this.resetExtent_();
      this.updateBoxAfterOvmapIsRendered_();
    }
  }

  /**
   * Return `true` if the overview map is collapsible, `false` otherwise.
   * @return {boolean} True if the widget is collapsible.
   * @api
   */
  public getCollapsible(): boolean {
    return this.collapsible_;
  }

  /**
   * Set whether the overview map should be collapsible.
   * @param {boolean} collapsible True if the widget is collapsible.
   * @api
   */
  public setCollapsible(collapsible: boolean): void {
    if (this.collapsible_ === collapsible) {
      return;
    }
    this.collapsible_ = collapsible;
    this.element.classList.toggle('tl-uncollapsible');
    if (!collapsible && this.collapsed_) {
      this.handleToggle_();
    }
  }

  /**
   * Collapse or expand the overview map according to the passed parameter. Will
   * not do anything if the overview map isn't collapsible or if the current
   * collapsed state is already the one requested.
   * @param {boolean} collapsed True if the widget is collapsed.
   * @api
   */
  public setCollapsed(collapsed: boolean): void {
    if (!this.collapsible_ || this.collapsed_ === collapsed) {
      return;
    }
    this.handleToggle_();
  }

  /**
   * Determine if the overview map is collapsed.
   * @return {boolean} The overview map is collapsed.
   * @api
   */
  public getCollapsed(): boolean {
    return this.collapsed_;
  }

  /**
   * Return `true` if the overview map view can rotate, `false` otherwise.
   * @return {boolean} True if the control view can rotate.
   * @api
   */
  public getRotateWithView(): boolean {
    return this.rotateWithView_;
  }

  /**
   * Set whether the overview map view should rotate with the main map view.
   * @param {boolean} rotateWithView True if the control view should rotate.
   * @api
   */
  public setRotateWithView(rotateWithView: boolean): void {
    if (this.rotateWithView_ === rotateWithView) {
      return;
    }
    this.rotateWithView_ = rotateWithView;
    if (this.getMap().getView().getRotation() !== 0) {
      if (this.rotateWithView_) {
        this.handleRotationChanged_();
      } else {
        this.ovmap_.getView().setRotation(0);
      }
      this.viewExtent_ = undefined;
      this.validateExtent_();
      this.updateBox_();
    }
  }

  /**
   * Return the overview map.
   * @return {import("../Map").default} Overview map.
   * @api
   */
  public getOverviewMap(): Map {
    return this.ovmap_;
  }

  /**
   * Update the overview map element.
   * @param {import("../MapEvent").default} mapEvent Map event.
   * @override
   */
  public render(mapEvent: MapEvent): void {
    this.validateExtent_();
    this.updateBox_();
  }
}

export default OverviewMap;
