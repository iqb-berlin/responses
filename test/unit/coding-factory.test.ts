import {
  Response,
  ResponseValueSingleType,
  ResponseValueType
} from '@iqbspecs/response/response.interface';
import {
  ProcessingParameterType,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { CodingFactory } from '../../src';

describe('CodingFactory', () => {
  describe('getValueAsNumber', () => {
    test('parses numbers, booleans, null/empty, and comma decimals', () => {
      expect(CodingFactory.getValueAsNumber(5)).toBe(5);
      expect(CodingFactory.getValueAsNumber(true)).toBe(1);
      expect(CodingFactory.getValueAsNumber(false)).toBe(0);
      expect(CodingFactory.getValueAsNumber(null)).toBe(0);
      expect(CodingFactory.getValueAsNumber('')).toBe(0);
      expect(CodingFactory.getValueAsNumber(' 1 234 ')).toBe(1234);
      expect(CodingFactory.getValueAsNumber(' -1,5 ')).toBe(-1.5);
    });

    test('returns null for non-numeric strings', () => {
      expect(CodingFactory.getValueAsNumber('abc')).toBeNull();
      expect(CodingFactory.getValueAsNumber('1.2.3')).toBeNull();
      expect(CodingFactory.getValueAsNumber('1,2,3')).toBeNull();
    });
  });

  describe('getValueAsString', () => {
    test('applies REMOVE_ALL_SPACES and TO_LOWER_CASE', () => {
      expect(
        CodingFactory.getValueAsString(' A  B ', [
          'REMOVE_ALL_SPACES',
          'TO_LOWER_CASE'
        ])
      ).toBe('ab');
    });

    test('applies REMOVE_DISPENSABLE_SPACES', () => {
      expect(
        CodingFactory.getValueAsString('  A   B  ', [
          'REMOVE_DISPENSABLE_SPACES'
        ])
      ).toBe('A B');
    });

    test('returns null for unsupported types', () => {
      expect(
        CodingFactory.getValueAsString({} as ResponseValueSingleType)
      ).toBeNull();
    });
  });

  describe('code', () => {
    const baseResponse = (value: ResponseValueType): Response => ({
      id: 'v1',
      value,
      status: 'VALUE_CHANGED'
    } as Response);
    const baseCoding = (): VariableCodingData => ({
      ...CodingFactory.createCodingVariable('v1'),
      processing: []
    });

    test('returns NO_CODING if no codes are defined', () => {
      const result = CodingFactory.code(baseResponse('x'), baseCoding());
      expect(result.status).toBe('NO_CODING');
    });

    test('applies else code RESIDUAL_AUTO when no rule matches', () => {
      const coding = baseCoding();
      coding.codes = [
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
              rules: [{ method: 'MATCH', parameters: ['A'] }]
            }
          ]
        },
        {
          id: 9,
          score: 0,
          label: '',
          type: 'RESIDUAL_AUTO',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: []
        }
      ];

      const result = CodingFactory.code(baseResponse('B'), coding);
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(9);
      expect(result.score).toBe(0);
    });

    test('uses matched rule even if an else code exists (else at end)', () => {
      const coding = baseCoding();
      coding.codes = [
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
              rules: [{ method: 'MATCH', parameters: ['A'] }]
            }
          ]
        },
        {
          id: 9,
          score: 0,
          label: '',
          type: 'RESIDUAL_AUTO',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: []
        }
      ];

      const result = CodingFactory.code(baseResponse('A'), coding);
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(1);
      expect(result.score).toBe(1);
    });

    test('uses matched rule even if else code comes first (else at beginning)', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 9,
          score: 0,
          label: '',
          type: 'RESIDUAL_AUTO',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: []
        },
        {
          id: 2,
          score: 2,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              ruleOperatorAnd: false,
              rules: [{ method: 'MATCH', parameters: ['A'] }]
            }
          ]
        }
      ];

      const result = CodingFactory.code(baseResponse('A'), coding);
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(2);
      expect(result.score).toBe(2);
    });

    test('applies else code INTENDED_INCOMPLETE when no rules match', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 7,
          score: 0,
          label: '',
          type: 'INTENDED_INCOMPLETE',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: []
        }
      ];

      const result = CodingFactory.code(baseResponse('X'), coding);
      expect(result.status).toBe('INTENDED_INCOMPLETE');
      expect(result.code).toBe(7);
      expect(result.score).toBe(0);
    });

    test('does not treat RESIDUAL (without _AUTO) as else fallback', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 9,
          score: 0,
          label: '',
          type: 'RESIDUAL',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: []
        }
      ];

      const result = CodingFactory.code(baseResponse('B'), coding);
      expect(result.status).toBe('CODING_INCOMPLETE');
    });

    test('sets status INVALID when a matched code id is the string INVALID', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 'INVALID',
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              ruleOperatorAnd: false,
              rules: [{ method: 'MATCH', parameters: ['A'] }]
            }
          ]
        }
      ];

      const result = CodingFactory.code(baseResponse('A'), coding);
      expect(result.status).toBe('INVALID');
      expect(result.code).toBe(0);
      expect(result.score).toBe(0);
    });

    test('handles else code INVALID', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 'INVALID',
          score: 0,
          label: '',
          type: 'RESIDUAL_AUTO',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: []
        }
      ];

      const result = CodingFactory.code(baseResponse('B'), coding);
      expect(result.status).toBe('INVALID');
      expect(result.code).toBe(0);
      expect(result.score).toBe(0);
    });

    test('supports SORT_ARRAY + ruleSet.valueArrayPos=LENGTH', () => {
      const coding = baseCoding();
      coding.processing = ['SORT_ARRAY' as ProcessingParameterType];
      coding.codes = [
        {
          id: 7,
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              valueArrayPos: 'LENGTH',
              ruleOperatorAnd: false,
              rules: [{ method: 'NUMERIC_MATCH', parameters: ['3'] }]
            }
          ]
        }
      ];

      const result = CodingFactory.code(baseResponse(['c', 'a', 'b']), coding);
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(7);
    });

    test('supports ruleSet.valueArrayPos=SUM with numeric-like values', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 3,
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              valueArrayPos: 'SUM',
              ruleOperatorAnd: false,
              rules: [{ method: 'NUMERIC_MATCH', parameters: ['6'] }]
            }
          ]
        }
      ];

      const result = CodingFactory.code(baseResponse(['1', 2, '3']), coding);
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(3);
    });

    test('supports valueArrayPos=ANY requiring all members comply', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 4,
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              valueArrayPos: 'ANY',
              ruleOperatorAnd: false,
              rules: [{ method: 'NUMERIC_MIN', parameters: ['0'] }]
            }
          ]
        }
      ];

      const ok = CodingFactory.code(baseResponse([0, 1, 2]), coding);
      expect(ok.status).toBe('CODING_COMPLETE');

      const bad = CodingFactory.code(baseResponse([0, -1, 2]), coding);
      expect(bad.status).toBe('CODING_INCOMPLETE');
    });

    test('handles fragmenting with capture groups', () => {
      const coding = baseCoding();
      coding.fragmenting = '([0-9]+)-([A-Z]+)';
      coding.codes = [
        {
          id: 8,
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              ruleOperatorAnd: false,
              rules: [{ method: 'MATCH', fragment: 1, parameters: ['ABC'] }]
            }
          ]
        }
      ];

      const result = CodingFactory.code(baseResponse('12-ABC'), coding);
      expect(result.status).toBe('CODING_COMPLETE');
      expect(result.code).toBe(8);
    });

    test('returns CODING_ERROR if fragmenting regex is invalid', () => {
      const coding = baseCoding();
      coding.fragmenting = '(';
      coding.codes = [
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
              rules: [{ method: 'IS_EMPTY' }]
            }
          ]
        }
      ];

      const onError = jest.fn();
      const result = CodingFactory.code(baseResponse('x'), coding, { onError });
      expect(result.status).toBe('CODING_ERROR');
      expect(onError).toHaveBeenCalled();
    });

    test('invalid regexp in MATCH_REGEX does not throw and simply results in no match', () => {
      const coding = baseCoding();
      coding.codes = [
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

      const onError = jest.fn();
      const result = CodingFactory.code(baseResponse('x'), coding, { onError });
      expect(result.status).toBe('CODING_INCOMPLETE');
      expect(onError).not.toHaveBeenCalled();
    });

    test('returns CODING_ERROR if rule evaluation throws (and calls onError)', () => {
      const coding = baseCoding();

      const badCode = {
        id: 1,
        score: 1,
        label: '',
        type: 'FULL_CREDIT',
        manualInstruction: '',
        ruleSetOperatorAnd: false
      } as unknown as NonNullable<VariableCodingData['codes']>[number];

      Object.defineProperty(badCode, 'ruleSets', {
        get: () => {
          throw new Error('boom');
        }
      });

      coding.codes = [badCode];

      const onError = jest.fn();
      const result = CodingFactory.code(baseResponse('A'), coding, { onError });
      expect(result.status).toBe('CODING_ERROR');
      expect(onError).toHaveBeenCalled();
    });

    test('sets status INTENDED_INCOMPLETE when a matched code id is INTENDED_INCOMPLETE', () => {
      const coding = baseCoding();
      coding.codes = [
        {
          id: 'INTENDED_INCOMPLETE',
          score: 1,
          label: '',
          type: 'FULL_CREDIT',
          manualInstruction: '',
          ruleSetOperatorAnd: false,
          ruleSets: [
            {
              ruleOperatorAnd: false,
              rules: [{ method: 'MATCH', parameters: ['A'] }]
            }
          ]
        }
      ];

      const result = CodingFactory.code(baseResponse('A'), coding);
      expect(result.status).toBe('INTENDED_INCOMPLETE');
      expect(result.code).toBe(0);
      expect(result.score).toBe(0);
    });
  });
});
