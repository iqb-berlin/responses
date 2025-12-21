import { Response } from '@iqbspecs/response/response.interface';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import {
  CodeData,
  SourceProcessingType,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { CodingFactory, CodingSchemeFactory } from '../../src';

describe('CodingSchemeFactory', () => {
  describe('getVariableDependencyTree', () => {
    test('orders derived variables by dependency level', () => {
      const v1 = CodingFactory.createCodingVariable('v1');
      const v2 = CodingFactory.createCodingVariable('v2');

      const d1: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d1'),
        sourceType: 'COPY_VALUE',
        deriveSources: ['v1'],
        codes: []
      } as VariableCodingData;

      const d2: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d2'),
        sourceType: 'SUM_SCORE',
        deriveSources: ['d1', 'v2'],
        codes: []
      } as VariableCodingData;

      const tree = CodingSchemeFactory.getVariableDependencyTree([
        v1,
        v2,
        d1,
        d2
      ]);
      expect(tree.find(n => n.id === 'v1')?.level).toBe(0);
      expect(tree.find(n => n.id === 'd1')?.level).toBe(1);
      expect(tree.find(n => n.id === 'd2')?.level).toBe(2);
    });

    test('throws on circular dependencies', () => {
      const a: VariableCodingData = {
        ...CodingFactory.createCodingVariable('a'),
        sourceType: 'SUM_SCORE',
        deriveSources: ['b'],
        codes: []
      } as VariableCodingData;

      const b: VariableCodingData = {
        ...CodingFactory.createCodingVariable('b'),
        sourceType: 'SUM_SCORE',
        deriveSources: ['a'],
        codes: []
      } as VariableCodingData;

      expect(() => CodingSchemeFactory.getVariableDependencyTree([a, b])
      ).toThrow(/Circular dependency/);
    });
  });

  describe('deriveValue', () => {
    test('COPY_VALUE returns DERIVE_PENDING if any source is pending', () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'COPY_VALUE',
        deriveSources: ['v1'],
        codes: []
      } as VariableCodingData;

      const src: Response = {
        id: 'v1',
        value: null,
        status: 'DERIVE_PENDING'
      } as Response;

      const result = CodingSchemeFactory.deriveValue([coding], coding, [src]);
      expect(result.status).toBe('DERIVE_PENDING');
      expect(result.value).toBeNull();
    });

    test('SUM_CODE throws DERIVE_ERROR when a declared source response is missing', () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'SUM_CODE',
        deriveSources: ['v1', 'v2'],
        codes: []
      } as VariableCodingData;

      const src: Response = {
        id: 'v1',
        value: null,
        status: 'CODING_COMPLETE',
        code: 2,
        score: 0
      } as Response;

      expect(() => CodingSchemeFactory.deriveValue([coding], coding, [src])
      ).toThrow(/not found/);
    });

    test('SOLVER returns DERIVE_ERROR if solver expression references sources not listed in deriveSources', () => {
      const dollar = '$';
      const leftBrace = '{';
      const rightBrace = '}';
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'SOLVER',
        deriveSources: ['v1'],
        sourceParameters: {
          solverExpression: `${dollar}${leftBrace}v1${rightBrace}+${dollar}${leftBrace}v2${rightBrace}`,
          processing: []
        },
        codes: []
      } as VariableCodingData;

      const src1: Response = {
        id: 'v1',
        value: 1,
        status: 'VALUE_CHANGED'
      } as Response;

      const result = CodingSchemeFactory.deriveValue([coding], coding, [src1]);
      expect(result.status).toBe('DERIVE_ERROR');
    });

    test('UNIQUE_VALUES returns false if duplicates exist (with TO_NUMBER)', () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'UNIQUE_VALUES',
        deriveSources: ['v1', 'v2'],
        sourceParameters: {
          processing: ['TO_NUMBER']
        },
        codes: []
      } as VariableCodingData;

      const r1: Response = {
        id: 'v1',
        value: '01',
        status: 'CODING_COMPLETE'
      } as Response;
      const r2: Response = {
        id: 'v2',
        value: 1,
        status: 'CODING_COMPLETE'
      } as Response;

      const result = CodingSchemeFactory.deriveValue([coding], coding, [
        r1,
        r2
      ]);
      expect(result.status).toBe('VALUE_CHANGED');
      expect(result.value).toBe(false);
    });
  });

  describe('validate', () => {
    test('detects RULE_PARAMETER_COUNT_MISMATCH', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' }
      ] as unknown as VariableInfo[];

      const coding = CodingFactory.createCodingVariable('v1');
      coding.codes = <CodeData[]>[
        {
          id: 1,
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              ruleOperatorAnd: false,
              rules: [{ method: 'NUMERIC_RANGE', parameters: ['0'] }]
            }
          ]
        }
      ];

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(p => p.type === 'RULE_PARAMETER_COUNT_MISMATCH')
      ).toBe(true);
    });

    test('detects SOURCE_MISSING for base variable not in var info list', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' }
      ] as unknown as VariableInfo[];
      const coding = CodingFactory.createCodingVariable('v_missing');

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(p => p.type === 'SOURCE_MISSING' && p.breaking)
      ).toBe(true);
    });

    test('detects INVALID_SOURCE if BASE variable points to VarInfo of type no-value', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1', type: 'no-value' }
      ] as unknown as VariableInfo[];
      const coding = CodingFactory.createCodingVariable('v1');

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(p => p.type === 'INVALID_SOURCE' && p.breaking)
      ).toBe(true);
    });

    test('detects INVALID_SOURCE if BASE_NO_VALUE variable points to VarInfo not of type no-value', () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('v1'),
        sourceType: 'BASE_NO_VALUE'
      } as VariableCodingData;
      const baseVars: VariableInfo[] = [
        { id: 'v1', type: 'string' }
      ] as unknown as VariableInfo[];

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(p => p.type === 'INVALID_SOURCE' && p.breaking)
      ).toBe(true);
    });

    test('detects INVALID_SOURCE for duplicate coding ids', () => {
      const baseVars: VariableInfo[] = [] as unknown as VariableInfo[];
      const v1 = CodingFactory.createCodingVariable('v1');
      const v1dup = CodingFactory.createCodingVariable('v1');

      const problems = CodingSchemeFactory.validate(baseVars, [v1, v1dup]);
      expect(
        problems.some(p => p.type === 'INVALID_SOURCE' && p.breaking)
      ).toBe(true);
    });

    test('detects INVALID_SOURCE for duplicate aliases', () => {
      const baseVars: VariableInfo[] = [] as unknown as VariableInfo[];
      const v1: VariableCodingData = {
        ...CodingFactory.createCodingVariable('v1'),
        alias: 'a'
      } as VariableCodingData;
      const v2: VariableCodingData = {
        ...CodingFactory.createCodingVariable('v2'),
        alias: 'a'
      } as VariableCodingData;

      const problems = CodingSchemeFactory.validate(baseVars, [v1, v2]);
      expect(
        problems.some(p => p.type === 'INVALID_SOURCE' && p.breaking)
      ).toBe(true);
    });

    test('detects INVALID_SOURCE when an alias collides with another variable id', () => {
      const baseVars: VariableInfo[] = [] as unknown as VariableInfo[];
      const v1: VariableCodingData = {
        ...CodingFactory.createCodingVariable('v1'),
        alias: 'v2'
      } as VariableCodingData;
      const v2 = CodingFactory.createCodingVariable('v2');

      const problems = CodingSchemeFactory.validate(baseVars, [v1, v2]);
      expect(
        problems.some(p => p.type === 'INVALID_SOURCE' && p.breaking)
      ).toBe(true);
    });
  });

  describe('code', () => {
    test('marks empty string as INVALID for BASE unless TAKE_EMPTY_AS_VALID is set', () => {
      const v1 = CodingFactory.createCodingVariable('v1');
      v1.sourceParameters = v1.sourceParameters || { processing: [] };
      v1.sourceParameters.processing = [];

      const responses: Response[] = [
        { id: 'v1', value: '', status: 'VALUE_CHANGED' } as Response
      ];

      const coded = CodingSchemeFactory.code(responses, [v1]);
      expect(coded.find(r => r.id === 'v1')?.status).toBe('INVALID');

      const v1ok = CodingFactory.createCodingVariable('v1');
      v1ok.sourceParameters = v1ok.sourceParameters || { processing: [] };
      v1ok.sourceParameters.processing = [
        'TAKE_EMPTY_AS_VALID' as SourceProcessingType
      ];
      const codedOk = CodingSchemeFactory.code(responses, [v1ok]);
      expect(codedOk.find(r => r.id === 'v1')?.status).toBe('VALUE_CHANGED');
    });

    test('maps response ids from alias to id and back to alias', () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('ID_1'),
        alias: 'ALIAS_1',
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const coded = CodingSchemeFactory.code(
        [{ id: 'ALIAS_1', value: 1, status: 'VALUE_CHANGED' } as Response],
        [coding]
      );

      expect(coded[0].id).toBe('ALIAS_1');
    });
  });
});
