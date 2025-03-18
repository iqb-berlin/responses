import { ResponseValueSingleType, ResponseValueType, Response } from '@iqbspecs/response/response.interface';
import {
  booleanRules,
  CodingRule, numericRules,
  ProcessingParameterType, RuleSet,
  SourceProcessingType, TransformedResponseValueType,
  VariableCodingData
} from '@iqbspecs/coding-scheme/coding-scheme.interface';

export abstract class CodingFactory {
  static createBaseCodingVariable(varId: string, sourceType: 'BASE' | 'BASE_NO_VALUE'): VariableCodingData {
    return {
      id: varId,
      alias: varId,
      label: '',
      sourceType: sourceType,
      sourceParameters: {
        solverExpression: '',
        processing: []
      },
      deriveSources: [],
      processing: [],
      fragmenting: '',
      manualInstruction: '',
      codeModel: 'NONE',
      codes: []
    } as VariableCodingData;
  }

  static createCodingVariable(varId: string): VariableCodingData {
    return this.createBaseCodingVariable(varId, 'BASE');
  }

  static createNoValueCodingVariable(varId: string): VariableCodingData {
    return this.createBaseCodingVariable(varId, 'BASE_NO_VALUE');
  }

  private static transformString(
    value: string,
    processing: (ProcessingParameterType | SourceProcessingType)[],
    fragmentExp?: RegExp
  ): string | string[] {
    if (fragmentExp) {
      const matchResult = [...value.matchAll(fragmentExp)];
      // Extract all groups, ignore the first entry (full match)
      return matchResult.length > 0 ? matchResult[0].slice(1) : [];
    }

    const shouldRemoveAllSpaces = processing
      .includes('REMOVE_ALL_SPACES') || processing.includes('IGNORE_ALL_SPACES');
    const shouldTrimAndNormalizeSpaces = processing
      .includes('REMOVE_DISPENSABLE_SPACES') || processing.includes('IGNORE_DISPENSABLE_SPACES');
    const shouldConvertToLowerCase = processing
      .includes('IGNORE_CASE') || processing.includes('TO_LOWER_CASE');

    let transformedString = value;

    // Remove all whitespaces if the respective setting is enabled
    if (shouldRemoveAllSpaces && transformedString) {
      transformedString = transformedString.replace(/\s+/g, '');
    }

    // Normalize whitespaces if needed (trim and reduce multiple internal spaces)
    if (shouldTrimAndNormalizeSpaces && transformedString) {
      transformedString = transformedString.trim().replace(/\s+/g, ' ');
    }

    // Convert string to lowercase if enabled
    if (shouldConvertToLowerCase && transformedString) {
      transformedString = transformedString.toLowerCase();
    }

    return transformedString;
  }

  private static transformValue(
    value: ResponseValueType,
    fragmenting: string,
    sortArray: boolean
  ): TransformedResponseValueType {
    const fragmentRegEx = fragmenting ? new RegExp(fragmenting, 'g') : undefined;
    const transformIfString = (v: unknown): unknown => {
      if (typeof v === 'string') {
        return this.transformString(v, [], fragmentRegEx);
      }
      return v;
    };

    if (Array.isArray(value)) {
      if (sortArray) {
        value.sort((a, b) => {
          const aAsString = this.getValueAsString(a) || '';
          const bAsString = this.getValueAsString(b) || '';
          return aAsString.localeCompare(bAsString);
        });
      }
      return value.map(transformIfString) as TransformedResponseValueType;
    }

    if (typeof value === 'string') {
      return this.transformString(value, [], fragmentRegEx);
    }

    // Return the value as-is if no transformation is needed
    return value;
  }

  private static findString(
    value: string,
    codingProcessing: ProcessingParameterType[],
    parameters: string[] = []
  ): boolean {
    // Flatten and transform all strings from parameters
    const allStrings = parameters
      .flatMap(p => p.split(/\r?\n/)) // Split parameters into lines
      .map(s => {
        const transformed = this.transformString(s, codingProcessing);
        return Array.isArray(transformed) ? (transformed[0] || '') : transformed;
      });

    // Transform the value to be compared
    let stringToCompare = this.transformString(value, codingProcessing);
    if (Array.isArray(stringToCompare)) {
      stringToCompare = stringToCompare[0] || '';
    }

    // Check if the transformed value exists in the list
    return allStrings.includes(stringToCompare);
  }

  private static findStringRegEx(
    value: string,
    parameters: string[],
    addCaseIgnoreFlag: boolean
  ): boolean {
    // Combine all strings from the given parameters by splitting them line by line
    const allStrings = parameters.flatMap(p => p.split(/\r?\n/));

    // Check if at least one regex matches the given value
    return allStrings.some(s => {
      const regEx = new RegExp(s, addCaseIgnoreFlag ? 'i' : undefined);
      return regEx.test(value);
    });
  }

  private static findNumericValue(value: ResponseValueSingleType, parameters: string[] = []): boolean {
    const allCompareValues = parameters
      .flatMap(p => p.split(/\r?\n/))
      .map(s => this.getValueAsNumber(s));
    const valueAsNumber = this.getValueAsNumber(value);
    return valueAsNumber !== null && allCompareValues.includes(valueAsNumber);
  }

  static getValueAsNumber(value: ResponseValueSingleType): number | null {
    if (value === null || value === '') {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (typeof value === 'string') {
      // Normalize the string (remove spaces and adjust decimal separator)
      let normalizedString = value.trim();
      normalizedString = normalizedString.replace(/\s+/g, '') // Remove all whitespace
        .replace(',', '.'); // Replace comma with dot as decimal separator

      // Check if the string represents a valid number
      const isInvalidNumber = !/^[-+]?\d+(\.\d+)?$/.test(normalizedString);
      if (isInvalidNumber) {
        return null;
      }

      // Parse the number, check for NaN, and return the result
      const parsedValue = Number.parseFloat(normalizedString);
      return Number.isNaN(parsedValue) ? null : parsedValue;
    }

    // If the value is of an unsupported type, return null
    return null;
  }

  static getValueAsString(
    value: ResponseValueSingleType,
    processing: (ProcessingParameterType | SourceProcessingType)[] = []
  ): string | null {
    if (typeof value === 'number') {
      return value.toString(10);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'string') {
      let processedString = value;
      if (processing.includes('REMOVE_ALL_SPACES') || processing.includes('IGNORE_ALL_SPACES')) {
        processedString = processedString.replace(/\s/g, '');
      } else if (processing.includes('REMOVE_DISPENSABLE_SPACES') || processing.includes('IGNORE_DISPENSABLE_SPACES')) {
        processedString = processedString.trim().replace(/\s+/g, ' ');
      }
      if (processing.includes('TO_LOWER_CASE')) {
        processedString = processedString.toLowerCase();
      }
      return processedString;
    }
    // Return null if the value cannot be converted to a string
    return null;
  }

  static isValidValueForRule(
    valueToCheck: ResponseValueSingleType,
    valueMustBeNumeric: boolean,
    valueMustBeBoolean: boolean
  ): boolean {
    if (valueMustBeNumeric) {
      return this.isNumeric(valueToCheck);
    }

    if (valueMustBeBoolean) {
      return this.isBooleanLike(valueToCheck);
    }

    return true;
  }

  private static isNumeric(value: unknown): boolean {
    const valueAsNumber = this.getValueAsNumber(value as ResponseValueSingleType);
    return typeof valueAsNumber === 'number' && !Number.isNaN(valueAsNumber);
  }

  private static isBooleanLike(value: unknown): boolean {
    const booleanLikeValues = [0, 1, '0', '1', true, false, 'true', 'false', null];
    return booleanLikeValues.includes(value as string | number | boolean | null);
  }

  static isValidRule(
    valueToCheck: TransformedResponseValueType,
    rule: CodingRule,
    isValueArray: boolean
  ): boolean {
    const valueMustBeNumeric = numericRules.includes(rule.method);
    const valueMustBeBoolean = booleanRules.includes(rule.method);

    // If the rule doesn't require numeric or boolean handling, it's valid by default.
    if (!valueMustBeNumeric && !valueMustBeBoolean) {
      return true;
    }

    // Helper method to validate a single value based on the rule requirements.
    const validateValue = (value: ResponseValueSingleType): boolean => this.isValidValueForRule(value, valueMustBeNumeric, valueMustBeBoolean);

    // Helper method to extract the fragment value from an array based on the rule.
    const getFragmentValue = (arr: unknown[]): unknown => (rule.fragment && rule.fragment >= 0 && arr.length > rule.fragment ?
      arr[rule.fragment] :
      arr[0]);

    if (Array.isArray(valueToCheck)) {
      // Handle cases where the valueToCheck is an array.
      if (isValueArray) {
        // If valueToCheck contains nested arrays, validate each element.
        return valueToCheck.every(v => (Array.isArray(v) ? validateValue(getFragmentValue(v) as ResponseValueSingleType) : validateValue(v as ResponseValueSingleType))
        );
      }
      // If valueToCheck is a single array, extract a fragment value and validate it.
      return validateValue(getFragmentValue(valueToCheck) as ResponseValueSingleType);
    }

    // Handle cases where valueToCheck is a single value.
    return validateValue(valueToCheck);
  }

  static isEmptyValue(value: ResponseValueType): boolean {
    return value === '' || (Array.isArray(value) && value.length === 0);
  }

  static checkOneValue(valueToCheck: ResponseValueSingleType,
                       rule: CodingRule, codingProcessing:
                       ProcessingParameterType[]): boolean {
    let returnValue = false;
    let valueAsNumber: number | null = null;
    // eslint-disable-next-line default-case
    switch (rule.method) {
      case 'IS_NULL':
        if (valueToCheck === null) returnValue = true;
        break;
      case 'IS_EMPTY':
        if (this.isEmptyValue(valueToCheck)) returnValue = true;
        break;
      case 'MATCH':
        if (valueToCheck !== null && valueToCheck !== '') {
          if (typeof valueToCheck === 'number') {
            // eslint-disable-next-line no-param-reassign
            valueToCheck = valueToCheck.toString(10);
          } else if (typeof valueToCheck === 'boolean') {
            // eslint-disable-next-line no-param-reassign
            valueToCheck = valueToCheck.toString();
          }
          returnValue = this.findString(valueToCheck, codingProcessing, rule.parameters);
        }
        break;
      case 'MATCH_REGEX':
        if (valueToCheck !== null && valueToCheck !== '') {
          if (typeof valueToCheck === 'number') {
            // eslint-disable-next-line no-param-reassign
            valueToCheck = valueToCheck.toString(10);
          } else if (typeof valueToCheck === 'boolean') {
            // eslint-disable-next-line no-param-reassign
            valueToCheck = valueToCheck.toString();
          }
          returnValue = this.findStringRegEx(
            valueToCheck, rule.parameters || [], codingProcessing.includes('IGNORE_CASE'));
        }
        break;
      case 'NUMERIC_MATCH':
        returnValue = this.findNumericValue(valueToCheck, rule.parameters);
        break;
      case 'NUMERIC_LESS_THAN':
        if (valueToCheck !== null && valueToCheck !== '') {
          valueAsNumber = this.getValueAsNumber(valueToCheck);
          if (typeof valueAsNumber === 'number' && rule.parameters) {
            const compareValue = Number.parseFloat(rule.parameters[0]);
            returnValue = !Number.isNaN(compareValue) && valueAsNumber < compareValue;
          }
        }
        break;
      case 'NUMERIC_MAX':
        if (valueToCheck !== null && valueToCheck !== '') {
          valueAsNumber = this.getValueAsNumber(valueToCheck);
          if (typeof valueAsNumber === 'number' && rule.parameters) {
            const compareValue = Number.parseFloat(rule.parameters[0]);
            returnValue = !Number.isNaN(compareValue) && valueAsNumber <= compareValue;
          }
        }
        break;
      case 'NUMERIC_MORE_THAN':
        if (valueToCheck !== null && valueToCheck !== '') {
          valueAsNumber = this.getValueAsNumber(valueToCheck);
          if (typeof valueAsNumber === 'number' && rule.parameters) {
            const compareValue = Number.parseFloat(rule.parameters[0]);
            returnValue = !Number.isNaN(compareValue) && valueAsNumber > compareValue;
          }
        }
        break;
      case 'NUMERIC_MIN':
        if (valueToCheck !== null && valueToCheck !== '') {
          valueAsNumber = this.getValueAsNumber(valueToCheck);
          if (typeof valueAsNumber === 'number' && rule.parameters) {
            const compareValue = Number.parseFloat(rule.parameters[0]);
            returnValue = !Number.isNaN(compareValue) && valueAsNumber >= compareValue;
          }
        }
        break;
      case 'NUMERIC_RANGE':
        if (valueToCheck !== null && valueToCheck !== '') {
          valueAsNumber = this.getValueAsNumber(valueToCheck);
          if (typeof valueAsNumber === 'number' && rule.parameters) {
            const compareValueLL = this.getValueAsNumber(rule.parameters[0]);
            const compareValueUL = this.getValueAsNumber(rule.parameters[1]);
            if (typeof compareValueLL === 'number' && typeof compareValueUL === 'number') returnValue = valueAsNumber > compareValueLL && valueAsNumber <= compareValueUL;
          }
        }
        break;
      case 'NUMERIC_FULL_RANGE':
        if (valueToCheck !== null && valueToCheck !== '') {
          valueAsNumber = this.getValueAsNumber(valueToCheck);
          if (typeof valueAsNumber === 'number' && rule.parameters) {
            const compareValueLL = this.getValueAsNumber(rule.parameters[0]);
            const compareValueUL = this.getValueAsNumber(rule.parameters[1]);
            // eslint-disable-next-line max-len
            if (typeof compareValueLL === 'number' && typeof compareValueUL === 'number') returnValue = valueAsNumber >= compareValueLL && valueAsNumber <= compareValueUL;
          }
        }
        break;
      case 'IS_TRUE':
        returnValue = valueToCheck === 1 || valueToCheck === '1' || valueToCheck === true || valueToCheck === 'true';
        break;
      case 'IS_FALSE':
        returnValue = valueToCheck === 0 || valueToCheck === '0' || valueToCheck === false || valueToCheck === 'false';
        break;
    }
    return returnValue;
  }

  private static isMatchRule(valueToCheck: TransformedResponseValueType, rule: CodingRule,
                             isValueArray: boolean, codingProcessing: ProcessingParameterType[]): boolean {
    if (Array.isArray(valueToCheck) && isValueArray) {
      if (valueToCheck.length === 0) {
        return CodingFactory.checkOneValue('', rule, codingProcessing);
      }
      // eslint-disable-next-line no-restricted-syntax
      for (const valueMember of valueToCheck) {
        if (Array.isArray(valueMember)) {
          if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
            // eslint-disable-next-line no-restricted-syntax
            for (const fragment of valueMember) {
              if (CodingFactory.checkOneValue(fragment, rule, codingProcessing)) {
                return true;
              }
            }
          } else if (CodingFactory.checkOneValue(valueMember[rule.fragment], rule, codingProcessing)) {
            return true;
          }
        } else if (CodingFactory.checkOneValue(valueMember, rule, codingProcessing)) {
          return true;
        }
      }
      return false;
    }
    if (Array.isArray(valueToCheck)) {
      const { fragment } = rule;
      // Check all fragments if `fragment` is undefined or negative
      if (fragment == null || fragment < 0) {
        return valueToCheck.some(value => CodingFactory.checkOneValue(value as string, rule, codingProcessing)
        );
      }
      // Check specific fragment
      return CodingFactory.checkOneValue(
        valueToCheck[fragment] as string,
        rule,
        codingProcessing
      );
    }
    return CodingFactory.checkOneValue(valueToCheck as ResponseValueSingleType, rule, codingProcessing);
  }

  private static isMatchRuleSet(valueToCheck: TransformedResponseValueType, ruleSet: RuleSet,
                                isValueArray: boolean, codingProcessing: ProcessingParameterType[]): boolean {
    let valueMemberToCheck;
    if (isValueArray && Array.isArray(valueToCheck)) {
      if (typeof ruleSet.valueArrayPos === 'number') {
        if (ruleSet.valueArrayPos >= 0 && ruleSet.valueArrayPos < valueToCheck.length) {
          valueMemberToCheck = valueToCheck[ruleSet.valueArrayPos];
        }
      } else if (ruleSet.valueArrayPos === 'SUM') {
        valueMemberToCheck = valueToCheck.map(v => {
          if (Array.isArray(v)) {
            return v.map(s => this.getValueAsNumber(s) || 0).reduce((a, b) => a + b, 0);
          }
          return this.getValueAsNumber(v) || 0;
        }).reduce((pv, cv) => pv + cv, 0);
      } else if (ruleSet.valueArrayPos === 'LENGTH') {
        valueMemberToCheck = valueToCheck.length;
      }
    }
    let oneMatch = false;
    let oneMisMatch = false;
    let ruleIndex = 0;
    let matchAll = false;
    while (!oneMatch && ruleIndex < ruleSet.rules.length) {
      const currentRule = ruleSet.rules[ruleIndex];
      const valueToEvaluate = typeof valueMemberToCheck !== 'undefined' ? valueMemberToCheck : valueToCheck;
      const isMatch = this.isMatchRule(valueToEvaluate, currentRule, typeof valueMemberToCheck === 'undefined' && isValueArray, codingProcessing);

      if (isMatch) {
        if (!ruleSet.ruleOperatorAnd) {
          oneMatch = true;
        } else {
          matchAll = true;
        }
      } else {
        oneMisMatch = true;
      }

      ruleIndex += 1;
    }
    if (
      oneMatch &&
      isValueArray &&
      Array.isArray(valueToCheck) &&
      valueToCheck.length > 1 &&
      ruleSet.valueArrayPos === 'ANY'
    ) {
      // Check if ALL values in the array comply with the rules
      oneMatch = valueToCheck.every(value => ruleSet.rules
        .every(rule => this.isMatchRule(value, rule, false, codingProcessing)
        )
      );
    }

    return ((oneMatch) || (matchAll && !oneMisMatch));
  }

  static code(response: Response, coding: VariableCodingData): Response {
    const stringifiedResponse = JSON.stringify(response);
    const newResponse: Response = JSON.parse(stringifiedResponse);
    if (coding && coding.codes.length > 0) {
      let valueToCheck: TransformedResponseValueType | null = null;
      try {
        const shouldSortArray = Boolean(coding.processing && coding.processing.includes('SORT_ARRAY'));
        const fragmentingPattern = coding.fragmenting || '';
        valueToCheck = this.transformValue(newResponse.value, fragmentingPattern, shouldSortArray);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error during value transformation:', error.message);
        }
        newResponse.status = 'CODING_ERROR';
      }

      if (newResponse.status !== 'CODING_ERROR') {
        let hasElse = false;
        let elseCode: 'INVALID' | 'INTENDED_INCOMPLETE' | number = 0;
        let elseScore = 0;
        let changed = false;

        coding.codes.forEach(c => {
          if (!changed) {
            // ignore other rules if ELSE-rule found
            if (c.type === 'RESIDUAL_AUTO' || c.type === 'INTENDED_INCOMPLETE') {
              hasElse = true;
              elseCode = c.id;
              elseScore = c.score;
            } else {
              // todo: this section is somehow unclear!
              //  It will find a rule(set) which is invalid OR for which the value is invalid.
              //  But for what? The rules should be validated elsewhere, and whether the value is valid for all
              //  rules or not (numeric?) is not important.
              /**
              const invalidRule = c.ruleSets.find(rs => !!rs.rules.find(r => {
                if (typeof rs.valueArrayPos === 'number' && rs.valueArrayPos >= 0) {
                  return Array.isArray(newResponse.value) && Array.isArray(valueToCheck) ?
                    !CodingFactory.isValidRule(valueToCheck[rs.valueArrayPos], r, false) : true;
                }
                return !CodingFactory.isValidRule(valueToCheck, r, Array.isArray(newResponse.value));
              }));
                  * */
              const invalidRule = false;
              if (invalidRule) {
                newResponse.status = 'CODING_ERROR';
                changed = true;
              } else {
                let hasMatch = false;
                let hasMismatch = false;
                let matchAll = false;

                // eslint-disable-next-line no-restricted-syntax
                for (const currentRuleSet of c.ruleSets) {
                  const isMatchingRuleSet = CodingFactory.isMatchRuleSet(
                    valueToCheck,
                    currentRuleSet,
                    Array.isArray(newResponse.value),
                    coding.processing || []
                  );

                  if (isMatchingRuleSet) {
                    if (c.ruleSetOperatorAnd) {
                      matchAll = true;
                    } else {
                      hasMatch = true;
                      break; // break if OR operator and match
                    }
                  } else {
                    hasMismatch = true;
                  }
                }

                if ((hasMatch || matchAll) && !hasMismatch) {
                  const { id, score } = c;
                  newResponse.status = (id === 'INVALID' || id === 'INTENDED_INCOMPLETE') ? id : 'CODING_COMPLETE';
                  newResponse.code = (id === 'INVALID' || id === 'INTENDED_INCOMPLETE') ? 0 : id;
                  if (newResponse.status === 'CODING_COMPLETE') {
                    newResponse.score = score || 0;
                  }
                  changed = true;
                }
              }
            }
          }
        });
        if (!changed) {
          if (hasElse) {
            // @ts-expect-error elseCode is 'INVALID' | 'INTENDED_INCOMPLETE' | number
            if (elseCode === 'INTENDED_INCOMPLETE') {
              newResponse.status = 'INTENDED_INCOMPLETE';
              newResponse.code = 0;
              newResponse.score = 0;
            // @ts-expect-error elseCode is 'INVALID' | 'INTENDED_INCOMPLETE' | number
            } else if (elseCode === 'INVALID') {
              newResponse.status = 'INVALID';
              newResponse.code = 0;
              newResponse.score = 0;
            } else {
              newResponse.code = elseCode;
              newResponse.score = elseScore;
              newResponse.status = 'CODING_COMPLETE';
            }
          } else {
            newResponse.status = 'CODING_INCOMPLETE';
          }
          changed = true;
        }
      }
    } else {
      newResponse.status = 'NO_CODING';
    }
    return newResponse;
  }
}
