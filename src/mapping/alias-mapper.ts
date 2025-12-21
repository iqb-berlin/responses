import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';

export const mapResponseAliasToId = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => responses.map(r => ({
  ...r,
  id: variableCodings.find(c => c.alias === r.id)?.id || r.id
}));

export const mapResponseIdToAlias = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => {
  const codingMap = new Map(
    variableCodings.map(coding => [coding.id, coding.alias || coding.id])
  );
  return responses.map(response => ({
    ...response,
    id: codingMap.get(response.id) || response.id
  }));
};
