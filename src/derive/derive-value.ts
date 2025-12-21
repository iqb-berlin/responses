import { evaluate } from 'mathjs';
import { Response } from '@iqbspecs/response/response.interface';
import {
  DeriveConcatDelimiter,
  validStatesForDerivingValue,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import {
  CONCAT_SUM_VALID_STATES,
  COPY_SOLVER_VALID_STATES,
  MANUAL_VALID_STATES,
  PARTLY_DISPLAYED_STATUSES,
  VALID_STATES_TO_START_DERIVE_PENDING_CHECK
} from '../constants';
import { CodingFactory } from '../coding-factory';

export const amountFalseStates = (
  coding: VariableCodingData,
  sourceResponses: Response[]
): number => {
  switch (coding.sourceType) {
    case 'MANUAL': {
      const isInvalid = (r: Response) => !MANUAL_VALID_STATES.includes(
        r.status as (typeof MANUAL_VALID_STATES)[number]
      ) &&
        !(
          (r.status === 'DISPLAYED' &&
            coding.sourceParameters?.processing?.includes(
              'TAKE_DISPLAYED_AS_VALUE_CHANGED'
            )) ||
          (r.status === 'NOT_REACHED' &&
            coding.sourceParameters?.processing?.includes(
              'TAKE_NOT_REACHED_AS_VALUE_CHANGED'
            ))
        );

      return sourceResponses.filter(isInvalid).length;
    }

    case 'COPY_VALUE':
    case 'UNIQUE_VALUES':
    case 'SOLVER': {
      const isInvalid = (r: Response) => !COPY_SOLVER_VALID_STATES.includes(
        r.status as (typeof COPY_SOLVER_VALID_STATES)[number]
      );
      return sourceResponses.filter(isInvalid).length;
    }

    case 'CONCAT_CODE':
    case 'SUM_CODE':
    case 'SUM_SCORE': {
      const isInvalid = (r: Response) => !CONCAT_SUM_VALID_STATES.includes(
        r.status as (typeof CONCAT_SUM_VALID_STATES)[number]
      );
      return sourceResponses.filter(isInvalid).length;
    }

    default:
      return 0;
  }
};

export const deriveValue = (
  variableCodings: VariableCodingData[],
  coding: VariableCodingData,
  sourceResponses: Response[]
): Response => {
  const subformSource = sourceResponses.find(
    r => r.subform !== undefined
  )?.subform;

  const statusMapping: Record<string, string> = {
    UNSET: 'UNSET',
    DERIVE_ERROR: 'DERIVE_ERROR',
    NO_CODING: 'DERIVE_ERROR',
    CODING_ERROR: 'CODING_ERROR',
    INVALID: 'INVALID'
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(statusMapping)) {
    if (sourceResponses.some(r => r.status === key)) {
      return <Response>{
        id: coding.id,
        value: null,
        status: value,
        subform: subformSource
      };
    }
  }

  const hasPending = sourceResponses.some(
    r => r.status === 'CODING_INCOMPLETE' || r.status === 'DERIVE_PENDING'
  );

  if (
    hasPending &&
    sourceResponses.every(r => VALID_STATES_TO_START_DERIVE_PENDING_CHECK.includes(
      r.status as (typeof VALID_STATES_TO_START_DERIVE_PENDING_CHECK)[number]
    )
    ) &&
    !['MANUAL', 'COPY_VALUE', 'UNIQUE_VALUES', 'SOLVER'].includes(
      coding.sourceType
    )
  ) {
    return <Response>{
      id: coding.id,
      value: null,
      status: 'DERIVE_PENDING',
      subform: subformSource
    };
  }

  const falseStates = amountFalseStates(coding, sourceResponses);

  if (sourceResponses.length >= falseStates && falseStates > 0) {
    const allHaveSameStatus = sourceResponses.every(
      r => r.status === sourceResponses[0].status
    );
    const allArePartlyDisplayedStatuses = sourceResponses.every(r => PARTLY_DISPLAYED_STATUSES.includes(
      r.status as (typeof PARTLY_DISPLAYED_STATUSES)[number]
    )
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
        status: 'PARTLY_DISPLAYED',
        subform: subformSource
      };
    }

    return <Response>{
      id: coding.id,
      value: null,
      status: 'INVALID',
      subform: subformSource
    };
  }

  // eslint-disable-next-line default-case
  switch (coding.sourceType) {
    case 'MANUAL': {
      if (sourceResponses.every(r => r.status === 'INTENDED_INCOMPLETE')) {
        return <Response>{
          id: coding.id,
          value: null,
          status: 'CODING_INCOMPLETE',
          subform: subformSource
        };
      }
      return <Response>{
        id: coding.id,
        value: null,
        status: 'CODING_COMPLETE',
        subform: subformSource
      };
    }

    case 'COPY_VALUE': {
      if (
        sourceResponses.some(response => response.status === 'DERIVE_PENDING')
      ) {
        return <Response>{
          id: coding.id,
          value: null,
          status: 'DERIVE_PENDING',
          subform: subformSource
        };
      }
      const derivedValue = sourceResponses[0].value;
      return <Response>{
        id: coding.id,
        value: derivedValue ? JSON.parse(JSON.stringify(derivedValue)) : null,
        status: 'VALUE_CHANGED',
        subform: subformSource
      };
    }

    case 'CONCAT_CODE': {
      const deriveSources = coding.deriveSources ?? [];
      const extractCode = (sourceId: string): string => {
        const response = sourceResponses.find(r => r.id === sourceId);
        return response && (response.code || response.code === 0) ?
          response.code.toString(10) :
          '?';
      };
      const codes = deriveSources.map(extractCode);

      if (coding.sourceParameters?.processing?.includes('SORT')) {
        codes.sort();
      }

      return <Response>{
        id: coding.id,
        value: codes.join(DeriveConcatDelimiter),
        status: 'VALUE_CHANGED',
        subform: subformSource
      };
    }

    case 'SUM_CODE': {
      const deriveSources = coding.deriveSources ?? [];
      return <Response>{
        id: coding.id,
        value: deriveSources.reduce((sum, sourceId) => {
          const myResponse = sourceResponses.find(r => r.id === sourceId);

          if (!myResponse) {
            throw new Error(
              `Response with id ${sourceId} not found in derive sources`
            );
          }

          return sum + (myResponse.code || 0);
        }, 0),
        status: 'VALUE_CHANGED',
        subform: subformSource
      };
    }

    case 'SUM_SCORE': {
      const deriveSources = coding.deriveSources ?? [];
      return <Response>{
        id: coding.id,
        value: deriveSources
          .map((sourceId: string) => {
            const response = sourceResponses.find(r => r.id === sourceId);
            if (!response) {
              throw new Error(
                `Response with id "${sourceId}" not found in derive sources.`
              );
            }
            return response.score ?? 0;
          })
          .reduce((total: number, score: number) => total + score, 0),
        status: 'VALUE_CHANGED',
        subform: subformSource
      };
    }

    case 'UNIQUE_VALUES': {
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

      const duplicates = valuesToCompare.filter(
        (value, index, array) => array.indexOf(value) < index
      );

      return <Response>{
        id: coding.id,
        value: duplicates.length === 0,
        status: 'VALUE_CHANGED',
        subform: subformSource
      };
    }

    case 'SOLVER':
      if (
        coding.sourceParameters &&
        coding.sourceParameters.processing &&
        coding.sourceParameters.solverExpression
      ) {
        const deriveSources = coding.deriveSources ?? [];
        const varSearchPattern = /\$\{(\s*[\w,-]+\s*)}/g;
        const sources: string[] = [];
        const replacements = new Map<string, string>();

        const matches = Array.from(
          coding.sourceParameters.solverExpression.matchAll(varSearchPattern)
        );

        // eslint-disable-next-line no-restricted-syntax
        for (const match of matches) {
          const variableAlias = match[1].trim();
          const matchId =
            variableCodings.find(c => c.alias === variableAlias)?.id ||
            variableAlias;

          if (!sources.includes(matchId)) {
            sources.push(matchId);
          }
          if (!replacements.has(variableAlias)) {
            replacements.set(variableAlias, matchId);
          }
        }

        const missingDeriveVars = sources.filter(
          source => !deriveSources.includes(source)
        );

        if (missingDeriveVars.length > 0) {
          return <Response>{
            id: coding.id,
            value: null,
            status: 'DERIVE_ERROR',
            subform: subformSource
          };
        }

        let newExpression = coding.sourceParameters.solverExpression;

        replacements.forEach((varId, toReplace) => {
          const responseToReplace = sourceResponses.find(r => r.id === varId);

          if (!responseToReplace || Array.isArray(responseToReplace.value)) {
            throw new Error(
              'Response is missing or value is an array in the solver'
            );
          }

          const valueToReplace = CodingFactory.getValueAsNumber(
            responseToReplace.value
          );
          if (valueToReplace === null) {
            throw new Error('Response value is not numeric');
          }

          const replacePattern = new RegExp(`\\$\\{${toReplace}}`, 'g');
          newExpression = newExpression.replace(
            replacePattern,
            valueToReplace.toString(10)
          );
        });

        let newValue = evaluate(newExpression);

        if (
          Number.isNaN(newValue) ||
          newValue === Number.POSITIVE_INFINITY ||
          newValue === Number.NEGATIVE_INFINITY
        ) {
          newValue = null;
        }

        return <Response>{
          id: coding.id,
          value: newValue,
          status: newValue === null ? 'DERIVE_ERROR' : 'VALUE_CHANGED',
          subform: subformSource
        };
      }
      break;
    default:
      break;
  }

  throw new Error('deriving failed');
};
