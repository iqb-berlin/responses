import { Response } from '@iqbspecs/response/response.interface';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodingSchemeProblem } from './coding-interfaces';
import { deepClone } from './utils/deep-clone';
import {
  getVariableDependencyTree,
  type VariableGraphNode
} from './graph/dependency-tree';
import { deriveValue } from './derive/derive-value';
import {
  buildDependencyPlan,
  ensureResponsesExist,
  executeDependencyPlan
} from './derive/dependency-plan';
import { applyDerivationsAndCoding } from './derive/derivation-traversal';
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
import { finalizeAndDeduplicateResponses } from './finalize/finalize-and-deduplicate';

export type { VariableGraphNode } from './graph/dependency-tree';

export abstract class CodingSchemeFactory {
  variableCodings: VariableCodingData[] = [];

  private static buildCodingPipeline(options?: {
    onError?: (error: unknown) => void;
  }): Array<
    (ctx: {
      responses: Response[];
      variableCodings: VariableCodingData[];
      notSubformResponses: Response[];
      allResponses: Response[];
    }) => {
      responses: Response[];
      variableCodings: VariableCodingData[];
      notSubformResponses: Response[];
      allResponses: Response[];
    }
    > {
    return [
      ctx => ({
        ...ctx,
        responses: CodingSchemeFactory.prepareResponsesForGroup(
          ctx.allResponses,
          ctx.variableCodings,
          ctx.notSubformResponses
        )
      }),
      ctx => ({
        ...ctx,
        responses: CodingSchemeFactory.normalizeStatuses(
          ctx.responses,
          ctx.variableCodings
        )
      }),
      ctx => ({
        ...ctx,
        responses: removeBaseResponsesShadowedByDerived(
          ctx.responses,
          ctx.variableCodings
        )
      }),
      ctx => {
        const plan = buildDependencyPlan(
          ctx.variableCodings,
          CodingSchemeFactory.getVariableDependencyTree,
          options
        );

        const prepared = ensureResponsesExist(
          ctx.responses,
          ctx.variableCodings,
          plan
        );

        const executed = executeDependencyPlan(
          prepared.responses,
          ctx.variableCodings,
          prepared.plan,
          applyDerivationsAndCoding,
          options
        );

        return {
          ...ctx,
          responses: executed
        };
      },
      ctx => ({
        ...ctx,
        responses: mapResponseIdToAlias(ctx.responses, ctx.variableCodings)
      })
    ];
  }

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
  ): Response[] {
    const normalized = [...responses];
    normalizeDisplayedToValueChanged(normalized, variableCodings);
    normalizeNotReachedToValueChanged(normalized, variableCodings);
    markEmptyValuesInvalidForBaseUnlessAllowed(normalized, variableCodings);
    return normalized;
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

    const pipeline = CodingSchemeFactory.buildCodingPipeline(options);

    // code responses for each subform
    [...Object.values(subformGroups), notSubformResponses].forEach(
      allResponses => {
        const initialCtx = {
          responses: newResponses,
          variableCodings,
          notSubformResponses,
          allResponses
        };

        const finalCtx = pipeline.reduce((ctx, step) => step(ctx), initialCtx);
        newResponses = finalCtx.responses;
        allCodedResponses = [...allCodedResponses, ...finalCtx.responses];
      }
    );

    return finalizeAndDeduplicateResponses(
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

  static getBaseVarsList(
    varAliases: string[],
    variableCodings: VariableCodingData[]
  ): string[] {
    const getVarBy = (selector: 'id' | 'alias') => (varId: string) => {
      const findVariable = (variable: VariableCodingData) => variable[selector] === varId;
      return variableCodings.find(findVariable);
    };

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
