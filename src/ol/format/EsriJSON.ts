/**
 * @module ol/format/EsriJSON
 */
import Feature from '../Feature';
import JSONFeature from './JSONFeature';
import LineString from '../geom/LineString';
import LinearRing from '../geom/LinearRing';
import MultiLineString from '../geom/MultiLineString';
import MultiPoint from '../geom/MultiPoint';
import MultiPolygon from '../geom/MultiPolygon';
import Point from '../geom/Point';
import Polygon from '../geom/Polygon';
import {assert} from '../asserts';
import {containsExtent} from '../extent';
import {deflateCoordinates} from '../geom/flat/deflate';
import {get as getProjection} from '../proj';
import {isEmpty} from '../obj';
import {linearRingIsClockwise} from '../geom/flat/orient';
import {ReadOptions, transformGeometryWithOptions, WriteOptions} from './Feature';
import * as Esri from 'arcgis-rest-api';
import Geometry, {GeometryLayout} from "../geom/Geometry";
import SimpleGeometry from "../geom/SimpleGeometry";

export type EsriJSONFeature = Esri.Feature;
export type EsriJSONFeatureSet = Esri.FeatureSet;
export type EsriJSONGeometry = Esri.Geometry;
export type EsriJSONPoint = Esri.Point;
export type EsriJSONPolyline = Esri.Polyline;
export type EsriJSONPolygon = Esri.Polygon;
export type EsriJSONMultiPoint = Esri.Multipoint;
export type EsriJSONHasZM = Esri.HasZM;
export type EsriJSONPosition = Esri.Position;
export type EsriJSONSpatialReferenceWkid = Esri.SpatialReferenceWkid;

/**
 * @typedef {import("arcgis-rest-api").Feature} EsriJSONFeature
 * @typedef {import("arcgis-rest-api").FeatureSet} EsriJSONFeatureSet
 * @typedef {import("arcgis-rest-api").Geometry} EsriJSONGeometry
 * @typedef {import("arcgis-rest-api").Point} EsriJSONPoint
 * @typedef {import("arcgis-rest-api").Polyline} EsriJSONPolyline
 * @typedef {import("arcgis-rest-api").Polygon} EsriJSONPolygon
 * @typedef {import("arcgis-rest-api").Multipoint} EsriJSONMultipoint
 * @typedef {import("arcgis-rest-api").HasZM} EsriJSONHasZM
 * @typedef {import("arcgis-rest-api").Position} EsriJSONPosition
 * @typedef {import("arcgis-rest-api").SpatialReferenceWkid} EsriJSONSpatialReferenceWkid
 */

/**
 * @typedef {Object} EsriJSONMultiPolygon
 * @property {Array<Array<Array<Array<number>>>>} rings Rings for the MultiPolygon.
 * @property {boolean} [hasM] If the polygon coordinates have an M value.
 * @property {boolean} [hasZ] If the polygon coordinates have a Z value.
 * @property {EsriJSONSpatialReferenceWkid} [spatialReference] The coordinate reference system.
 */

export interface EsriJSONMultiPolygon
{
  rings: number[][][][],
  hasM: boolean,
  hasZ: boolean,
  spatialReference: EsriJSONSpatialReferenceWkid
}

/**
 * @const
 * @type {Object<import("../geom/Geometry").Type, function(EsriJSONGeometry): import("../geom/Geometry").default>}
 */
const GEOMETRY_READERS = {
  Point: readPointGeometry,
  LineString: readLineStringGeometry,
  Polygon: readPolygonGeometry,
  MultiPoint: readMultiPointGeometry,
  MultiLineString: readMultiLineStringGeometry,
  MultiPolygon: readMultiPolygonGeometry,
};

/**
 * @const
 * @type {Object<import("../geom/Geometry").Type, function(import("../geom/Geometry").default, import("./Feature").WriteOptions=): (EsriJSONGeometry)>}
 */
const GEOMETRY_WRITERS = {
  Point: writePointGeometry,
  LineString: writeLineStringGeometry,
  Polygon: writePolygonGeometry,
  MultiPoint: writeMultiPointGeometry,
  MultiLineString: writeMultiLineStringGeometry,
  MultiPolygon: writeMultiPolygonGeometry,
};

export interface EsriJSONOptions
{
  geometryName?: string;
}

/**
 * @classdesc
 * Feature format for reading and writing data in the EsriJSON format.
 *
 * @api
 */
class EsriJSON extends JSONFeature {
  /**
   * @param {Options} [options] Options.
   */

  private geometryName_: string;

  constructor(options: EsriJSONOptions) {
    options = options ? options : {};

    super();

    /**
     * Name of the geometry attribute for features.
     * @type {string|undefined}
     * @private
     */
    this.geometryName_ = options.geometryName;
  }

  /**
   * @param {Object} object Object.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @param {string} [idField] Name of the field where to get the id from.
   * @protected
   * @return {import("../Feature").default} Feature.
   */
  public readFeatureFromObject(object: any, options: ReadOptions, idField?: string): Feature {
    const esriJSONFeature = (<EsriJSONFeature>object);
    const geometry = readGeometry(esriJSONFeature.geometry, options);
    const feature = new Feature();
    if (this.geometryName_) {
      feature.setGeometryName(this.geometryName_);
    }
    feature.setGeometry(geometry);
    if (esriJSONFeature.attributes) {
      feature.setProperties(esriJSONFeature.attributes, true);
      const id = esriJSONFeature.attributes[idField];
      if (id !== undefined) {
        feature.setId((<number>id));
      }
    }
    return feature;
  }

  /**
   * @param {Object} object Object.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {Array<Feature>} Features.
   */
  protected readFeaturesFromObject(object: {[key: string]: any}, options?: ReadOptions): Feature[] {
    options = options ? options : {};
    if (object['features']) {
      const esriJSONFeatureSet = /** @type {EsriJSONFeatureSet} */ (<EsriJSONFeatureSet>object);
      /** @type {Array<import("../Feature").default>} */
      let features: Feature[] = [];
      let esriJSONFeatures: any[] = <any[]>esriJSONFeatureSet.features;

      for (let i = 0, ii = esriJSONFeatures.length; i < ii; ++i) {
        features.push(
          this.readFeatureFromObject(
            esriJSONFeatures[i],
            options,
            object.objectIdFieldName
          )
        );
      }
      return features;
    }
    return [this.readFeatureFromObject(object, options)];
  }

  /**
   * @param {EsriJSONGeometry} object Object.
   * @param {import("./Feature").ReadOptions} [options] Read options.
   * @protected
   * @return {import("../geom/Geometry").default} Geometry.
   */
  readGeometryFromObject(object, options) {
    return readGeometry(object, options);
  }

  /**
   * @param {Object} object Object.
   * @protected
   * @return {import("../proj/Projection").default} Projection.
   */
  readProjectionFromObject(object) {
    if (
      object['spatialReference'] &&
      object['spatialReference']['wkid'] !== undefined
    ) {
      const spatialReference = /** @type {EsriJSONSpatialReferenceWkid} */ (
        object['spatialReference']
      );
      const crs = spatialReference.wkid;
      return getProjection('EPSG:' + crs);
    }
    return null;
  }

  /**
   * Encode a geometry as a EsriJSON object.
   *
   * @param {import("../geom/Geometry").default} geometry Geometry.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {EsriJSONGeometry} Object.
   * @api
   */
  writeGeometryObject(geometry, options) {
    return writeGeometry(geometry, this.adaptOptions(options));
  }

  /**
   * Encode a feature as a esriJSON Feature object.
   *
   * @param {import("../Feature").default} feature Feature.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {Object} Object.
   * @api
   */
  writeFeatureObject(feature, options) {
    options = this.adaptOptions(options);
    const object = {};
    if (!feature.hasProperties()) {
      object['attributes'] = {};
      return object;
    }
    const properties = feature.getProperties();
    const geometry = feature.getGeometry();
    if (geometry) {
      object['geometry'] = writeGeometry(geometry, options);
      const projection =
        options && (options.dataProjection || options.featureProjection);
      if (projection) {
        object['geometry']['spatialReference'] =
          /** @type {EsriJSONSpatialReferenceWkid} */ ({
            wkid: Number(getProjection(projection).getCode().split(':').pop()),
          });
      }
      delete properties[feature.getGeometryName()];
    }
    if (!isEmpty(properties)) {
      object['attributes'] = properties;
    } else {
      object['attributes'] = {};
    }
    return object;
  }

  /**
   * Encode an array of features as a EsriJSON object.
   *
   * @param {Array<import("../Feature").default>} features Features.
   * @param {import("./Feature").WriteOptions} [options] Write options.
   * @return {EsriJSONFeatureSet} EsriJSON Object.
   * @api
   */
  public writeFeaturesObject(features: Feature[], options?: WriteOptions): EsriJSONFeatureSet {
    options = this.adaptOptions(options);
    const objects = [];
    for (let i = 0, ii = features.length; i < ii; ++i) {
      objects.push(this.writeFeatureObject(features[i], options));
    }
    return {
      'features': objects,
    };
  }
}

/**
 * @param {EsriJSONGeometry} object Object.
 * @param {import("./Feature").ReadOptions} [options] Read options.
 * @return {import("../geom/Geometry").default} Geometry.
 */
function readGeometry(object: EsriJSONGeometry, options?: ReadOptions): Geometry {
  if (!object) {
    return null;
  }
  /** @type {import("../geom/Geometry").Type} */
  let type;
  if (typeof object['x'] === 'number' && typeof object['y'] === 'number') {
    type = 'Point';
  } else if (object['points']) {
    type = 'MultiPoint';
  } else if (object['paths']) {
    const esriJSONPolyline = /** @type {EsriJSONPolyline} */ (<EsriJSONPolyline>object);
    if (esriJSONPolyline.paths.length === 1) {
      type = 'LineString';
    } else {
      type = 'MultiLineString';
    }
  } else if (object['rings']) {
    const esriJSONPolygon = /** @type {EsriJSONPolygon} */ (<EsriJSONPolygon>object);
    const layout = getGeometryLayout(esriJSONPolygon);
    const rings = convertRings(esriJSONPolygon.rings, layout);
    if (rings.length === 1) {
      type = 'Polygon';
      object = Object.assign({}, object, {['rings']: rings[0]});
    } else {
      type = 'MultiPolygon';
      object = Object.assign({}, object, {['rings']: rings});
    }
  }
  const geometryReader = GEOMETRY_READERS[type];
  return transformGeometryWithOptions(geometryReader(object), false, options);
}

/**
 * Determines inner and outer rings.
 * Checks if any polygons in this array contain any other polygons in this
 * array. It is used for checking for holes.
 * Logic inspired by: https://github.com/Esri/terraformer-arcgis-parser
 * @param {Array<!Array<!Array<number>>>} rings Rings.
 * @param {import("../geom/Geometry").GeometryLayout} layout Geometry layout.
 * @return {Array<!Array<!Array<!Array<number>>>>} Transformed rings.
 */
function convertRings(rings, layout) {
  const flatRing = [];
  const outerRings = [];
  const holes = [];
  let i, ii;
  for (i = 0, ii = rings.length; i < ii; ++i) {
    flatRing.length = 0;
    deflateCoordinates(flatRing, 0, rings[i], layout.length);
    // is this ring an outer ring? is it clockwise?
    const clockwise = linearRingIsClockwise(
      flatRing,
      0,
      flatRing.length,
      layout.length
    );
    if (clockwise) {
      outerRings.push([rings[i]]);
    } else {
      holes.push(rings[i]);
    }
  }
  while (holes.length) {
    const hole = holes.shift();
    let matched = false;
    // loop over all outer rings and see if they contain our hole.
    for (i = outerRings.length - 1; i >= 0; i--) {
      const outerRing = outerRings[i][0];
      const containsHole = containsExtent(
        new LinearRing(outerRing).getExtent(),
        new LinearRing(hole).getExtent()
      );
      if (containsHole) {
        // the hole is contained push it into our polygon
        outerRings[i].push(hole);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // no outer rings contain this hole turn it into and outer
      // ring (reverse it)
      outerRings.push([hole.reverse()]);
    }
  }
  return outerRings;
}

/**
 * @param {EsriJSONPoint} object Object.
 * @return {import("../geom/Geometry").default} Point.
 */
function readPointGeometry(object: EsriJSONPoint): Point {
  let point: Point;

  if (object.m !== undefined && object.z !== undefined) {
    point = new Point([object.x, object.y, object.z, object.m], 'XYZM');
  } else if (object.z !== undefined) {
    point = new Point([object.x, object.y, object.z], 'XYZ');
  } else if (object.m !== undefined) {
    point = new Point([object.x, object.y, object.m], 'XYM');
  } else {
    point = new Point([object.x, object.y]);
  }

  return point;
}

/**
 * @param {EsriJSONPolyline} object Object.
 * @return {import("../geom/Geometry").default} LineString.
 */
function readLineStringGeometry(object: EsriJSONPolyline): LineString {
  const layout = getGeometryLayout(object);
  return new LineString(object.paths[0], layout);
}

/**
 * @param {EsriJSONPolyline} object Object.
 * @return {import("../geom/Geometry").default} MultiLineString.
 */
function readMultiLineStringGeometry(object: EsriJSONPolyline): MultiLineString {
  const layout = getGeometryLayout(object);
  return new MultiLineString(object.paths, layout);
}

/**
 * @param {EsriJSONHasZM} object Object.
 * @return {import("../geom/Geometry").GeometryLayout} The geometry layout to use.
 */
function getGeometryLayout(object: EsriJSONHasZM): GeometryLayout {
  let layout: GeometryLayout = 'XY';
  if (object.hasZ === true && object.hasM === true) {
    layout = 'XYZM';
  } else if (object.hasZ === true) {
    layout = 'XYZ';
  } else if (object.hasM === true) {
    layout = 'XYM';
  }
  return layout;
}

/**
 * @param {EsriJSONMultipoint} object Object.
 * @return {import("../geom/Geometry").default} MultiPoint.
 */
function readMultiPointGeometry(object: EsriJSONMultiPoint): MultiPoint {
  const layout = getGeometryLayout(object);
  return new MultiPoint(object.points, layout);
}

/**
 * @param {EsriJSONMultiPolygon} object Object.
 * @return {import("../geom/Geometry").default} MultiPolygon.
 */
function readMultiPolygonGeometry(object: EsriJSONMultiPolygon): MultiPolygon {
  const layout = getGeometryLayout(object);
  return new MultiPolygon(object.rings, layout);
}

/**
 * @param {EsriJSONPolygon} object Object.
 * @return {import("../geom/Geometry").default} Polygon.
 */
function readPolygonGeometry(object: EsriJSONPolygon): Polygon {
  const layout = getGeometryLayout(object);
  return new Polygon(object.rings, layout);
}

/**
 * @param {import("../geom/Point").default} geometry Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONPoint} EsriJSON geometry.
 */
function writePointGeometry(geometry: Point, options?: WriteOptions): EsriJSONPoint {
  const coordinates = <number[]>geometry.getCoordinates();
  /** @type {EsriJSONPoint} */
  let esriJSON: EsriJSONPoint;
  const layout = geometry.getLayout();
  if (layout === 'XYZ') {
    esriJSON = {
      x: coordinates[0],
      y: coordinates[1],
      z: coordinates[2],
    };
  } else if (layout === 'XYM') {
    esriJSON = {
      x: coordinates[0],
      y: coordinates[1],
      m: coordinates[2],
    };
  } else if (layout === 'XYZM') {
    esriJSON = {
      x: coordinates[0],
      y: coordinates[1],
      z: coordinates[2],
      m: coordinates[3],
    };
  } else if (layout === 'XY') {
    esriJSON = {
      x: coordinates[0],
      y: coordinates[1],
    };
  } else {
    assert(false, 34); // Invalid geometry layout
  }
  return esriJSON;
}

/**
 * @param {import("../geom/SimpleGeometry").default} geometry Geometry.
 * @return {Object} Object with boolean hasZ and hasM keys.
 */
function getHasZM(geometry: SimpleGeometry) {
  const layout = geometry.getLayout();
  return {
    hasZ: layout === 'XYZ' || layout === 'XYZM',
    hasM: layout === 'XYM' || layout === 'XYZM',
  };
}

/**
 * @param {import("../geom/LineString").default} lineString Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONPolyline} EsriJSON geometry.
 */
function writeLineStringGeometry(lineString: LineString, options?: WriteOptions): EsriJSONPolyline {
  const hasZM = getHasZM(lineString);
  return {
    hasZ: hasZM.hasZ,
    hasM: hasZM.hasM,
    paths: [
      /** @type {Array<EsriJSONPosition>} */ (lineString.getCoordinates()),
    ],
  };
}

/**
 * @param {import("../geom/Polygon").default} polygon Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONPolygon} EsriJSON geometry.
 */
function writePolygonGeometry(polygon: Polygon, options?: WriteOptions): EsriJSONPolygon {
  // Esri geometries use the left-hand rule
  const hasZM = getHasZM(polygon);
  return {
    hasZ: hasZM.hasZ,
    hasM: hasZM.hasM,
    rings: /** @type {Array<Array<EsriJSONPosition>>} */ (
      polygon.getCoordinates(false)
    ),
  };
}

/**
 * @param {import("../geom/MultiLineString").default} multiLineString Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONPolyline} EsriJSON geometry.
 */
function writeMultiLineStringGeometry(multiLineString: MultiLineString, options?: WriteOptions): EsriJSONPolyline {
  const hasZM = getHasZM(multiLineString);
  return {
    hasZ: hasZM.hasZ,
    hasM: hasZM.hasM,
    paths: /** @type {Array<Array<EsriJSONPosition>>} */ (
      multiLineString.getCoordinates()
    ),
  };
}

/**
 * @param {import("../geom/MultiPoint").default} multiPoint Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONMultipoint} EsriJSON geometry.
 */
function writeMultiPointGeometry(multiPoint: MultiPoint, options?: WriteOptions): EsriJSONMultiPoint {
  const hasZM = getHasZM(multiPoint);
  return {
    hasZ: hasZM.hasZ,
    hasM: hasZM.hasM,
    points: /** @type {Array<EsriJSONPosition>} */ (
      multiPoint.getCoordinates()
    ),
  };
}

/**
 * @param {import("../geom/MultiPolygon").default} geometry Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONPolygon} EsriJSON geometry.
 */
function writeMultiPolygonGeometry(geometry: MultiPolygon, options?: WriteOptions): EsriJSONPolygon {
  const hasZM = getHasZM(geometry);
  const coordinates = geometry.getCoordinates(false);
  const output = [];
  for (let i = 0; i < coordinates.length; i++) {
    for (let x = coordinates[i].length - 1; x >= 0; x--) {
      output.push(coordinates[i][x]);
    }
  }
  return {
    hasZ: hasZM.hasZ,
    hasM: hasZM.hasM,
    rings: /** @type {Array<Array<EsriJSONPosition>>} */ (output),
  };
}

/**
 * @param {import("../geom/Geometry").default} geometry Geometry.
 * @param {import("./Feature").WriteOptions} [options] Write options.
 * @return {EsriJSONGeometry} EsriJSON geometry.
 */
function writeGeometry(geometry: Geometry, options?: WriteOptions): EsriJSONGeometry {
  const geometryWriter = GEOMETRY_WRITERS[geometry.getType()];
  return geometryWriter(
    transformGeometryWithOptions(geometry, true, options),
    options
  );
}

export default EsriJSON;
