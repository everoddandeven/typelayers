/**
 * @module tl/proj/Units
 */

export type Units = 'radians' | 'degrees' | 'ft' | 'm' | 'pixels' | 'tile-pixels' | 'us-ft';

/**
 * See http://duff.ess.washington.edu/data/raster/drg/docs/geotiff.txt
 * @type {Object<number, Units>}
 */
const unitByCode: { [n: number]: Units; } = {
  '9001': 'm',
  '9002': 'ft',
  '9003': 'us-ft',
  '9101': 'radians',
  '9102': 'degrees',
};

/**
 * @param {number} code Unit code.
 * @return {Units} Units.
 */
export function fromCode(code: number): Units {
  return unitByCode[code];
}

export interface MetersPerUnitLookup
{
  radians: number,
  degrees: number,
  ft: number,
  m: number,
  us_ft: number
}


/**
 * Meters per unit lookup table.
 * @const
 * @type {MetersPerUnitLookup}
 * @api
 */
export const METERS_PER_UNIT: MetersPerUnitLookup = {
  // use the radius of the Normal sphere
  'radians': 6370997 / (2 * Math.PI),
  'degrees': (2 * Math.PI * 6370997) / 360,
  'ft': 0.3048,
  'm': 1,
  'us_ft': 1200 / 3937,
};
