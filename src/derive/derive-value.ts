import { evaluate } from 'mathjs';
import { Response, ResponseValueSingleType } from '@iqbspecs/response/response.interface';
import { DeriveConcatDelimiter, validStatesForDerivingValue, VariableCodingData } from '@iqbspecs/coding-scheme';
import {
  CODING_SCHEME_STATUS,
  CONCAT_SUM_VALID_STATES,
  COPY_SOLVER_VALID_STATES,
  MANUAL_VALID_STATES,
  PARTLY_DISPLAYED_STATUSES,
  VALID_STATES_TO_START_DERIVE_PENDING_CHECK
} from '../constants';
import { CodingFactory } from '../coding-factory';
import { type CodingSchemeStatus, isPendingStatus } from '../status-helpers';
import { transformValue } from '../value-transform';

const deriveErrorResponse = (coding: VariableCodingData, subform: string | undefined): Response => <Response>{
  id: coding.id,
  value: null,
  status: CODING_SCHEME_STATUS.DERIVE_ERROR,
  subform
};

export const amountFalseStates = (coding: VariableCodingData, sourceResponses: Response[]): number => {
  switch (coding.sourceType) {
    case 'MANUAL': {
      const isInvalid = (r: Response) => !MANUAL_VALID_STATES
        .includes(r.status as (typeof MANUAL_VALID_STATES)[number]) &&
        !(
          (r.status === CODING_SCHEME_STATUS.DISPLAYED &&
            coding.sourceParameters?.processing?.includes('TAKE_DISPLAYED_AS_VALUE_CHANGED')) ||
          (r.status === CODING_SCHEME_STATUS.NOT_REACHED &&
            coding.sourceParameters?.processing?.includes('TAKE_NOT_REACHED_AS_VALUE_CHANGED'))
        );

      return sourceResponses.filter(isInvalid).length;
    }

    case 'COPY_VALUE':
    case 'UNIQUE_VALUES':
    case 'SOLVER': {
      const isInvalid = (r: Response) => !COPY_SOLVER_VALID_STATES
        .includes(r.status as (typeof COPY_SOLVER_VALID_STATES)[number]);
      return sourceResponses.filter(isInvalid).length;
    }

    case 'CONCAT_CODE':
    case 'SUM_CODE':
    case 'SUM_SCORE': {
      const isInvalid = (r: Response) => !CONCAT_SUM_VALID_STATES
        .includes(r.status as (typeof CONCAT_SUM_VALID_STATES)[number]);
      return sourceResponses.filter(isInvalid).length;
    }

    default:
      return 0;
  }
};

type DeriveContext = {
  variableCodings: VariableCodingData[];
  coding: VariableCodingData;
  sourceResponses: Response[];
  sourceResponseById: Map<string, Response>;
  subformSource: string | undefined;
};

type SolverReplacement = {
  sourceId: string;
  fragmentIndex?: number;
};

type SolverToken = {
  text: string;
  variableAlias: string;
  fragmentIndex?: number;
};

const handleManual = ({ coding, sourceResponses, subformSource }: DeriveContext): Response => {
  if (sourceResponses.every(r => r.status === CODING_SCHEME_STATUS.INTENDED_INCOMPLETE)) {
    return <Response>{
      id: coding.id,
      value: null,
      status: CODING_SCHEME_STATUS.CODING_INCOMPLETE,
      subform: subformSource
    };
  }
  return <Response>{
    id: coding.id,
    value: null,
    status: CODING_SCHEME_STATUS.CODING_COMPLETE,
    subform: subformSource
  };
};

const handleCopyValue = ({ coding, sourceResponses, subformSource }: DeriveContext): Response => {
  if (sourceResponses.some(response => response.status === CODING_SCHEME_STATUS.DERIVE_PENDING)) {
    return <Response>{
      id: coding.id,
      value: null,
      status: CODING_SCHEME_STATUS.DERIVE_PENDING,
      subform: subformSource
    };
  }

  const derivedValue = sourceResponses[0].value;
  return <Response>{
    id: coding.id,
    value: derivedValue ? JSON.parse(JSON.stringify(derivedValue)) : null,
    status: CODING_SCHEME_STATUS.VALUE_CHANGED,
    subform: subformSource
  };
};

const handleConcatCode = ({ coding, sourceResponseById, subformSource }: DeriveContext): Response => {
  const deriveSources = coding.deriveSources ?? [];
  const extractCode = (sourceId: string): string => {
    const response = sourceResponseById.get(sourceId);
    return response && (response.code || response.code === 0) ? response.code.toString(10) : '?';
  };
  const codes = deriveSources.map(extractCode);

  if (coding.sourceParameters?.processing?.includes('SORT')) {
    codes.sort();
  }

  return <Response>{
    id: coding.id,
    value: codes.join(DeriveConcatDelimiter),
    status: CODING_SCHEME_STATUS.VALUE_CHANGED,
    subform: subformSource
  };
};

const handleSumCode = ({ coding, sourceResponseById, subformSource }: DeriveContext): Response => {
  const deriveSources = coding.deriveSources ?? [];
  const allSourcesPresent = deriveSources.every(sourceId => sourceResponseById.has(sourceId));
  if (!allSourcesPresent) {
    return deriveErrorResponse(coding, subformSource);
  }
  return <Response>{
    id: coding.id,
    value: deriveSources.reduce((sum, sourceId) => {
      const myResponse = sourceResponseById.get(sourceId);
      return sum + (myResponse?.code ?? 0);
    }, 0),
    status: CODING_SCHEME_STATUS.VALUE_CHANGED,
    subform: subformSource
  };
};

const handleSumScore = ({ coding, sourceResponseById, subformSource }: DeriveContext): Response => {
  const deriveSources = coding.deriveSources ?? [];
  const allSourcesPresent = deriveSources.every(sourceId => sourceResponseById.has(sourceId));
  if (!allSourcesPresent) {
    return deriveErrorResponse(coding, subformSource);
  }

  return <Response>{
    id: coding.id,
    value: deriveSources
      .map((sourceId: string) => {
        const response = sourceResponseById.get(sourceId);
        return response?.score ?? 0;
      })
      .reduce((total: number, score: number) => total + score, 0),
    status: CODING_SCHEME_STATUS.VALUE_CHANGED,
    subform: subformSource
  };
};

const handleUniqueValues = ({ coding, sourceResponses, subformSource }: DeriveContext): Response => {
  const valuesToCompare: string[] = sourceResponses
    .filter(r => validStatesForDerivingValue.includes(r.status))
    .map(r => {
      const processing = coding.sourceParameters?.processing;
      const isToNumberProcessing = processing?.includes('TO_NUMBER');

      if (Array.isArray(r.value)) {
        return r.value
          .map(value => (isToNumberProcessing ?
            (CodingFactory.getValueAsNumber(value) || 0).toString(10) :
            CodingFactory.getValueAsString(value, processing) || '')
          )
          .join('##');
      }

      return isToNumberProcessing ?
        (CodingFactory.getValueAsNumber(r.value) || 0).toString(10) :
        CodingFactory.getValueAsString(r.value, processing) || '';
    });

  const duplicates = valuesToCompare.filter((value, index, array) => array.indexOf(value) < index);

  return <Response>{
    id: coding.id,
    value: duplicates.length === 0,
    status: CODING_SCHEME_STATUS.VALUE_CHANGED,
    subform: subformSource
  };
};

const isSolverAliasChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === '_' ||
    char === ',' ||
    char === '-'
  );
};

const isDigit = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code >= 48 && code <= 57;
};

const parseSolverToken = (text: string, content: string): SolverToken | null => {
  let variableAlias = content.trim();
  let fragmentIndex: number | undefined;

  if (variableAlias.endsWith(']')) {
    const fragmentStart = variableAlias.lastIndexOf('[');
    if (fragmentStart < 0) {
      return null;
    }

    const fragmentText = variableAlias.slice(fragmentStart + 1, -1).trim();
    if (fragmentText.length === 0 || !Array.from(fragmentText).every(isDigit)) {
      return null;
    }

    fragmentIndex = Number.parseInt(fragmentText, 10);
    variableAlias = variableAlias.slice(0, fragmentStart).trim();
  }

  if (variableAlias.length === 0 || !Array.from(variableAlias).every(isSolverAliasChar)) {
    return null;
  }

  return {
    text,
    variableAlias,
    fragmentIndex
  };
};

const getSolverTokens = (solverExpression: string): SolverToken[] => {
  const tokens: SolverToken[] = [];
  let searchStart = 0;

  while (searchStart < solverExpression.length) {
    const tokenStart = solverExpression.indexOf('${', searchStart);
    if (tokenStart < 0) {
      break;
    }

    const tokenEnd = solverExpression.indexOf('}', tokenStart + 2);
    if (tokenEnd < 0) {
      break;
    }

    const text = solverExpression.slice(tokenStart, tokenEnd + 1);
    const content = solverExpression.slice(tokenStart + 2, tokenEnd);
    const token = parseSolverToken(text, content);
    if (token) {
      tokens.push(token);
    }
    searchStart = tokenEnd + 1;
  }

  return tokens;
};

const getFragmentValueAsNumber = (
  response: Response,
  sourceCoding: VariableCodingData | undefined,
  fragmentIndex: number
): number | null => {
  if (!sourceCoding || Array.isArray(response.value)) {
    return null;
  }

  let transformedValue;
  try {
    transformedValue = transformValue(response.value, sourceCoding.fragmenting || '', false);
  } catch (error) {
    return null;
  }
  if (!Array.isArray(transformedValue)) {
    return null;
  }

  const fragment = transformedValue[fragmentIndex];
  if (Array.isArray(fragment) || typeof fragment === 'undefined') {
    return null;
  }

  if (typeof fragment === 'string' && fragment.trim() === '') {
    return null;
  }

  return CodingFactory.getValueAsNumber(fragment as ResponseValueSingleType);
};

const getSolverReplacementValue = (
  replacement: SolverReplacement,
  sourceResponseById: Map<string, Response>,
  sourceCodingById: Map<string, VariableCodingData>
): number | null => {
  const responseToReplace = sourceResponseById.get(replacement.sourceId);
  if (!responseToReplace) {
    return null;
  }

  if (typeof replacement.fragmentIndex === 'number') {
    return getFragmentValueAsNumber(
      responseToReplace,
      sourceCodingById.get(replacement.sourceId),
      replacement.fragmentIndex
    );
  }

  if (Array.isArray(responseToReplace.value)) {
    return null;
  }

  return CodingFactory.getValueAsNumber(responseToReplace.value);
};

const handleSolver = ({
  variableCodings, coding, sourceResponseById, subformSource
}: DeriveContext): Response => {
  if (!(coding.sourceParameters && coding.sourceParameters.processing && coding.sourceParameters.solverExpression)) {
    return deriveErrorResponse(coding, subformSource);
  }

  const deriveSources = coding.deriveSources ?? [];
  const sourceCodingById = new Map(variableCodings.map(c => [c.id, c] as const));
  const sources: string[] = [];
  const replacements = new Map<string, SolverReplacement>();

  const tokens = getSolverTokens(coding.sourceParameters.solverExpression);

  // eslint-disable-next-line no-restricted-syntax
  for (const token of tokens) {
    const variableAlias = token.variableAlias;
    const matchId = variableCodings.find(c => c.alias === variableAlias)?.id || variableAlias;

    if (!sources.includes(matchId)) {
      sources.push(matchId);
    }
    if (!replacements.has(token.text)) {
      replacements.set(token.text, {
        sourceId: matchId,
        fragmentIndex: token.fragmentIndex
      });
    }
  }

  const missingDeriveVars = sources.filter(source => !deriveSources.includes(source));

  if (missingDeriveVars.length > 0) {
    return <Response>{
      id: coding.id,
      value: null,
      status: CODING_SCHEME_STATUS.DERIVE_ERROR,
      subform: subformSource
    };
  }

  let newExpression = coding.sourceParameters.solverExpression;

  // eslint-disable-next-line no-restricted-syntax
  for (const [toReplace, replacement] of replacements.entries()) {
    const valueToReplace = getSolverReplacementValue(replacement, sourceResponseById, sourceCodingById);
    if (valueToReplace === null) {
      return deriveErrorResponse(coding, subformSource);
    }

    newExpression = newExpression.split(toReplace).join(valueToReplace.toString(10));
  }

  let newValue: unknown;
  try {
    newValue = evaluate(newExpression);
  } catch (error) {
    return deriveErrorResponse(coding, subformSource);
  }

  if (
    typeof newValue !== 'number' ||
    Number.isNaN(newValue) ||
    newValue === Number.POSITIVE_INFINITY ||
    newValue === Number.NEGATIVE_INFINITY
  ) {
    newValue = null;
  }

  return <Response>{
    id: coding.id,
    value: newValue,
    status: newValue === null ? CODING_SCHEME_STATUS.DERIVE_ERROR : CODING_SCHEME_STATUS.VALUE_CHANGED,
    subform: subformSource
  };
};

export const deriveValue = (
  variableCodings: VariableCodingData[],
  coding: VariableCodingData,
  sourceResponses: Response[]
): Response => {
  const subformSource = sourceResponses.find(r => r.subform !== undefined)?.subform;

  const statusPrecedence: Array<{
    from: CodingSchemeStatus;
    to: CodingSchemeStatus;
  }> = [
    { from: CODING_SCHEME_STATUS.UNSET, to: CODING_SCHEME_STATUS.UNSET },
    {
      from: CODING_SCHEME_STATUS.DERIVE_ERROR,
      to: CODING_SCHEME_STATUS.DERIVE_ERROR
    },
    {
      from: CODING_SCHEME_STATUS.NO_CODING,
      to: CODING_SCHEME_STATUS.DERIVE_ERROR
    },
    {
      from: CODING_SCHEME_STATUS.CODING_ERROR,
      to: CODING_SCHEME_STATUS.CODING_ERROR
    },
    { from: CODING_SCHEME_STATUS.INVALID, to: CODING_SCHEME_STATUS.INVALID }
  ];

  // eslint-disable-next-line no-restricted-syntax
  for (const mapping of statusPrecedence) {
    if (sourceResponses.some(r => r.status === mapping.from)) {
      return <Response>{
        id: coding.id,
        value: null,
        status: mapping.to,
        subform: subformSource
      };
    }
  }

  const hasPending = sourceResponses.some(r => isPendingStatus(r.status as CodingSchemeStatus));

  if (
    hasPending &&
    sourceResponses.every(r => VALID_STATES_TO_START_DERIVE_PENDING_CHECK.includes(
      r.status as (typeof VALID_STATES_TO_START_DERIVE_PENDING_CHECK)[number]
    )
    ) &&
    !['MANUAL', 'COPY_VALUE', 'UNIQUE_VALUES', 'SOLVER'].includes(coding.sourceType)
  ) {
    return <Response>{
      id: coding.id,
      value: null,
      status: CODING_SCHEME_STATUS.DERIVE_PENDING,
      subform: subformSource
    };
  }

  const falseStates = amountFalseStates(coding, sourceResponses);

  if (sourceResponses.length >= falseStates && falseStates > 0) {
    const allHaveSameStatus = sourceResponses.every(r => r.status === sourceResponses[0].status);
    const allArePartlyDisplayedStatuses = sourceResponses
      .every(r => PARTLY_DISPLAYED_STATUSES.includes(r.status as (typeof PARTLY_DISPLAYED_STATUSES)[number])
      );

    if (allHaveSameStatus) {
      return <Response>{
        id: coding.id,
        value: null,
        status: sourceResponses[0].status,
        subform: subformSource
      };
    }

    if (allArePartlyDisplayedStatuses) {
      return <Response>{
        id: coding.id,
        value: null,
        status: CODING_SCHEME_STATUS.PARTLY_DISPLAYED,
        subform: subformSource
      };
    }

    return <Response>{
      id: coding.id,
      value: null,
      status: CODING_SCHEME_STATUS.INVALID,
      subform: subformSource
    };
  }

  const ctx: DeriveContext = {
    variableCodings,
    coding,
    sourceResponses,
    sourceResponseById: new Map(sourceResponses.map(r => [r.id, r] as const)),
    subformSource
  };

  const handlers: Partial<Record<VariableCodingData['sourceType'], (c: DeriveContext) => Response>> = {
    MANUAL: handleManual,
    COPY_VALUE: handleCopyValue,
    CONCAT_CODE: handleConcatCode,
    SUM_CODE: handleSumCode,
    SUM_SCORE: handleSumScore,
    UNIQUE_VALUES: handleUniqueValues,
    SOLVER: handleSolver
  };

  const handler = handlers[coding.sourceType];
  return handler ? handler(ctx) : deriveErrorResponse(coding, subformSource);
};
