import { Response } from '@iqbspecs/response/response.interface';

export const groupResponsesBySubform = (
  responses: Response[]
): {
  subformGroups: Record<string, Response[]>;
  notSubformResponses: Response[];
} => {
  const notSubformResponses: Response[] = [];
  const subformGroups = responses.reduce((acc, r: Response) => {
    if (r.subform) {
      acc[r.subform] = acc[r.subform] || [];
      acc[r.subform].push(r);
    } else {
      notSubformResponses.push(r);
    }
    return acc;
  }, {} as Record<string, Response[]>);
  return { subformGroups, notSubformResponses };
};
