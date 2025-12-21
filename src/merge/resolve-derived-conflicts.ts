import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';

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
        !response.code &&
        !response.score &&
        response.status !== 'CODING_COMPLETE'
    );
    return !hasDerivedConflict;
  });
};
