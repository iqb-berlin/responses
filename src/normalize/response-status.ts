import { Response } from '@iqbspecs/response/response.interface';
import {
  SourceProcessingType,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { CodingFactory } from '../coding-factory';

export const normalizeDisplayedToValueChanged = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): void => {
  responses
    .filter(r => r.status === 'DISPLAYED')
    .forEach(r => {
      const myCoding = variableCodings.find(c => c.id === r.id);
      if (
        myCoding &&
        myCoding.sourceType === 'BASE' &&
        myCoding.sourceParameters?.processing &&
        myCoding.sourceParameters.processing.includes(
          'TAKE_DISPLAYED_AS_VALUE_CHANGED' as SourceProcessingType
        )
      ) {
        r.status = 'VALUE_CHANGED';
      }
    });
};

export const normalizeNotReachedToValueChanged = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): void => {
  responses
    .filter(r => r.status === 'NOT_REACHED')
    .forEach(r => {
      const myCoding = variableCodings.find(c => c.id === r.id);
      if (
        myCoding?.sourceType === 'BASE' &&
        myCoding.sourceParameters?.processing?.includes(
          'TAKE_NOT_REACHED_AS_VALUE_CHANGED' as SourceProcessingType
        )
      ) {
        r.status = 'VALUE_CHANGED';
      }
    });
};

export const markEmptyValuesInvalidForBaseUnlessAllowed = (
  responses: Response[],
  variableCodings: VariableCodingData[]
): void => {
  responses
    .filter(
      r => r.status === 'VALUE_CHANGED' && CodingFactory.isEmptyValue(r.value)
    )
    .forEach(r => {
      const myCoding = variableCodings.find(coding => coding.id === r.id);

      if (!myCoding) {
        return;
      }

      const isBaseType = myCoding.sourceType === 'BASE';
      const takeEmptyAsValid =
        myCoding.sourceParameters?.processing?.includes(
          'TAKE_EMPTY_AS_VALID' as SourceProcessingType
        ) || false;

      if (isBaseType && !takeEmptyAsValid) {
        r.status = 'INVALID';
      }
    });
};
