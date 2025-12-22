import * as responses from '../../src';

describe('Public API (exports)', () => {
  test('does not change exported runtime keys accidentally', () => {
    const keys = Object.keys(responses).sort();
    expect(keys).toEqual([
      'CODING_SCHEME_STATUS',
      'CONCAT_SUM_VALID_STATES',
      'COPY_SOLVER_VALID_STATES',
      'CodingEngine',
      'CodingFactory',
      'CodingFormatter',
      'CodingSchemeEngine',
      'CodingSchemeFactory',
      'CodingSchemeTextFactory',
      'CodingSchemeTextRenderer',
      'CodingTextRenderer',
      'DERIVE_PENDING_STATUSES',
      'MANUAL_VALID_STATES',
      'PARTLY_DISPLAYED_STATUSES',
      'ResponseCoder',
      'SchemeCoder',
      'ToTextFactory',
      'VALID_STATES_TO_START_DERIVE_PENDING_CHECK',
      'VariableList'
    ]);
  });
});
