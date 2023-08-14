/**
 * @module ol/format/filter/Spatial
 */
import Filter from './Filter';
import Geometry from "../../geom/Geometry";

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Represents a spatial operator to test whether a geometry-valued property
 * relates to a given geometry.
 *
 * @abstract
 */
class Spatial extends Filter {
  /**
   * @param {!string} tagName The XML tag name for this filter.
   * @param {!string} geometryName Geometry name to use.
   * @param {!import("../../geom/Geometry").default} geometry Geometry.
   * @param {string} [srsName] SRS name. No srsName attribute will be
   *    set on geometries when this is not provided.
   */

  public geometryName: string;
  public geometry: Geometry;
  public srsName?: string;

  constructor(tagName: string, geometryName: string, geometry: Geometry, srsName?: string) {
    super(tagName);

    /**
     * @type {!string}
     */
    this.geometryName = geometryName || 'the_geom';

    /**
     * @type {import("../../geom/Geometry").default}
     */
    this.geometry = geometry;

    /**
     * @type {string|undefined}
     */
    this.srsName = srsName;
  }
}

export default Spatial;
