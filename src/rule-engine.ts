import {
  ResponseValueSingleType,
  ResponseValueType
} from '@iqbspecs/response/response.interface';
import {
  CodingRule,
  ProcessingParameterType,
  RuleSet,
  TransformedResponseValueType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import {
  getValueAsNumber,
  isEmptyValue,
  transformString
} from './value-transform';

function findString(
  value: string,
  codingProcessing: ProcessingParameterType[],
  parameters: string[] = []
): boolean {
  const allStrings = parameters
    .flatMap(p => p.split(/\r?\n/))
    .map(s => {
      const transformed = transformString(s, codingProcessing);
      return Array.isArray(transformed) ? transformed[0] || '' : transformed;
    });

  let stringToCompare = transformString(value, codingProcessing);
  if (Array.isArray(stringToCompare)) {
    stringToCompare = stringToCompare[0] || '';
  }

  return allStrings.includes(stringToCompare);
}

function findStringRegEx(
  value: string,
  parameters: string[],
  addCaseIgnoreFlag: boolean
): boolean {
  const allStrings = parameters.flatMap(p => p.split(/\r?\n/));
  return allStrings.some(s => {
    try {
      const regEx = new RegExp(s, addCaseIgnoreFlag ? 'i' : undefined);
      return regEx.test(value);
    } catch (e) {
      return false;
    }
  });
}

function findNumericValue(
  value: ResponseValueSingleType,
  parameters: string[] = []
): boolean {
  const allCompareValues = parameters
    .flatMap(p => p.split(/\r?\n/))
    .map(s => getValueAsNumber(s));
  const valueAsNumber = getValueAsNumber(value);
  return valueAsNumber !== null && allCompareValues.includes(valueAsNumber);
}

export function checkOneValue(
  valueToCheck: ResponseValueSingleType,
  rule: CodingRule,
  codingProcessing: ProcessingParameterType[]
): boolean {
  let returnValue = false;
  let valueAsNumber: number | null = null;

  // eslint-disable-next-line default-case
  switch (rule.method) {
    case 'IS_NULL':
      if (valueToCheck === null) returnValue = true;
      break;
    case 'IS_EMPTY':
      if (isEmptyValue(valueToCheck as ResponseValueType)) returnValue = true;
      break;
    case 'MATCH':
      if (valueToCheck !== null && valueToCheck !== '') {
        let valueAsString = valueToCheck;
        if (typeof valueToCheck === 'number') {
          valueAsString = valueToCheck.toString(10);
        } else if (typeof valueToCheck === 'boolean') {
          valueAsString = valueToCheck.toString();
        }
        returnValue = findString(
          valueAsString as string,
          codingProcessing,
          rule.parameters
        );
      }
      break;
    case 'MATCH_REGEX':
      if (valueToCheck !== null && valueToCheck !== '') {
        let valueAsString = valueToCheck;
        if (typeof valueToCheck === 'number') {
          valueAsString = valueToCheck.toString(10);
        } else if (typeof valueToCheck === 'boolean') {
          valueAsString = valueToCheck.toString();
        }
        returnValue = findStringRegEx(
          valueAsString as string,
          rule.parameters || [],
          codingProcessing.includes('IGNORE_CASE')
        );
      }
      break;
    case 'NUMERIC_MATCH':
      returnValue = findNumericValue(valueToCheck, rule.parameters);
      break;
    case 'NUMERIC_LESS_THAN':
      if (valueToCheck !== null && valueToCheck !== '') {
        valueAsNumber = getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue =
            !Number.isNaN(compareValue) && valueAsNumber < compareValue;
        }
      }
      break;
    case 'NUMERIC_MAX':
      if (valueToCheck !== null && valueToCheck !== '') {
        valueAsNumber = getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue =
            !Number.isNaN(compareValue) && valueAsNumber <= compareValue;
        }
      }
      break;
    case 'NUMERIC_MORE_THAN':
      if (valueToCheck !== null && valueToCheck !== '') {
        valueAsNumber = getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue =
            !Number.isNaN(compareValue) && valueAsNumber > compareValue;
        }
      }
      break;
    case 'NUMERIC_MIN':
      if (valueToCheck !== null && valueToCheck !== '') {
        valueAsNumber = getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue =
            !Number.isNaN(compareValue) && valueAsNumber >= compareValue;
        }
      }
      break;
    case 'NUMERIC_RANGE':
      if (valueToCheck !== null && valueToCheck !== '') {
        valueAsNumber = getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValueLL = getValueAsNumber(rule.parameters[0]);
          const compareValueUL = getValueAsNumber(rule.parameters[1]);
          if (
            typeof compareValueLL === 'number' &&
            typeof compareValueUL === 'number'
          ) {
            returnValue =
              valueAsNumber > compareValueLL && valueAsNumber <= compareValueUL;
          }
        }
      }
      break;
    case 'NUMERIC_FULL_RANGE':
      if (valueToCheck !== null && valueToCheck !== '') {
        valueAsNumber = getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValueLL = getValueAsNumber(rule.parameters[0]);
          const compareValueUL = getValueAsNumber(rule.parameters[1]);
          if (
            typeof compareValueLL === 'number' &&
            typeof compareValueUL === 'number'
          ) {
            returnValue =
              valueAsNumber >= compareValueLL &&
              valueAsNumber <= compareValueUL;
          }
        }
      }
      break;
    case 'IS_TRUE':
      returnValue =
        valueToCheck === 1 ||
        valueToCheck === '1' ||
        valueToCheck === true ||
        valueToCheck === 'true';
      break;
    case 'IS_FALSE':
      returnValue =
        valueToCheck === 0 ||
        valueToCheck === '0' ||
        valueToCheck === false ||
        valueToCheck === 'false';
      break;
  }

  return returnValue;
}

function isMatchRule(
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

function resolveValueArrayPosMember(
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

  return valueToCheck.some(value => (ruleSet.rules ?? []).every(rule => isMatchRule(value, rule, false, codingProcessing)
  )
  );
}

function evaluateAny(
  valueToCheck: TransformedResponseValueType,
  ruleSet: RuleSet,
  codingProcessing: ProcessingParameterType[]
): boolean {
  if (!Array.isArray(valueToCheck)) return false;
  if (valueToCheck.length <= 1) return false;
  if (ruleSet.valueArrayPos !== 'ANY') return false;

  return valueToCheck.every(value => (ruleSet.rules ?? []).every(rule => isMatchRule(value, rule, false, codingProcessing)
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
      return evaluateAny(valueToCheck, ruleSet, codingProcessing);
    }
  }

  return rulesMatch;
}
