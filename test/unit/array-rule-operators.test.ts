import { CodingRule, RuleSet, VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingFactory } from '../../src';
import { isMatchRuleSet } from '../../src/rule-engine';

describe('array references and rule operators', () => {
  const alternatives: CodingRule[] = [
    { method: 'MATCH', parameters: ['A'] },
    { method: 'MATCH', parameters: ['B'] }
  ];

  test.each<['ANY' | 'ANY_OPEN', string[], boolean]>([
    ['ANY', ['A', 'B'], true],
    ['ANY', ['A', 'C'], false],
    ['ANY', ['B'], true],
    ['ANY', [], false],
    ['ANY_OPEN', ['A', 'C'], true],
    ['ANY_OPEN', ['C', 'B'], true],
    ['ANY_OPEN', ['B'], true],
    ['ANY_OPEN', ['C'], false],
    ['ANY_OPEN', [], false]
  ])('%s applies OR to each member of %j', (valueArrayPos, values, expected) => {
    expect(isMatchRuleSet(values, {
      valueArrayPos, ruleOperatorAnd: false, rules: alternatives
    }, true, [])).toBe(expected);
  });

  test.each(['ANY', 'ANY_OPEN'] as const)('%s keeps AND rules on the same member', valueArrayPos => {
    expect(isMatchRuleSet(['A', 'B'], {
      valueArrayPos, ruleOperatorAnd: true, rules: alternatives
    }, true, [])).toBe(false);
    expect(isMatchRuleSet(['A', 'A'], {
      valueArrayPos,
      ruleOperatorAnd: true,
      rules: [alternatives[0], { method: 'MATCH_REGEX', parameters: ['^A$'] }]
    }, true, [])).toBe(true);
  });

  test.each([false, true])('omitted references preserve legacy rule-wise matching (AND=%s)', ruleOperatorAnd => {
    const ruleSet: RuleSet = { ruleOperatorAnd, rules: alternatives };
    const restored: RuleSet = JSON.parse(JSON.stringify(ruleSet));
    expect(isMatchRuleSet(['A', 'B'], restored, true, [])).toBe(true);
    expect(restored).not.toHaveProperty('valueArrayPos');
    expect(isMatchRuleSet(['A', 'C'], restored, true, [])).toBe(!ruleOperatorAnd);
  });

  test.each([undefined, 'ANY', 'ANY_OPEN'] as const)('%s preserves IS_EMPTY on an empty array', valueArrayPos => {
    expect(isMatchRuleSet([], {
      ...(valueArrayPos ? { valueArrayPos } : {}),
      ruleOperatorAnd: false,
      rules: [{ method: 'IS_EMPTY' }]
    }, true, [])).toBe(true);
  });

  describe('fragmented marking responses from coding-components issue 276', () => {
    const rules: CodingRule[] = [
      { method: 'NUMERIC_MORE_THAN', parameters: ['74'], fragment: 0 },
      { method: 'NUMERIC_LESS_THAN', parameters: ['74'], fragment: 1 }
    ];
    const before = ['63-64-#f9f871', '66-67-#f9f871', '69-70-#f9f871', '72-73-#f9f871'];
    const after = ['75-76-#f9f871', '78-79-#f9f871', '81-81-#f9f871'];
    const mixed = [...before, ...after];
    const coding = (ruleSets: RuleSet[], ruleSetOperatorAnd = false): VariableCodingData => ({
      ...CodingFactory.createCodingVariable('marking'),
      fragmenting: '^(\\d+)-(\\d+)-#',
      codes: [{
        id: 41, type: 'NO_CREDIT', score: 0, ruleSetOperatorAnd, ruleSets
      }]
    });
    const code = (value: string[], scheme: VariableCodingData) => CodingFactory.code(
      { id: 'marking', status: 'VALUE_CHANGED', value }, JSON.parse(JSON.stringify(scheme))
    );

    test.each([[before], [after], [mixed]])('ANY with OR accepts only-outside selections %j', value => {
      const result = code(value, coding([{ valueArrayPos: 'ANY', ruleOperatorAnd: false, rules }]));
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(41);
      expect(result.score).toBe(0);
    });

    test('ANY rejects an additional target match while ANY_OPEN accepts the outside members', () => {
      const value = [...mixed, '74-74-#f9f871'];
      const ruleSet: RuleSet = { valueArrayPos: 'ANY', ruleOperatorAnd: false, rules };
      expect(code(value, coding([ruleSet])).status).toBe('CODING_INCOMPLETE');
      expect(code(value, coding([{ ...ruleSet, valueArrayPos: 'ANY_OPEN' }])).code).toBe(41);
    });

    test('two strict sets differ from one strict set containing OR alternatives', () => {
      const separate = coding(rules.map(rule => ({ valueArrayPos: 'ANY', rules: [rule] })));
      expect(code(before, separate).code).toBe(41);
      expect(code(after, separate).code).toBe(41);
      expect(code(mixed, separate).status).toBe('CODING_INCOMPLETE');
    });

    test('the original omitted references still match mixed selections after a JSON round trip', () => {
      const original = coding(rules.map(rule => ({ rules: [rule] })));
      const serialized = JSON.stringify(original);
      expect(code(mixed, original).code).toBe(41);
      expect(JSON.stringify(original)).toBe(serialized);
      expect(original.codes?.[0].ruleSets?.every(set => !('valueArrayPos' in set))).toBe(true);
    });
  });
});
