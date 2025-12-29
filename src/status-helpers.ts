import { Response } from '@iqbspecs/response/response.interface';
import { CODING_SCHEME_STATUS } from './constants';

export type CodingSchemeStatus = (typeof CODING_SCHEME_STATUS)[keyof typeof CODING_SCHEME_STATUS];

export const isPendingStatus =
  (status: CodingSchemeStatus): boolean => status === CODING_SCHEME_STATUS.CODING_INCOMPLETE ||
    status === CODING_SCHEME_STATUS.DERIVE_PENDING;

export const isErrorStatus = (status: CodingSchemeStatus): boolean => status === CODING_SCHEME_STATUS.CODING_ERROR ||
  status === CODING_SCHEME_STATUS.DERIVE_ERROR ||
  status === CODING_SCHEME_STATUS.NO_CODING;

export const isUnsetLikeResponse = (
  response: Pick<Response, 'code' | 'score'> & { status: CodingSchemeStatus }
): boolean => response.status === CODING_SCHEME_STATUS.UNSET ||
  (response.status !== CODING_SCHEME_STATUS.CODING_COMPLETE && response.code == null && response.score == null);
