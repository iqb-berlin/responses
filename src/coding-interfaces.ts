export type ResponseStatusType = 'UNSET' | 'NOT_REACHED' | 'DISPLAYED' | 'VALUE_CHANGED' | 'VALUE_DERIVED' |
'SOURCE_MISSING' | 'DERIVE_ERROR' | 'CODING_COMPLETE' | 'NO_CODING' | 'CODING_INCOMPLETE' | 'CODING_ERROR';

export type ResponseValueType = null | string | number | boolean | string[] | number[] | boolean[];

export interface Response {
  id: string,
  status: ResponseStatusType;
  value: ResponseValueType;
  subform?: string,
  code?: number;
  score?: number
}

export type RuleMethod = 'MATCH' | 'MATCH_REGEX' | 'NUMERIC_RANGE' | 'NUMERIC_LESS_THEN' | 'NUMERIC_MORE_THEN' |
'NUMERIC_MAX' | 'NUMERIC_MIN' | 'IS_EMPTY' | 'ELSE' | 'IS_NULL' | 'IS_TRUE' | 'IS_FALSE';
export const RuleMethodParameterCount = {
  MATCH: -1,
  MATCH_REGEX: -1,
  NUMERIC_RANGE: 2,
  NUMERIC_LESS_THEN: 1,
  NUMERIC_MORE_THEN: 1,
  NUMERIC_MAX: 1,
  NUMERIC_MIN: 1,
  IS_EMPTY: 0,
  ELSE: 0,
  IS_NULL: 0,
  IS_TRUE: 0,
  IS_FALSE: 0
};
export type ProcessingParameterType = 'IGNORE_CASE' | 'REMOVE_WHITE_SPACES' | 'REPLAY_REQUIRED' |
'ATTACHMENT' | 'SPLIT_POSINT_POSINT_STRING' | 'SPLIT_FLOAT_STRING';
export type CodeModelType = 'NONE' | 'CHOICE' | 'VALUE_LIST' | 'NUMBER' | 'MANUAL';
export type SourceType = 'BASE' | 'COPY_FIRST_VALUE' | 'CONCAT_CODE' | 'SUM_CODE' | 'SUM_SCORE';
export const DeriveConcatDelimiter = '_';
export type CodingSchemeProblemType = 'VACANT' | 'SOURCE_MISSING' | 'INVALID_SOURCE' | 'RULE_PARAMETER_COUNT_MISMATCH'
| 'MORE_THEN_ONE_SOURCE' | 'ONLY_ONE_SOURCE' | 'VALUE_COPY_NOT_FROM_BASE';

export interface CodingRule {
  method: RuleMethod,
  parameters?: string[],
}

export interface CodeData {
  id: number,
  label: string,
  score: number,
  ruleOperatorAnd: boolean,
  rules: CodingRule[],
  manualInstruction: string
}

export interface VariableCodingData {
  id: string;
  label: string;
  sourceType: SourceType;
  deriveSources: string[];
  processing: ProcessingParameterType[];
  manualInstruction: string;
  codeModel?: CodeModelType;
  codeModelParameters?: string[],
  codes: CodeData[];
}

export interface CodingSchemeProblem {
  type: CodingSchemeProblemType,
  breaking: boolean,
  variableId: string,
  code?: number
}

export type VariableInfoValueType = string | number | boolean;

export interface VariableValue {
  value: VariableInfoValueType;
  label: string
}
export interface VariableInfo {
  id: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'attachment';
  format: 'text-selection' | 'image' | 'capture-image' | 'audio' | 'ggb-file' | 'non-negative' |
      'latex' | 'math-ml' | 'math-table' | 'ggb-variable' | '';
  multiple: boolean;
  nullable: boolean;
  values: VariableValue[];
  valuePositionLabels: string[];
  valuesComplete?: boolean;
  page: string;
}

export interface CodeAsText {
  code: number,
  score: number,
  label: string,
  scoreLabel: string,
  hasManualInstruction: boolean,
  description: string
}

export interface CodingAsText {
  id: string,
  label: string,
  source: string,
  processing?: string,
  hasManualInstruction: boolean,
  codes: CodeAsText[]
}

export interface VariableInfoShort {
  id: string,
  label: string,
  page: string
}
