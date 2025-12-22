import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CODING_SCHEME_STATUS } from '../constants';
import type { VariableGraphNode } from '../graph/dependency-tree';

export type DependencyPlan = {
  varDependencies: VariableGraphNode[];
  globalDeriveError: boolean;
};

export function buildDependencyPlan(
  variableCodings: VariableCodingData[],
  getVariableDependencyTree: (
    variableCodings: VariableCodingData[]
  ) => VariableGraphNode[],
  options?: { onError?: (error: unknown) => void }
): DependencyPlan {
  try {
    return {
      varDependencies: getVariableDependencyTree(variableCodings),
      globalDeriveError: false
    };
  } catch (error) {
    options?.onError?.(error);
    return { varDependencies: [], globalDeriveError: true };
  }
}

export function ensureResponsesExist(
  responses: Response[],
  variableCodings: VariableCodingData[],
  plan: DependencyPlan
): { responses: Response[]; plan: DependencyPlan } {
  const updatedPlan: DependencyPlan = {
    ...plan,
    varDependencies: [...plan.varDependencies]
  };
  const updatedResponses = [...responses];

  variableCodings.forEach(coding => {
    if (updatedPlan.globalDeriveError && coding.sourceType === 'BASE') {
      updatedPlan.varDependencies.push({
        id: coding.id,
        level: 0,
        sources: [],
        page: coding.page || ''
      });
    }

    if (updatedResponses.some(response => response.id === coding.id)) {
      return;
    }

    if (coding.sourceType !== 'BASE_NO_VALUE') {
      const status =
        updatedPlan.globalDeriveError && coding.sourceType !== 'BASE' ?
          CODING_SCHEME_STATUS.DERIVE_ERROR :
          CODING_SCHEME_STATUS.UNSET;

      updatedResponses.push({
        id: coding.id,
        value: null,
        status
      });
    }
  });

  return { responses: updatedResponses, plan: updatedPlan };
}

export function executeDependencyPlan(
  responses: Response[],
  variableCodings: VariableCodingData[],
  plan: DependencyPlan,
  applyDerivationsAndCoding: (
    responses: Response[],
    variableCodings: VariableCodingData[],
    varDependencies: VariableGraphNode[],
    options?: { onError?: (error: unknown) => void }
  ) => void,
  options?: { onError?: (error: unknown) => void }
): Response[] {
  const updatedResponses = [...responses];
  applyDerivationsAndCoding(
    updatedResponses,
    variableCodings,
    plan.varDependencies,
    options
  );
  return updatedResponses;
}
