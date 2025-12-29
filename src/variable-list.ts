import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';

export class VariableList {
  variables: VariableInfo[] = [];

  constructor(varInfos: VariableInfo[] | null) {
    const input = Array.isArray(varInfos) ? varInfos : [];
    const uniqueById = new Map<string, VariableInfo>();

    input.forEach(v => {
      const candidate = v as unknown as { id?: unknown };
      const id =
        typeof candidate?.id === 'string' ? candidate.id.trim() : undefined;
      if (!id) return;
      if (!uniqueById.has(id)) {
        uniqueById.set(id, {
          ...(v as unknown as Record<string, unknown>),
          id
        } as unknown as VariableInfo);
      }
    });

    this.variables = [...uniqueById.values()];
  }
}
