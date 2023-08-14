/**
 * @module ol/format/filter/DWithin
 */
import Spatial from './Spatial';
import Geometry from "../../geom/Geometry";

/**
 * @classdesc
 * Represents a `<DWithin>` operator to test whether a geometry-valued property
 * is within a distance to a given geometry.
 * @api
 */
class DWithin extends Spatial {
  /**
   * @param {!string} geometryName Geometry name to use.
   * @param {!import("../../geom/Geometry").default} geometry Geometry.
   * @param {!number} distance Distance.
   * @param {!string} unit Unit.
   * @param {string} [srsName] SRS name. No srsName attribute will be
   *    set on geometries when this is not provided.
   */

  public distance: number;
  public unit: string;

  constructor(geometryName: string, geometry: Geometry, distance: number, unit: string, srsName?: string) {
    super('DWithin', geometryName, geometry, srsName);

    /**
     * @public
     * @type {!number}
     */
    this.distance = distance;

    /**
     * @public
     * @type {!string}
     */
    this.unit = unit;
  }
}

export default DWithin;
