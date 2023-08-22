/**
 * @module tl/format/filter/Within
 */
import Spatial from './Spatial';
import Geometry from "../../geom/Geometry";

/**
 * @classdesc
 * Represents a `<Within>` operator to test whether a geometry-valued property
 * is within a given geometry.
 * @api
 */
class Within extends Spatial {
  /**
   * @param {!string} geometryName Geometry name to use.
   * @param {!import("../../geom/Geometry").default} geometry Geometry.
   * @param {string} [srsName] SRS name. No srsName attribute will be
   *    set on geometries when this is not provided.
   */
  constructor(geometryName: string, geometry: Geometry, srsName?: string) {
    super('Within', geometryName, geometry, srsName);
  }
}

export default Within;
