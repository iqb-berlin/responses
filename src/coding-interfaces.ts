import { CodingSchemeProblemType } from '@iqbspecs/coding-scheme/coding-scheme.interface';

export interface CodingSchemeProblem {
  type: CodingSchemeProblemType,
  breaking: boolean,
  variableId: string,
  variableLabel: string,
  code?: string
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
