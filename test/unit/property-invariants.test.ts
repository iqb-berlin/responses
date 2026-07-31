import { VariableCodingData } from '@iqbspecs/coding-scheme';
import fc from 'fast-check';
import { CodingFactory, CodingSchemeFactory } from '../../src';

describe('Property-style invariants', () => {
  test('getValueAsNumber is deterministic for random strings', () => {
    const alphabet = '0123456789 ,.-+abcXYZ\t\n';
    const randomString = fc.array(fc.constantFrom(...alphabet), { maxLength: 40 })
      .map(characters => characters.join(''));
    fc.assert(fc.property(randomString, value => {
      expect(CodingFactory.getValueAsNumber(value)).toBe(CodingFactory.getValueAsNumber(value));
    }), { seed: 0x05220010, numRuns: 200 });
  });

  test('dependency tree levels are strictly increasing along edges', () => {
    const baseCount = 3;
    const sourceSelectors = fc.array(
      fc.tuple(fc.nat(1000), fc.nat(1000)),
      { minLength: 1, maxLength: 8 }
    );
    fc.assert(fc.property(sourceSelectors, selectors => {
      const base = Array.from(
        { length: baseCount },
        (_, index) => CodingFactory.createCodingVariable(`b${index + 1}`)
      );
      const allIds: string[] = base.map(variable => variable.id);
      const derived: VariableCodingData[] = selectors.map(([first, second], index) => {
        const variable: VariableCodingData = {
          ...CodingFactory.createCodingVariable(`d${index + 1}`),
          sourceType: 'SUM_SCORE',
          deriveSources: [allIds[first % allIds.length], allIds[second % allIds.length]],
          codes: []
        };
        allIds.push(variable.id);
        return variable;
      });
      const tree = CodingSchemeFactory.getVariableDependencyTree([...base, ...derived]);
      const levelById = new Map(tree.map(node => [node.id, node.level] as const));
      tree.forEach(node => node.sources.forEach(source => {
        expect(levelById.get(node.id)).toBeGreaterThan(levelById.get(source) as number);
      }));
    }), { seed: 0x05220011, numRuns: 100 });
  });
});
