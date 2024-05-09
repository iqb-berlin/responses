export type ResponseStatusType = 'UNSET' | 'NOT_REACHED' | 'DISPLAYED' | 'VALUE_CHANGED' |
    'DERIVE_ERROR' | 'CODING_COMPLETE' | 'NO_CODING' | 'INVALID' | 'CODING_INCOMPLETE' | 'CODING_ERROR';
export const responseStatesInOrder = ['UNSET', 'NOT_REACHED', 'DISPLAYED', 'VALUE_CHANGED', 'INVALID',
  'DERIVE_ERROR', 'CODING_COMPLETE', 'NO_CODING', 'CODING_INCOMPLETE', 'CODING_ERROR'];
export const validStatesForDerivingValue = ['VALUE_CHANGED', 'NO_CODING', 'CODING_INCOMPLETE',
  'CODING_ERROR', 'CODING_COMPLETE'];
export const validStatesForDerivingCode = ['CODING_COMPLETE'];
export const validStatesToStartDeriving = ['UNSET', 'CODING_ERROR', 'CODING_INCOMPLETE'];
export const statesToReplaceByDeriveError = ['NO_CODING', 'CODING_INCOMPLETE', 'CODING_ERROR'];
export const deriveMethodsFromValue = ['SOLVER', 'COPY_VALUE', 'UNIQUE_VALUES'];

export type ResponseValueSingleType = null | string | number | boolean;
export type ResponseValueType = ResponseValueSingleType | ResponseValueSingleType[];
export type TransformedResponseValueType = ResponseValueType | string[][];

export interface Response {
  id: string,
  state: ResponseStatusType;
  value: ResponseValueType;
  subform?: string,
  code?: number;
  score?: number
}

// eslint-disable-next-line max-len
export type RuleMethod = 'MATCH' | 'MATCH_REGEX' | 'NUMERIC_MATCH' | 'NUMERIC_RANGE' | 'NUMERIC_LESS_THAN' |
'NUMERIC_MORE_THAN' | 'NUMERIC_MAX' | 'NUMERIC_MIN' | 'IS_EMPTY' | 'ELSE' | 'IS_NULL' | 'IS_TRUE' | 'IS_FALSE' | 'IS_UNIQUE_IN_ARRAY';
export const RuleMethodParameterCount = {
  MATCH: -1,
  MATCH_REGEX: -1,
  NUMERIC_MATCH: 1,
  NUMERIC_RANGE: 2,
  NUMERIC_LESS_THAN: 1,
  NUMERIC_MORE_THAN: 1,
  NUMERIC_MAX: 1,
  NUMERIC_MIN: 1,
  IS_UNIQUE_IN_ARRAY: 0,
  IS_EMPTY: 0,
  ELSE: 0,
  IS_NULL: 0,
  IS_TRUE: 0,
  IS_FALSE: 0
};
export type ProcessingParameterType = 'IGNORE_CASE' | 'IGNORE_ALL_SPACES' | 'IGNORE_DISPENSABLE_SPACES' | 'SORT_ARRAY' |
    'REPLAY_REQUIRED' | 'ATTACHMENT';
export type CodeModelType = 'NONE' | 'CHOICE' | 'VALUE_LIST' | 'NUMBER' | 'MANUAL';
export type SourceType = 'BASE' | 'COPY_VALUE' | 'CONCAT_CODE' | 'SUM_CODE' | 'SUM_SCORE' | 'UNIQUE_VALUES' | 'SOLVER';
export type SourceProcessingType = 'TO_LOWER_CASE' | 'TO_NUMBER' | 'REMOVE_ALL_SPACES' | 'REMOVE_DISPENSABLE_SPACES' |
    'TAKE_DISPLAYED_AS_VALUE_CHANGED' | 'TAKE_EMPTY_AS_VALID' | 'SORT';
export const DeriveConcatDelimiter = '_';
export type CodingSchemeProblemType = 'VACANT' | 'SOURCE_MISSING' | 'INVALID_SOURCE' | 'RULE_PARAMETER_COUNT_MISMATCH'
| 'MORE_THAN_ONE_SOURCE' | 'ONLY_ONE_SOURCE' | 'VALUE_COPY_NOT_FROM_BASE';

export interface CodingRule {
  method: RuleMethod,
  parameters?: string[],
  fragment?: number
}

export interface RuleSet {
  ruleOperatorAnd: boolean,
  rules: CodingRule[],
  valueArrayPos?: number | 'ANY' | 'SUM'
}

export interface CodeData {
  id: number | null,
  label: string,
  score: number,
  ruleSetOperatorAnd: boolean,
  ruleSets: RuleSet[],
  manualInstruction: string
}

export interface VariableSourceParameters {
  solverExpression?: string,
  processing?: SourceProcessingType[]
}

export interface VariableCodingData {
  id: string,
  label: string,
  sourceType: SourceType,
  sourceParameters: VariableSourceParameters,
  deriveSources: string[],
  processing: ProcessingParameterType[],
  fragmenting?: string,
  manualInstruction: string,
  codeModel?: CodeModelType,
  codeModelParameters?: string[],
  codes: CodeData[],
  page: string
}

export interface CodingSchemeProblem {
  type: CodingSchemeProblemType,
  breaking: boolean,
  variableId: string,
  variableLabel: string,
  code?: string
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
  code: string,
  score: number,
  label: string,
  scoreLabel: string,
  hasManualInstruction: boolean,
  ruleSetOperatorAnd: boolean,
  ruleSetDescriptions: string[]
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
