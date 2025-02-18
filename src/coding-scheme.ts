/* eslint-disable implicit-arrow-linebreak */
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
  validStatesForDerivingValue,
  validStatesToStartDeriving,
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
      this.variableCodings.map(vc => vc.codes.map(code => {
        if (code.id === null) code.id = 'INVALID';
        return code;
      }));
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
        id: c.id,
        level: 0,
        sources: [],
        page: c.page || ''
      }));
    let foundInWhile = true;
    const baseNoValueCount: number = this.variableCodings
      .filter(c => c.sourceType === 'BASE_NO_VALUE').length;
    const maxGraphLength = this.variableCodings.length - baseNoValueCount;
    while (foundInWhile && maxGraphLength > graph.length) {
      let found = false;
      this.variableCodings.forEach(vc => {
        const existingNode = graph.find(n => n.id === vc.id);
        if (vc.sourceType !== 'BASE_NO_VALUE' && !existingNode) {
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
              id: vc.id,
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
    variableCodings: VariableCodingData[],
    coding: VariableCodingData,
    sourceResponses: Response[]
  ): Response {
    const subformSource = sourceResponses.find(r => r.subform !== undefined)?.subform;
    // Killer
    const hasUnset = sourceResponses.some(r => r.status === 'UNSET');
    if (hasUnset) {
      return <Response>{
        id: coding.id,
        value: null,
        status: 'UNSET',
        subform: subformSource
      };
    }
    const hasDeriveError = sourceResponses.some(r => r.status === 'DERIVE_ERROR');
    if (hasDeriveError) {
      return <Response>{
        id: coding.id,
        value: null,
        status: 'DERIVE_ERROR',
        subform: subformSource
      };
    }
    const hasNoCoding = sourceResponses.some(r => r.status === 'NO_CODING');
    if (hasNoCoding) {
      return <Response>{
        id: coding.id,
        value: null,
        status: 'DERIVE_ERROR',
        subform: subformSource
      };
    }
    const hasCodingError = sourceResponses.some(r => r.status === 'CODING_ERROR');
    if (hasCodingError) {
      return <Response>{
        id: coding.id,
        value: null,
        status: 'CODING_ERROR',
        subform: subformSource
      };
    }
    const hasInvalid = sourceResponses.some(r => r.status === 'INVALID');
    if (hasInvalid) {
      return <Response>{
        id: coding.id,
        value: null,
        status: 'INVALID',
        subform: subformSource
      };
    }

    const hasPending = sourceResponses.some(r => r.status === 'CODING_INCOMPLETE' || r.status === 'DERIVE_PENDING');
    if (hasPending) {
      if (sourceResponses
        .every(r => r.status === 'CODING_INCOMPLETE' ||
          r.status === 'CODING_COMPLETE' ||
          r.status === 'DERIVE_PENDING' ||
          r.status === 'INTENDED_INCOMPLETE')) {
        if (!(coding.sourceType === 'MANUAL' ||
          coding.sourceType === 'COPY_VALUE' ||
          coding.sourceType === 'UNIQUE_VALUES' ||
          coding.sourceType === 'SOLVER')) {
          return <Response>{
            id: coding.id,
            value: null,
            status: 'DERIVE_PENDING',
            subform: subformSource
          };
        }
      }
    }

    const amountFalseStates = this.amountFalseStates(coding, sourceResponses);
    if (sourceResponses.length >= amountFalseStates && amountFalseStates > 0) {
      if (amountFalseStates && sourceResponses.every(r => r.status === sourceResponses[0].status)) {
        return <Response>{
          id: coding.id,
          value: null,
          status: sourceResponses[0].status,
          subform: subformSource
        };
      }
      if (sourceResponses
        .every(r => (r.status === 'NOT_REACHED' || r.status === 'DISPLAYED' || r.status === 'PARTLY_DISPLAYED'))) {
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
          return < Response > {
            id: coding.id,
            value: null,
            status: 'CODING_INCOMPLETE',
            subform: subformSource
          };
        }
        return < Response > {
          id: coding.id,
          value: null,
          status: 'CODING_COMPLETE',
          subform: subformSource
        };
      }
      case 'COPY_VALUE': {
        if (sourceResponses.some(r => r.status === 'DERIVE_PENDING')) {
          return <Response>{
            id: coding.id,
            value: null,
            status: 'DERIVE_PENDING',
            subform: subformSource
          };
        }
        const stringfiedValue = JSON.stringify(sourceResponses[0].value);
        return <Response>{
          id: coding.id,
          value: JSON.parse(stringfiedValue),
          status: 'VALUE_CHANGED',
          subform: subformSource
        };
      }
      case 'CONCAT_CODE': {
        let codes = coding.deriveSources.map(s => {
          const myResponse = sourceResponses.find(r => r.id === s);
          return (myResponse && (myResponse.code || myResponse.code === 0)) ?
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
          status: 'VALUE_CHANGED',
          subform: subformSource
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
          status: 'VALUE_CHANGED',
          subform: subformSource
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
          status: 'VALUE_CHANGED',
          subform: subformSource
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
          const varSearchPattern = /\$\{(\s*[\w,-]+\s*)}/g;
          const sources: string[] = [];
          const replacements = new Map();
          const regExExecReturn =
            coding.sourceParameters.solverExpression.matchAll(varSearchPattern);
          // eslint-disable-next-line no-restricted-syntax
          for (const match of regExExecReturn) {
            const matchId = variableCodings.find(c => match[1].trim() === c.alias)?.id;
            if (!sources
              .includes(matchId || match[1].trim())) sources.push(matchId || match[1].trim());
            if (!replacements
              .has(matchId || match[1].trim())) replacements.set(match[1].trim(), matchId || match[1].trim());
          }
          if (sources.length > 0) {
            const missingDeriveVars = sources.filter(
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
                status: newValue === null ? 'DERIVE_ERROR' : 'VALUE_CHANGED',
                subform: subformSource
              };
            }
          }
        }
    }

    throw new Error('deriving failed');
  }

  static amountFalseStates(
    coding: VariableCodingData,
    sourceResponses: Response[]
  ): number {
    let errors = 0;
    if (coding.sourceType === 'MANUAL') {
      const validStates = [
        'INVALID',
        'VALUE_CHANGED',
        'NO_CODING',
        'CODING_ERROR',
        'CODING_COMPLETE',
        'INTENDED_INCOMPLETE'
      ];
      sourceResponses.forEach(r => {
        if (!validStates.includes(r.status) ||
          (r.status === 'DISPLAYED' &&
            coding.sourceParameters.processing?.includes('TAKE_DISPLAYED_AS_VALUE_CHANGED'))) {
          errors += 1;
        }
      });
    }
    if (coding.sourceType === 'COPY_VALUE' || coding.sourceType === 'UNIQUE_VALUES' || coding.sourceType === 'SOLVER') {
      const validStates =
        ['VALUE_CHANGED', 'NO_CODING', 'CODING_INCOMPLETE', 'CODING_ERROR', 'CODING_COMPLETE', 'INTENDED_INCOMPLETE'];
      sourceResponses.forEach(r => {
        if (!validStates.includes(r.status)) {
          errors += 1;
        }
      });
    }
    if (coding.sourceType === 'CONCAT_CODE' || coding.sourceType === 'SUM_CODE' || coding.sourceType === 'SUM_SCORE') {
      sourceResponses.forEach(r => {
        if (!(r.status === 'CODING_COMPLETE' || r.status === 'INTENDED_INCOMPLETE')) {
          errors += 1;
        }
      });
    }
    return errors;
  }

  code(unitResponses: Response[]): Response[] {
    // decouple object from caller variable
    const stringifiedResponses = JSON.stringify(unitResponses);
    let newResponses: Response[] = JSON.parse(stringifiedResponses);
    let allCodedResponses: Response[] = [];
    const notSubformResponses: Response[] = [];

    // group responses into sub-forms
    const subformGroups = newResponses.reduce((acc, r:Response) => {
      if (r.subform !== undefined) {
        if (!acc[r.subform]) {
          acc[r.subform] = [];
        }
        acc[r.subform].push(r);
      } else {
        notSubformResponses.push(r);
      }
      return acc;
    }, {} as Record<string, Response[]>);

    // code responses for each sub-form
    [...Object.values(subformGroups), notSubformResponses].forEach(allResponses => {
      // responses id to alias
      allResponses.every(r => r.subform !== undefined) ?
        newResponses = [...allResponses, ...notSubformResponses]
          .map(r => ({
            ...r,
            id: this.variableCodings.find(c => c.alias === r.id)?.id || r.id
          })) :
        newResponses = [...allResponses]
          .map(r => ({
            ...r,
            id: this.variableCodings.find(c => c.alias === r.id)?.id || r.id
          }));

      // change DISPLAYED to VALUE_CHANGED if requested
      newResponses
        .filter(r => r.status === 'DISPLAYED')
        .forEach(r => {
          const myCoding = this.variableCodings.find(c => c.id === r.id);
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
          const myCoding = this.variableCodings.find(c => c.id === r.id);
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
      this.variableCodings.filter(vc => vc.sourceType !== 'BASE');
      newResponses = newResponses.filter(r => {
        const shouldDelete = this.variableCodings
          .some(vc => vc.sourceType !== 'BASE' &&
                r.id === vc.id && !r.code && !r.score && r.status !== 'CODING_COMPLETE');
        return !shouldDelete;
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
              id: c.id,
              level: 0,
              sources: [],
              page: c.page || ''
            });
          }
        }
        const existingResponse = newResponses.find(r => r.id === c.id);
        if (!existingResponse) {
          if (c.sourceType !== 'BASE_NO_VALUE') {
            newResponses.push({
              id: c.id,
              value: null,
              status:
                globalDeriveError && c.sourceType !== 'BASE' ?
                  'DERIVE_ERROR' :
                  'UNSET'
            });
          }
        }
      });

      const maxVarLevel = Math.max(...varDependencies.map(n => n.level));

      for (let level = 0; level <= maxVarLevel; level++) {
        varDependencies
          .filter(n => n.level === level)
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          .forEach(varNode => {
            const targetResponse = newResponses.find(r => r.id === varNode.id);
            const varCoding = this.variableCodings.find(
              vc => vc.id === varNode.id
            );
            if (targetResponse && varCoding) {
              if (
                varNode.sources.length > 0 &&
                validStatesToStartDeriving.includes(targetResponse.status)
              ) {
                // derive
                if (!varCoding.sourceParameters.processing?.includes('NO_CODING')) {
                  try {
                    const derivedResponse = CodingScheme.deriveValue(
                      this.variableCodings,
                      varCoding,
                      newResponses.filter(r => varNode.sources.includes(r.id))
                    );
                    targetResponse.status = derivedResponse.status;
                    targetResponse.subform = derivedResponse.subform;
                    if (derivedResponse.status === 'VALUE_CHANGED') targetResponse.value = derivedResponse.value;
                  } catch (e) {
                    targetResponse.status = 'DERIVE_ERROR';
                    targetResponse.value = null;
                  }
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

      // responses id to alias
      newResponses = newResponses
        .map(r => ({
          ...r,
          id: this.variableCodings.find(c => c.id === r.id)?.alias || r.id
        }));
      allCodedResponses = [...allCodedResponses, ...newResponses];
    });

    // remove duplicate responses if not from derived var
    let uniqueResponses = allCodedResponses
      .filter((item, index, self) => index === self
        .findIndex(t => (
          t.id === item.id && t.subform === item.subform
        ))
      );

    const derivedAliases = this.variableCodings
      .filter(vc => (vc.sourceType !== 'BASE') && (vc.sourceType !== 'BASE_NO_VALUE'))
      .map(vc => vc.alias || vc.id);

    // remove unset responses if value is part in subform
    if (Object.keys(subformGroups).length > 0) {
      uniqueResponses = uniqueResponses.filter(ur => {
        const foundInSubformGroups = Object.values(subformGroups)[0].find(sr => sr.id === ur.id);
        const foundInDerived = derivedAliases.includes(ur.id);
        return !((foundInSubformGroups || foundInDerived) && ur.status === 'UNSET');
      });
    }
    return [...uniqueResponses];
  }

  validate(baseVariables: VariableInfo[]): CodingSchemeProblem[] {
    // todo: check against VarInfo
    const problems: CodingSchemeProblem[] = [];
    const allDerivedVariableIds: string[] = this.variableCodings
      .filter(vc => vc.sourceType !== 'BASE' && vc.sourceType !== 'BASE_NO_VALUE')
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
            variableId: c.alias || c.id,
            variableLabel: c.label
          });
        }
      } else if (c.deriveSources && c.deriveSources.length > 0) {
        if (c.sourceType === 'COPY_VALUE') {
          if (c.deriveSources.length > 1) {
            problems.push({
              type: 'MORE_THAN_ONE_SOURCE',
              breaking: false,
              variableId: c.alias || c.id,
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
              variableId: c.alias || c.id,
              variableLabel: c.label
            });
          }
        } else if (c.deriveSources.length === 1) {
          problems.push({
            type: 'ONLY_ONE_SOURCE',
            breaking: false,
            variableId: c.alias || c.id,
            variableLabel: c.label
          });
        }
        c.deriveSources.forEach(s => {
          if (allPossibleSourceIds.indexOf(s) < 0) {
            problems.push({
              type: 'SOURCE_MISSING',
              breaking: true,
              variableId: c.alias || c.id,
              variableLabel: c.label
            });
          }
        });
      } else if (c.sourceType !== 'BASE_NO_VALUE') {
        problems.push({
          type: 'SOURCE_MISSING',
          breaking: true,
          variableId: c.alias || c.id,
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
                    variableId: c.alias || c.id,
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
                  variableId: c.alias || c.id,
                  code: code.id ? code.id.toString(10) : 'null',
                  variableLabel: c.label
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
            variableLabel: c.label
          });
        }
      }
    });
    return problems;
  }

  asText(mode: CodingToTextMode = 'EXTENDED'): CodingAsText[] {
    const returnTexts: CodingAsText[] = [];
    this.variableCodings.forEach(c => {
      const mappedSources = c.deriveSources
        .map(s => this.variableCodings.find(vc => vc.alias === s)?.alias || s);
      const newCodingText: CodingAsText = {
        id: c.alias || c.id,
        label: c.label,
        source: ToTextFactory.sourceAsText(
          c.alias || c.id,
          c.sourceType,
          mappedSources,
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

  /**
   * Get a list of all base variables need for the coding of a given list of variables.
   * Variables are identified by what is called internally **alias** and **id** in outside applications
   */
  getBaseVarsList(varAliases: string[]): string[] {
    const getVarBy = (selector: 'id' | 'alias') =>
      (varId: string) =>
        this.variableCodings.find(variable => variable[selector] === varId);

    const getSourceVarAliases = (sourceVar: VariableCodingData | undefined): string[] => {
      if (!sourceVar) return [];
      if (sourceVar.sourceType === 'BASE') return [sourceVar.alias];
      return sourceVar.deriveSources
        .map(getVarBy('id'))
        .flatMap(getSourceVarAliases);
    };

    const baseVarAliases = varAliases
      .map(getVarBy('alias'))
      .flatMap(getSourceVarAliases);
    return [...new Set(baseVarAliases)];
  }
}
