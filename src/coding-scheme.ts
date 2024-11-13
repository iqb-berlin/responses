import { evaluate } from 'mathjs';
import {
  VariableCodingData,
  Response,
  VariableInfo,
  CodingSchemeProblem,
  RuleMethodParameterCount,
  CodingAsText,
  CodeData,
  RuleSet,
  ProcessingParameterType,
  DeriveConcatDelimiter,
  responseStatesInOrder,
  validStatesForDerivingValue,
  validStatesForDerivingCode,
  validStatesToStartDeriving,
  deriveMethodsFromValue,
  statesToReplaceByDeriveError,
  CodingToTextMode
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';
import { ToTextFactory } from './to-text-factory';

export interface VariableGraphNode {
  id: string;
  level: number;
  sources: string[];
  page: string;
}
export const CodingSchemeVersionMajor = 3;
export const CodingSchemeVersionMinor = 0;

export class CodingScheme {
  variableCodings: VariableCodingData[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(givenScheme: any) {
    const transformedScheme =
      typeof givenScheme === 'string' ? JSON.parse(givenScheme) : givenScheme;
    let codingSchemeMajorVersion = 0;
    // let codingSchemeMinorVersion = 0;
    if (!Array.isArray(transformedScheme) && transformedScheme.version) {
      const versionMatches = /^(\d+).(\d+)$/.exec(transformedScheme.version);
      if (versionMatches && versionMatches.length > 2) {
        codingSchemeMajorVersion = Number.parseInt(versionMatches[1], 10);
        // codingSchemeMinorVersion = Number.parseInt(versionMatches[2], 10);
      }
    }
    const givenCodings = Array.isArray(transformedScheme) ?
      transformedScheme :
      transformedScheme.variableCodings || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    givenCodings.forEach((c: any) => {
      if (codingSchemeMajorVersion < 3) {
        this.variableCodings.push(CodingScheme.getCodeVersionLessThan3(c));
      } else {
        this.variableCodings.push(c);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static getCodeVersionLessThan3(givenCoding: any): VariableCodingData {
    let valueProcessing: string[] =
      givenCoding.processing ||
      givenCoding.preProcessing ||
      givenCoding.valueTransformations ||
      [];
    if (valueProcessing && valueProcessing.includes('REMOVE_WHITE_SPACES')) {
      valueProcessing = valueProcessing.filter(
        vp => vp !== 'REMOVE_WHITE_SPACES'
      );
      valueProcessing.push('IGNORE_ALL_SPACES');
    }
    const newCoding: VariableCodingData = {
      id: givenCoding.id,
      alias: givenCoding.alias || givenCoding.id,
      label: givenCoding.label || '',
      sourceType: 'BASE',
      sourceParameters: {
        solverExpression: givenCoding.sourceParameters ?
          givenCoding.sourceParameters.solverExpression || '' :
          '',
        processing: givenCoding.sourceParameters ?
          givenCoding.sourceParameters.processing || [] :
          []
      },
      deriveSources: givenCoding.deriveSources || [],
      processing: valueProcessing as ProcessingParameterType[],
      fragmenting: givenCoding.fragmenting || '',
      manualInstruction: givenCoding.manualInstruction || '',
      codeModel: givenCoding.codeModel || 'NONE',
      page: givenCoding.page || '0',
      codes: []
    };
    if (givenCoding.sourceType === 'DERIVE_CONCAT') {
      if (givenCoding.deriveSourceType === 'VALUE') {
        newCoding.sourceType = 'COPY_VALUE';
      } else {
        // concat score will be changed to concat code
        newCoding.sourceType = 'CONCAT_CODE';
      }
    } else if (givenCoding.sourceType === 'DERIVE_SUM') {
      if (givenCoding.deriveSourceType === 'VALUE') {
        // sum of values is invalid
        newCoding.sourceType = 'COPY_VALUE';
      } else if (givenCoding.deriveSourceType === 'CODE') {
        newCoding.sourceType = 'SUM_CODE';
      } else {
        newCoding.sourceType = 'SUM_SCORE';
      }
    } else if (givenCoding.sourceType === 'COPY_FIRST_VALUE') {
      newCoding.sourceType = 'COPY_VALUE';
    } else {
      newCoding.sourceType = givenCoding.sourceType;
    }
    if (givenCoding.codeModel !== 'NONE') {
      newCoding.codeModel =
        givenCoding.codeModel === 'MANUAL' ? 'MANUAL_ONLY' : 'NONE';
    }
    if (givenCoding.codes && Array.isArray(givenCoding.codes)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      givenCoding.codes.forEach((code: any) => {
        if (code.ruleSets) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const elseRule = code.ruleSets.find((rs: any) => !!rs.rules.find((r: any) => r.method === 'ELSE'));
          if (elseRule) {
            newCoding.codes.push(<CodeData>{
              id: code.id,
              type: 'RESIDUAL_AUTO',
              label: code.label,
              score: 0,
              ruleSetOperatorAnd: false,
              ruleSets: [],
              manualInstruction: code.manualInstruction
            });
          } else {
            if (!code.type) code.type = 'UNSET';
            newCoding.codes.push(code);
          }
        } else if (code.rules && Array.isArray(code.rules)) {
          newCoding.codes.push(<CodeData>{
            id: code.id,
            type: 'UNSET',
            label: code.label || '',
            score: code.score || 0,
            ruleSetOperatorAnd: false,
            ruleSets: [
              <RuleSet>{
                ruleOperatorAnd: code.ruleOperatorAnd || false,
                rules: code.rules
              }
            ],
            manualInstruction: code.manualInstruction || ''
          });
        }
      });
    }
    return newCoding;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static checkVersion(givenScheme: any): 'OK' | 'MAJOR_LESS' | 'MAJOR_GREATER' | 'MINOR_GREATER' {
    const transformedScheme =
      typeof givenScheme === 'string' ? JSON.parse(givenScheme) : givenScheme;
    let localCodingSchemeVersionMajor = 0;
    let localCodingSchemeVersionMinor = 0;
    if (!Array.isArray(transformedScheme) && transformedScheme.version) {
      const versionMatches = /^(\d+).(\d+)$/.exec(transformedScheme.version);
      if (versionMatches && versionMatches.length > 2) {
        localCodingSchemeVersionMajor = Number.parseInt(versionMatches[1], 10);
        localCodingSchemeVersionMinor = Number.parseInt(versionMatches[2], 10);
      }
    }
    if (CodingSchemeVersionMajor < localCodingSchemeVersionMajor) return 'MAJOR_GREATER';
    if (CodingSchemeVersionMajor > localCodingSchemeVersionMajor) return 'MAJOR_LESS';
    if (CodingSchemeVersionMinor > localCodingSchemeVersionMinor) return 'MINOR_GREATER';
    return 'OK';
  }

  toString(): string {
    return JSON.stringify({
      version: `${CodingSchemeVersionMajor}.${CodingSchemeVersionMinor}`,
      variables: this.variableCodings
    });
  }

  getVariableDependencyTree(): VariableGraphNode[] {
    const graph: VariableGraphNode[] = this.variableCodings
      .filter(c => c.sourceType === 'BASE')
      .map(c => ({
        id: c.alias || c.id,
        level: 0,
        sources: [],
        page: c.page || ''
      }));
    let foundInWhile = true;
    while (foundInWhile && this.variableCodings.length > graph.length) {
      let found = false;
      this.variableCodings.forEach(vc => {
        const existingNode = graph.find(n => n.id === (vc.alias || vc.id));
        if (!existingNode) {
          let maxLevel = 0;
          let newPage: string | null = null;
          vc.deriveSources.forEach(s => {
            const node = graph.find(n => n.id === s);
            if (node) {
              maxLevel = Math.max(maxLevel, node.level);
              newPage =
                  // eslint-disable-next-line no-nested-ternary
                  newPage === null ?
                    node.page :
                    newPage === node.page ?
                      node.page :
                      '';
            } else {
              maxLevel = Number.MAX_VALUE;
            }
          });
          if (maxLevel < Number.MAX_VALUE) {
            found = true;
            graph.push({
              id: vc.alias || vc.id,
              level: maxLevel + 1,
              sources: [...vc.deriveSources],
              page: newPage || ''
            });
          }
        }
      });
      foundInWhile = found;
    }
    if (foundInWhile) return graph;
    throw new Error('circular dependency in coding scheme');
  }

  static deriveValue(
    coding: VariableCodingData,
    sourceResponses: Response[]
  ): Response {
    const validResponseStatuses = deriveMethodsFromValue.includes(
      coding.sourceType
    ) ?
      validStatesForDerivingValue :
      validStatesForDerivingCode;
    const errorStatuses: string[] = [];
    sourceResponses.forEach(r => {
      if (!validResponseStatuses.includes(r.status)) errorStatuses.push(r.status);
    });
    if (
      errorStatuses.length > 0 &&
      (coding.sourceType !== 'UNIQUE_VALUES' ||
        errorStatuses.length === sourceResponses.length)
    ) {
      const minStatusIndex = Math.min(
        ...errorStatuses.map(s => responseStatesInOrder.indexOf(s))
      );
      let newStatus = responseStatesInOrder[minStatusIndex];
      if (statesToReplaceByDeriveError.includes(newStatus)) newStatus = 'DERIVE_ERROR';
      return <Response>{
        id: coding.id,
        value: null,
        status: newStatus
      };
    }
    // eslint-disable-next-line default-case
    switch (coding.sourceType) {
      case 'COPY_VALUE': {
        const stringfiedValue = JSON.stringify(sourceResponses[0].value);
        return <Response>{
          id: coding.id,
          value: JSON.parse(stringfiedValue),
          status: 'VALUE_CHANGED'
        };
      }
      case 'CONCAT_CODE': {
        let codes = coding.deriveSources.map(s => {
          const myResponse = sourceResponses.find(r => r.id === s);
          return myResponse && myResponse.code ?
            myResponse.code.toString(10) :
            '?';
        });
        if (
          coding.sourceParameters &&
          coding.sourceParameters.processing &&
          coding.sourceParameters.processing.includes('SORT')
        ) {
          codes = codes.sort();
        }
        return <Response>{
          id: coding.id,
          value: codes.join(DeriveConcatDelimiter),
          status: 'VALUE_CHANGED'
        };
      }
      case 'SUM_CODE':
        return <Response>{
          id: coding.id,
          value: coding.deriveSources
            .map(s => {
              const myResponse = sourceResponses.find(r => r.id === s);
              if (myResponse) return myResponse.code || 0;
              throw new Error('response not found in derive');
            })
            .reduce((sum, current) => sum + current, 0),
          status: 'VALUE_CHANGED'
        };
      case 'SUM_SCORE':
        return <Response>{
          id: coding.id,
          value: coding.deriveSources
            .map(s => {
              const myResponse = sourceResponses.find(r => r.id === s);
              if (myResponse) return myResponse.score || 0;
              throw new Error('response not found in derive');
            })
            .reduce((sum, current) => sum + current, 0),
          status: 'VALUE_CHANGED'
        };
      case 'UNIQUE_VALUES': {
        const valuesToCompare: string[] = [];
        sourceResponses
          .filter(r => validStatesForDerivingValue.includes(r.status))
          .forEach(r => {
            if (
              coding.sourceParameters &&
              coding.sourceParameters.processing &&
              coding.sourceParameters.processing.includes('TO_NUMBER')
            ) {
              if (Array.isArray(r.value)) {
                valuesToCompare.push(
                  r.value
                    .map(v => (CodingFactory.getValueAsNumber(v) || 0).toString(10)
                    )
                    .join('##')
                );
              } else {
                valuesToCompare.push(
                  (CodingFactory.getValueAsNumber(r.value) || 0).toString(10)
                );
              }
            } else {
              let newValue;
              if (Array.isArray(r.value)) {
                newValue = r.value
                  .map(
                    v => CodingFactory.getValueAsString(
                      v,
                      coding.sourceParameters?.processing
                    ) || ''
                  )
                  .join('##');
              } else {
                newValue =
                  CodingFactory.getValueAsString(
                    r.value,
                    coding.sourceParameters?.processing
                  ) || '';
              }
              valuesToCompare.push(newValue);
            }
          });
        const duplicates = valuesToCompare.filter(
          (value, index, array) => array.indexOf(value) < index
        );
        return <Response>{
          id: coding.id,
          value: duplicates.length === 0,
          status: 'VALUE_CHANGED'
        };
      }
      case 'SOLVER':
        if (
          coding.sourceParameters &&
          coding.sourceParameters.processing &&
          coding.sourceParameters.solverExpression
        ) {
          const varSearchPattern = /\$\{(\s*\w+\s*)}/g;
          const sourceIds: string[] = [];
          const replacements = new Map();
          const regExExecReturn =
            coding.sourceParameters.solverExpression.matchAll(varSearchPattern);
          // eslint-disable-next-line no-restricted-syntax
          for (const match of regExExecReturn) {
            if (!sourceIds.includes(match[1].trim())) sourceIds.push(match[1].trim());
            if (!replacements.has(match[1])) replacements.set(match[1], match[1].trim());
          }
          if (sourceIds.length > 0) {
            const missingDeriveVars = sourceIds.filter(
              s => !coding.deriveSources.includes(s)
            );
            if (missingDeriveVars.length === 0) {
              let newExpression = coding.sourceParameters.solverExpression;
              replacements.forEach((varId: string, toReplace: string) => {
                const responseToReplace = sourceResponses.find(
                  r => r.id === varId
                );
                if (
                  responseToReplace &&
                  !Array.isArray(responseToReplace.value)
                ) {
                  const valueToReplace = CodingFactory.getValueAsNumber(
                    responseToReplace.value
                  );
                  if (valueToReplace === null) {
                    throw new Error('response value not numeric');
                  } else {
                    const replacePattern = new RegExp(
                      `\\$\\{${toReplace}}`,
                      'g'
                    );
                    newExpression = newExpression.replace(
                      replacePattern,
                      valueToReplace.toString(10)
                    );
                  }
                } else {
                  throw new Error(
                    'response missing or value is array in solver'
                  );
                }
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
                status: newValue === null ? 'DERIVE_ERROR' : 'VALUE_CHANGED'
              };
            }
          }
        }
    }
    throw new Error('deriving failed');
  }

  code(unitResponses: Response[]): Response[] {
    // decouple object from caller variable
    const stringifiedResponses = JSON.stringify(unitResponses);
    const newResponses: Response[] = JSON.parse(stringifiedResponses);

    // change DISPLAYED to VALUE_CHANGED if requested
    newResponses
      .filter(r => r.status === 'DISPLAYED')
      .forEach(r => {
        const myCoding = this.variableCodings.find(c => (c.alias || c.id) === r.id);
        if (
          myCoding &&
          myCoding.sourceType === 'BASE' &&
          myCoding.sourceParameters.processing &&
          myCoding.sourceParameters.processing.includes(
            'TAKE_DISPLAYED_AS_VALUE_CHANGED'
          )
        ) {
          r.status = 'VALUE_CHANGED';
        }
      });

    // set invalid if value is empty
    newResponses
      .filter(
        r => r.status === 'VALUE_CHANGED' && CodingFactory.isEmptyValue(r.value)
      )
      .forEach(r => {
        const myCoding = this.variableCodings.find(c => (c.alias || c.id) === r.id);
        if (
          myCoding &&
          myCoding.sourceType === 'BASE' &&
          !(
            myCoding.sourceParameters.processing &&
            myCoding.sourceParameters.processing.includes('TAKE_EMPTY_AS_VALID')
          )
        ) {
          r.status = 'INVALID';
        }
      });

    // ignore base var if derived var with same id
    this.variableCodings
      .filter(vc => vc.sourceType !== 'BASE')
      .forEach(c => {
        newResponses.forEach((r, index) => {
          if (r.id === (c.alias || c.id) && !r.code && !r.score) {
            newResponses.splice(index, 1);
          }
        });
      });

    // set up variable tree
    let varDependencies: VariableGraphNode[] = [];
    let globalDeriveError = false;
    try {
      varDependencies = this.getVariableDependencyTree();
    } catch {
      globalDeriveError = true;
      varDependencies = [];
    }

    // add derived variables when error and missing responses
    this.variableCodings.forEach(c => {
      if (c.sourceType === 'BASE') {
        if (globalDeriveError) {
          varDependencies.push({
            id: c.alias || c.id,
            level: 0,
            sources: [],
            page: c.page || ''
          });
        }
      }
      const existingResponse = newResponses.find(r => r.id === (c.alias || c.id));
      if (!existingResponse) {
        newResponses.push({
          id: c.alias || c.id,
          value: null,
          status:
            globalDeriveError && c.sourceType !== 'BASE' ?
              'DERIVE_ERROR' :
              'UNSET'
        });
      }
    });

    const maxVarLevel = Math.max(...varDependencies.map(n => n.level));

    for (let level = 0; level <= maxVarLevel; level++) {
      varDependencies
        .filter(n => n.level === level)
        .forEach(varNode => {
          const targetResponse = newResponses.find(r => r.id === varNode.id);
          const varCoding = this.variableCodings.find(
            vc => (vc.alias || vc.id) === varNode.id
          );
          if (targetResponse && varCoding) {
            if (
              varNode.sources.length > 0 &&
              validStatesToStartDeriving.includes(targetResponse.status)
            ) {
              // derive
              try {
                const derivedResponse = CodingScheme.deriveValue(
                  varCoding,
                  newResponses.filter(r => varNode.sources.includes(r.id))
                );
                targetResponse.status = derivedResponse.status;
                if (derivedResponse.status === 'VALUE_CHANGED') targetResponse.value = derivedResponse.value;
              } catch (e) {
                targetResponse.status = 'DERIVE_ERROR';
                targetResponse.value = null;
              }
            }
            if (targetResponse.status === 'VALUE_CHANGED') {
              if (varCoding.codes.length > 0) {
                const codedResponse = CodingFactory.code(
                  targetResponse,
                  varCoding
                );
                if (codedResponse.status !== targetResponse.status) {
                  targetResponse.status = codedResponse.status;
                  targetResponse.code = codedResponse.code;
                  targetResponse.score = codedResponse.score;
                }
              } else {
                targetResponse.status = 'NO_CODING';
              }
            }
          }
        });
    }
    return newResponses;
  }

  validate(baseVariables: VariableInfo[]): CodingSchemeProblem[] {
    // todo: check against VarInfo
    const problems: CodingSchemeProblem[] = [];
    const allDerivedVariableIds: string[] = this.variableCodings
      .filter(vc => vc.sourceType !== 'BASE')
      .map(vc => vc.id);
    const allBaseVariableInfoIds = baseVariables.map(bv => bv.id);
    const allPossibleSourceIds = [
      ...allBaseVariableInfoIds,
      ...allDerivedVariableIds
    ];
    const variableValuesCopied: string[] = [];
    this.variableCodings
      .filter(vc => vc.sourceType === 'COPY_VALUE')
      .forEach(vc => {
        variableValuesCopied.push(...vc.deriveSources);
      });
    this.variableCodings.forEach(c => {
      if (c.sourceType === 'BASE') {
        if (allBaseVariableInfoIds.indexOf(c.id) < 0) {
          problems.push({
            type: 'SOURCE_MISSING',
            breaking: true,
            variableId: c.id,
            variableLabel: c.label
          });
        }
      } else if (c.deriveSources && c.deriveSources.length > 0) {
        if (c.sourceType === 'COPY_VALUE') {
          if (c.deriveSources.length > 1) {
            problems.push({
              type: 'MORE_THAN_ONE_SOURCE',
              breaking: false,
              variableId: c.id,
              variableLabel: c.label
            });
          }
          if (
            allPossibleSourceIds.indexOf(c.deriveSources[0]) >= 0 &&
            allBaseVariableInfoIds.indexOf(c.deriveSources[0]) < 0
          ) {
            problems.push({
              type: 'VALUE_COPY_NOT_FROM_BASE',
              breaking: false,
              variableId: c.id,
              variableLabel: c.label
            });
          }
        } else if (c.deriveSources.length === 1) {
          problems.push({
            type: 'ONLY_ONE_SOURCE',
            breaking: false,
            variableId: c.id,
            variableLabel: c.label
          });
        }
        c.deriveSources.forEach(s => {
          if (allPossibleSourceIds.indexOf(s) < 0) {
            problems.push({
              type: 'SOURCE_MISSING',
              breaking: true,
              variableId: c.id,
              variableLabel: c.label
            });
          }
        });
      } else {
        problems.push({
          type: 'SOURCE_MISSING',
          breaking: true,
          variableId: c.id,
          variableLabel: c.label
        });
      }

      if (c.codes.length > 0) {
        c.codes.forEach(code => {
          code.ruleSets.forEach(rs => {
            rs.rules.forEach(r => {
              if (RuleMethodParameterCount[r.method] < 0) {
                if (!r.parameters || r.parameters.length < 1) {
                  problems.push({
                    type: 'RULE_PARAMETER_COUNT_MISMATCH',
                    breaking: true,
                    variableId: c.id,
                    code: code.id ? code.id.toString(10) : 'null',
                    variableLabel: c.label
                  });
                }
              } else if (
                RuleMethodParameterCount[r.method] !==
                (r.parameters ? r.parameters.length : 0)
              ) {
                problems.push({
                  type: 'RULE_PARAMETER_COUNT_MISMATCH',
                  breaking: true,
                  variableId: c.id,
                  code: code.id ? code.id.toString(10) : 'null',
                  variableLabel: c.label
                });
              }
            });
          });
        });
      } else if (variableValuesCopied.indexOf(c.id) < 0) {
        problems.push({
          type: 'VACANT',
          breaking: false,
          variableId: c.id,
          variableLabel: c.label
        });
      }
    });
    return problems;
  }

  asText(mode: CodingToTextMode = 'EXTENDED'): CodingAsText[] {
    const returnTexts: CodingAsText[] = [];
    this.variableCodings.forEach(c => {
      const newCodingText: CodingAsText = {
        id: c.alias || c.id,
        label: c.label,
        source: ToTextFactory.sourceAsText(
          c.id,
          c.sourceType,
          c.deriveSources,
          c.sourceParameters
        ),
        processing: ToTextFactory.processingAsText(c.processing, c.fragmenting),
        hasManualInstruction: !!c.manualInstruction,
        codes: c.codes.map(code => ToTextFactory.codeAsText(code, mode))
      };
      returnTexts.push(newCodingText);
    });
    return returnTexts;
  }

  getBaseVarsList(derivedVarsIds: string[]): string[] {
    const allBaseVariables: string[] = this.variableCodings
      .filter(c => c.deriveSources.length === 0)
      .map(c => c.id);
    const baseVariablesIds: string[] = [];
    if (derivedVarsIds.length > 0) {
      derivedVarsIds.forEach(derivedVarId => {
        const derivedVar: VariableCodingData | undefined =
          this.variableCodings.find(
            variableCoding => variableCoding.id === derivedVarId
          );
        if (derivedVar) {
          if (derivedVar.sourceType === 'BASE') {
            baseVariablesIds.push(derivedVar.id);
          } else {
            baseVariablesIds.push(
              ...this.derivedVarToBaseVars(derivedVar, allBaseVariables)
            );
          }
        }
      });
      return [...new Set(baseVariablesIds)];
    }
    return [];
  }

  derivedVarToBaseVars(
    derivedVariable: VariableCodingData,
    allBaseVariables: string[]
  ) {
    let baseVariablesIds: string[] = [];
    derivedVariable.deriveSources.forEach(derivedVar => {
      if (allBaseVariables.includes(derivedVar)) {
        baseVariablesIds.push(derivedVar);
      } else {
        const variableCoding = this.variableCodings.find(
          c => c.id === derivedVar
        );
        if (variableCoding) {
          baseVariablesIds = [
            ...baseVariablesIds,
            ...this.derivedVarToBaseVars(variableCoding, allBaseVariables)
          ];
        }
      }
    });
    return [...new Set(baseVariablesIds)];
  }
}
