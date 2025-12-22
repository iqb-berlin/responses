import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CODING_SCHEME_STATUS } from '../constants';

export function finalizeAndDeduplicateResponses(
  allCodedResponses: Response[],
  subformGroups: Record<string, Response[]>,
  variableCodings: VariableCodingData[]
): Response[] {
  const isDuplicateResponse = (
    item: Response,
    index: number,
    self: Response[]
  ): boolean => index !==
    self.findIndex(t => t.id === item.id && t.subform === item.subform);

  const derivedAliases = new Set(
    variableCodings
      .filter(
        vc => vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE'
      )
      .map(vc => vc.alias || vc.id)
  );

  function shouldDropUnsetBecauseShadowed(response: Response): boolean {
    if (Object.keys(subformGroups).length === 0) return false;

    const foundInSubformGroups = Object.values(subformGroups)[0].find(
      sr => sr.id === response.id
    );
    const foundInDerived = derivedAliases.has(response.id);
    return (
      Boolean(foundInSubformGroups || foundInDerived) &&
      response.status === CODING_SCHEME_STATUS.UNSET
    );
  }

  const uniqueResponses = allCodedResponses
    .filter((item, index, self) => !isDuplicateResponse(item, index, self))
    .filter(r => !shouldDropUnsetBecauseShadowed(r));

  return [...uniqueResponses];
}
