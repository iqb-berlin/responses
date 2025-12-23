import { Response } from '@iqbspecs/response/response.interface';
import { SourceProcessingType, VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingFactory } from '../coding-factory';
import { CODING_SCHEME_STATUS } from '../constants';

export const normalizeDisplayedToValueChanged = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): void => {
  const codingById = new Map(variableCodings.map(c => [c.id, c] as const));
  responses
    .filter(r => r.status === CODING_SCHEME_STATUS.DISPLAYED)
    .forEach(r => {
      const myCoding = codingById.get(r.id);
      if (
        myCoding &&
        myCoding.sourceType === 'BASE' &&
        myCoding.sourceParameters?.processing &&
        myCoding.sourceParameters.processing.includes('TAKE_DISPLAYED_AS_VALUE_CHANGED' as SourceProcessingType)
      ) {
        r.status = CODING_SCHEME_STATUS.VALUE_CHANGED;
      }
    });
};

export const normalizeNotReachedToValueChanged = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): void => {
  const codingById = new Map(variableCodings.map(c => [c.id, c] as const));
  responses
    .filter(r => r.status === CODING_SCHEME_STATUS.NOT_REACHED)
    .forEach(r => {
      const myCoding = codingById.get(r.id);
      if (
        myCoding?.sourceType === 'BASE' &&
        myCoding.sourceParameters?.processing?.includes('TAKE_NOT_REACHED_AS_VALUE_CHANGED' as SourceProcessingType)
      ) {
        r.status = CODING_SCHEME_STATUS.VALUE_CHANGED;
      }
    });
};

export const markEmptyValuesInvalidForBaseUnlessAllowed = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): void => {
  const codingById = new Map(variableCodings.map(c => [c.id, c] as const));
  responses
    .filter(r => r.status === CODING_SCHEME_STATUS.VALUE_CHANGED && CodingFactory.isEmptyValue(r.value))
    .forEach(r => {
      const myCoding = codingById.get(r.id);

      if (!myCoding) {
        return;
      }

      const isBaseType = myCoding.sourceType === 'BASE';
      const takeEmptyAsValid =
        myCoding.sourceParameters?.processing?.includes('TAKE_EMPTY_AS_VALID' as SourceProcessingType) || false;

      if (isBaseType && !takeEmptyAsValid) {
        r.status = CODING_SCHEME_STATUS.INVALID;
      }
    });
};
