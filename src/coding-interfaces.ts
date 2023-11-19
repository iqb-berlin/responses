export type StatusType = 'UNSET' | 'NOT_REACHED' | 'DISPLAYED' | 'VALUE_CHANGED' | 'VALUE_DERIVED' |
    'SOURCE_MISSING' | 'DERIVE_ERROR' | 'CODING_COMPLETE' | 'NO_CODING' | 'CODING_INCOMPLETE' | 'CODING_ERROR';

export type ValueType = null | string | number | boolean | string[] | number[] | boolean[];

export interface Response {
    id: string,
    status: StatusType;
    value: ValueType;
    subform?: string,
    code?: number;
    score?: number
}

export type RuleMethod = 'MATCH' | 'MATCH_REGEX' | 'NUMERIC_RANGE' | 'NUMERIC_LESS_THEN' | 'NUMERIC_MORE_THEN' |
    'NUMERIC_MAX' | 'NUMERIC_MIN' | 'IS_EMPTY' | 'ELSE' | 'IS_NULL';
export const RuleMethodParameterCount = {
    'MATCH': -1, 'MATCH_REGEX': -1, 'NUMERIC_RANGE': 2, 'NUMERIC_LESS_THEN': 1, 'NUMERIC_MORE_THEN': 1,
    'NUMERIC_MAX': 1, 'NUMERIC_MIN': 1, 'IS_EMPTY': 0, 'ELSE': 0, 'IS_NULL': 0
}
export type ValueTransformation = 'TO_UPPER' | 'REMOVE_WHITE_SPACES' | 'TO_NUMBER';
export type CodeModel = null | 'CHOICE' | 'INPUT_INTEGER' | 'INPUT_STRING';
export type SourceType = 'BASE' | 'COPY_FIRST_VALUE' | 'CONCAT_CODE' | 'SUM_CODE' | 'SUM_SCORE';
export type CodingSchemeProblemType = 'VACANT' | 'SOURCE_MISSING' | 'INVALID_SOURCE' | 'RULE_PARAMETER_COUNT_MISMATCH'
    | 'MORE_THEN_ONE_SOURCE' | 'ONLY_ONE_SOURCE' | 'VALUE_COPY_NOT_FROM_BASE';

export interface CodingRule {
    method: RuleMethod,
    parameters: string[],
}

export interface CodeData {
    id: number,
    label: string,
    score: number,
    rules: CodingRule[],
    manualInstruction: string
}

export interface VariableCodingData {
    id: string;
    label: string;
    sourceType: SourceType;
    deriveSources: string[];
    valueTransformations: ValueTransformation[];
    manualInstruction: string;
    codeModel: CodeModel;
    codeModelParameters: string[],
    codes: CodeData[];
}

export interface CodingSchemeProblem {
    type: CodingSchemeProblemType,
    breaking: boolean,
    variable_id: string,
    code?: number
}

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
