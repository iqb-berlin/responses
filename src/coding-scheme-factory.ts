import { Response } from '@iqbspecs/response/response.interface';
import {
  validStatesToStartDeriving,
  VariableCodingData
} from '@iqbspecs/coding-scheme';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import {
  CodingAsText,
  CodingToTextMode,
  CodingSchemeProblem
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';
import { ToTextFactory } from './to-text-factory';
import { deepClone } from './utils/deep-clone';
import {
  getVariableDependencyTree,
  type VariableGraphNode
} from './graph/dependency-tree';
import { deriveValue } from './derive/derive-value';
import { validateCodingScheme } from './validation/validate-coding-scheme';
import { groupResponsesBySubform } from './subform/grouping';
import { mapResponseIdToAlias } from './mapping/alias-mapper';
import {
  markEmptyValuesInvalidForBaseUnlessAllowed,
  normalizeDisplayedToValueChanged,
  normalizeNotReachedToValueChanged
} from './normalize/response-status';
import { removeBaseResponsesShadowedByDerived } from './merge/resolve-derived-conflicts';

export type { VariableGraphNode } from './graph/dependency-tree';

export abstract class CodingSchemeFactory {
  variableCodings: VariableCodingData[] = [];

  private static deriveResponse(
    variableCodings: VariableCodingData[],
    targetResponse: Response,
    varCoding: VariableCodingData,
    sourceIds: string[],
    responsesList: Response[],
    options?: { onError?: (error: unknown) => void }
  ): void {
    if (targetResponse.status === 'CODING_ERROR') {
      return;
    }

    try {
      const sourceResponses = responsesList.filter(r => sourceIds.includes(r.id)
      );
      const derivedResponse = CodingSchemeFactory.deriveValue(
        variableCodings,
        varCoding,
        sourceResponses
      );

      targetResponse.status = derivedResponse.status;
      targetResponse.subform = derivedResponse.subform;

      if (derivedResponse.status === 'VALUE_CHANGED') {
        targetResponse.value = derivedResponse.value;
      }
    } catch (error) {
      options?.onError?.(error);
      targetResponse.status = 'DERIVE_ERROR';
      targetResponse.value = null;
    }
  }

  private static processCoding(
    targetResponse: Response,
    varCoding: VariableCodingData,
    options?: { onError?: (error: unknown) => void }
  ): void {
    if ((varCoding.codes?.length ?? 0) > 0) {
      const codedResponse = CodingFactory.code(
        targetResponse,
        varCoding,
        options
      );

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

      if (!takeEmptyAsValid) {
        targetResponse.status = 'NO_CODING';
      }
    } else {
      targetResponse.status = 'NO_CODING';
    }
  }

  static getVariableDependencyTree(
    variableCodings: VariableCodingData[]
  ): VariableGraphNode[] {
    return getVariableDependencyTree(variableCodings);
  }

  static deriveValue(
    variableCodings: VariableCodingData[],
    coding: VariableCodingData,
    sourceResponses: Response[]
  ): Response {
    return deriveValue(variableCodings, coding, sourceResponses);
  }

  static code(
    unitResponses: Response[],
    variableCodings: VariableCodingData[],
    options?: { onError?: (error: unknown) => void }
  ): Response[] {
    // decouple object from caller variable
    let newResponses: Response[] = deepClone(unitResponses);
    let allCodedResponses: Response[] = [];
    const { subformGroups, notSubformResponses } =
      groupResponsesBySubform(newResponses);

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

        normalizeDisplayedToValueChanged(newResponses, variableCodings);
        normalizeNotReachedToValueChanged(newResponses, variableCodings);
        markEmptyValuesInvalidForBaseUnlessAllowed(
          newResponses,
          variableCodings
        );

        // Remove base variables if a derived variable with the same ID exists
        newResponses = removeBaseResponsesShadowedByDerived(
          newResponses,
          variableCodings
        );

        // Set up the variable tree
        let varDependencies: VariableGraphNode[] = [];
        let globalDeriveError = false;

        try {
          varDependencies =
            CodingSchemeFactory.getVariableDependencyTree(variableCodings);
        } catch (error) {
          options?.onError?.(error);
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
              CodingSchemeFactory.deriveResponse(
                variableCodings,
                targetResponse,
                varCoding,
                varNode.sources,
                newResponses,
                options
              );
            }

            // Process coding logic if the status is "VALUE_CHANGED"
            if (targetResponse.status === 'VALUE_CHANGED') {
              CodingSchemeFactory.processCoding(
                targetResponse,
                varCoding,
                options
              );
            }
          }
        }

        // combine responses
        newResponses = mapResponseIdToAlias(newResponses, variableCodings);
        allCodedResponses = [...allCodedResponses, ...newResponses];
      }
    );

    // remove duplicate responses if not from derived var
    let uniqueResponses = allCodedResponses.filter(
      (item, index, self) => index ===
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
    return validateCodingScheme(baseVariables, variableCodings);
  }

  static asText(
    variableCodings: VariableCodingData[],
    mode: CodingToTextMode = 'EXTENDED'
  ): CodingAsText[] {
    return variableCodings.map(coding => {
      const mappedSources = (coding.deriveSources ?? []).map(
        source => variableCodings.find(vc => vc.alias === source)?.alias || source
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
        codes: (coding.codes || []).map(code => ToTextFactory.codeAsText(code, mode)
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
    const getVarBy = (selector: 'id' | 'alias') => (varId: string) => variableCodings.find(variable => variable[selector] === varId);

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
