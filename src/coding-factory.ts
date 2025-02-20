import {
  ResponseValueType,
  VariableCodingData,
  Response,
  ProcessingParameterType,
  CodingRule,
  ResponseValueSingleType,
  TransformedResponseValueType,
  RuleSet,
  SourceProcessingType, numericRules, booleanRules
} from './coding-interfaces';

export abstract class CodingFactory {
  static createCodingVariable(varId: string): VariableCodingData {
    return <VariableCodingData>{
      id: varId,
      alias: varId,
      label: '',
      sourceType: 'BASE',
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
    };
  }

  static createNoValueCodingVariable(varId: string): VariableCodingData {
    return <VariableCodingData>{
      id: varId,
      alias: varId,
      label: '',
      sourceType: 'BASE_NO_VALUE',
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
    };
  }

  private static transformString(
    value: string,
    processing: (ProcessingParameterType | SourceProcessingType)[],
    fragmentExp?: RegExp
  ): string | string[] {
    if (fragmentExp) {
      const newValueArray = [...value.matchAll(fragmentExp)];
      return newValueArray[0].filter((v, i) => i > 0);
    }
    const removeAllWhiteSpaces = processing.includes('REMOVE_ALL_SPACES') || processing.includes('IGNORE_ALL_SPACES');
    // eslint-disable-next-line max-len
    const removeDispensableWhiteSpaces = processing.includes('REMOVE_DISPENSABLE_SPACES') || processing.includes('IGNORE_DISPENSABLE_SPACES');
    const toLowerCase = processing.includes('IGNORE_CASE') || processing.includes('TO_LOWER_CASE');
    let newString = value && removeAllWhiteSpaces ? value.replace(/\s+/g, '') : value;
    if (newString && removeDispensableWhiteSpaces) newString = newString.trim().replace(/\s+/g, ' ');
    if (newString && toLowerCase) newString = newString.toLowerCase();
    return newString;
  }

  private static transformValue(
    value: ResponseValueType,
    fragmenting: string,
    sortArray : boolean
  ): TransformedResponseValueType {
    // raises exceptions if transformation fails
    const fragmentRegEx = fragmenting ? new RegExp(fragmenting, 'g') : undefined;
    if (Array.isArray(value)) {
      if (sortArray) {
        return value.sort((a, b) => {
          const aAsString = this.getValueAsString(a) || '';
          const bAsString = this.getValueAsString(b) || '';
          if (aAsString < bAsString) return -1;
          if (aAsString > bAsString) return 1;
          return 0;
        }).map(v => {
          if (v && typeof v === 'string') return this.transformString(v, [], fragmentRegEx);
          return v;
        }) as TransformedResponseValueType;
      }
      return value.map(v => {
        if (v && typeof v === 'string') return this.transformString(v, [], fragmentRegEx);
        return v;
      }) as TransformedResponseValueType;
    }
    if (value && typeof value === 'string') return this.transformString(value, [], fragmentRegEx);
    return value;
  }

  private static findString(value: string,
                            codingProcessing: ProcessingParameterType[],
                            parameters: string[] = []): boolean {
    let allStrings: string[] = [];
    parameters.forEach(p => {
      allStrings.push(...p.split(/\r?\n/));
    });
    allStrings = allStrings.map(s => {
      const newValue = this.transformString(s, codingProcessing);
      if (Array.isArray(newValue)) return newValue[0] || '';
      return newValue;
    });
    let stringToCompare = this.transformString(value, codingProcessing);
    if (Array.isArray(stringToCompare)) stringToCompare = stringToCompare[0] || '';
    const inList = allStrings.find(s => stringToCompare === s);
    return !!inList;
  }

  private static findStringRegEx(value: string, parameters: string[], addCaseIgnoreFlag: boolean): boolean {
    const allStrings: string[] = [];
    parameters.forEach(p => {
      allStrings.push(...p.split(/\r?\n/));
    });
    const trueCases = allStrings.map((s: string): boolean => {
      const regEx = addCaseIgnoreFlag ? new RegExp(s, 'i') : new RegExp(s);
      return !!regEx.exec(value);
    }).filter(found => found);
    return trueCases.length > 0;
  }

  private static findNumericValue(value: ResponseValueSingleType, parameters: string[] = []): boolean {
    const allStrings: string[] = [];
    parameters.forEach(p => {
      allStrings.push(...p.split(/\r?\n/));
    });
    const allCompareValues = allStrings.map(s => this.getValueAsNumber(s));
    const valueAsNumber = this.getValueAsNumber(value);
    if (valueAsNumber !== null) {
      const firstMatch = allCompareValues.find(v => v === valueAsNumber);
      if (firstMatch || firstMatch === 0) {
        return true;
      }
    }
    return false;
  }

  static getValueAsNumber(value: ResponseValueSingleType): number | null {
    if (value === null || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return (value as boolean) ? 1 : 0;
    let normalizedString = value.length < 6 ? (value as string).replace('.', ',') : value;
    normalizedString = normalizedString.replace(/\s/g, '');
    normalizedString = normalizedString.replace(',', '.');
    const isInvalidNumber = !/^[-+]?\d+\.?\d*$/.exec(normalizedString);
    if (isInvalidNumber) return null;
    const validValue = Number.parseFloat(normalizedString);
    return Number.isNaN(validValue) ? null : validValue;
  }

  static getValueAsString(
    value: ResponseValueSingleType,
    processing: (ProcessingParameterType | SourceProcessingType)[] = []): string | null {
    if (typeof value === 'number') return value.toString(10);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') {
      let newString = value as string;
      if (processing.includes('REMOVE_ALL_SPACES') || processing.includes('IGNORE_ALL_SPACES')) {
        newString = newString.replace(/\s/g, '');
      } else if (processing.includes('REMOVE_DISPENSABLE_SPACES') || processing.includes('IGNORE_DISPENSABLE_SPACES')) {
        newString = newString.trim().replace(/\s+/g, ' ');
      }
      if (processing.includes('TO_LOWER_CASE')) newString = newString.toLowerCase();
      return newString;
    }
    return null;
  }

  static isValidValueForRule(
    valueToCheck: ResponseValueSingleType,
    valueMustBeNumeric: boolean,
    valueMustBeBoolean: boolean
  ): boolean {
    if (valueMustBeNumeric) {
      const valueAsNumber = this.getValueAsNumber(valueToCheck);
      return typeof valueAsNumber === 'number';
    }
    if (valueMustBeBoolean) {
      return valueToCheck === 0 ||
        valueToCheck === 1 ||
        valueToCheck === '1' ||
        valueToCheck === true ||
        valueToCheck === 'true' ||
        valueToCheck === '0' ||
        valueToCheck === false ||
        valueToCheck === 'false' ||
        valueToCheck === null;
    }
    return true;
  }

  static isValidRule(
    valueToCheck: TransformedResponseValueType,
    rule: CodingRule,
    isValueArray: boolean
  ): boolean {
    let returnValue = true;
    const valueMustBeNumeric = numericRules.includes(rule.method);
    const valueMustBeBoolean = booleanRules.includes(rule.method);
    if (valueMustBeNumeric || valueMustBeBoolean) {
      if (isValueArray && Array.isArray(valueToCheck)) {
        valueToCheck.forEach(v => {
          if (returnValue) {
            if (Array.isArray(v)) {
              if (rule.fragment && rule.fragment >= 0 && v.length >= rule.fragment) {
                returnValue = this.isValidValueForRule(v[rule.fragment], valueMustBeNumeric, valueMustBeBoolean);
              } else {
                returnValue = this.isValidValueForRule(v[0], valueMustBeNumeric, valueMustBeBoolean);
              }
            } else {
              returnValue = this.isValidValueForRule(v, valueMustBeNumeric, valueMustBeBoolean);
            }
          }
        });
      } else if (Array.isArray(valueToCheck)) {
        let newValueToCheck: ResponseValueSingleType = valueToCheck[0] as ResponseValueSingleType;
        if (rule.fragment && rule.fragment >= 0 && valueToCheck.length >= rule.fragment) {
          newValueToCheck = valueToCheck[rule.fragment] as ResponseValueSingleType;
        }
        returnValue = this.isValidValueForRule(newValueToCheck, valueMustBeNumeric, valueMustBeBoolean);
      } else {
        returnValue = this.isValidValueForRule(valueToCheck, valueMustBeNumeric, valueMustBeBoolean);
      }
    }
    return returnValue;
  }

  static isEmptyValue(value: ResponseValueType): boolean {
    if (value === '') return true;
    const isArray = Array.isArray(value);
    return isArray && value.length === 0;
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
            // eslint-disable-next-line max-len
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
      let valueIndex = 0;
      let oneMatch = false;
      while (!oneMatch && valueIndex < valueToCheck.length) {
        const valueMemberToCheck = valueToCheck[valueIndex];
        if (Array.isArray(valueMemberToCheck)) {
          if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
            let fragmentIndex = 0;
            while (!oneMatch && fragmentIndex < valueMemberToCheck.length) {
              if (CodingFactory.checkOneValue(valueMemberToCheck[fragmentIndex],
                rule,
                codingProcessing)) { oneMatch = true; }
              fragmentIndex += 1;
            }
          } else if (
            CodingFactory.checkOneValue(valueMemberToCheck[rule.fragment],
              rule,
              codingProcessing
            )) { oneMatch = true; }
        } else if (CodingFactory.checkOneValue(valueMemberToCheck, rule, codingProcessing)) oneMatch = true;
        valueIndex += 1;
      }
      if (valueToCheck.length === 0) {
        if (CodingFactory.checkOneValue('', rule, codingProcessing)) {
          oneMatch = true;
        }
      }
      return oneMatch;
    }
    if (Array.isArray(valueToCheck)) {
      if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
        let fragmentIndex = 0;
        let oneMatch = false;
        while (!oneMatch && fragmentIndex < valueToCheck.length) {
          if (CodingFactory.checkOneValue(valueToCheck[fragmentIndex] as string,
            rule,
            codingProcessing)) { oneMatch = true; }
          fragmentIndex += 1;
        }
        return oneMatch;
      }
      return CodingFactory.checkOneValue(valueToCheck[rule.fragment] as string, rule, codingProcessing);
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
      let isMatch;
      if (typeof valueMemberToCheck !== 'undefined') {
        isMatch = this.isMatchRule(valueMemberToCheck, ruleSet.rules[ruleIndex], false, codingProcessing);
      } else {
        isMatch = this.isMatchRule(valueToCheck, ruleSet.rules[ruleIndex], isValueArray, codingProcessing);
      }
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
    if (oneMatch && isValueArray &&
      Array.isArray(valueToCheck) &&
      valueToCheck.length > 1 &&
      ruleSet.valueArrayPos === 'ANY') {
      // check whether ALL values in array match
      let valueIndex = 0;
      while (oneMatch && valueIndex < valueToCheck.length) {
        // eslint-disable-next-line @typescript-eslint/no-shadow
        let ruleIndex = 0;
        while (oneMatch && ruleIndex < ruleSet.rules.length) {
          oneMatch = this.isMatchRule(valueToCheck[valueIndex], ruleSet.rules[ruleIndex], false, codingProcessing);
          ruleIndex += 1;
        }
        valueIndex += 1;
      }
    }
    return ((oneMatch) || (matchAll && !oneMisMatch));
  }

  static code(response: Response, coding: VariableCodingData): Response {
    const stringifiedResponse = JSON.stringify(response);
    const newResponse: Response = JSON.parse(stringifiedResponse);
    if (coding && coding.codes.length > 0) {
      let valueToCheck: TransformedResponseValueType;
      try {
        valueToCheck = this.transformValue(
          newResponse.value, coding.fragmenting || '', coding.processing && coding.processing.includes('SORT_ARRAY')
        );
      } catch (e) {
        newResponse.status = 'CODING_ERROR';
        valueToCheck = null;
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
                let oneMatch = false;
                let oneMisMatch = false;
                let ruleSetIndex = 0;
                let matchAll = false;
                while (!oneMatch && ruleSetIndex < c.ruleSets.length) {
                  if (!c.ruleSetOperatorAnd) {
                    if (CodingFactory.isMatchRuleSet(valueToCheck,
                      c.ruleSets[ruleSetIndex],
                      Array.isArray(newResponse.value),
                      coding.processing || [])) {
                      oneMatch = true;
                    } else {
                      oneMisMatch = true;
                    }
                  } else if (CodingFactory.isMatchRuleSet(valueToCheck,
                    c.ruleSets[ruleSetIndex],
                    Array.isArray(newResponse.value),
                    coding.processing || [])) {
                    matchAll = true;
                  } else {
                    oneMisMatch = true;
                  }

                  ruleSetIndex += 1;
                }
                if ((oneMatch || matchAll) && (!oneMisMatch)) {
                  if (c.id === 'INVALID') {
                    newResponse.status = 'INVALID';
                    newResponse.code = 0;
                  } else if (c.id === 'INTENDED_INCOMPLETE') {
                    newResponse.status = 'INTENDED_INCOMPLETE';
                    newResponse.code = 0;
                  } else {
                    newResponse.code = c.id;
                    newResponse.score = c.score || 0;
                    newResponse.status = 'CODING_COMPLETE';
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
