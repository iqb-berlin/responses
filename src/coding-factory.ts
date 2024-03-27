import {
  ResponseValueType,
  VariableCodingData,
  VariableInfo,
  Response,
  ProcessingParameterType,
  DeriveConcatDelimiter, CodingRule, ResponseValueSingleType, TransformedResponseValueType, RuleSet
} from './coding-interfaces';

export abstract class CodingFactory {
  static createCodingVariableFromVarInfo(varInfo: VariableInfo): VariableCodingData {
    return <VariableCodingData>{
      id: varInfo.id,
      label: '',
      sourceType: 'BASE',
      deriveSources: [],
      processing: [],
      manualInstruction: '',
      codeModel: 'NONE',
      codeModelParameters: [],
      codes: [],
      page: ''
    };
  }

  static deriveValue(coding: VariableCodingData, allResponses: Response[]): ResponseValueType {
    // raises exceptions if deriving fails
    // ensure before, that sourceType is not 'BASE' and there are enough valid sources
    // eslint-disable-next-line default-case
    switch (coding.sourceType) {
      case 'CONCAT_CODE':
        return allResponses.filter(r => coding.deriveSources.indexOf(r.id) >= 0)
          .map(r => (r.code ? r.code.toString() : ''))
          .join(DeriveConcatDelimiter);
      case 'SUM_CODE':
        return allResponses.filter(r => coding.deriveSources.indexOf(r.id) >= 0)
          .map(r => (r.code ? r.code : 0))
          .reduce((sum, current) => sum + current, 0);
      case 'SUM_SCORE':
        return allResponses.filter(r => coding.deriveSources.indexOf(r.id) >= 0)
          .map(r => (r.score ? r.score : 0))
          .reduce((sum, current) => sum + current, 0);
    }
    throw new TypeError('deriving failed');
  }

  private static transformString(
    value: string,
    removeWhiteSpaces: boolean,
    fragmentExp?: RegExp
  ): string | string[] {
    const newString = removeWhiteSpaces ? value.trim() : value;
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
    processing: ProcessingParameterType[],
    fragmenting?: string
  ): TransformedResponseValueType {
    // raises exceptions if transformation fails
    const fragmentRegEx = fragmenting ? new RegExp(fragmenting) : undefined;
    const removeWhiteSpaces = processing && processing.length > 0 && processing.indexOf('REMOVE_WHITE_SPACES') >= 0;
    if (Array.isArray(value)) {
      return value.map(v => {
        if (v && typeof v === 'string') return this.transformString(v, removeWhiteSpaces, fragmentRegEx);
        return v;
      }) as TransformedResponseValueType;
    }
    if (value && typeof value === 'string') return this.transformString(value, removeWhiteSpaces, fragmentRegEx);
    return value;
  }

  private static findString(value: string, ignoreCase: boolean, parameters: string[] = []): boolean {
    const allStrings: string[] = [];
    parameters.forEach(p => {
      allStrings.push(...p.split('\n'));
    });
    const stringToCompare = ignoreCase ? (value as string).toUpperCase() : (value as string);
    const inList = allStrings.find(s => stringToCompare === (ignoreCase ? s.toUpperCase() : s));
    return !!inList;
  }

  private static findStringRegEx(value: string, parameters: string[] = []): boolean {
    const allStrings: string[] = [];
    parameters.forEach(p => {
      allStrings.push(...p.split('\n'));
    });
    const trueCases = allStrings.map((s: string): boolean => {
      const regEx = new RegExp(s);
      return !!regEx.exec(value);
    }).filter(found => found);
    return trueCases.length > 0;
  }

  static getValueAsNumber(value: ResponseValueType): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return (value as boolean) ? 1 : 0;
    if (typeof value === 'string') {
      const normalizedString = (value as string).replace(',', '.').trim();
      const valueAsString = Number.parseFloat(normalizedString);
      if (Number.isNaN(valueAsString)) return null;
      return valueAsString;
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
      return valueToCheck === '1' || valueToCheck === true || valueToCheck === 'true' ||
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
    const valueMustBeNumeric = ['NUMERIC_MATCH', 'NUMERIC_LESS_THEN', 'NUMERIC_MAX', 'NUMERIC_MORE_THEN',
      'NUMERIC_MIN', 'NUMERIC_RANGE'].indexOf(rule.method) >= 0;
    const valueMustBeBoolean = ['IS_TRUE', 'IS_FALSE'].indexOf(rule.method) >= 0;
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

  static checkOneValue(valueToCheck: ResponseValueSingleType, rule: CodingRule, ignoreCase: boolean): boolean {
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
        if (valueToCheck) {
          if (typeof valueToCheck === 'number') {
            // eslint-disable-next-line no-param-reassign
            valueToCheck = valueToCheck.toString(10);
          } else if (typeof valueToCheck === 'boolean') {
            // eslint-disable-next-line no-param-reassign
            valueToCheck = valueToCheck.toString();
          }
          returnValue = this.findString(valueToCheck, ignoreCase, rule.parameters);
        }
        break;
      case 'MATCH_REGEX':
        if (valueToCheck) {
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
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue = !Number.isNaN(compareValue) && valueAsNumber === compareValue;
        }
        break;
      case 'NUMERIC_LESS_THEN':
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue = !Number.isNaN(compareValue) && valueAsNumber < compareValue;
        }
        break;
      case 'NUMERIC_MAX':
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue = !Number.isNaN(compareValue) && valueAsNumber <= compareValue;
        }
        break;
      case 'NUMERIC_MORE_THEN':
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue = !Number.isNaN(compareValue) && valueAsNumber > compareValue;
        }
        break;
      case 'NUMERIC_MIN':
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValue = Number.parseFloat(rule.parameters[0]);
          returnValue = !Number.isNaN(compareValue) && valueAsNumber >= compareValue;
        }
        break;
      case 'NUMERIC_RANGE':
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        if (typeof valueAsNumber === 'number' && rule.parameters) {
          const compareValueLL = Number.parseFloat(rule.parameters[0]);
          const compareValueUL = Number.parseFloat(rule.parameters[1]);
          returnValue = !Number.isNaN(compareValueUL) && Number.isNaN(compareValueLL) &&
              valueAsNumber > compareValueLL && valueAsNumber <= compareValueUL;
        }
        break;
      case 'IS_TRUE':
        returnValue = valueToCheck === '1' || valueToCheck === true || valueToCheck === 'true';
        break;
      case 'IS_FALSE':
        returnValue = valueToCheck === '0' || valueToCheck === false || valueToCheck === 'false';
        break;
    }
    return returnValue;
  }

  private static isMatchRule(valueToCheck: TransformedResponseValueType, rule: CodingRule,
                             isValueArray: boolean, ignoreCase: boolean): boolean {
    if (Array.isArray(valueToCheck) && isValueArray) {
      let valueIndex = 0;
      let oneMatch = false;
      while (!oneMatch && valueIndex < valueToCheck.length) {
        const valueMemberToCheck = valueToCheck[valueIndex];
        if (Array.isArray(valueMemberToCheck)) {
          if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
            let fragmentIndex = 0;
            while (!oneMatch && fragmentIndex < valueMemberToCheck.length) {
              if (CodingFactory.checkOneValue(valueMemberToCheck[fragmentIndex], rule, ignoreCase)) oneMatch = true;
              fragmentIndex += 1;
            }
          } else if (CodingFactory.checkOneValue(valueMemberToCheck[rule.fragment], rule, ignoreCase)) oneMatch = true;
        } else if (CodingFactory.checkOneValue(valueMemberToCheck, rule, ignoreCase)) oneMatch = true;
        valueIndex += 1;
      }
      return oneMatch;
    }
    if (Array.isArray(valueToCheck)) {
      if (typeof rule.fragment === 'undefined' || rule.fragment < 0) {
        let fragmentIndex = 0;
        let oneMatch = false;
        while (!oneMatch && fragmentIndex < valueToCheck.length) {
          if (CodingFactory.checkOneValue(valueToCheck[fragmentIndex] as string, rule, ignoreCase)) oneMatch = true;
          fragmentIndex += 1;
        }
        return oneMatch;
      }
      return CodingFactory.checkOneValue(valueToCheck[rule.fragment] as string, rule, ignoreCase);
    }
    return CodingFactory.checkOneValue(valueToCheck as ResponseValueSingleType, rule, ignoreCase);
  }

  private static isMatchRuleSet(valueToCheck: TransformedResponseValueType, ruleSet: RuleSet,
                                isValueArray: boolean, ignoreCase: boolean): boolean {
    let valueMemberToCheck;
    if (ruleSet.valueArrayPos && isValueArray && Array.isArray(valueToCheck)) {
      if (typeof ruleSet.valueArrayPos === 'number') {
        if (ruleSet.valueArrayPos >= 0 &&
            valueToCheck.length < ruleSet.valueArrayPos) valueMemberToCheck = valueToCheck[ruleSet.valueArrayPos];
      } else if (ruleSet.valueArrayPos === 'SUM') {
        valueMemberToCheck = valueToCheck.map(v => this.getValueAsNumber(v) || 0)
          .reduce((pv, cv) => pv + cv, 0);
      }
    }
    let oneMatch = false;
    let oneMisMatch = false;
    let ruleIndex = 0;
    while ((!ruleSet.ruleOperatorAnd && !oneMatch) && ruleIndex < ruleSet.rules.length) {
      let isMatch;
      if (typeof valueMemberToCheck !== 'undefined') {
        isMatch = this.isMatchRule(valueMemberToCheck, ruleSet.rules[ruleIndex], false, ignoreCase);
      } else {
        isMatch = this.isMatchRule(valueToCheck, ruleSet.rules[ruleIndex], isValueArray, ignoreCase);
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
    if (coding && coding.codes.length > 0 && !Array.isArray(newResponse.value)) {
      let valueToCheck: TransformedResponseValueType;
      try {
        valueToCheck = this.transformValue(newResponse.value, coding.processing, coding.fragmenting);
      } catch (e) {
        newResponse.status = 'CODING_ERROR';
        valueToCheck = null;
      }
      if (newResponse.status !== 'CODING_ERROR') {
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
                newResponse.status = 'CODING_ERROR';
                changed = true;
              } else {
                let oneMatch = false;
                let oneMisMatch = false;
                let ruleSetIndex = 0;
                while ((!c.ruleSetOperatorAnd && !oneMatch) && ruleSetIndex < c.ruleSets.length) {
                  // eslint-disable-next-line max-len
                  if (CodingFactory.isMatchRuleSet(valueToCheck, c.ruleSets[ruleSetIndex], Array.isArray(newResponse.value), coding.processing.indexOf('IGNORE_CASE') >= 0)) {
                    oneMatch = true;
                  } else {
                    oneMisMatch = true;
                  }
                  ruleSetIndex += 1;
                }
                if (oneMatch && (!c.ruleSetOperatorAnd || !oneMisMatch)) {
                  if (c.id === null) {
                    newResponse.status = 'INVALID';
                  } else {
                    newResponse.code = c.id;
                    newResponse.score = c.score;
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
            if (elseCode === null) {
              newResponse.status = 'INVALID';
            } else {
              newResponse.code = elseCode;
              newResponse.score = elseScore;
              newResponse.status = 'CODING_COMPLETE';
            }
          } else {
            newResponse.code = 0;
            newResponse.score = 0;
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
