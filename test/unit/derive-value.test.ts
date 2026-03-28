import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { deriveValue } from '../../src/derive/derive-value';
import { CodingFactory } from '../../src';

describe('deriveValue', () => {
  test('propagates UNSET status by precedence and keeps subform', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SUM_SCORE',
      deriveSources: ['v1', 'v2'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'UNSET',
      subform: 'S1'
    } as Response;
    const r2: Response = {
      id: 'v2',
      value: null,
      status: 'VALUE_CHANGED',
      subform: 'S1'
    } as Response;

    const result = deriveValue([coding], coding, [r1, r2]);
    expect(result.status).toBe('UNSET');
    expect(result.subform).toBe('S1');
    expect(result.value).toBeNull();
  });

  test('maps NO_CODING to DERIVE_ERROR by precedence', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SUM_SCORE',
      deriveSources: ['v1'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'NO_CODING'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('DERIVE_ERROR');
    expect(result.value).toBeNull();
  });

  test('returns PARTLY_DISPLAYED when all false states are partly displayed', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SUM_SCORE',
      deriveSources: ['v1', 'v2'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'DISPLAYED'
    } as Response;
    const r2: Response = {
      id: 'v2',
      value: null,
      status: 'NOT_REACHED'
    } as Response;

    const result = deriveValue([coding], coding, [r1, r2]);
    expect(result.status).toBe('PARTLY_DISPLAYED');
    expect(result.value).toBeNull();
  });

  test('returns same false status if all invalid sources share it', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SUM_SCORE',
      deriveSources: ['v1', 'v2'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'DISPLAYED'
    } as Response;
    const r2: Response = {
      id: 'v2',
      value: null,
      status: 'DISPLAYED'
    } as Response;

    const result = deriveValue([coding], coding, [r1, r2]);
    expect(result.status).toBe('DISPLAYED');
    expect(result.value).toBeNull();
  });

  test(
    'returns DERIVE_PENDING for non-manual/copy/unique/solver if any source is pending ' +
      'and all are eligible for pending-check',
    () => {
      const coding: VariableCodingData = {
        ...CodingFactory.createCodingVariable('d'),
        sourceType: 'SUM_SCORE',
        deriveSources: ['v1', 'v2'],
        codes: []
      } as VariableCodingData;

      const r1: Response = {
        id: 'v1',
        value: null,
        status: 'DERIVE_PENDING'
      } as Response;
      const r2: Response = {
        id: 'v2',
        value: null,
        status: 'CODING_COMPLETE'
      } as Response;

      const result = deriveValue([coding], coding, [r1, r2]);
      expect(result.status).toBe('DERIVE_PENDING');
      expect(result.value).toBeNull();
    }
  );

  test('MANUAL returns CODING_INCOMPLETE if all sources are INTENDED_INCOMPLETE', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'MANUAL',
      deriveSources: ['v1'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'INTENDED_INCOMPLETE'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('CODING_INCOMPLETE');
  });

  test('CONCAT_CODE uses ? for missing code and sorts when SORT is set', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'CONCAT_CODE',
      deriveSources: ['v1', 'v2'],
      sourceParameters: { processing: ['SORT'] },
      codes: []
    } as unknown as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'CODING_COMPLETE',
      code: 2
    } as Response;
    const r2: Response = {
      id: 'v2',
      value: null,
      status: 'CODING_COMPLETE'
    } as Response;

    const result = deriveValue([coding], coding, [r1, r2]);
    expect(result.status).toBe('VALUE_CHANGED');
    // sorted: "2" and "?" => "2" comes before "?"
    expect(result.value).toBe('2_?');
  });

  test('CONCAT_CODE includes code 0', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'CONCAT_CODE',
      deriveSources: ['v1'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'CODING_COMPLETE',
      code: 0
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('VALUE_CHANGED');
    expect(result.value).toBe('0');
  });

  test('SUM_CODE sums codes and treats missing code as 0', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SUM_CODE',
      deriveSources: ['v1', 'v2'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'CODING_COMPLETE',
      code: 2
    } as Response;
    const r2: Response = {
      id: 'v2',
      value: null,
      status: 'CODING_COMPLETE'
    } as Response;

    const result = deriveValue([coding], coding, [r1, r2]);
    expect(result.status).toBe('VALUE_CHANGED');
    expect(result.value).toBe(2);
  });

  test('COPY_VALUE deep clones object value', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'COPY_VALUE',
      deriveSources: ['v1'],
      codes: []
    } as VariableCodingData;

    const arr = [1, 2, 3];
    const r1: Response = {
      id: 'v1',
      value: arr,
      status: 'VALUE_CHANGED'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('VALUE_CHANGED');
    expect(result.value).toEqual([1, 2, 3]);
    expect(result.value).not.toBe(arr);
  });

  test('UNIQUE_VALUES returns false if duplicates exist', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'UNIQUE_VALUES',
      deriveSources: ['v1', 'v2'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: 'x',
      status: 'CODING_COMPLETE'
    } as Response;
    const r2: Response = {
      id: 'v2',
      value: 'x',
      status: 'CODING_COMPLETE'
    } as Response;

    const result = deriveValue([coding], coding, [r1, r2]);
    expect(result.status).toBe('VALUE_CHANGED');
    expect(result.value).toBe(false);
  });

  test('SUM_SCORE returns DERIVE_ERROR if a declared source response is missing', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SUM_SCORE',
      deriveSources: ['v1', 'v2'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: null,
      status: 'CODING_COMPLETE',
      score: 1
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('DERIVE_ERROR');
    expect(result.value).toBeNull();
  });

  test('SOLVER returns DERIVE_ERROR if expression evaluates to non-finite number', () => {
    const v1 = CodingFactory.createCodingVariable('ID_1');
    v1.alias = 'v1';
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SOLVER',
      deriveSources: ['v1'],
      sourceParameters: {
        solverExpression: `${v1} / 0`,
        processing: []
      },
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: 1,
      status: 'VALUE_CHANGED'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('DERIVE_ERROR');
    expect(result.value).toBeNull();
  });

  test('SOLVER returns DERIVE_ERROR if expression uses var not in deriveSources', () => {
    const v2 = CodingFactory.createCodingVariable('ID_1');
    v2.alias = 'v2';
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SOLVER',
      deriveSources: ['v1'],
      sourceParameters: {
        solverExpression: `${v2} + 1'`,
        processing: []
      },
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: 1,
      status: 'VALUE_CHANGED'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('DERIVE_ERROR');
    expect(result.value).toBeNull();
  });

  test('SOLVER returns DERIVE_ERROR if source value is array', () => {
    const v1 = CodingFactory.createCodingVariable('ID_1');
    v1.alias = 'v1';
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'SOLVER',
      deriveSources: ['v1'],
      sourceParameters: {
        solverExpression: `${v1} + 1`,
        processing: []
      },
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: [1],
      status: 'VALUE_CHANGED'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('DERIVE_ERROR');
    expect(result.value).toBeNull();
  });

  test('returns DERIVE_ERROR if sourceType is invalid (e.g. toString)', () => {
    const coding: VariableCodingData = {
      ...CodingFactory.createCodingVariable('d'),
      sourceType: 'toString' as unknown as VariableCodingData['sourceType'],
      deriveSources: ['v1'],
      codes: []
    } as VariableCodingData;

    const r1: Response = {
      id: 'v1',
      value: 1,
      status: 'VALUE_CHANGED'
    } as Response;

    const result = deriveValue([coding], coding, [r1]);
    expect(result.status).toBe('DERIVE_ERROR');
  });
});
