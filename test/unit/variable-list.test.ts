import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { VariableList } from '../../src';

describe('VariableList', () => {
  test('constructor initializes with empty array when null is provided', () => {
    const list = new VariableList(null);
    expect(list.variables).toStrictEqual([]);
  });

  test('constructor keeps provided variable infos', () => {
    const varInfos: VariableInfo[] = [
      { id: 'v1' },
      { id: 'v2' }
    ] as unknown as VariableInfo[];
    const list = new VariableList(varInfos);
    expect(list.variables).toBe(varInfos);
    expect(list.variables).toHaveLength(2);
  });
});
