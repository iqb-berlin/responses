import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CODING_SCHEME_STATUS } from '../constants';
import { isUnsetLikeResponse } from '../status-helpers';

export const removeBaseResponsesShadowedByDerived = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => {
  const nonBaseCodings = variableCodings.filter(
    vc => vc.sourceType !== 'BASE'
  );

  return responses.filter(response => {
    const hasDerivedConflict = nonBaseCodings.some(
      vc => response.id === vc.id &&
        isUnsetLikeResponse(response) &&
        response.status !== CODING_SCHEME_STATUS.CODING_COMPLETE
    );
    return !hasDerivedConflict;
  });
};
