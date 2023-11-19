import {VariableInfo} from "./coding-interfaces";

export class VariableList {
    public variables: VariableInfo[] = [];

    constructor(varInfos: VariableInfo[] | null) {
        // todo: clean/validate
        this.variables = varInfos || [];
    }
}
