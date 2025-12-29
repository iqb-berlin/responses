import {
  ProcessingParameterType,
  RuleSet,
  TransformedResponseValueType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import { isMatchRule } from './rule-matcher';
import { resolveValueArrayPosMember } from './array-position';

function evaluateRuleSetRules(
  valueToEvaluate: TransformedResponseValueType,
  ruleSet: RuleSet,
  isValueArray: boolean,
  codingProcessing: ProcessingParameterType[]
): boolean {
  if (!ruleSet.ruleOperatorAnd) {
    return (ruleSet.rules ?? []).some(rule => isMatchRule(valueToEvaluate, rule, isValueArray, codingProcessing)
    );
  }

  return (ruleSet.rules ?? []).every(rule => isMatchRule(valueToEvaluate, rule, isValueArray, codingProcessing)
  );
}

function evaluateAnyOpen(
  valueToCheck: TransformedResponseValueType,
  ruleSet: RuleSet,
  codingProcessing: ProcessingParameterType[]
): boolean {
  if (!Array.isArray(valueToCheck)) return false;
  if (valueToCheck.length === 0) return false;
  if (ruleSet.valueArrayPos !== 'ANY_OPEN') return false;

  return valueToCheck.some(value => (ruleSet.rules ?? [])
    .every(rule => isMatchRule(value, rule, false, codingProcessing))
  );
}

function evaluateAllMembers(
  valueToCheck: TransformedResponseValueType,
  ruleSet: RuleSet,
  codingProcessing: ProcessingParameterType[]
): boolean {
  if (!Array.isArray(valueToCheck)) return false;
  if (valueToCheck.length <= 1) return false;
  if (ruleSet.valueArrayPos !== 'ANY') return false;

  return valueToCheck.every(value => (ruleSet.rules ?? [])
    .every(rule => isMatchRule(value, rule, false, codingProcessing)
    )
  );
}

export function isMatchRuleSet(
  valueToCheck: TransformedResponseValueType,
  ruleSet: RuleSet,
  isValueArray: boolean,
  codingProcessing: ProcessingParameterType[]
): boolean {
  if (!ruleSet.rules || ruleSet.rules.length === 0) {
    return false;
  }

  const valueMemberToCheck = resolveValueArrayPosMember(
    valueToCheck,
    ruleSet,
    isValueArray
  );

  const valueToEvaluate =
    typeof valueMemberToCheck !== 'undefined' ?
      valueMemberToCheck :
      valueToCheck;

  const isValueArrayForRules =
    typeof valueMemberToCheck === 'undefined' && isValueArray;
  const rulesMatch = evaluateRuleSetRules(
    valueToEvaluate,
    ruleSet,
    isValueArrayForRules,
    codingProcessing
  );

  if (rulesMatch && isValueArray && Array.isArray(valueToCheck)) {
    if (ruleSet.valueArrayPos === 'ANY_OPEN' && valueToCheck.length > 0) {
      return evaluateAnyOpen(valueToCheck, ruleSet, codingProcessing);
    }
    if (ruleSet.valueArrayPos === 'ANY' && valueToCheck.length > 1) {
      return evaluateAllMembers(valueToCheck, ruleSet, codingProcessing);
    }
  }

  return rulesMatch;
}
