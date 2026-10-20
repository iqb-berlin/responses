import { VariableInfo as CurrentVariableInfo } from '@iqbspecs/variable-info/variable-info.interface';

/** The structural 1.x contract, retained for existing VariableList consumers. */
export interface LegacyVariableInfo {
  id: string;
  alias?: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'attachment' | 'json' | 'no-value' | 'coded';
  format: 'text-selection' | 'image' | 'capture-image' | 'audio' | 'ggb-file' | 'non-negative' |
  'latex' | 'math-ml' | 'math-table' | 'math-text-mix' | 'ggb-variable' | '';
  multiple: boolean;
  nullable: boolean;
  values: { value: string | number | boolean; label: string }[];
  valuePositionLabels: string[];
  valuesComplete?: boolean;
  page?: string;
  visualAnchor?: string;
}

/** The published VariableInfo 2.1 TypeScript interface. */
export type VariableInfoV2 = CurrentVariableInfo;

/**
 * Read-only input shared by 1.x, published 2.1 types and minimal 2.1 schema data.
 * The schema requires only id/type; its other properties and value labels are optional.
 * Legacy fields and chemistry spellings remain accepted without rewriting data.
 */
export interface VariableInfoInput {
  readonly id: string;
  readonly alias?: string;
  readonly type: LegacyVariableInfo['type'] | CurrentVariableInfo['type'];
  readonly format?: LegacyVariableInfo['format'] | CurrentVariableInfo['format'] |
  'chem-element-symbols' | 'chem-molecule';
  readonly multiple?: boolean;
  readonly nullable?: boolean;
  readonly values?: readonly { readonly value: string | number | boolean; readonly label?: string }[];
  readonly valuePositionLabels?: readonly string[];
  readonly valuesComplete?: boolean;
  readonly page?: string;
  readonly visualAnchor?: string;
}
