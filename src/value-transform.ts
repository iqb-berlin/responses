import {
  ResponseValueSingleType,
  ResponseValueType
} from '@iqbspecs/response/response.interface';
import {
  ProcessingParameterType,
  SourceProcessingType,
  TransformedResponseValueType
} from '@iqbspecs/coding-scheme/coding-scheme.interface';

export function compileFragmentRegExp(fragmenting: string): RegExp | undefined {
  return fragmenting ? new RegExp(fragmenting, 'g') : undefined;
}

export function transformString(
  value: string,
  processing: (ProcessingParameterType | SourceProcessingType)[],
  fragmentExp?: RegExp
): string | string[] {
  if (fragmentExp) {
    const matchResult = [...value.matchAll(fragmentExp)];
    return matchResult.length > 0 ? matchResult[0].slice(1) : [];
  }

  const shouldRemoveAllSpaces =
    processing.includes('REMOVE_ALL_SPACES') ||
    processing.includes('IGNORE_ALL_SPACES');
  const shouldTrimAndNormalizeSpaces =
    processing.includes('REMOVE_DISPENSABLE_SPACES') ||
    processing.includes('IGNORE_DISPENSABLE_SPACES');
  const shouldConvertToLowerCase =
    processing.includes('IGNORE_CASE') || processing.includes('TO_LOWER_CASE');

  let transformedString = value;

  if (shouldRemoveAllSpaces && transformedString) {
    transformedString = transformedString.replace(/\s+/g, '');
  }

  if (shouldTrimAndNormalizeSpaces && transformedString) {
    transformedString = transformedString.trim().replace(/\s+/g, ' ');
  }

  if (shouldConvertToLowerCase && transformedString) {
    transformedString = transformedString.toLowerCase();
  }

  return transformedString;
}

export function getValueAsNumber(
  value: ResponseValueSingleType
): number | null {
  if (value === null || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  let normalizedString = value.trim();
  normalizedString = normalizedString.replace(/\s+/g, '').replace(',', '.');

  const isInvalidNumber = !/^[-+]?\d+(\.\d+)?$/.test(normalizedString);
  if (isInvalidNumber) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedString);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

export function getValueAsString(
  value: ResponseValueSingleType,
  processing: (ProcessingParameterType | SourceProcessingType)[] = []
): string | null {
  if (typeof value === 'number') {
    return value.toString(10);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    let processedString = value;
    if (
      processing.includes('REMOVE_ALL_SPACES') ||
      processing.includes('IGNORE_ALL_SPACES')
    ) {
      processedString = processedString.replace(/\s/g, '');
    } else if (
      processing.includes('REMOVE_DISPENSABLE_SPACES') ||
      processing.includes('IGNORE_DISPENSABLE_SPACES')
    ) {
      processedString = processedString.trim().replace(/\s+/g, ' ');
    }
    if (processing.includes('TO_LOWER_CASE')) {
      processedString = processedString.toLowerCase();
    }
    return processedString;
  }

  return null;
}

export function transformValue(
  value: ResponseValueType,
  fragmenting: string,
  sortArray: boolean
): TransformedResponseValueType {
  const fragmentRegEx = compileFragmentRegExp(fragmenting);
  const transformIfString = (v: unknown): unknown => {
    if (typeof v === 'string') {
      return transformString(v, [], fragmentRegEx);
    }
    return v;
  };

  if (Array.isArray(value)) {
    const sorted = sortArray ? [...value] : value;
    if (sortArray) {
      sorted.sort((a, b) => {
        const aAsString = getValueAsString(a) || '';
        const bAsString = getValueAsString(b) || '';
        return aAsString.localeCompare(bAsString);
      });
    }
    return sorted.map(transformIfString) as TransformedResponseValueType;
  }

  if (typeof value === 'string') {
    return transformString(value, [], fragmentRegEx);
  }

  return value;
}

export function isEmptyValue(value: ResponseValueType): boolean {
  return value === '' || (Array.isArray(value) && value.length === 0);
}
