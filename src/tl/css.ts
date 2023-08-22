/**
 * @module tl/css
 */

export interface FontParameters
{
    style: string,
    variant: string,
    weight: string,
    size: string,
    lineHeight: string,
    family: string,
    families: string[]
}

/**
 * The CSS class for hidden feature.
 *
 * @const
 * @type {string}
 */
export const CLASS_HIDDEN: string = 'tl-hidden';

/**
 * The CSS class that we'll give the DOM elements to have them selectable.
 *
 * @const
 * @type {string}
 */
export const CLASS_SELECTABLE: string = 'tl-selectable';

/**
 * The CSS class that we'll give the DOM elements to have them unselectable.
 *
 * @const
 * @type {string}
 */
export const CLASS_UNSELECTABLE: string = 'tl-unselectable';

/**
 * The CSS class for unsupported feature.
 *
 * @const
 * @type {string}
 */
export const CLASS_UNSUPPORTED: string = 'tl-unsupported';

/**
 * The CSS class for controls.
 *
 * @const
 * @type {string}
 */
export const CLASS_CONTROL: string = 'tl-control';

/**
 * The CSS class that we'll give the DOM elements that are collapsed, i.e.
 * to those elements which usually can be expanded.
 *
 * @const
 * @type {string}
 */
export const CLASS_COLLAPSED: string = 'tl-collapsed';

/**
 * From https://stackoverflow.com/questions/10135697/regex-to-parse-any-css-font
 * @type {RegExp}
 */
const fontRegEx: RegExp = new RegExp(
  [
    '^\\s*(?=(?:(?:[-a-z]+\\s*){0,2}(italic|oblique))?)',
    '(?=(?:(?:[-a-z]+\\s*){0,2}(small-caps))?)',
    '(?=(?:(?:[-a-z]+\\s*){0,2}(bold(?:er)?|lighter|[1-9]00 ))?)',
    '(?:(?:normal|\\1|\\2|\\3)\\s*){0,3}((?:xx?-)?',
    '(?:small|large)|medium|smaller|larger|[\\.\\d]+(?:\\%|in|[cem]m|ex|p[ctx]))',
    '(?:\\s*\\/\\s*(normal|[\\.\\d]+(?:\\%|in|[cem]m|ex|p[ctx])?))',
    '?\\s*([-,\\"\\\'\\sa-z]+?)\\s*$',
  ].join(''),
  'i'
);
const fontRegExMatchIndex: string[] = [
  'style',
  'variant',
  'weight',
  'size',
  'lineHeight',
  'family',
];

/**
 * Get the list of font families from a font spec.  Note that this doesn't work
 * for font families that have commas in them.
 * @param {string} fontSpec The CSS font property.
 * @return {FontParameters|null} The font parameters (or null if the input spec is invalid).
 */
export const getFontParameters = function (fontSpec: string): FontParameters | null {
  const match = fontSpec.match(fontRegEx);
  if (!match) {
    return null;
  }
  const style = {
    lineHeight: 'normal',
    size: '1.2em',
    style: 'normal',
    weight: 'normal',
    variant: 'normal',
      family: null,
      families: null
  } as FontParameters;

  for (let i = 0, ii = fontRegExMatchIndex.length; i < ii; ++i) {
    const value = match[i + 1];
    if (value !== undefined) {
      style[fontRegExMatchIndex[i]] = value;
    }
  }

  style.families = style.family.split(/,\s?/);
  return style;
};
