import { Response } from '@iqbspecs/response/response.interface';
import {
  validStatesToStartDeriving,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { CODING_SCHEME_STATUS } from '../constants';
import type { VariableGraphNode } from '../graph/dependency-tree';
import { CodingFactory } from '../coding-factory';
import { deriveValue } from './derive-value';

export function applyDerivationsAndCoding(
  responses: Response[],
  variableCodings: VariableCodingData[],
  varDependencies: VariableGraphNode[],
  options?: { onError?: (error: unknown) => void }
): void {
  const responseById = new Map(responses.map(r => [r.id, r] as const));
  const codingById = new Map(variableCodings.map(vc => [vc.id, vc] as const));
  const maxVarLevel = Math.max(0, ...varDependencies.map(n => n.level));

  for (let level = 0; level <= maxVarLevel; level++) {
    const currentLevelNodes = varDependencies.filter(n => n.level === level);

    // eslint-disable-next-line no-restricted-syntax
    for (const varNode of currentLevelNodes) {
      const targetResponse = responseById.get(varNode.id);
      const varCoding = codingById.get(varNode.id);

      if (targetResponse && varCoding) {
        if (
          varNode.sources.length > 0 &&
          validStatesToStartDeriving.includes(targetResponse.status)
        ) {
          deriveResponse(
            variableCodings,
            targetResponse,
            varCoding,
            varNode.sources,
            responses,
            options
          );

          responseById.set(targetResponse.id, targetResponse);
        }

        if (targetResponse.status === CODING_SCHEME_STATUS.VALUE_CHANGED) {
          processCoding(targetResponse, varCoding, options);
        }
      }
    }
  }
}

function deriveResponse(
  variableCodings: VariableCodingData[],
  targetResponse: Response,
  varCoding: VariableCodingData,
  sourceIds: string[],
  responsesList: Response[],
  options?: { onError?: (error: unknown) => void }
): void {
  if (targetResponse.status === CODING_SCHEME_STATUS.CODING_ERROR) {
    return;
  }

  try {
    const sourceResponses = responsesList.filter(r => sourceIds.includes(r.id)
    );
    const derivedResponse = deriveValue(
      variableCodings,
      varCoding,
      sourceResponses
    );

    targetResponse.status = derivedResponse.status;
    targetResponse.subform = derivedResponse.subform;

    if (derivedResponse.status === CODING_SCHEME_STATUS.VALUE_CHANGED) {
      targetResponse.value = derivedResponse.value;
    }
  } catch (error) {
    options?.onError?.(error);
    targetResponse.status = CODING_SCHEME_STATUS.DERIVE_ERROR;
    targetResponse.value = null;
  }
}

function processCoding(
  targetResponse: Response,
  varCoding: VariableCodingData,
  options?: { onError?: (error: unknown) => void }
): void {
  if ((varCoding.codes?.length ?? 0) > 0) {
    const codedResponse = CodingFactory.code(
      targetResponse,
      varCoding,
      options
    );

    if (codedResponse.status !== targetResponse.status) {
      targetResponse.status = codedResponse.status;
      targetResponse.code = codedResponse.code;
      targetResponse.score = codedResponse.score;
    }
  } else if (varCoding.sourceType === 'BASE') {
    const takeEmptyAsValid =
      varCoding.sourceParameters?.processing?.includes('TAKE_EMPTY_AS_VALID') ||
      false;

    if (!takeEmptyAsValid) {
      targetResponse.status = CODING_SCHEME_STATUS.NO_CODING;
    }
  } else {
    targetResponse.status = CODING_SCHEME_STATUS.NO_CODING;
  }
}
