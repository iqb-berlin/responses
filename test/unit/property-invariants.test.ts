import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingFactory, CodingSchemeFactory } from '../../src';

describe('Property-style invariants (lightweight fuzz)', () => {
  test('getValueAsNumber is deterministic for random strings', () => {
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const alphabet = '0123456789 ,.-+abcXYZ\t\n';

    const randomString = (len: number) => {
      let out = '';
      for (let i = 0; i < len; i++) {
        out += alphabet[randInt(0, alphabet.length - 1)];
      }
      return out;
    };

    for (let i = 0; i < 200; i++) {
      const s = randomString(randInt(0, 40));
      const a = CodingFactory.getValueAsNumber(s);
      const b = CodingFactory.getValueAsNumber(s);
      expect(a).toBe(b);
    }
  });

  test('dependency tree levels are strictly increasing along edges', () => {
    const baseCount = 3;
    const derivedCount = 8;

    const base = Array.from({ length: baseCount }, (_, i) => CodingFactory.createCodingVariable(`b${i + 1}`)
    );

    const allIds: string[] = base.map(v => v.id);
    const derived: VariableCodingData[] = Array.from(
      { length: derivedCount },
      (_, i) => {
        const id = `d${i + 1}`;
        const vc: VariableCodingData = {
          ...CodingFactory.createCodingVariable(id),
          sourceType: 'SUM_SCORE',
          deriveSources: [] as string[],
          codes: []
        };

        const sourceCount = 2;
        const sources: string[] = [];
        for (let j = 0; j < sourceCount; j++) {
          const pick = allIds[Math.floor(Math.random() * allIds.length)];
          sources.push(pick);
        }

        vc.deriveSources = sources;
        allIds.push(id);
        return vc;
      }
    );

    const tree = CodingSchemeFactory.getVariableDependencyTree([
      ...base,
      ...derived
    ]);

    const levelById = new Map(tree.map(n => [n.id, n.level] as const));
    tree.forEach(n => {
      n.sources.forEach(s => {
        const srcLevel = levelById.get(s);
        const tgtLevel = levelById.get(n.id);
        expect(typeof srcLevel).toBe('number');
        expect(typeof tgtLevel).toBe('number');
        expect(tgtLevel).toBeGreaterThan(srcLevel as number);
      });
    });
  });
});
