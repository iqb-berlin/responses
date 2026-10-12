import { normalizeVariableInfoFormat, normalizeVariableInfoType } from '../../src';

const TYPES: [string, string][] = [
  ['string', 'STRING'],
  ['integer', 'INTEGER'],
  ['number', 'NUMBER'],
  ['boolean', 'BOOLEAN'],
  ['attachment', 'ATTACHMENT'],
  ['json', 'JSON'],
  ['no-value', 'NO_VALUE'],
  ['coded', 'CODED']
];

const FORMATS: [string, string][] = [
  ['text-selection', 'TEXT_SELECTION'],
  ['image', 'IMAGE'],
  ['capture-image', 'CAPTURE_IMAGE'],
  ['audio', 'AUDIO'],
  ['ggb-file', 'GGB_FILE'],
  ['non-negative', 'NON_NEGATIVE'],
  ['latex', 'LATEX'],
  ['math-ml', 'MATH_ML'],
  ['math-table', 'MATH_TABLE'],
  ['math-text-mix', 'MATH_TEXT_MIX'],
  ['ggb-variable', 'GGB_VARIABLE']
];

describe('VariableInfo spelling', () => {
  test.each(TYPES)('normalizes type %s to %s', (v1, v2) => {
    expect(normalizeVariableInfoType(v1)).toBe(v2);
    expect(normalizeVariableInfoType(v2)).toBe(v2);
  });

  test.each(FORMATS)('normalizes format %s to %s', (v1, v2) => {
    expect(normalizeVariableInfoFormat(v1)).toBe(v2);
    expect(normalizeVariableInfoFormat(v2)).toBe(v2);
  });

  test.each(['', 'CHEM_ELEMENT_SYMBOLS', 'CHEM_MOLECULE', 'Fancy-Format', 'constructor', '__proto__'])(
    'leaves format "%s" unchanged',
    format => {
      expect(normalizeVariableInfoFormat(format)).toBe(format);
    }
  );

  test.each(['', 'fancy-type', 'String', 'constructor', 'toString'])('leaves type "%s" unchanged', type => {
    expect(normalizeVariableInfoType(type)).toBe(type);
  });

  test('does not mix up types and formats', () => {
    FORMATS.forEach(([v1]) => expect(normalizeVariableInfoType(v1)).toBe(v1));
    TYPES.forEach(([v1]) => expect(normalizeVariableInfoFormat(v1)).toBe(v1));
  });
});
