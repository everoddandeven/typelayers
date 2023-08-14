/**
 * @module ol/events/SnapEvent
 */
import Event from './Event';
import {Coordinate} from "../coordinate";
import Feature from "../Feature";

/**
 * @enum {string}
 */
export enum SnapEventType {
  /**
   * Triggered upon snapping to vertex or edge
   * @event SnapEvent#snap
   * @api
   */
  SNAP = 'snap'
}

/**
 * @classdesc
 * Events emitted by {@link module:ol/interaction/Snap~Snap} instances are instances of this
 */
export class SnapEvent extends Event {
  /**
   * @param {SnapEventType} type Type.
   * @param {Object} options Options.
   * @param {import("../coordinate").Coordinate} options.vertex The snapped vertex.
   * @param {import("../coordinate").Coordinate} options.vertexPixel The pixel of the snapped vertex.
   * @param {import("../Feature").default} options.feature The feature being snapped.
   */

  public vertex: Coordinate;
  public vertexPixel: number[];
  public feature: Feature;


  constructor(type: SnapEventType, options: {
    vertex: Coordinate,
    feature: Feature,
    vertexPixel: number[]
  }) {
    super(type);
    /**
     * The Map coordinate of the snapped point.
     * @type {import("../coordinate").Coordinate}
     * @api
     */
    this.vertex = options.vertex;
    /**
     * The Map pixel of the snapped point.
     * @type {Array<number>&Array<number>}
     * @api
     */
    this.vertexPixel = options.vertexPixel;
    /**
     * The feature closest to the snapped point.
     * @type {import("../Feature").default<import("../geom/Geometry").default>}
     * @api
     */
    this.feature = options.feature;
  }
}
