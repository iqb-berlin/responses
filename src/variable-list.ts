import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';

export class VariableList {
  variables: VariableInfo[] = [];

  constructor(varInfos: VariableInfo[] | null) {
    // todo: clean/validate
    this.variables = varInfos || [];
  }
}
