import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodingFactory, CodingSchemeFactory } from '../../src';

describe('stable 5.4.0 regular-expression compatibility', () => {
  test.each([
    ['umlauts', '^[äöü]+$', 'äöü'],
    ['lookahead', '^(?=abc$)abc$', 'abc'],
    ['lookbehind', '(?<=a)b', 'ab'],
    ['backreferences', '^(ab)\\1$', 'abab'],
    ['Unicode escapes', '^\\u00e4$', 'ä'],
    ['hexadecimal escapes', '^\\x61$', 'a']
  ])('validates and codes %s', (description, pattern, value) => {
    const coding = CodingFactory.createCodingVariable('text');
    coding.codes = [{
      id: 1,
      type: 'FULL_CREDIT',
      score: 1,
      ruleSets: [{ ruleOperatorAnd: false, rules: [{ method: 'MATCH_REGEX', parameters: [pattern] }] }]
    }];
    const variables = [{
      id: 'text', type: 'string', multiple: false, values: [], valuePositionLabels: []
    }] as unknown as VariableInfo[];
    expect(CodingSchemeFactory.validate(variables, [coding])).toEqual([]);

    const onError = jest.fn();
    const response = { id: 'text', status: 'VALUE_CHANGED' as const, value };
    expect(CodingFactory.code(response, coding, { onError })).toEqual({
      ...response, status: 'CODING_COMPLETE', code: 1, score: 1
    });
    expect(onError).not.toHaveBeenCalled();
    expect(response).toEqual({ id: 'text', status: 'VALUE_CHANGED', value });
  });
});
