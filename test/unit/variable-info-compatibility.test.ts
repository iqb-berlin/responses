import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import {
  CodingFactory,
  CodingSchemeFactory,
  LegacyVariableInfo,
  ToTextFactory,
  VariableInfoInput,
  VariableList
} from '../../src';

const legacy: LegacyVariableInfo = {
  id: 'answer',
  type: 'string',
  format: 'ggb-file',
  multiple: false,
  nullable: false,
  values: [],
  valuePositionLabels: [],
  page: 'P1',
  visualAnchor: 'answer-widget'
};
const current: VariableInfo = { ...legacy, type: 'STRING', format: 'GGB_FILE' };

describe('VariableInfo 1.x/2.1 compatibility', () => {
  test('formats a published 2.1 type like legacy input and keeps legacy page text', () => {
    expect(ToTextFactory.varInfoAsText(current)).toEqual(ToTextFactory.varInfoAsText(legacy));
    expect(ToTextFactory.varInfoAsText(current)).toContain('Variable ist auf Seite "P1" verortet');
  });

  test.each(['STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'ATTACHMENT', 'JSON', 'NO_VALUE'] as const)(
    'accepts a minimal %s schema payload without changing it', type => {
      const info = Object.freeze({ id: 'minimal', type });
      expect(ToTextFactory.varInfoAsText(info)).toHaveLength(1);
      expect(ToTextFactory.varInfoAsText(info)[0]).not.toContain('unbekannt');
      const list = new VariableList([info]);
      expect(list.variables).toEqual([info]);
      expect(info).toEqual({ id: 'minimal', type });
    }
  );

  test('formats schema values with omitted labels and position metadata', () => {
    const info: VariableInfoInput = Object.freeze({
      id: 'value',
      type: 'STRING',
      values: Object.freeze([{ value: 'A' }, { value: 2 }, { value: false }])
    });
    const before = JSON.stringify(info);
    expect(ToTextFactory.varInfoAsText(info)).toEqual([
      'Datentyp: String/Text',
      'Mögliche Werte: "A"; "2"; "Nein/Falsch"'
    ]);
    expect(JSON.stringify(info)).toBe(before);
  });

  test('keeps legacy and current spellings, page and extension fields when cleaning ids', () => {
    const input = [
      { ...legacy, id: ' old ', extension: { source: 'v1' } },
      { ...current, id: ' current ', extension: { source: 'v2' } }
    ];
    const before = JSON.stringify(input);
    const list = new VariableList(input);
    expect(list.variables).toEqual([
      { ...input[0], id: 'old' },
      { ...input[1], id: 'current' }
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('retains the legacy contract for an explicitly typed empty list', () => {
    const list: VariableList = new VariableList(null);
    list.variables.push(legacy);
    const infos: LegacyVariableInfo[] = list.variables;
    expect(infos[0].type).toBe('string');
    expect(infos[0].page).toBe('P1');
  });

  test('validates a minimal NO_VALUE state and a mixed legacy/current list', () => {
    const state = { id: 'state', type: 'NO_VALUE' } as const;
    const stateCoding = CodingFactory.createCodingVariable('state');
    stateCoding.sourceType = 'BASE_NO_VALUE';
    const infos = Object.freeze([legacy, { ...current, id: 'other' }, state]);
    expect(CodingSchemeFactory.validate(infos, [stateCoding])).toEqual([]);
  });

  test('keeps omitted multiple metadata unknown without adding validation errors', () => {
    const info = Object.freeze({ id: 'number', type: 'NUMBER' } as const);
    const coding = CodingFactory.createCodingVariable('number');
    coding.codes = [{
      id: 1,
      type: 'FULL_CREDIT',
      score: 1,
      ruleSets: [{ valueArrayPos: 0, rules: [{ method: 'NUMERIC_MATCH', parameters: ['1'] }] }]
    }];
    const problems = CodingSchemeFactory.validate([info], [coding]);
    expect(problems).toEqual([]);
    const explicitScalarProblems = CodingSchemeFactory.validate([{ ...info, multiple: false }], [coding]);
    expect(explicitScalarProblems.some(problem => problem.type === 'RULESET_VALUE_ARRAY_POS_INVALID')).toBe(true);
    expect(info).toEqual({ id: 'number', type: 'NUMBER' });
  });
});
