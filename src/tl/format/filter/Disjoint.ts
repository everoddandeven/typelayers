/**
 * @module tl/format/filter/Disjoint
 */
import Spatial from './Spatial';
import Geometry from "../../geom/Geometry";

/**
 * @classdesc
 * Represents a `<Disjoint>` operator to test whether a geometry-valued property
 * is disjoint to a given geometry.
 * @api
 */
class Disjoint extends Spatial {
  /**
   * @param {!string} geometryName Geometry name to use.
   * @param {!import("../../geom/Geometry").default} geometry Geometry.
   * @param {string} [srsName] SRS name. No srsName attribute will be
   *    set on geometries when this is not provided.
   */
  constructor(geometryName: string, geometry: Geometry, srsName?: string) {
    super('Disjoint', geometryName, geometry, srsName);
  }
}

export default Disjoint;
