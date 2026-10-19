import { CodingFactory } from '../../src';

describe('stable 5.3.1 regular-expression compatibility', () => {
  test.each([
    ['umlauts', '^[äöü]+$', 'äöü'],
    ['lookahead', '^(?=abc$)abc$', 'abc'],
    ['lookbehind', '(?<=a)b', 'ab'],
    ['backreferences', '^(ab)\\1$', 'abab'],
    ['Unicode escapes', '^\\u00e4$', 'ä'],
    ['hexadecimal escapes', '^\\x61$', 'a']
  ])('continues to match %s', (description, pattern, value) => {
    const coding = CodingFactory.createCodingVariable('text');
    coding.codes = [{
      id: 1,
      type: 'FULL_CREDIT',
      score: 1,
      ruleSets: [{ ruleOperatorAnd: false, rules: [{ method: 'MATCH_REGEX', parameters: [pattern] }] }]
    }];
    expect(CodingFactory.code({ id: 'text', status: 'VALUE_CHANGED', value }, coding)).toMatchObject({
      status: 'CODING_COMPLETE', code: 1, score: 1
    });
  });
});
