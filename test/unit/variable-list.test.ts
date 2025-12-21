import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { VariableList } from '../../src';

describe('VariableList', () => {
  test('constructor initializes with empty array when null is provided', () => {
    const list = new VariableList(null);
    expect(list.variables).toStrictEqual([]);
  });

  test('constructor cleans, validates and de-duplicates variable infos', () => {
    const varInfos: VariableInfo[] = [
      { id: 'v1' },
      { id: '  v2  ' },
      { id: '' },
      {} as unknown as VariableInfo,
      { id: 'v1' }
    ] as unknown as VariableInfo[];

    const list = new VariableList(varInfos);
    expect(list.variables).toHaveLength(2);
    expect(list.variables.map(v => v.id)).toStrictEqual(['v1', 'v2']);
  });

  test('constructor creates a new array instance', () => {
    const varInfos: VariableInfo[] = [
      { id: 'v1' }
    ] as unknown as VariableInfo[];
    const list = new VariableList(varInfos);
    expect(list.variables).not.toBe(varInfos);
  });

  test('constructor keeps additional properties on VariableInfo', () => {
    const varInfos: VariableInfo[] = [
      {
        id: 'v1',
        label: 'Label 1'
      } as unknown as VariableInfo
    ];
    const list = new VariableList(varInfos);
    expect((list.variables[0] as unknown as { label?: string }).label).toBe(
      'Label 1'
    );
  });

  test('constructor de-duplicates by trimmed id (first occurrence wins)', () => {
    const varInfos: VariableInfo[] = [
      {
        id: '  v1  ',
        label: 'first'
      } as unknown as VariableInfo,
      {
        id: 'v1',
        label: 'second'
      } as unknown as VariableInfo
    ];

    const list = new VariableList(varInfos);
    expect(list.variables).toHaveLength(1);
    expect(list.variables[0].id).toBe('v1');
    expect((list.variables[0] as unknown as { label?: string }).label).toBe(
      'first'
    );
  });
});
