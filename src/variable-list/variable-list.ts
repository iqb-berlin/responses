export type VariableListValueType = string | number | boolean;

export interface VariableValue {
    value: VariableListValueType;
    label: string
}
export interface VariableInfo {
    id: string;
    type: 'string' | 'integer' | 'number' | 'boolean' | 'attachment';
    format: 'text-selection' | 'image' | 'capture-image' | 'audio' | 'ggb-file' | 'non-negative' | '';
    multiple: boolean;
    nullable: boolean;
    values: VariableValue[];
    valuePositionLabels: string[];
    valuesComplete?: boolean;
    page: string;
}

export class VariableList {
    public variables: VariableInfo[] = [];

    constructor(varInfos: VariableInfo[] | null) {
        // todo: clean/validate
        this.variables = varInfos || [];
    }
}
