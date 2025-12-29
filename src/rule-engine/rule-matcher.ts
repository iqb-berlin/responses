import { ResponseValueSingleType } from '@iqbspecs/response/response.interface';
import {
  CodingRule,
  ProcessingParameterType,
  TransformedResponseValueType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import { checkOneValue } from './scalar-evaluator';

export function isMatchRule(
  valueToCheck: TransformedResponseValueType,
  rule: CodingRule,
  isValueArray: boolean,
  codingProcessing: ProcessingParameterType[]
): boolean {
  if (Array.isArray(valueToCheck) && isValueArray) {
    if (valueToCheck.length === 0) {
      return checkOneValue('', rule, codingProcessing);
    }
    return valueToCheck.some(valueMember => {
      if (Array.isArray(valueMember)) {
        if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
          return valueMember.some(fragment => checkOneValue(
            fragment as ResponseValueSingleType,
            rule,
            codingProcessing
          )
          );
        }

        return checkOneValue(
          valueMember[rule.fragment] as ResponseValueSingleType,
          rule,
          codingProcessing
        );
      }

      return checkOneValue(
        valueMember as ResponseValueSingleType,
        rule,
        codingProcessing
      );
    });
  }

  if (Array.isArray(valueToCheck)) {
    const { fragment } = rule;
    if (fragment == null || fragment < 0) {
      return valueToCheck.some(value => checkOneValue(value as ResponseValueSingleType, rule, codingProcessing)
      );
    }

    return checkOneValue(
      valueToCheck[fragment] as ResponseValueSingleType,
      rule,
      codingProcessing
    );
  }

  return checkOneValue(
    valueToCheck as ResponseValueSingleType,
    rule,
    codingProcessing
  );
}
