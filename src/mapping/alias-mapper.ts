import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';

export const mapResponseAliasToId = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => {
  const aliasMap = new Map(
    variableCodings
      .filter(coding => Boolean(coding.alias))
      .map(coding => [coding.alias as string, coding.id])
  );
  return responses.map(response => ({
    ...response,
    id: aliasMap.get(response.id) || response.id
  }));
};

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
