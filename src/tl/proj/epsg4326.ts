/**
 * @module tl/proj/epsg4326
 */
import Projection from './Projection';
import {Extent} from "../extent/Extent";

/**
 * Semi-major radius of the WGS84 ellipsoid.
 *
 * @const
 * @type {number}
 */
export const RADIUS: number = 6378137;

/**
 * Extent of the EPSG:4326 projection which is the whole world.
 *
 * @const
 * @type {import("../extent").Extent}
 */
export const EXTENT: Extent = [-180, -90, 180, 90];

/**
 * @const
 * @type {number}
 */
export const METERS_PER_UNIT: number = (Math.PI * RADIUS) / 180;

/**
 * @classdesc
 * Projection object for WGS84 geographic coordinates (EPSG:4326).
 *
 * Note that OpenLayers does not strictly comply with the EPSG definition.
 * The EPSG registry defines 4326 as a CRS for Latitude,Longitude (y,x).
 * OpenLayers treats EPSG:4326 as a pseudo-projection, with x,y coordinates.
 */
class EPSG4326Projection extends Projection {
  /**
   * @param {string} code Code.
   * @param {string} [axisOrientation] Axis orientation.
   */
  constructor(code: string, axisOrientation?: string) {
    super({
      code: code,
      units: 'degrees',
      extent: EXTENT,
      axisOrientation: axisOrientation,
      global: true,
      metersPerUnit: METERS_PER_UNIT,
      worldExtent: EXTENT,
    });
  }
}

/**
 * Projections equal to EPSG:4326.
 *
 * @const
 * @type {Array<import("./Projection").default>}
 */
export const PROJECTIONS: Projection[] = [
  new EPSG4326Projection('CRS:84'),
  new EPSG4326Projection('EPSG:4326', 'neu'),
  new EPSG4326Projection('urn:ogc:def:crs:OGC:1.3:CRS84'),
  new EPSG4326Projection('urn:ogc:def:crs:OGC:2:84'),
  new EPSG4326Projection('http://www.opengis.net/def/crs/OGC/1.3/CRS84'),
  new EPSG4326Projection('http://www.opengis.net/gml/srs/epsg.xml#4326', 'neu'),
  new EPSG4326Projection('http://www.opengis.net/def/crs/EPSG/0/4326', 'neu'),
];
