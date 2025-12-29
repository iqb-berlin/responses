import { ResponseValueSingleType } from '@iqbspecs/response/response.interface';
import {
  RuleSet,
  TransformedResponseValueType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import { getValueAsNumber } from '../value-transform';

export function resolveValueArrayPosMember(
  valueToCheck: TransformedResponseValueType,
  ruleSet: RuleSet,
  isValueArray: boolean
): TransformedResponseValueType | undefined {
  if (!isValueArray || !Array.isArray(valueToCheck)) {
    return undefined;
  }

  if (typeof ruleSet.valueArrayPos === 'number') {
    if (
      ruleSet.valueArrayPos >= 0 &&
      ruleSet.valueArrayPos < valueToCheck.length
    ) {
      return valueToCheck[ruleSet.valueArrayPos];
    }
    return undefined;
  }

  if (ruleSet.valueArrayPos === 'SUM') {
    return valueToCheck
      .map(v => {
        if (Array.isArray(v)) {
          return v
            .map(s => getValueAsNumber(s as ResponseValueSingleType) || 0)
            .reduce((a, b) => a + b, 0);
        }
        return getValueAsNumber(v as ResponseValueSingleType) || 0;
      })
      .reduce((pv, cv) => pv + cv, 0);
  }

  if (ruleSet.valueArrayPos === 'LENGTH') {
    return valueToCheck.length;
  }

  return undefined;
}
