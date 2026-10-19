import { Response } from '@iqbspecs/response/response.interface';
import { SourceProcessingType, VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingFactory, CodingSchemeFactory, ToTextFactory } from '../../src';
import { deriveValue } from '../../src/derive/derive-value';

const displayed: SourceProcessingType = 'TAKE_DISPLAYED_AS_ZERO_IF_PARTIAL';
const empty: SourceProcessingType = 'TAKE_EMPTY_AS_ZERO_IF_PARTIAL';
const methods = ['SUM_SCORE', 'SUM_CODE', 'CONCAT_CODE'] as const;
const expectedContribution = { SUM_SCORE: 3, SUM_CODE: 2, CONCAT_CODE: '2_x' };
const expectedFullResult = { SUM_SCORE: 6, SUM_CODE: 4, CONCAT_CODE: '2_2' };
const coded = (id = 'a', value: Response['value'] = 1): Response => ({
  id, value, status: 'CODING_COMPLETE', code: 2, score: 3, subform: 'S1'
});
const partial = (status: Response['status'] = 'DISPLAYED', value: Response['value'] = null): Response => ({
  id: 'b', status, value, subform: 'S1'
});
const coding = (
  method: VariableCodingData['sourceType'],
  processing: SourceProcessingType[] = [displayed, empty]
): VariableCodingData => ({
  ...CodingFactory.createCodingVariable('derived'),
  sourceType: method,
  deriveSources: ['a', 'b'],
  sourceParameters: { processing }
});

describe.each(methods)('%s partial credit', method => {
  test.each([
    ['DISPLAYED', null, displayed],
    ['DISPLAYED', false, displayed],
    ['DISPLAYED', 0, displayed],
    ['INVALID', null, empty],
    ['INVALID', '', empty],
    ['INVALID', [], empty]
  ] as [Response['status'], Response['value'], SourceProcessingType][])(
    'replaces only the contribution from %s with value %j', (status, value, option) => {
      const sources = [Object.freeze(coded()), Object.freeze(partial(status, value))];
      const before = JSON.stringify(sources);
      const result = deriveValue([], coding(method, [option]), sources);
      expect(result).toMatchObject({
        status: 'VALUE_CHANGED',
        subform: 'S1',
        value: expectedContribution[method]
      });
      expect(JSON.stringify(sources)).toBe(before);
    }
  );

  test('keeps the existing result without either opt-in', () => {
    expect(deriveValue([], coding(method, []), [coded(), partial()]).status).toBe('INVALID');
    expect(deriveValue([], coding(method, [empty]), [coded(), partial()]).status).toBe('INVALID');
    expect(deriveValue([], coding(method, [displayed]), [coded(), partial('INVALID', '')]).status).toBe('INVALID');
  });

  test.each([false, 0, 'wrong', ' ', [null]])('does not replace nonempty INVALID %j', value => {
    expect(deriveValue([], coding(method), [coded(), partial('INVALID', value)]).status).toBe('INVALID');
  });

  test.each(['DISPLAYED', 'INVALID'] as const)('does not calculate when all sources are %s', status => {
    const sources = [{ ...partial(status, ''), id: 'a' }, partial(status, [])];
    expect(deriveValue([], coding(method), sources)).toMatchObject({ status, value: null });
  });

  test('does not calculate from displayed plus deleted answers alone', () => {
    expect(deriveValue([], coding(method), [{ ...partial(), id: 'a' }, partial('INVALID', '')]))
      .toMatchObject({ status: 'INVALID', value: null });
  });

  test('does not calculate from only INVALID null sources', () => {
    expect(deriveValue([], coding(method), [{ ...partial('INVALID'), id: 'a' }, partial('INVALID')]))
      .toMatchObject({ status: 'INVALID', value: null });
  });

  test.each(['CODING_INCOMPLETE', 'DERIVE_PENDING'] as const)(
    'defers %s plus allowed partials without a completed answer', status => {
      const pending = { ...coded(), status };
      expect(deriveValue([], coding(method), [pending, partial()]).status).toBe('DERIVE_PENDING');
      expect(deriveValue([], coding(method), [pending, partial('INVALID', [])]).status).toBe('DERIVE_PENDING');
    }
  );

  test('does not skip a pending source when a completed answer exists', () => {
    const derived = coding(method);
    derived.deriveSources?.push('c');
    const sources: Response[] = [coded(), partial(), { id: 'c', value: 1, status: 'CODING_INCOMPLETE' }];
    expect(deriveValue([], derived, sources).status).toBe('DERIVE_PENDING');
  });

  test.each([
    ['UNSET', 'UNSET'], ['CODING_ERROR', 'CODING_ERROR'], ['DERIVE_ERROR', 'DERIVE_ERROR'],
    ['NO_CODING', 'DERIVE_ERROR'], ['NOT_REACHED', 'INVALID'], ['PARTLY_DISPLAYED', 'INVALID']
  ] as [Response['status'], Response['status']][])('preserves %s precedence', (status, expected) => {
    const derived = coding(method);
    derived.deriveSources?.push('c');
    expect(deriveValue([], derived, [coded(), partial(), { id: 'c', value: null, status }]).status)
      .toBe(expected);
  });

  test('does not treat INTENDED_INCOMPLETE as a regularly coded answer', () => {
    expect(deriveValue([], coding(method), [{ ...coded(), status: 'INTENDED_INCOMPLETE' }, partial()]).status)
      .toBe('INVALID');
  });

  test('preserves display-family aggregation', () => {
    expect(deriveValue([], coding(method), [{ ...partial(), id: 'a' }, partial('NOT_REACHED')]).status)
      .toBe('PARTLY_DISPLAYED');
  });

  test('calculates normally when all sources are coded', () => {
    expect(deriveValue([], coding(method), [coded(), coded('b')])).toMatchObject({
      status: 'VALUE_CHANGED', value: expectedFullResult[method]
    });
  });

  test.each([false, 0])('retains coded answer %j as the start of processing', value => {
    expect(deriveValue([], coding(method), [{ ...coded('a', value), code: 0, score: 0 }, partial()]))
      .toMatchObject({ status: 'VALUE_CHANGED', value: method === 'CONCAT_CODE' ? '0_x' : 0 });
  });

  test('does not conceal a missing declared source with replacement', () => {
    const derived = coding(method);
    derived.deriveSources?.push('missing');
    expect(deriveValue([], derived, [coded(), partial()]).status).toBe('DERIVE_ERROR');
  });

  test('preserves UNSET precedence even when a declared source is missing', () => {
    const derived = coding(method);
    derived.deriveSources?.push('unset', 'missing');
    const unset: Response = { id: 'unset', status: 'UNSET', value: null };
    expect(deriveValue([], derived, [coded(), partial(), unset]).status).toBe('UNSET');
  });

  test('does not start processing based on an undeclared source', () => {
    const derived = coding(method);
    derived.deriveSources = ['b'];
    expect(deriveValue([], derived, [coded(), partial()]).status).toBe('INVALID');
  });

  test('describes enabled replacements in coding-scheme text', () => {
    const derived = coding(method);
    const text = ToTextFactory.sourceAsText('derived', method, ['a', 'b'], derived.sourceParameters);
    expect(text).toContain('mindestens einer regulär kodierten Teilantwort');
    expect(text).toContain(`angezeigte Quellantworten als ${method === 'CONCAT_CODE' ? 'x' : '0'}`);
    expect(text).toContain('leere ungültige Quellantworten');
  });
});

test('CONCAT_CODE keeps x distinct from a real zero and sorts contributions', () => {
  const derived = coding('CONCAT_CODE', [displayed, 'SORT']);
  expect(deriveValue([], derived, [partial(), { ...coded(), code: 0 }]).value).toBe('0_x');
  expect(deriveValue([], derived, [{ ...coded(), code: 0 }, { ...coded('b'), code: 0 }]).value).toBe('0_0');
});

test.each(['SOLVER', 'UNIQUE_VALUES', 'COPY_VALUE', 'MANUAL'] as const)(
  'does not change the existing %s policies', method => {
    const derived = coding(method);
    derived.sourceParameters!.solverExpression = `${'${'}a:0} + ${'${'}b:0}`;
    const baseline = { ...derived, sourceParameters: { ...derived.sourceParameters, processing: [] } };
    const sources = [coded(), partial('INVALID', '')];
    expect(deriveValue([], derived, sources)).toEqual(deriveValue([], baseline, sources));
  }
);

const base = (id: string): VariableCodingData => ({
  ...CodingFactory.createCodingVariable(id),
  codes: [
    {
      id: 1, type: 'FULL_CREDIT', score: 1, ruleSets: [{ rules: [{ method: 'NUMERIC_MATCH', parameters: ['1'] }] }]
    },
    { id: 0, type: 'RESIDUAL_AUTO', score: 0 }
  ]
});

describe('partial credit through the complete coding pipeline', () => {
  test.each(methods)('scores three of four answers with %s and preserves sources', method => {
    const bases = ['a', 'b', 'c', 'd'].map(base);
    const derived: VariableCodingData = {
      ...coding(method),
      deriveSources: bases.map(b => b.id),
      codes: [{
        id: 7,
        type: 'PARTIAL_CREDIT',
        score: 3,
        ruleSets: [{
          rules: [{
            method: method === 'CONCAT_CODE' ? 'MATCH' : 'NUMERIC_MATCH',
            parameters: [method === 'CONCAT_CODE' ? '1_1_1_x' : '3']
          }]
        }]
      }]
    };
    const inputs: Response[] = bases.map(b => ({ id: b.id, value: 1, status: 'VALUE_CHANGED' }));
    inputs[3] = { id: 'd', value: null, status: 'DISPLAYED' };
    const strict = {
      ...derived, id: 'strict', alias: 'strict', sourceParameters: { processing: [] }
    };
    const outputs = CodingSchemeFactory.code(inputs, [...bases, derived, strict]);
    expect(outputs.find(r => r.id === 'derived')).toMatchObject({ status: 'CODING_COMPLETE', code: 7, score: 3 });
    expect(outputs.find(r => r.id === 'strict')?.status).toBe('INVALID');
    expect(outputs.find(r => r.id === 'd')).toEqual(inputs[3]);
    expect(inputs[0].status).toBe('VALUE_CHANGED');
  });

  test.each(['', []] as Response['value'][])('supports deleted VALUE_CHANGED %j after base normalization', value => {
    const derived = coding('SUM_SCORE');
    const outputs = CodingSchemeFactory.code([
      { id: 'a', value: 1, status: 'VALUE_CHANGED' }, { id: 'b', value, status: 'VALUE_CHANGED' }
    ], [base('a'), base('b'), derived]);
    expect(outputs.find(r => r.id === 'derived')).toMatchObject({ value: 1, status: 'NO_CODING' });
    expect(outputs.find(r => r.id === 'b')).toMatchObject({ value, status: 'INVALID' });
  });

  test.each(['', []] as Response['value'][])('keeps all deleted VALUE_CHANGED %j invalid', value => {
    const inputs: Response[] = ['a', 'b'].map(id => ({ id, value, status: 'VALUE_CHANGED' }));
    const outputs = CodingSchemeFactory.code(inputs, [base('a'), base('b'), coding('SUM_SCORE')]);
    expect(outputs.find(r => r.id === 'derived')?.status).toBe('INVALID');
  });

  test('preserves explicit TAKE_EMPTY_AS_VALID coding and treats its zero code as regular', () => {
    const first = base('a');
    first.sourceParameters = { processing: ['TAKE_EMPTY_AS_VALID'] };
    const outputs = CodingSchemeFactory.code([
      { id: 'a', value: '', status: 'VALUE_CHANGED' }, { id: 'b', value: null, status: 'DISPLAYED' }
    ], [first, base('b'), coding('SUM_SCORE')]);
    expect(outputs.find(r => r.id === 'a')).toMatchObject({ status: 'CODING_COMPLETE', code: 0 });
    expect(outputs.find(r => r.id === 'derived')).toMatchObject({ value: 0, status: 'NO_CODING' });
  });

  test('keeps independent subforms and supports downstream derivations', () => {
    const derived = coding('SUM_SCORE');
    derived.codes = [{ id: 4, type: 'RESIDUAL_AUTO', score: 1 }];
    const downstream: VariableCodingData = {
      ...coding('SUM_SCORE'),
      id: 'downstream',
      alias: 'downstream',
      deriveSources: ['derived'],
      codes: [{ id: 8, type: 'RESIDUAL_AUTO', score: 1 }]
    };
    const inputs: Response[] = ['S1', 'S2'].flatMap(subform => [
      {
        id: 'a', value: 1, status: subform === 'S1' ? 'VALUE_CHANGED' : 'DISPLAYED', subform
      },
      {
        id: 'b', value: null, status: 'DISPLAYED', subform
      }
    ] as Response[]);
    const result = CodingSchemeFactory.code(inputs, [base('a'), base('b'), derived, downstream]);
    expect(result.find(r => r.id === 'derived' && r.subform === 'S1')?.code).toBe(4);
    expect(result.find(r => r.id === 'downstream' && r.subform === 'S1')?.code).toBe(8);
    expect(result.find(r => r.id === 'derived' && r.subform === 'S2')?.status).toBe('DISPLAYED');
  });
});
