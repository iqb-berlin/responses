// VariableInfo 1.x spells type and format in lower case with hyphens
// (`no-value`, `ggb-file`), 2.x in upper case with underscores (`NO_VALUE`,
// `GGB_FILE`). Both occur side by side: stored units keep the list their editor
// wrote, and not every editor moves to 2.x. 2.x has exactly the values of 1.x,
// so mapping 1.x to 2.x is lossless. The chemistry formats of 2.1 never had a
// 1.x spelling; readers that only take 1.x (the unit XSD) get them by the same
// rule, lower case with hyphens (`chem-molecule`).
//
// Normalize for decisions and lookups only. Data a consumer stores or passes on
// keeps the spelling it came with, or an older reader would get values it
// cannot handle.

const TYPE_V1_TO_V2: Readonly<Record<string, string>> = {
  string: 'STRING',
  integer: 'INTEGER',
  number: 'NUMBER',
  boolean: 'BOOLEAN',
  attachment: 'ATTACHMENT',
  json: 'JSON',
  'no-value': 'NO_VALUE',
  coded: 'CODED'
};

const FORMAT_V1_TO_V2: Readonly<Record<string, string>> = {
  'text-selection': 'TEXT_SELECTION',
  image: 'IMAGE',
  'capture-image': 'CAPTURE_IMAGE',
  audio: 'AUDIO',
  'ggb-file': 'GGB_FILE',
  'non-negative': 'NON_NEGATIVE',
  latex: 'LATEX',
  'math-ml': 'MATH_ML',
  'math-table': 'MATH_TABLE',
  'math-text-mix': 'MATH_TEXT_MIX',
  'ggb-variable': 'GGB_VARIABLE',
  'chem-element-symbols': 'CHEM_ELEMENT_SYMBOLS',
  'chem-molecule': 'CHEM_MOLECULE'
};

const lookUp = (table: Readonly<Record<string, string>>, value: string): string => (
  Object.prototype.hasOwnProperty.call(table, value) ? table[value] : value
);

/**
 * Returns the VariableInfo 2.x spelling of a type (`no-value` → `NO_VALUE`).
 * Values already in 2.x spelling and unknown values are returned unchanged.
 */
export const normalizeVariableInfoType = (type: string): string => lookUp(TYPE_V1_TO_V2, type);

/**
 * Returns the VariableInfo 2.x spelling of a format (`ggb-file` → `GGB_FILE`).
 * Values already in 2.x spelling, unknown values and `''` are returned unchanged.
 */
export const normalizeVariableInfoFormat = (format: string): string => lookUp(FORMAT_V1_TO_V2, format);
