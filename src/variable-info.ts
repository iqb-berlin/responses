export interface VariableValue {
  value: string;
  label: string
}
export interface VariableInfo {
  id: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'attachment';
  format: 'text-selection' | 'image' | 'capture-image' | 'audio' | 'ggb-file' | 'non-negative' | '';
  multiple: boolean;
  nullable: boolean;
  values: VariableValue[];
  valuesComplete?: boolean;
}
