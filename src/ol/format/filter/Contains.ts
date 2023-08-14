/**
 * @module ol/format/filter/Contains
 */
import Spatial from './Spatial';
import Geometry from "../../geom/Geometry";

/**
 * @classdesc
 * Represents a `<Contains>` operator to test whether a geometry-valued property
 * contains a given geometry.
 * @api
 */
class Contains extends Spatial {
  /**
   * @param {!string} geometryName Geometry name to use.
   * @param {!import("../../geom/Geometry").default} geometry Geometry.
   * @param {string} [srsName] SRS name. No srsName attribute will be
   *    set on geometries when this is not provided.
   */
  constructor(geometryName: string, geometry: Geometry, srsName?: string) {
    super('Contains', geometryName, geometry, srsName);
  }
}

export default Contains;
