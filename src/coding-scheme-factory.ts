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
import { CODING_SCHEME_STATUS } from './constants';
import {
  getVariableDependencyTree,
  type VariableGraphNode
} from './graph/dependency-tree';
import { deriveValue } from './derive/derive-value';
import { validateCodingScheme } from './validation/validate-coding-scheme';
import { groupResponsesBySubform } from './subform/grouping';
import {
  mapResponseAliasToId,
  mapResponseIdToAlias
} from './mapping/alias-mapper';
import {
  markEmptyValuesInvalidForBaseUnlessAllowed,
  normalizeDisplayedToValueChanged,
  normalizeNotReachedToValueChanged
} from './normalize/response-status';
import { removeBaseResponsesShadowedByDerived } from './merge/resolve-derived-conflicts';

export type { VariableGraphNode } from './graph/dependency-tree';

export abstract class CodingSchemeFactory {
  variableCodings: VariableCodingData[] = [];

  private static prepareResponsesForGroup(
    groupResponses: Response[],
    variableCodings: VariableCodingData[],
    notSubformResponses: Response[]
  ): Response[] {
    const updatedResponses = mapResponseAliasToId(
      groupResponses,
      variableCodings
    );

    const isSubformGroup = groupResponses.every(r => r.subform !== undefined);
    return isSubformGroup ?
      [...updatedResponses, ...notSubformResponses] :
      [...updatedResponses];
  }

  private static normalizeStatuses(
    responses: Response[],
    variableCodings: VariableCodingData[]
  ): void {
    normalizeDisplayedToValueChanged(responses, variableCodings);
    normalizeNotReachedToValueChanged(responses, variableCodings);
    markEmptyValuesInvalidForBaseUnlessAllowed(responses, variableCodings);
  }

  private static buildDependencyPlan(
    variableCodings: VariableCodingData[],
    options?: { onError?: (error: unknown) => void }
  ): { varDependencies: VariableGraphNode[]; globalDeriveError: boolean } {
    try {
      return {
        varDependencies:
          CodingSchemeFactory.getVariableDependencyTree(variableCodings),
        globalDeriveError: false
      };
    } catch (error) {
      options?.onError?.(error);
      return { varDependencies: [], globalDeriveError: true };
    }
  }

  private static ensureResponsesExist(
    responses: Response[],
    variableCodings: VariableCodingData[],
    varDependencies: VariableGraphNode[],
    globalDeriveError: boolean
  ): VariableGraphNode[] {
    const updatedDependencies = [...varDependencies];

    variableCodings.forEach(coding => {
      if (globalDeriveError && coding.sourceType === 'BASE') {
        updatedDependencies.push({
          id: coding.id,
          level: 0,
          sources: [],
          page: coding.page || ''
        });
      }

      if (responses.some(response => response.id === coding.id)) {
        return;
      }

      if (coding.sourceType !== 'BASE_NO_VALUE') {
        const status =
          globalDeriveError && coding.sourceType !== 'BASE' ?
            CODING_SCHEME_STATUS.DERIVE_ERROR :
            CODING_SCHEME_STATUS.UNSET;

        responses.push({
          id: coding.id,
          value: null,
          status
        });
      }
    });

    return updatedDependencies;
  }

  private static applyDerivationsAndCoding(
    responses: Response[],
    variableCodings: VariableCodingData[],
    varDependencies: VariableGraphNode[],
    options?: { onError?: (error: unknown) => void }
  ): void {
    const maxVarLevel = Math.max(0, ...varDependencies.map(n => n.level));

    for (let level = 0; level <= maxVarLevel; level++) {
      const currentLevelNodes = varDependencies.filter(
        n => n.level === level
      );

      // eslint-disable-next-line no-restricted-syntax
      for (const varNode of currentLevelNodes) {
        const targetResponse = responses.find(r => r.id === varNode.id);
        const varCoding = variableCodings.find(vc => vc.id === varNode.id);

        if (!targetResponse || !varCoding) {
          break;
        }

        if (
          varNode.sources.length > 0 &&
          validStatesToStartDeriving.includes(targetResponse.status)
        ) {
          CodingSchemeFactory.deriveResponse(
            variableCodings,
            targetResponse,
            varCoding,
            varNode.sources,
            responses,
            options
          );
        }

        if (targetResponse.status === CODING_SCHEME_STATUS.VALUE_CHANGED) {
          CodingSchemeFactory.processCoding(targetResponse, varCoding, options);
        }
      }
    }
  }

  private static finalizeAndDeduplicate(
    allCodedResponses: Response[],
    subformGroups: Record<string, Response[]>,
    variableCodings: VariableCodingData[]
  ): Response[] {
    let uniqueResponses = allCodedResponses.filter(
      (item, index, self) => index ===
        self.findIndex(t => t.id === item.id && t.subform === item.subform)
    );

    const derivedAliases = variableCodings
      .filter(
        vc => vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE'
      )
      .map(vc => vc.alias || vc.id);

    if (Object.keys(subformGroups).length > 0) {
      uniqueResponses = uniqueResponses.filter(ur => {
        const foundInSubformGroups = Object.values(subformGroups)[0].find(
          sr => sr.id === ur.id
        );
        const foundInDerived = derivedAliases.includes(ur.id);
        return !(
          (foundInSubformGroups || foundInDerived) &&
          ur.status === CODING_SCHEME_STATUS.UNSET
        );
      });
    }

    return [...uniqueResponses];
  }

  private static deriveResponse(
    variableCodings: VariableCodingData[],
    targetResponse: Response,
    varCoding: VariableCodingData,
    sourceIds: string[],
    responsesList: Response[],
    options?: { onError?: (error: unknown) => void }
  ): void {
    if (targetResponse.status === CODING_SCHEME_STATUS.CODING_ERROR) {
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

      if (derivedResponse.status === CODING_SCHEME_STATUS.VALUE_CHANGED) {
        targetResponse.value = derivedResponse.value;
      }
    } catch (error) {
      options?.onError?.(error);
      targetResponse.status = CODING_SCHEME_STATUS.DERIVE_ERROR;
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
        targetResponse.status = CODING_SCHEME_STATUS.NO_CODING;
      }
    } else {
      targetResponse.status = CODING_SCHEME_STATUS.NO_CODING;
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
        newResponses = CodingSchemeFactory.prepareResponsesForGroup(
          allResponses,
          variableCodings,
          notSubformResponses
        );

        CodingSchemeFactory.normalizeStatuses(newResponses, variableCodings);

        // Remove base variables if a derived variable with the same ID exists
        newResponses = removeBaseResponsesShadowedByDerived(
          newResponses,
          variableCodings
        );

        const { varDependencies, globalDeriveError } =
          CodingSchemeFactory.buildDependencyPlan(variableCodings, options);

        const resolvedDependencies = CodingSchemeFactory.ensureResponsesExist(
          newResponses,
          variableCodings,
          varDependencies,
          globalDeriveError
        );

        CodingSchemeFactory.applyDerivationsAndCoding(
          newResponses,
          variableCodings,
          resolvedDependencies,
          options
        );

        // combine responses
        newResponses = mapResponseIdToAlias(newResponses, variableCodings);
        allCodedResponses = [...allCodedResponses, ...newResponses];
      }
    );

    return CodingSchemeFactory.finalizeAndDeduplicate(
      allCodedResponses,
      subformGroups,
      variableCodings
    );
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
