import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CODING_SCHEME_STATUS } from '../constants';
import { type CodingSchemeStatus, isUnsetLikeResponse } from '../status-helpers';

export const removeBaseResponsesShadowedByDerived = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => {
  const nonBaseCodings = variableCodings.filter(vc => vc.sourceType !== 'BASE');

  return responses.filter(response => {
    const hasDerivedConflict = nonBaseCodings.some(
      vc => response.id === vc.id &&
        isUnsetLikeResponse({
          ...response,
          status: response.status as CodingSchemeStatus
        }) &&
        response.status !== CODING_SCHEME_STATUS.CODING_COMPLETE
    );
    return !hasDerivedConflict;
  });
};

export const removeBaseResponsesShadowedByDerivedAlias = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => {
  const baseCodingIds = new Set(
    variableCodings
      .filter(vc => vc.sourceType === 'BASE')
      .map(vc => vc.id)
  );
  const shadowingPairs = variableCodings
    .filter(vc => (
      vc.sourceType !== 'BASE' &&
      vc.sourceType !== 'BASE_NO_VALUE' &&
      Boolean(vc.alias) &&
      vc.alias !== vc.id &&
      baseCodingIds.has(vc.alias as string) &&
      (vc.deriveSources ?? []).includes(vc.alias as string)
    ))
    .map(vc => ({
      baseId: vc.alias as string,
      derivedId: vc.id
    }));

  return responses.filter(response => {
    const isShadowedBaseResponse = shadowingPairs.some(pair => (
      response.id === pair.baseId &&
      responses.some(candidate => (
        candidate.id === pair.derivedId &&
        candidate.subform === response.subform
      ))
    ));

    return !isShadowedBaseResponse;
  });
};
