import {
  ResponseValueSingleType,
  ResponseValueType
} from '@iqbspecs/response/response.interface';
import {
  CodingRule,
  ProcessingParameterType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import {
  getValueAsNumber,
  isEmptyValue,
  transformString
} from '../value-transform';

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
