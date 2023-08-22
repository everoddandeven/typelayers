/**
 * @module tl/format/filter/Intersects
 */
import Spatial from './Spatial';
import Geometry from "../../geom/Geometry";

/**
 * @classdesc
 * Represents a `<Intersects>` operator to test whether a geometry-valued property
 * intersects a given geometry.
 * @api
 */
class Intersects extends Spatial {
  /**
   * @param {!string} geometryName Geometry name to use.
   * @param {!import("../../geom/Geometry").default} geometry Geometry.
   * @param {string} [srsName] SRS name. No srsName attribute will be
   *    set on geometries when this is not provided.
   */
  constructor(geometryName: string, geometry: Geometry, srsName?: string) {
    super('Intersects', geometryName, geometry, srsName);
  }
}

export default Intersects;
