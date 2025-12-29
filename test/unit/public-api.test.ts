import * as responses from '../../src';

describe('Public API (exports)', () => {
  test('does not change exported runtime keys accidentally', () => {
    const keys = Object.keys(responses).sort();
    expect(keys).toEqual([
      'CodingEngine',
      'CodingFactory',
      'CodingFormatter',
      'CodingSchemeEngine',
      'CodingSchemeFactory',
      'CodingSchemeTextFactory',
      'CodingSchemeTextRenderer',
      'CodingTextRenderer',
      'ResponseCoder',
      'SchemeCoder',
      'ToTextFactory',
      'VariableList'
    ]);
  });
});
