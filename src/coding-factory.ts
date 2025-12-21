import {
  ResponseValueSingleType,
  ResponseValueType,
  Response
} from '@iqbspecs/response/response.interface';
import {
  ProcessingParameterType,
  RuleSet,
  SourceProcessingType,
  TransformedResponseValueType,
  VariableCodingData
} from '@iqbspecs/coding-scheme/coding-scheme.interface';

import {
  getValueAsNumber as getValueAsNumberInternal,
  getValueAsString as getValueAsStringInternal,
  isEmptyValue as isEmptyValueInternal,
  transformValue as transformValueInternal
} from './value-transform';
import { isMatchRuleSet as isMatchRuleSetInternal } from './rule-engine';
import { deepClone } from './utils/deep-clone';

export abstract class CodingFactory {
  static createBaseCodingVariable(
    varId: string,
    sourceType: 'BASE' | 'BASE_NO_VALUE'
  ): VariableCodingData {
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
      codeModel: 'RULES_ONLY',
      codes: []
    } as VariableCodingData;
  }

  static createCodingVariable(varId: string): VariableCodingData {
    return this.createBaseCodingVariable(varId, 'BASE');
  }

  static getValueAsNumber(value: ResponseValueSingleType): number | null {
    return getValueAsNumberInternal(value);
  }

  static getValueAsString(
    value: ResponseValueSingleType,
    processing: (ProcessingParameterType | SourceProcessingType)[] = []
  ): string | null {
    return getValueAsStringInternal(value, processing);
  }

  static isEmptyValue(value: ResponseValueType): boolean {
    return isEmptyValueInternal(value);
  }

  private static isMatchRuleSet(
    valueToCheck: TransformedResponseValueType,
    ruleSet: RuleSet,
    isValueArray: boolean,
    codingProcessing: ProcessingParameterType[]
  ): boolean {
    return isMatchRuleSetInternal(
      valueToCheck,
      ruleSet,
      isValueArray,
      codingProcessing
    );
  }

  static code(
    response: Response,
    coding: VariableCodingData,
    options?: { onError?: (error: unknown) => void }
  ): Response {
    const newResponse: Response = deepClone(response);

    // Check if coding data exists
    if (!coding || (coding.codes?.length ?? 0) === 0) {
      newResponse.status = 'NO_CODING';
      return newResponse;
    }

    let valueToCheck: TransformedResponseValueType | null = null;

    // Attempt to transform the value
    try {
      const shouldSortArray =
        coding.processing?.includes('SORT_ARRAY') || false;
      const fragmentingPattern = coding.fragmenting || '';
      valueToCheck = transformValueInternal(
        newResponse.value,
        fragmentingPattern,
        shouldSortArray
      );
    } catch (error) {
      options?.onError?.(error);
      newResponse.status = 'CODING_ERROR';
      return newResponse;
    }

    // Proceed with coding if no transformation error occurred
    let hasElse = false;
    let elseCode: unknown = 0;
    let elseScore = 0;
    let elseType: string | undefined;
    let changed = false;

    try {
      const codes = coding.codes ?? [];
      const isValueArray = Array.isArray(newResponse.value);
      const processing = coding.processing || [];

      codes.some(code => {
        const codeType = code.type;
        if (
          typeof codeType === 'string' &&
          ['RESIDUAL_AUTO', 'INTENDED_INCOMPLETE'].includes(codeType)
        ) {
          hasElse = true;
          elseCode = code.id;
          elseType = codeType;
          elseScore = code.score || 0;
          return false;
        }

        const ruleSets = code.ruleSets ?? [];

        const isMatchingRuleSet = (ruleSet: RuleSet): boolean => CodingFactory.isMatchRuleSet(
          valueToCheck,
          ruleSet,
          isValueArray,
          processing
        );

        const hasMatch = code.ruleSetOperatorAnd ?
          ruleSets.length > 0 && ruleSets.every(isMatchingRuleSet) :
          ruleSets.some(isMatchingRuleSet);

        if (!hasMatch) return false;

        const { id, score } = code;
        const idAsString = String(id);
        const isInvalidOrIncomplete =
          idAsString === 'INVALID' || idAsString === 'INTENDED_INCOMPLETE';

        newResponse.status = isInvalidOrIncomplete ?
          (idAsString as 'INVALID' | 'INTENDED_INCOMPLETE') :
          'CODING_COMPLETE';
        newResponse.code = isInvalidOrIncomplete ? 0 : (id as number);
        newResponse.score = isInvalidOrIncomplete ? 0 : score || 0;

        changed = true;
        return true;
      });
    } catch (error) {
      options?.onError?.(error);
      newResponse.status = 'CODING_ERROR';
      return newResponse;
    }

    // If no matches were found, handle "else" cases
    if (!changed) {
      if (hasElse) {
        if (elseType === 'INTENDED_INCOMPLETE') {
          newResponse.status = 'INTENDED_INCOMPLETE';
          newResponse.code = typeof elseCode === 'number' ? elseCode : 0;
          newResponse.score = elseScore;
        } else if (String(elseCode) === 'INVALID') {
          newResponse.status = 'INVALID';
          newResponse.code = 0;
          newResponse.score = 0;
        } else {
          newResponse.status = 'CODING_COMPLETE';
          newResponse.code = typeof elseCode === 'number' ? elseCode : 0;
          newResponse.score = elseScore;
        }
      } else {
        newResponse.status = 'CODING_INCOMPLETE';
      }
    }

    return newResponse;
  }
}
