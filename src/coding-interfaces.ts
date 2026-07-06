import { CodingSchemeProblemType } from '@iqbspecs/coding-scheme/coding-scheme.interface';

export type CodingSchemeProblemReason = 'ALIAS_ID_COLLISION';

export interface CodingSchemeProblem {
  type: CodingSchemeProblemType,
  breaking: boolean,
  variableId: string,
  variableLabel: string,
  code?: string,
  reason?: CodingSchemeProblemReason,
  alias?: string,
  aliasVariableId?: string,
  collidingVariableId?: string
}

export interface CodeAsText {
  id: string,
  score: number,
  label: string,
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

export type CodingToTextMode = 'SIMPLE' | 'EXTENDED';
