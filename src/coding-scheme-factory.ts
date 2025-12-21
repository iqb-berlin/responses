/* eslint-disable implicit-arrow-linebreak */
import { evaluate } from 'mathjs';
import { Response } from '@iqbspecs/response/response.interface';
import {
  DeriveConcatDelimiter,
  RuleMethodParameterCount,
  validStatesForDerivingValue,
  validStatesToStartDeriving,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodingAsText, CodingSchemeProblem, CodingToTextMode } from './coding-interfaces';
import {
  CodingAsText,
  CodingToTextMode,
  CodingSchemeProblem
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';
import { ToTextFactory } from './to-text-factory';

export interface VariableGraphNode {
  id: string;
  level: number;
  sources: string[];
  page: string;
}

export abstract class CodingSchemeFactory {
  variableCodings: VariableCodingData[] = [];

  static getVariableDependencyTree(
    variableCodings: VariableCodingData[]
  ): VariableGraphNode[] {
    const graph: VariableGraphNode[] = variableCodings
      .filter(c => c.sourceType === 'BASE')
      .map(c => ({
        id: c.id,
        level: 0,
        sources: [],
        page: c.page || ''
      }));

    const baseNoValueCount = variableCodings.filter(
      c => c.sourceType === 'BASE_NO_VALUE'
    ).length;
    const maxGraphLength = variableCodings.length - baseNoValueCount;

    // Main loop to extend the dependencies
    let dependenciesResolved = true;
    while (dependenciesResolved && graph.length < maxGraphLength) {
      dependenciesResolved = false;

      const processVariableCoding = (vc: VariableCodingData): boolean => {
        const existingNode = graph.find(node => node.id === vc.id);

        if (vc.sourceType !== 'BASE_NO_VALUE' && !existingNode) {
          const deriveSources = vc.deriveSources ?? [];
          let maxLevel = 0;
          let commonPage: string | null = null;

          const allSourcesResolved = deriveSources.every(sourceId => {
            const sourceNode = graph.find(node => node.id === sourceId);
            if (sourceNode) {
              maxLevel = Math.max(maxLevel, sourceNode.level);
              commonPage = CodingSchemeFactory.resolveCommonPage(
                commonPage,
                sourceNode.page
              );
              return true;
            }
            return false;
          });

          if (allSourcesResolved) {
            graph.push({
              id: vc.id,
              level: maxLevel + 1,
              sources: [...deriveSources],
              page: commonPage || ''
            });
            return true;
          }
        }
        return false;
      };

      let anyDependenciesResolved = false;
      variableCodings.forEach(vc => {
        if (processVariableCoding(vc)) {
          anyDependenciesResolved = true;
        }
      });
      dependenciesResolved = anyDependenciesResolved;
    }

    if (dependenciesResolved) {
      return graph;
    }

    throw new Error('Circular dependency detected in the coding scheme');
  }

  /**
   * Helper function to resolve the common page between nodes.
   * Returns either the common page or an empty string if the pages are different.
   */
  private static resolveCommonPage(
    currentPage: string | null,
    newPage: string
  ): string | null {
    if (currentPage === null) {
      return newPage;
    }
    return currentPage === newPage ? currentPage : '';
  }

  static deriveValue(
    variableCodings: VariableCodingData[],
    coding: VariableCodingData,
    sourceResponses: Response[]
  ): Response {
    const subformSource = sourceResponses.find(
      r => r.subform !== undefined
    )?.subform;
    // Killer
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
      sourceResponses.every(r =>
        [
          'CODING_INCOMPLETE',
          'CODING_COMPLETE',
          'DERIVE_PENDING',
          'INTENDED_INCOMPLETE'
        ].includes(r.status)
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

    const amountFalseStates = this.amountFalseStates(coding, sourceResponses);

    if (sourceResponses.length >= amountFalseStates && amountFalseStates > 0) {
      const allHaveSameStatus = sourceResponses.every(
        r => r.status === sourceResponses[0].status
      );
      const allArePartlyDisplayedStatuses = sourceResponses.every(r =>
        ['NOT_REACHED', 'DISPLAYED', 'PARTLY_DISPLAYED'].includes(r.status)
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
          sourceResponses.some(
            response => response.status === 'DERIVE_PENDING'
          )
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
          .filter(r => validStatesForDerivingValue.includes(r.status) || r.status === 'INTENDED_INCOMPLETE')
          .map(r => {
            const processing = coding.sourceParameters?.processing;
            const isToNumberProcessing = processing?.includes('TO_NUMBER');

            if (Array.isArray(r.value)) {
              return r.value
                .map(value =>
                  (isToNumberProcessing ?
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

          // Extract all variable placeholders from the solver expression
          const matches = Array.from(
            coding.sourceParameters.solverExpression.matchAll(varSearchPattern)
          );

          // eslint-disable-next-line no-restricted-syntax
          for (const match of matches) {
            const variableAlias = match[1].trim(); // Extract the variable alias without surrounding whitespace
            const matchId =
              variableCodings.find(c => c.alias === variableAlias)?.id ||
              variableAlias;

            // Add to sources if not already present
            if (!sources.includes(matchId)) {
              sources.push(matchId);
            }
            // Add to the replacement map if not already present
            if (!replacements.has(variableAlias)) {
              replacements.set(variableAlias, matchId);
            }
          }

          // Verify if there are any missing sources required for deriving the value
          const missingDeriveVars = sources.filter(
            source => !deriveSources.includes(source)
          );

          if (missingDeriveVars.length > 0) {
            // Exit early if required sources are missing
            return <Response>{
              id: coding.id,
              value: null,
              status: 'DERIVE_ERROR',
              subform: subformSource
            };
          }

          // All variables can be resolved; begin processing the expression
          let newExpression = coding.sourceParameters.solverExpression;

          replacements.forEach((varId, toReplace) => {
            const responseToReplace = sourceResponses.find(
              r => r.id === varId
            );

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

            // Replace the variable placeholder with its corresponding numeric value
            const replacePattern = new RegExp(`\\$\\{${toReplace}}`, 'g');
            newExpression = newExpression.replace(
              replacePattern,
              valueToReplace.toString(10)
            );
          });

          // Evaluate the resulting expression
          let newValue = evaluate(newExpression);

          // Validate the result - check for invalid numbers or infinities
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
    }

    throw new Error('deriving failed');
  }

  static amountFalseStates(
    coding: VariableCodingData,
    sourceResponses: Response[]
  ): number {
    const manualValidStates = [
      'INVALID',
      'VALUE_CHANGED',
      'NO_CODING',
      'CODING_ERROR',
      'CODING_COMPLETE',
      'INTENDED_INCOMPLETE'
    ];

    const copySolverValidStates = [
      'VALUE_CHANGED',
      'NO_CODING',
      'CODING_INCOMPLETE',
      'CODING_ERROR',
      'CODING_COMPLETE',
      'INTENDED_INCOMPLETE'
    ];

    const concatSumValidStates = ['CODING_COMPLETE', 'INTENDED_INCOMPLETE'];

    switch (coding.sourceType) {
      case 'MANUAL': {
        const isInvalid = (r: Response) =>
          !manualValidStates.includes(r.status) &&
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
        const isInvalid = (r: Response) =>
          !copySolverValidStates.includes(r.status);
        return sourceResponses.filter(isInvalid).length;
      }

      case 'CONCAT_CODE':
      case 'SUM_CODE':
      case 'SUM_SCORE': {
        const isInvalid = (r: Response) =>
          !concatSumValidStates.includes(r.status);
        return sourceResponses.filter(isInvalid).length;
      }

      default:
        return 0;
    }
  }

  static code(
    unitResponses: Response[],
    variableCodings: VariableCodingData[]
  ): Response[] {
    // decouple object from caller variable
    const stringifiedResponses = JSON.stringify(unitResponses);
    let newResponses: Response[] = JSON.parse(stringifiedResponses);
    let allCodedResponses: Response[] = [];
    const notSubformResponses: Response[] = [];

    // Group responses into sub-forms
    const subformGroups = newResponses.reduce((acc, r: Response) => {
      if (r.subform) {
        acc[r.subform] = acc[r.subform] || [];
        acc[r.subform].push(r);
      } else {
        notSubformResponses.push(r);
      }
      return acc;
    }, {} as Record<string, Response[]>);

    // code responses for each subform
    [...Object.values(subformGroups), notSubformResponses].forEach(
      allResponses => {
        // responses id to alias
        const updatedResponses = allResponses.map(r => ({
          ...r,
          id: variableCodings.find(c => c.alias === r.id)?.id || r.id
        }));

        newResponses = allResponses.every(r => r.subform !== undefined) ?
          [...updatedResponses, ...notSubformResponses] :
          [...updatedResponses];

        // change DISPLAYED to VALUE_CHANGED if requested
        newResponses
          .filter(r => r.status === 'DISPLAYED')
          .forEach(r => {
            const myCoding = variableCodings.find(c => c.id === r.id);
            if (
              myCoding &&
              myCoding.sourceType === 'BASE' &&
              myCoding.sourceParameters?.processing &&
              myCoding.sourceParameters.processing.includes(
                'TAKE_DISPLAYED_AS_VALUE_CHANGED'
              )
            ) {
              r.status = 'VALUE_CHANGED';
            }
          });

        // change NOT_REACHED to VALUE_CHANGED if requested
        newResponses
          .filter(r => r.status === 'NOT_REACHED')
          .forEach(r => {
            const myCoding = variableCodings.find(c => c.id === r.id);

            if (
              myCoding?.sourceType === 'BASE' &&
              myCoding.sourceParameters?.processing?.includes(
                'TAKE_NOT_REACHED_AS_VALUE_CHANGED'
              )
            ) {
              r.status = 'VALUE_CHANGED';
            }
          });

        // Mark the response as 'INVALID' if the value is empty and certain conditions are met
        newResponses
          .filter(
            r =>
              r.status === 'VALUE_CHANGED' &&
              CodingFactory.isEmptyValue(r.value)
          )
          .forEach(r => {
            const myCoding = variableCodings.find(
              coding => coding.id === r.id
            );

            if (!myCoding) {
              return;
            }

            const isBaseType = myCoding.sourceType === 'BASE';
            const takeEmptyAsValid =
              myCoding.sourceParameters?.processing?.includes(
                'TAKE_EMPTY_AS_VALID'
              ) || false;

            if (isBaseType && !takeEmptyAsValid) {
              r.status = 'INVALID';
            }
          });

        // Remove base variables if a derived variable with the same ID exists
        const nonBaseCodings = variableCodings.filter(
          vc => vc.sourceType !== 'BASE'
        );

        newResponses = newResponses.filter(response => {
          const hasDerivedConflict = nonBaseCodings.some(
            vc =>
              response.id === vc.id &&
              !response.code &&
              !response.score &&
              response.status !== 'CODING_COMPLETE'
          );
          return !hasDerivedConflict;
        });

        // Set up the variable tree
        let varDependencies: VariableGraphNode[] = [];
        let globalDeriveError = false;

        try {
          varDependencies =
            CodingSchemeFactory.getVariableDependencyTree(variableCodings);
        } catch (error) {
          globalDeriveError = true;
          varDependencies = [];
        }

        // Handle derived variables in case of errors or missing responses
        variableCodings.forEach(coding => {
          if (globalDeriveError && coding.sourceType === 'BASE') {
            varDependencies.push({
              id: coding.id,
              level: 0,
              sources: [],
              page: coding.page || ''
            });
          }

          if (newResponses.some(response => response.id === coding.id)) {
            return;
          }

          if (coding.sourceType !== 'BASE_NO_VALUE') {
            const status =
              globalDeriveError && coding.sourceType !== 'BASE' ?
                'DERIVE_ERROR' :
                'UNSET';

            newResponses.push({
              id: coding.id,
              value: null,
              status
            });
          }
        });

        const maxVarLevel = Math.max(...varDependencies.map(n => n.level));

        for (let level = 0; level <= maxVarLevel; level++) {
          // Filter variables at the current level
          const currentLevelNodes = varDependencies.filter(
            n => n.level === level
          );

          // eslint-disable-next-line no-restricted-syntax
          for (const varNode of currentLevelNodes) {
            const targetResponse = newResponses.find(
              r => r.id === varNode.id
            );
            const varCoding = variableCodings.find(
              vc => vc.id === varNode.id
            );

            if (!targetResponse || !varCoding) {
              // Skip processing if there is no target response or variable coding for the node
              break;
            }

            // If sources exist and the current status is valid for derivation
            if (
              varNode.sources.length > 0 &&
              validStatesToStartDeriving.includes(targetResponse.status)
            ) {
              deriveResponse(
                targetResponse,
                varCoding,
                varNode.sources,
                newResponses
              );
            }

            // Process coding logic if the status is "VALUE_CHANGED"
            if (targetResponse.status === 'VALUE_CHANGED') {
              processCoding(targetResponse, varCoding);
            }
          }
        }

        /**
         * Handles the derivation of the target response.
         */
        function deriveResponse(
          targetResponse: Response,
          varCoding: VariableCodingData,
          sourceIds: string[],
          responsesList: Response[]
        ): void {
          if (varCoding.sourceParameters?.processing?.includes('NO_CODING')) {
            return; // Skip derivation if the "NO_CODING" process is set
          }

          try {
            // Find the source responses based on source IDs
            const sourceResponses = responsesList.filter(r =>
              sourceIds.includes(r.id)
            );
            const derivedResponse = CodingSchemeFactory.deriveValue(
              variableCodings,
              varCoding,
              sourceResponses
            );

            // Update the target response's derived status and subform
            targetResponse.status = derivedResponse.status;
            targetResponse.subform = derivedResponse.subform;

            // Update the value if the status after derivation is "VALUE_CHANGED"
            if (derivedResponse.status === 'VALUE_CHANGED') {
              targetResponse.value = derivedResponse.value;
            }
          } catch (error) {
            // Handle errors during derivation
            targetResponse.status = 'DERIVE_ERROR';
            targetResponse.value = null;
          }
        }

        /**
         * Processes the coding logic for the target response.
         */
        function processCoding(
          targetResponse: Response,
          varCoding: VariableCodingData
        ): void {
          if ((varCoding.codes?.length ?? 0) > 0) {
            // Perform variable coding if codes are available
            const codedResponse = CodingFactory.code(targetResponse, varCoding);

            // Update the target response if the status changed after coding
            if (codedResponse.status !== targetResponse.status) {
              targetResponse.status = codedResponse.status;
              targetResponse.code = codedResponse.code;
              targetResponse.score = codedResponse.score;
            }
          } else if (varCoding.sourceType === 'BASE') {
            const takeEmptyAsValid =
              varCoding.sourceParameters?.processing?.includes(
                'TAKE_EMPTY_AS_VALID'
              ) || false;

            // BASE variables usually have no coding table; in that case we mark them as NO_CODING.
            // Exception: if TAKE_EMPTY_AS_VALID is set, keep VALUE_CHANGED to indicate the empty value is accepted.
            if (!takeEmptyAsValid) {
              targetResponse.status = 'NO_CODING';
            }
          } else {
            // If there are no codes, mark the status as "NO_CODING"
            targetResponse.status = 'NO_CODING';
          }
        }

        // Mapping of responses (ID to Alias)
        function mapResponseIdsToAlias(
          responses: Response[],
          codings: VariableCodingData[]
        ): Response[] {
          const codingMap = new Map(
            codings.map(coding => [coding.id, coding.alias || coding.id])
          );
          return responses.map(response => ({
            ...response,
            id: codingMap.get(response.id) || response.id
          }));
        }

        // combine responses
        newResponses = mapResponseIdsToAlias(newResponses, variableCodings);
        allCodedResponses = [...allCodedResponses, ...newResponses];
      }
    );

    // remove duplicate responses if not from derived var
    let uniqueResponses = allCodedResponses.filter(
      (item, index, self) =>
        index ===
        self.findIndex(t => t.id === item.id && t.subform === item.subform)
    );

    const derivedAliases = variableCodings
      .filter(
        vc => vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE'
      )
      .map(vc => vc.alias || vc.id);

    // remove unset responses if the value is part in subform
    if (Object.keys(subformGroups).length > 0) {
      uniqueResponses = uniqueResponses.filter(ur => {
        const foundInSubformGroups = Object.values(subformGroups)[0].find(
          sr => sr.id === ur.id
        );
        const foundInDerived = derivedAliases.includes(ur.id);
        return !(
          (foundInSubformGroups || foundInDerived) &&
          ur.status === 'UNSET'
        );
      });
    }
    return [...uniqueResponses];
  }

  static validate(
    baseVariables: VariableInfo[],
    variableCodings: VariableCodingData[]
  ): CodingSchemeProblem[] {
    const baseVarById = new Map<string, VariableInfo>();
    const problems: CodingSchemeProblem[] = [];

    const pushInvalidSourceProblem = (
      variableId: string,
      variableLabel: string
    ) => {
      problems.push({
        type: 'INVALID_SOURCE',
        breaking: true,
        variableId,
        variableLabel
      });
    };

    const baseVarIdCounts = new Map<string, number>();
    baseVariables.forEach(bv => {
      if (bv?.id) {
        baseVarById.set(bv.id, bv);
        baseVarIdCounts.set(bv.id, (baseVarIdCounts.get(bv.id) ?? 0) + 1);
      }
    });
    [...baseVarIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .forEach(([id]) => {
        pushInvalidSourceProblem(id, '');
      });

    const codingIdCounts = new Map<string, number>();
    const codingAliasCounts = new Map<string, number>();
    const codingIds = new Set<string>();
    variableCodings.forEach(vc => {
      codingIdCounts.set(vc.id, (codingIdCounts.get(vc.id) ?? 0) + 1);
      codingIds.add(vc.id);
      if (vc.alias) {
        codingAliasCounts.set(
          vc.alias,
          (codingAliasCounts.get(vc.alias) ?? 0) + 1
        );
      }
    });

    variableCodings.forEach(vc => {
      if ((codingIdCounts.get(vc.id) ?? 0) > 1) {
        pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
      }
      if (vc.alias && (codingAliasCounts.get(vc.alias) ?? 0) > 1) {
        pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
      }
      if (vc.alias && codingIds.has(vc.alias) && vc.alias !== vc.id) {
        pushInvalidSourceProblem(vc.alias || vc.id, vc.label || '');
      }
    });

    const allDerivedVariableIds: string[] = variableCodings
      .filter(
        vc => vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE'
      )
      .map(vc => vc.id);
    const allBaseVariableInfoIds = baseVariables.map(bv => bv.id);
    const allPossibleSourceIds = [
      ...allBaseVariableInfoIds,
      ...allDerivedVariableIds
    ];
    const variableValuesCopied: string[] = [];
    variableCodings
      .filter(vc => vc.sourceType === 'COPY_VALUE')
      .forEach(vc => {
        variableValuesCopied.push(...(vc.deriveSources ?? []));
      });
    variableCodings.forEach(c => {
      if (c.sourceType === 'BASE') {
        const varInfo = baseVarById.get(c.id);
        if (varInfo?.type === 'no-value') {
          problems.push({
            type: 'INVALID_SOURCE',
            breaking: true,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
        if (allBaseVariableInfoIds.indexOf(c.id) < 0) {
          problems.push({
            type: 'SOURCE_MISSING',
            breaking: true,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
      } else if (c.sourceType === 'BASE_NO_VALUE') {
        const varInfo = baseVarById.get(c.id);
        if (varInfo && varInfo.type !== 'no-value') {
          problems.push({
            type: 'INVALID_SOURCE',
            breaking: true,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
        if (allBaseVariableInfoIds.indexOf(c.id) < 0) {
          problems.push({
            type: 'SOURCE_MISSING',
            breaking: true,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
      } else if (c.deriveSources && c.deriveSources.length > 0) {
        if (c.sourceType === 'COPY_VALUE') {
          if (c.deriveSources.length > 1) {
            problems.push({
              type: 'MORE_THAN_ONE_SOURCE',
              breaking: false,
              variableId: c.alias || c.id,
              variableLabel: c.label || ''
            });
          }
          if (
            allPossibleSourceIds.indexOf(c.deriveSources[0]) >= 0 &&
            allBaseVariableInfoIds.indexOf(c.deriveSources[0]) < 0
          ) {
            problems.push({
              type: 'VALUE_COPY_NOT_FROM_BASE',
              breaking: false,
              variableId: c.alias || c.id,
              variableLabel: c.label || ''
            });
          }
        } else if (c.deriveSources.length === 1) {
          problems.push({
            type: 'ONLY_ONE_SOURCE',
            breaking: false,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
        c.deriveSources.forEach(s => {
          if (allPossibleSourceIds.indexOf(s) < 0) {
            problems.push({
              type: 'SOURCE_MISSING',
              breaking: true,
              variableId: c.alias || c.id,
              variableLabel: c.label || ''
            });
          }
        });
      } else {
        problems.push({
          type: 'SOURCE_MISSING',
          breaking: true,
          variableId: c.alias || c.id,
          variableLabel: c.label || ''
        });
      }

      if ((c.codes?.length ?? 0) > 0) {
        c.codes?.forEach(code => {
          code.ruleSets?.forEach(rs => {
            rs.rules.forEach(r => {
              const parameterCount = r.parameters ? r.parameters.length : 0;
              const expectedParameterCount = RuleMethodParameterCount[r.method];

              const isMismatch =
                expectedParameterCount < 0 ?
                  parameterCount < 1 :
                  parameterCount !== expectedParameterCount;

              if (isMismatch) {
                problems.push({
                  type: 'RULE_PARAMETER_COUNT_MISMATCH',
                  breaking: true,
                  variableId: c.alias || c.id,
                  code: code.id ? code.id.toString(10) : 'null',
                  variableLabel: c.label || ''
                });
              }
            });
          });
        });
      } else if (variableValuesCopied.indexOf(c.id) < 0) {
        if (c.sourceType !== 'BASE_NO_VALUE') {
          problems.push({
            type: 'VACANT',
            breaking: false,
            variableId: c.alias || c.id,
            variableLabel: c.label || ''
          });
        }
      }
    });
    return problems;
  }

  static asText(
    variableCodings: VariableCodingData[],
    mode: CodingToTextMode = 'EXTENDED'
  ): CodingAsText[] {
    return variableCodings.map(coding => {
      const mappedSources = (coding.deriveSources ?? []).map(
        source =>
          variableCodings.find(vc => vc.alias === source)?.alias || source
      );

      return {
        id: coding.alias || coding.id,
        label: coding.label || '',
        source: ToTextFactory.sourceAsText(
          coding.alias || coding.id,
          coding.sourceType,
          mappedSources,
          coding.sourceParameters
        ),
        processing: ToTextFactory.processingAsText(
          coding.processing || [],
          coding.fragmenting
        ),
        hasManualInstruction: Boolean(coding.manualInstruction),
        codes: (coding.codes || []).map(code =>
          ToTextFactory.codeAsText(code, mode)
        )
      };
    });
  }

  /**
   * Get a list of all base variables need for the coding a given list of variables.
   * Variables are identified by what is called internally **alias** and **id** in outside applications
   */
  static getBaseVarsList(
    varAliases: string[],
    variableCodings: VariableCodingData[]
  ): string[] {
    const getVarBy = (selector: 'id' | 'alias') => (varId: string) =>
      variableCodings.find(variable => variable[selector] === varId);

    const getSourceVarAliases = (
      sourceVar: VariableCodingData | undefined
    ): string[] => {
      if (!sourceVar) return [];
      if (sourceVar.sourceType === 'BASE') return [sourceVar.alias || sourceVar.id];
      return (sourceVar.deriveSources ?? [])
        .map(getVarBy('id'))
        .flatMap(getSourceVarAliases);
    };

    const baseVarAliases = varAliases
      .map(getVarBy('alias'))
      .flatMap(getSourceVarAliases);
    return [...new Set(baseVarAliases)];
  }
}
