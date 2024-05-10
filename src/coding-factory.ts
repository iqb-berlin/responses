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

  private static transformString(
    value: string,
    processing: (ProcessingParameterType | SourceProcessingType)[],
    fragmentExp?: RegExp
  ): string | string[] {
    const removeAllWhiteSpaces = processing.includes('REMOVE_ALL_SPACES') || processing.includes('IGNORE_ALL_SPACES');
    const removeDispensableWhiteSpaces = processing.includes('REMOVE_DISPENSABLE_SPACES') || processing.includes('IGNORE_DISPENSABLE_SPACES');
    const toLowerCase = processing.includes('IGNORE_CASE') || processing.includes('TO_LOWER_CASE');
    let newString = removeAllWhiteSpaces ? value.replace(/\s+/g, '') : value;
    if (removeDispensableWhiteSpaces) newString = newString.trim().replace(/\s+/g, ' ');
    if (toLowerCase) newString = newString.toLowerCase();
    if (fragmentExp) {
      const regExExecReturn = fragmentExp.exec(newString);
      if (regExExecReturn) {
        const newStringArray: string[] = [];
        for (let i = 1; i < regExExecReturn.length; i++) {
          newStringArray.push(regExExecReturn[i]);
        }
        return newStringArray;
      }
      throw new TypeError('fragmenting failed');
    } else {
      return newString;
    }
  }

  private static transformValue(
    value: ResponseValueType,
    fragmenting: string,
    sortArray : boolean
  ): TransformedResponseValueType {
    // raises exceptions if transformation fails
    const fragmentRegEx = fragmenting ? new RegExp(fragmenting) : undefined;
    if (Array.isArray(value)) {
      if (sortArray) {
        return value.sort((a, b) => {
          const aAsString = this.getValueAsString(a) || '';
          const bAsString = this.getValueAsString(b) || '';
          if (aAsString < bAsString) return -1;
          if (aAsString > bAsString) return 1;
          return 0
        }).map(v => {
          if (v && typeof v === 'string') return this.transformString(v, [], fragmentRegEx);
          return v;
        }) as TransformedResponseValueType;
      } else {
        return value.map(v => {
          if (v && typeof v === 'string') return this.transformString(v, [], fragmentRegEx);
          return v;
        }) as TransformedResponseValueType;
      }
    }
    if (value && typeof value === 'string') return this.transformString(value, [], fragmentRegEx);
    return value;
  }

  private static findString(value: string, codingProcessing: ProcessingParameterType[], parameters: string[] = []): boolean {
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

  private static findStringRegEx(value: string, parameters: string[] = []): boolean {
    const allStrings: string[] = [];
    parameters.forEach(p => {
      allStrings.push(...p.split(/\r?\n/));
    });
    const trueCases = allStrings.map((s: string): boolean => {
      const regEx = new RegExp(s);
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
      return !!firstMatch;
    }
    return false;
  }

  static getValueAsNumber(value: ResponseValueSingleType): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return (value as boolean) ? 1 : 0;
    if (typeof value === 'string') {
      let normalizedString = (value as string).replace('.', '');
      normalizedString = normalizedString.replace(/\s/g, '');
      normalizedString = normalizedString.replace(',', '.');
      const valueAsString = Number.parseFloat(normalizedString);
      if (Number.isNaN(valueAsString)) return null;
      return valueAsString;
    }
    return null;
  }

  static getValueAsString(
      value: ResponseValueSingleType,
      processing: (ProcessingParameterType | SourceProcessingType)[] = []): string | null {
    if (typeof value === 'number') return value.toString(10);
    if (typeof value === 'boolean') return (value as boolean) ? 'true' : 'false';
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
      return valueToCheck === 0 || valueToCheck === 1 || valueToCheck === '1' || valueToCheck === true || valueToCheck === 'true' ||
          valueToCheck === '0' || valueToCheck === false ||
          valueToCheck === 'false' || valueToCheck === null;
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

  static checkOneValue(valueToCheck: ResponseValueSingleType, rule: CodingRule, codingProcessing: ProcessingParameterType[]): boolean {
    let returnValue = false;
    let valueAsNumber: number | null = null;
    // eslint-disable-next-line default-case
    switch (rule.method) {
      case 'IS_NULL':
        if (valueToCheck === null) returnValue = true;
        break;
      case 'IS_EMPTY':
        if (valueToCheck === '') returnValue = true;
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
          returnValue = this.findStringRegEx(valueToCheck, rule.parameters);
        }
        break;
      case 'NUMERIC_MATCH':
        if (valueToCheck !== null && valueToCheck !== '') returnValue = this.findNumericValue(valueToCheck, rule.parameters);
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
            if (typeof compareValueLL === 'number' && typeof compareValueUL === 'number')
              returnValue = valueAsNumber > compareValueLL && valueAsNumber <= compareValueUL;
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
              if (CodingFactory.checkOneValue(valueMemberToCheck[fragmentIndex], rule, codingProcessing)) oneMatch = true;
              fragmentIndex += 1;
            }
          } else if (CodingFactory.checkOneValue(valueMemberToCheck[rule.fragment], rule, codingProcessing)) oneMatch = true;
        } else if (CodingFactory.checkOneValue(valueMemberToCheck, rule, codingProcessing)) oneMatch = true;
        valueIndex += 1;
      }
      return oneMatch;
    }
    if (Array.isArray(valueToCheck)) {
      if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
        let fragmentIndex = 0;
        let oneMatch = false;
        while (!oneMatch && fragmentIndex < valueToCheck.length) {
          if (CodingFactory.checkOneValue(valueToCheck[fragmentIndex] as string, rule, codingProcessing)) oneMatch = true;
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
    if (ruleSet.valueArrayPos && isValueArray && Array.isArray(valueToCheck)) {
      if (typeof ruleSet.valueArrayPos === 'number') {
        if (ruleSet.valueArrayPos >= 0 && ruleSet.valueArrayPos < valueToCheck.length) {
          valueMemberToCheck = valueToCheck[ruleSet.valueArrayPos];
        }
      } else if (ruleSet.valueArrayPos === 'SUM') {
        valueMemberToCheck = valueToCheck.map(v => {
          if (Array.isArray(v)) {
            return v.map(s => this.getValueAsNumber(s) || 0).reduce((a, b) => a + b, 0)
          } else {
            return this.getValueAsNumber(v) || 0
          }
        }).reduce((pv, cv) => pv + cv, 0);
      }
    }
    let oneMatch = false;
    let oneMisMatch = false;
    let ruleIndex = 0;
    while ((!ruleSet.ruleOperatorAnd && !oneMatch) && ruleIndex < ruleSet.rules.length) {
      let isMatch;
      if (typeof valueMemberToCheck !== 'undefined') {
        isMatch = this.isMatchRule(valueMemberToCheck, ruleSet.rules[ruleIndex], false, codingProcessing);
      } else {
        isMatch = this.isMatchRule(valueToCheck, ruleSet.rules[ruleIndex], isValueArray, codingProcessing);
      }
      if (isMatch) {
        oneMatch = true;
      } else {
        oneMisMatch = true;
      }
      ruleIndex += 1;
    }
    return oneMatch && (!ruleSet.ruleOperatorAnd || !oneMisMatch);
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
        newResponse.state = 'CODING_ERROR';
        valueToCheck = null;
      }
      if (newResponse.state !== 'CODING_ERROR') {
        let hasElse = false;
        let elseCode: number | null = 0;
        let elseScore = 0;
        let changed = false;
        coding.codes.forEach(c => {
          if (!changed) {
            const elseRule = c.ruleSets.find(rs => !!rs.rules.find(r => r.method === 'ELSE'));
            // ignore other rules if ELSE-rule found
            if (elseRule) {
              hasElse = true;
              elseCode = c.id;
              elseScore = c.score;
            } else {
              const invalidRule = c.ruleSets.find(rs => !!rs.rules.find(r => {
                if (typeof rs.valueArrayPos === 'number' && rs.valueArrayPos >= 0) {
                  return Array.isArray(newResponse.value) && Array.isArray(valueToCheck) ?
                    !CodingFactory.isValidRule(valueToCheck[rs.valueArrayPos], r, false) : true;
                }
                return !CodingFactory.isValidRule(valueToCheck, r, Array.isArray(newResponse.value));
              }));
              if (invalidRule) {
                newResponse.state = 'CODING_ERROR';
                changed = true;
              } else {
                let oneMatch = false;
                let oneMisMatch = false;
                let ruleSetIndex = 0;
                while ((!c.ruleSetOperatorAnd && !oneMatch) && ruleSetIndex < c.ruleSets.length) {
                  // eslint-disable-next-line max-len
                  if (CodingFactory.isMatchRuleSet(valueToCheck, c.ruleSets[ruleSetIndex], Array.isArray(newResponse.value), coding.processing || [])) {
                    oneMatch = true;
                  } else {
                    oneMisMatch = true;
                  }
                  ruleSetIndex += 1;
                }
                if (oneMatch && (!c.ruleSetOperatorAnd || !oneMisMatch)) {
                  if (c.id === null) {
                    newResponse.state = 'INVALID';
                  } else {
                    newResponse.code = c.id;
                    newResponse.score = c.score || 0;
                    newResponse.state = 'CODING_COMPLETE';
                  }
                  changed = true;
                }
              }
            }
          }
        });
        if (!changed) {
          if (hasElse) {
            if (elseCode === null) {
              newResponse.state = 'INVALID';
            } else {
              newResponse.code = elseCode;
              newResponse.score = elseScore;
              newResponse.state = 'CODING_COMPLETE';
            }
          } else {
            newResponse.state = 'CODING_INCOMPLETE';
          }
          changed = true;
        }
      }
    } else {
      newResponse.state = 'NO_CODING';
    }
    return newResponse;
  }
}
