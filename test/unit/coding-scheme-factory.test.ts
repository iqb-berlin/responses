import { Response } from '@iqbspecs/response/response.interface';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import {
  CodeData,
  SourceProcessingType,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { CodingFactory, CodingSchemeFactory } from '../../src';
import { executeDependencyPlan } from '../../src/derive/dependency-plan';
import { applyDerivationsAndCoding } from '../../src/derive/derivation-traversal';

describe('CodingSchemeFactory', () => {
  test('can be subclassed (covers instance property initialization)', () => {
    class TestFactory extends CodingSchemeFactory {}
    const f = new TestFactory();
    expect(f.variableCodings).toEqual([]);
  });

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

    test('SUM_CODE returns DERIVE_ERROR when a declared source response is missing', () => {
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

      const result = CodingSchemeFactory.deriveValue([coding], coding, [src]);
      expect(result.status).toBe('DERIVE_ERROR');
      expect(result.value).toBeNull();
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

    test('detects RULE_PARAMETER_COUNT_MISMATCH for invalid MATCH_REGEX pattern', () => {
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
              rules: [{ method: 'MATCH_REGEX', parameters: ['['] }]
            }
          ]
        }
      ];

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(
          p => p.type === 'RULE_PARAMETER_COUNT_MISMATCH' && p.breaking
        )
      ).toBe(true);
    });

    test('detects RULE_PARAMETER_COUNT_MISMATCH for non-numeric NUMERIC_MIN parameter', () => {
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
              rules: [{ method: 'NUMERIC_MIN', parameters: ['abc'] }]
            }
          ]
        }
      ];

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(
          p => p.type === 'RULE_PARAMETER_COUNT_MISMATCH' && p.breaking
        )
      ).toBe(true);
    });

    test('detects RULE_PARAMETER_COUNT_MISMATCH for reversed NUMERIC_RANGE bounds', () => {
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
              rules: [{ method: 'NUMERIC_RANGE', parameters: ['10', '5'] }]
            }
          ]
        }
      ];

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(
          p => p.type === 'RULE_PARAMETER_COUNT_MISMATCH' && p.breaking
        )
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

    test('detects MORE_THAN_ONE_SOURCE for COPY_VALUE with multiple sources', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' },
        { id: 'v2' }
      ] as unknown as VariableInfo[];

      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'COPY_VALUE',
        deriveSources: ['v1', 'v2'],
        codes: []
      } as VariableCodingData;

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(problems.some(p => p.type === 'MORE_THAN_ONE_SOURCE')).toBe(
        true
      );
      expect(
        problems.some(p => p.type === 'MORE_THAN_ONE_SOURCE' && !p.breaking)
      ).toBe(true);
    });

    test('detects VALUE_COPY_NOT_FROM_BASE when COPY_VALUE references derived var', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' }
      ] as unknown as VariableInfo[];

      const derived: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d1'),
        sourceType: 'SUM_SCORE',
        deriveSources: ['v1', 'v1'],
        codes: []
      } as VariableCodingData;

      const copy: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d2'),
        sourceType: 'COPY_VALUE',
        deriveSources: ['d1'],
        codes: []
      } as VariableCodingData;

      const problems = CodingSchemeFactory.validate(baseVars, [derived, copy]);
      expect(problems.some(p => p.type === 'VALUE_COPY_NOT_FROM_BASE')).toBe(
        true
      );
    });

    test('detects ONLY_ONE_SOURCE for non-COPY derived variables', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' }
      ] as unknown as VariableInfo[];

      const derived: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'SUM_SCORE',
        deriveSources: ['v1'],
        codes: []
      } as VariableCodingData;

      const problems = CodingSchemeFactory.validate(baseVars, [derived]);
      expect(problems.some(p => p.type === 'ONLY_ONE_SOURCE')).toBe(true);
      expect(
        problems.some(p => p.type === 'ONLY_ONE_SOURCE' && !p.breaking)
      ).toBe(true);
    });

    test('detects RULE_PARAMETER_COUNT_MISMATCH for invalid valueArrayPos string and negative numeric', () => {
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
              valueArrayPos: 'NOPE',
              ruleOperatorAnd: false,
              rules: [{ method: 'IS_EMPTY' }]
            }
          ]
        },
        {
          id: 2,
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              valueArrayPos: -1,
              ruleOperatorAnd: false,
              rules: [{ method: 'IS_EMPTY' }]
            }
          ]
        }
      ];

      const problems = CodingSchemeFactory.validate(baseVars, [coding]);
      expect(
        problems.some(
          p => p.type === 'RULE_PARAMETER_COUNT_MISMATCH' && p.breaking
        )
      ).toBe(true);
    });

    test('detects INVALID_SOURCE for duplicate base variable ids in var info list', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' },
        { id: 'v1' }
      ] as unknown as VariableInfo[];

      const problems = CodingSchemeFactory.validate(baseVars, []);
      expect(
        problems.some(p => p.type === 'INVALID_SOURCE' && p.breaking)
      ).toBe(true);
    });

    test('emits VACANT for non-BASE_NO_VALUE variable with no codes and not copied', () => {
      const baseVars: VariableInfo[] = [
        { id: 'v1' }
      ] as unknown as VariableInfo[];

      const v1 = CodingFactory.createCodingVariable('v1');
      v1.codes = [];
      v1.sourceParameters = { processing: [] };

      const problems = CodingSchemeFactory.validate(baseVars, [v1]);
      expect(problems.some(p => p.type === 'VACANT')).toBe(true);
    });
  });

  describe('getBaseVarsList', () => {
    test('returns base variable aliases required for a derived variable (recursive) and de-duplicates', () => {
      const base1: VariableCodingData = {
        ...CodingFactory.createCodingVariable('ID_1'),
        alias: 'B1',
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const base2: VariableCodingData = {
        ...CodingFactory.createCodingVariable('ID_2'),
        alias: 'B2',
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const d1: VariableCodingData = {
        ...CodingFactory.createCodingVariable('D1'),
        alias: 'D1',
        sourceType: 'SUM_SCORE',
        deriveSources: ['ID_1', 'ID_2'],
        codes: []
      } as VariableCodingData;

      const d2: VariableCodingData = {
        ...CodingFactory.createCodingVariable('D2'),
        alias: 'D2',
        sourceType: 'SUM_SCORE',
        deriveSources: ['D1', 'ID_1'],
        codes: []
      } as VariableCodingData;

      const list = CodingSchemeFactory.getBaseVarsList(
        ['D2'],
        [base1, base2, d1, d2]
      );
      expect(new Set(list)).toEqual(new Set(['B1', 'B2']));
    });

    test('returns empty list for unknown aliases', () => {
      const list = CodingSchemeFactory.getBaseVarsList([], []);
      expect(list).toEqual([]);
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

    test('keeps subforms separated when mapping ids and returning results', () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('ID_1'),
        alias: 'ALIAS_1',
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const coded = CodingSchemeFactory.code(
        [
          {
            id: 'ALIAS_1',
            value: 1,
            status: 'VALUE_CHANGED',
            subform: 'S1'
          } as Response,
          {
            id: 'ALIAS_1',
            value: 2,
            status: 'VALUE_CHANGED',
            subform: 'S2'
          } as Response
        ],
        [coding]
      );

      expect(coded).toHaveLength(2);
      expect(coded.every(r => r.id === 'ALIAS_1')).toBe(true);
      expect(new Set(coded.map(r => r.subform))).toEqual(
        new Set(['S1', 'S2'])
      );
    });

    test('removes a base response when a derived variable with the same id exists and base is unset-like', () => {
      const derived: VariableCodingData = {
        ...CodingFactory.createCodingVariable('v1'),
        sourceType: 'COPY_VALUE',
        deriveSources: ['base1'],
        codes: []
      } as VariableCodingData;

      const base: VariableCodingData = {
        ...CodingFactory.createCodingVariable('v1'),
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const base1 = CodingFactory.createCodingVariable('base1');
      base1.sourceType = 'BASE';
      base1.sourceParameters = { processing: [] };

      const coded = CodingSchemeFactory.code(
        [
          // base response for v1 is effectively unset-like (no code/score and not coded)
          { id: 'v1', value: null, status: 'UNSET' } as Response,
          // source for derived v1
          { id: 'base1', value: 7, status: 'VALUE_CHANGED' } as Response
        ],
        [base1, base, derived]
      );

      // should keep only one v1 response (the derived placeholder/response, not the original base one)
      const v1Responses = coded.filter(r => r.id === 'v1');
      expect(v1Responses).toHaveLength(1);
    });

    test('handles derivation errors by calling onError and setting DERIVE_ERROR', () => {
      const base1: VariableCodingData = {
        ...CodingFactory.createCodingVariable('base1'),
        sourceType: 'BASE',
        sourceParameters: { processing: ['TAKE_EMPTY_AS_VALID'] },
        codes: []
      } as VariableCodingData;

      const derived: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d1'),
        sourceType: 'COPY_VALUE',
        deriveSources: ['base1'],
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const circularValue: unknown = {};
      (circularValue as { self?: unknown }).self = circularValue;

      const onError = jest.fn();
      const coded = CodingSchemeFactory.code(
        [
          {
            id: 'base1',
            value: circularValue as never,
            status: 'VALUE_CHANGED'
          } as Response
        ],
        [base1, derived],
        { onError }
      );

      expect(coded.find(r => r.id === 'd1')?.status).toBe('DERIVE_ERROR');
      expect(onError).toHaveBeenCalled();
    });

    test('skips dependency evaluation when a dependency has no response (BASE_NO_VALUE)', () => {
      const baseNoValue: VariableCodingData = {
        ...CodingFactory.createCodingVariable('nv1'),
        sourceType: 'BASE_NO_VALUE',
        codes: []
      } as VariableCodingData;

      const base: VariableCodingData = {
        ...CodingFactory.createCodingVariable('b1'),
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      const coded = CodingSchemeFactory.code(
        [{ id: 'b1', value: 1, status: 'VALUE_CHANGED' } as Response],
        [baseNoValue, base]
      );

      expect(coded.some(r => r.id === 'b1')).toBe(true);
    });

    test('skips a dependency node when it has no response', () => {
      const responses: Response[] = [
        { id: 'b1', value: 1, status: 'VALUE_CHANGED' } as Response
      ];

      const base: VariableCodingData = {
        ...CodingFactory.createCodingVariable('b1'),
        sourceType: 'BASE',
        sourceParameters: { processing: [] },
        codes: []
      } as VariableCodingData;

      // Create a dependency node for an id that has no response/coding.
      const deps = [
        {
          id: 'missing',
          level: 0,
          sources: [],
          page: ''
        }
      ];

      // Exercise dependency execution defensively when a node has no matching response/coding.
      expect(() => executeDependencyPlan(
        responses,
        [base],
        { varDependencies: deps, globalDeriveError: false },
        applyDerivationsAndCoding,
        {}
      )
      ).not.toThrow();
    });
  });
});
