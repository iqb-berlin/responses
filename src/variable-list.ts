import { LegacyVariableInfo, VariableInfoInput } from './variable-info';

// Preserve the old, mutable 1.x output contract, including inferred empty lists.
// For new inputs retain their metadata, widening ids because trimming can change them.
type ListEntry<T> = [T] extends [never] ? LegacyVariableInfo :
  T extends LegacyVariableInfo ? LegacyVariableInfo :
    T extends VariableInfoInput ? Omit<T, 'id'> & { id: string } : never;

export class VariableList<T extends VariableInfoInput = LegacyVariableInfo> {
  variables: ListEntry<T>[] = [];

  constructor(varInfos: readonly T[] | null) {
    const input: readonly T[] = Array.isArray(varInfos) ? varInfos : [];
    const uniqueById = new Map<string, ListEntry<T>>();

    input.forEach(v => {
      const candidate = v as unknown as { id?: unknown };
      const id =
        typeof candidate?.id === 'string' ? candidate.id.trim() : undefined;
      if (!id) return;
      if (!uniqueById.has(id)) {
        uniqueById.set(id, {
          ...v,
          id
        } as unknown as ListEntry<T>);
      }
    });

    this.variables = [...uniqueById.values()];
  }
}
