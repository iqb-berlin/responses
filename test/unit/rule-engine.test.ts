import {
  CodingRule,
  ProcessingParameterType,
  RuleSet,
  TransformedResponseValueType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import { ResponseValueSingleType } from '@iqbspecs/response/response.interface';
import { checkOneValue, isMatchRuleSet } from '../../src/rule-engine';

describe('rule-engine', () => {
  describe('checkOneValue (table-driven)', () => {
    test.each<{
      title: string;
      value: ResponseValueSingleType;
      rule: CodingRule;
      processing?: ProcessingParameterType[];
      expected: boolean;
    }>([
      {
        title: 'IS_NULL matches null',
        value: null,
        rule: { method: 'IS_NULL', parameters: [] } as CodingRule,
        expected: true
      },
      {
        title: 'IS_EMPTY matches empty string',
        value: '',
        rule: { method: 'IS_EMPTY', parameters: [] } as CodingRule,
        expected: true
      },
      {
        title: 'MATCH matches with IGNORE_CASE',
        value: 'AbC',
        rule: { method: 'MATCH', parameters: ['abc'] } as CodingRule,
        processing: ['IGNORE_CASE' as ProcessingParameterType],
        expected: true
      },
      {
        title: 'MATCH_REGEX matches with IGNORE_CASE',
        value: 'AbC',
        rule: { method: 'MATCH_REGEX', parameters: ['^abc$'] } as CodingRule,
        processing: ['IGNORE_CASE' as ProcessingParameterType],
        expected: true
      },
      {
        title:
          'MATCH_REGEX with invalid regex does not throw and returns false',
        value: 'AbC',
        rule: { method: 'MATCH_REGEX', parameters: ['['] } as CodingRule,
        expected: false
      },
      {
        title: 'NUMERIC_MATCH matches numeric-like string',
        value: '01',
        rule: { method: 'NUMERIC_MATCH', parameters: ['1'] } as CodingRule,
        expected: true
      },
      {
        title: 'NUMERIC_RANGE is lower-exclusive, upper-inclusive',
        value: '5',
        rule: {
          method: 'NUMERIC_RANGE',
          parameters: ['5', '10']
        } as CodingRule,
        expected: false
      },
      {
        title: 'NUMERIC_FULL_RANGE is inclusive',
        value: '5',
        rule: {
          method: 'NUMERIC_FULL_RANGE',
          parameters: ['5', '10']
        } as CodingRule,
        expected: true
      },
      {
        title: 'IS_TRUE matches string true',
        value: 'true',
        rule: { method: 'IS_TRUE', parameters: [] } as CodingRule,
        expected: true
      },
      {
        title: 'IS_FALSE matches number 0',
        value: 0,
        rule: { method: 'IS_FALSE', parameters: [] } as CodingRule,
        expected: true
      }
    ])('$title', ({
      value, rule, processing, expected
    }) => {
      expect(checkOneValue(value, rule, processing ?? [])).toBe(expected);
    });
  });

  describe('isMatchRuleSet (table-driven)', () => {
    test.each<{
      title: string;
      valueToCheck: TransformedResponseValueType;
      isValueArray: boolean;
      ruleSet: RuleSet;
      processing?: ProcessingParameterType[];
      expected: boolean;
    }>([
      {
        title: 'OR rules: at least one matches',
        valueToCheck: 'A',
        isValueArray: false,
        ruleSet: {
          ruleOperatorAnd: false,
          rules: [
            { method: 'MATCH', parameters: ['B'] },
            { method: 'MATCH', parameters: ['A'] }
          ]
        } as RuleSet,
        expected: true
      },
      {
        title: 'AND rules: all must match',
        valueToCheck: 'A',
        isValueArray: false,
        ruleSet: {
          ruleOperatorAnd: true,
          rules: [
            { method: 'MATCH', parameters: ['A'] },
            { method: 'MATCH_REGEX', parameters: ['^A$'] }
          ]
        } as RuleSet,
        expected: true
      },
      {
        title: 'valueArrayPos=LENGTH compares array length',
        valueToCheck: ['a', 'b', 'c'],
        isValueArray: true,
        ruleSet: {
          valueArrayPos: 'LENGTH',
          ruleOperatorAnd: false,
          rules: [{ method: 'NUMERIC_MATCH', parameters: ['3'] }]
        } as RuleSet,
        expected: true
      },
      {
        title: 'valueArrayPos=SUM sums numeric-like members',
        valueToCheck: ['1', 2, '3'],
        isValueArray: true,
        ruleSet: {
          valueArrayPos: 'SUM',
          ruleOperatorAnd: false,
          rules: [{ method: 'NUMERIC_MATCH', parameters: ['6'] }]
        } as RuleSet,
        expected: true
      }
    ])(
      '$title',
      ({
        valueToCheck, ruleSet, isValueArray, processing, expected
      }) => {
        expect(
          isMatchRuleSet(valueToCheck, ruleSet, isValueArray, processing ?? [])
        ).toBe(expected);
      }
    );
  });
});
