import {
  ResponseValueType,
  VariableCodingData,
  VariableInfo,
  Response,
  ProcessingParameterType,
  DeriveConcatDelimiter, CodingRule
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
      codes: []
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

  private static transformValue(value: ResponseValueType, processing: ProcessingParameterType[]): ResponseValueType {
    // raises exceptions if transformation fails
    const stringifiedValue = JSON.stringify(value);
    let newValue = JSON.parse(stringifiedValue);
    if (typeof newValue === 'string' && processing && processing.length > 0) {
      if (processing.indexOf('REMOVE_WHITE_SPACES') >= 0) {
        newValue = newValue.trim();
      }
    }
    return newValue;
  }

  private static findString(value: ResponseValueType, ignoreCase: boolean, parameters: string[] = []): boolean {
    if (typeof value === 'string' && value.length > 0) {
      const allStrings: string[] = [];
      parameters.forEach(p => {
        allStrings.push(...p.split('\n'));
      });
      const stringToCompare = ignoreCase ? (value as string).toUpperCase() : (value as string);
      const inList = allStrings.find(s => stringToCompare === (ignoreCase ? s.toUpperCase() : s));
      return !!inList;
    }
    return false;
  }

  private static findStringRegEx(value: ResponseValueType, parameters: string[] = []): boolean {
    if (typeof value === 'string' && value.length > 0) {
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
    return false;
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

  static isValidValueForRule(valueToCheck: ResponseValueType, rule: CodingRule): boolean {
    let returnValue = true;
    let valueAsNumber: number | null = null;
    // eslint-disable-next-line default-case
    switch (rule.method) {
      case 'NUMERIC_LESS_THEN':
      case 'NUMERIC_MAX':
      case 'NUMERIC_MORE_THEN':
      case 'NUMERIC_MIN':
      case 'NUMERIC_RANGE':
        valueAsNumber = this.getValueAsNumber(valueToCheck);
        returnValue = typeof valueAsNumber === 'number';
        break;
      case 'IS_TRUE':
      case 'IS_FALSE':
        if (valueToCheck !== '1' && valueToCheck !== true && valueToCheck !== 'true' &&
            valueToCheck !== '0' && valueToCheck !== false &&
            valueToCheck !== 'false' && valueToCheck !== null) {
          returnValue = false;
        }
        break;
    }
    return returnValue;
  }

  static checkOneRule(valueToCheck: ResponseValueType, rule: CodingRule, codingProcessing: ProcessingParameterType[]): boolean {
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
        if (typeof valueToCheck === 'number') {
          valueToCheck = valueToCheck.toString(10);
        } else if (typeof valueToCheck === 'boolean') {
          valueToCheck = valueToCheck.toString();
        }
        returnValue = this.findString(valueToCheck, codingProcessing.includes('IGNORE_CASE'), rule.parameters);
        break;
      case 'MATCH_REGEX':
        if (typeof valueToCheck === 'number') {
          valueToCheck = valueToCheck.toString(10);
        } else if (typeof valueToCheck === 'boolean') {
          valueToCheck = valueToCheck.toString();
        }
        returnValue = this.findStringRegEx(valueToCheck, rule.parameters);
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

  static code(response: Response, coding: VariableCodingData): Response {
    const stringifiedResponse = JSON.stringify(response);
    const newResponse = JSON.parse(stringifiedResponse);
    if (coding && coding.codes.length > 0 && !Array.isArray(newResponse.value)) {
      let valueToCheck: ResponseValueType;
      try {
        valueToCheck = this.transformValue(newResponse.value, coding.processing);
      } catch (e) {
        newResponse.status = 'CODING_ERROR';
        valueToCheck = null;
      }
      if (newResponse.status !== 'CODING_ERROR') {
        let hasElse = false;
        let elseCode = 0;
        let elseScore = 0;
        let changed = false;
        coding.codes.forEach(c => {
          if (!changed) {
            const elseRule = c.rules.find(r => r.method === 'ELSE');
            // ignore other rules if ELSE-rule found
            if (elseRule) {
              hasElse = true;
              elseCode = c.id;
              elseScore = c.score;
            } else {
              const invalidValue = c.rules.map(r => CodingFactory.isValidValueForRule(valueToCheck, r))
                  .find(validCheckResult => !validCheckResult);
              if (invalidValue) {
                newResponse.status = 'CODING_ERROR';
                changed = true;
              } else {
                const codingMatches = c.rules.map(r => CodingFactory.checkOneRule(valueToCheck, r, coding.processing));
                const falseMatch = codingMatches.find(m => !m);
                const trueMatch = codingMatches.find(m => m);
                if (trueMatch && (!c.ruleOperatorAnd || !falseMatch)) {
                  newResponse.code = c.id;
                  newResponse.score = c.score;
                  newResponse.status = 'CODING_COMPLETE';
                  changed = true;
                }
              }
            }
          }
        });
        if (!changed) {
          if (hasElse) {
            newResponse.code = elseCode;
            newResponse.score = elseScore;
            newResponse.status = 'CODING_COMPLETE';
            changed = true;
          } else {
            newResponse.code = 0;
            newResponse.score = 0;
            newResponse.status = 'CODING_INCOMPLETE';
            changed = true;
          }
        }
      }
    } else {
      newResponse.status = 'NO_CODING';
    }
    return newResponse;
  }
}
