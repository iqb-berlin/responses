import { Response } from '@iqbspecs/response/response.interface';
import { CODING_SCHEME_STATUS } from './constants';

export type CodingSchemeStatus =
  (typeof CODING_SCHEME_STATUS)[keyof typeof CODING_SCHEME_STATUS];

export type ResponseWithStatus = Omit<Response, 'status'> & {
  status: CodingSchemeStatus;
};

export const isPendingStatus = (status: string): boolean => status === CODING_SCHEME_STATUS.CODING_INCOMPLETE ||
  status === CODING_SCHEME_STATUS.DERIVE_PENDING;

export const isErrorStatus = (status: string): boolean => status === CODING_SCHEME_STATUS.CODING_ERROR ||
  status === CODING_SCHEME_STATUS.DERIVE_ERROR ||
  status === CODING_SCHEME_STATUS.NO_CODING;

export const isUnsetLikeResponse = (
  response: Pick<Response, 'status' | 'code' | 'score'>
): boolean => response.status === CODING_SCHEME_STATUS.UNSET ||
  (response.status !== CODING_SCHEME_STATUS.CODING_COMPLETE &&
    response.code == null &&
    response.score == null);
