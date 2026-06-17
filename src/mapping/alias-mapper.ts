import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';

const isDerivedVariable = (coding: VariableCodingData): boolean => (
  coding.sourceType !== 'BASE' && coding.sourceType !== 'BASE_NO_VALUE'
);

const shadowsBaseSourceAlias = (
  coding: VariableCodingData,
  shadowedCoding?: VariableCodingData
): boolean => Boolean(
  coding.alias &&
  shadowedCoding &&
  shadowedCoding.id === coding.alias &&
  shadowedCoding.sourceType === 'BASE' &&
  isDerivedVariable(coding) &&
  (coding.deriveSources ?? []).includes(shadowedCoding.id)
);

const getAliasMap = (
  variableCodings: VariableCodingData[]
): Map<string, string> => {
  const codingById = new Map(variableCodings.map(coding => [coding.id, coding]));
  const aliasMap = new Map<string, string>();

  variableCodings
    .filter(coding => Boolean(coding.alias))
    .forEach(coding => {
      const alias = coding.alias as string;
      const shadowedCoding = codingById.get(alias);

      if (shadowsBaseSourceAlias(coding, shadowedCoding)) {
        return;
      }

      aliasMap.set(alias, coding.id);
    });

  return aliasMap;
};

export const mapResponseAliasToId = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): Response[] => {
  const aliasMap = getAliasMap(variableCodings);
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
