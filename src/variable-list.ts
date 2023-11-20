import { VariableInfo } from './coding-interfaces';

export class VariableList {
  variables: VariableInfo[] = [];

  constructor(varInfos: VariableInfo[] | null) {
    // todo: clean/validate
    this.variables = varInfos || [];
  }
}
