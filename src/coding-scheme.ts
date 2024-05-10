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
  validStatesToStartDeriving, deriveMethodsFromValue, statesToReplaceByDeriveError
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';
import { ToTextFactory } from './to-text-factory';
import { evaluate } from 'mathjs';

export interface VariableGraphNode {
  id: string,
  level: number;
  sources: string[];
}

export class CodingScheme {
  variableCodings: VariableCodingData[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(codings: any[]) {
    this.variableCodings = [];
    // transforming old versions
    codings.forEach(c => {
      let valueProcessing: string[] = c.processing || c.preProcessing || c.valueTransformations || [];
      if (valueProcessing && valueProcessing.includes('REMOVE_WHITE_SPACES')) {
        valueProcessing = valueProcessing.filter(vp => vp !== 'REMOVE_WHITE_SPACES');
        valueProcessing.push('IGNORE_ALL_SPACES')
      }
      const newCoding: VariableCodingData = {
        id: c.id,
        label: c.label || '',
        sourceType: 'BASE',
        sourceParameters: {
          solverExpression: c.sourceParameters ? c.sourceParameters.solverExpression || '' : '',
          processing: c.sourceParameters ? c.sourceParameters.processing || [] : [],
        },
        deriveSources: c.deriveSources || [],
        processing: valueProcessing as ProcessingParameterType[],
        fragmenting: c.fragmenting || '',
        manualInstruction: c.manualInstruction || '',
        codeModel: c.codeModel || 'NONE',
        codeModelParameters: c.codeModelParameters || [],
        codes: [],
        page: c.page || ''
      };
      if (c.sourceType === 'DERIVE_CONCAT') {
        if (c.deriveSourceType === 'VALUE') {
          newCoding.sourceType = 'COPY_VALUE';
        } else {
          // concat score will be changed to concat code
          newCoding.sourceType = 'CONCAT_CODE';
        }
      } else if (c.sourceType === 'DERIVE_SUM') {
        if (c.deriveSourceType === 'VALUE') {
          // sum of values is invalid
          newCoding.sourceType = 'COPY_VALUE';
        } else if (c.deriveSourceType === 'CODE') {
          newCoding.sourceType = 'SUM_CODE';
        } else {
          newCoding.sourceType = 'SUM_SCORE';
        }
      } else if (c.sourceType === 'COPY_FIRST_VALUE') {
        newCoding.sourceType = 'COPY_VALUE';
      } else {
        newCoding.sourceType = c.sourceType;
      }
      if (c.codes && Array.isArray(c.codes)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.codes.forEach((code:any) => {
          if (code.ruleSets) {
            newCoding.codes.push(code);
          } else if (code.rules && Array.isArray(code.rules)) {
            newCoding.codes.push(<CodeData>{
              id: code.id,
              label: code.label || '',
              score: code.score || 0,
              ruleSetOperatorAnd: false,
              ruleSets: [<RuleSet>{
                ruleOperatorAnd: code.ruleOperatorAnd || false,
                rules: code.rules
              }],
              manualInstruction: code.manualInstruction || ''
            });
          }
        });
      }
      this.variableCodings.push(newCoding);
    });
  }

  getVariableDependencyTree(): VariableGraphNode[] {
    const graph: VariableGraphNode[] = this.variableCodings.filter(c => c.sourceType === 'BASE').map(c => {
      return {
        id: c.id,
        level: 0,
        sources: []
      }
    });
    let found = true;
    while (found && this.variableCodings.length > graph.length) {
      found = false;
      this.variableCodings.forEach(vc => {
        const existingNode = graph.find(n => n.id === vc.id);
        if (!existingNode) {
          let maxLevel = 0;
          vc.deriveSources.forEach(s => {
            const node = graph.find(n => n.id === s);
            if (node) {
              maxLevel = Math.max(maxLevel, node.level);
            } else {
              maxLevel = Number.MAX_VALUE
            }
          });
          if (maxLevel < Number.MAX_VALUE) {
            found = true;
            graph.push({
              id: vc.id,
              level: maxLevel + 1,
              sources: [...vc.deriveSources]
            })
          }
        }
      })
    }
    if (found) return graph;
    throw new Error('circular dependency in coding scheme');
  };

  static deriveValue(coding: VariableCodingData, sourceResponses: Response[]): Response {
    const validResponseStatuses =
        deriveMethodsFromValue.includes(coding.sourceType) ?
            validStatesForDerivingValue : validStatesForDerivingCode;
    const errorStatuses: string[] = [];
    sourceResponses.forEach(r => {
      if (!validResponseStatuses.includes(r.state)) errorStatuses.push(r.state)
    })
    if (errorStatuses.length > 0 && (coding.sourceType !== 'UNIQUE_VALUES' || errorStatuses.length === sourceResponses.length)) {
      const minStatusIndex = Math.min(...errorStatuses.map(s => responseStatesInOrder.indexOf(s)));
      let newState = responseStatesInOrder[minStatusIndex];
      if (statesToReplaceByDeriveError.includes(newState)) newState = 'DERIVE_ERROR';
      return <Response>{
        id: coding.id,
        value: null,
        state: newState
      }
    }
    // eslint-disable-next-line default-case
    switch (coding.sourceType) {
      case 'COPY_VALUE':
        const stringfiedValue = JSON.stringify(sourceResponses[0].value);
        return <Response>{
          id: coding.id,
          value: JSON.parse(stringfiedValue),
          state: 'VALUE_CHANGED'
        }
      case 'CONCAT_CODE':
        let codes = coding.deriveSources.map(s => {
          const myResponse = sourceResponses.find(r => r.id === s);
          return myResponse && myResponse.code ? myResponse.code.toString(10) : '?';
        });
        if (coding.sourceParameters && coding.sourceParameters.processing && coding.sourceParameters.processing.includes('SORT')) {
          codes = codes.sort();
        }
        return <Response>{
          id: coding.id,
          value: codes.join(DeriveConcatDelimiter),
          state: 'VALUE_CHANGED'
        }
      case 'SUM_CODE':
        return <Response>{
          id: coding.id,
          value: coding.deriveSources.map(s => {
            const myResponse = sourceResponses.find(r => r.id === s);
            if (myResponse) return myResponse.code || 0;
            throw new Error('response not found in derive');
          }).reduce((sum, current) => sum + current, 0),
          state: 'VALUE_CHANGED'
        }
      case 'SUM_SCORE':
        return <Response>{
          id: coding.id,
          value: coding.deriveSources.map(s => {
            const myResponse = sourceResponses.find(r => r.id === s);
            if (myResponse) return myResponse.score || 0;
            throw new Error('response not found in derive');
          }).reduce((sum, current) => sum + current, 0),
          state: 'VALUE_CHANGED'
        }
      case 'UNIQUE_VALUES':
        const valuesToCompare: string[] = [];
        sourceResponses.filter(r => validStatesForDerivingValue.includes(r.state)).forEach(r => {
          if (coding.sourceParameters && coding.sourceParameters.processing && coding.sourceParameters.processing.includes('TO_NUMBER')) {
            if (Array.isArray(r.value)) {
              valuesToCompare.push(r.value.map(v => (CodingFactory.getValueAsNumber(v) || 0).toString(10)).join('##'));
            } else {
              valuesToCompare.push((CodingFactory.getValueAsNumber(r.value) || 0).toString(10));
            }
          } else {
            let newValue;
            if (Array.isArray(r.value)) {
              newValue = r.value.map(v => (CodingFactory.getValueAsString(v, coding.sourceParameters?.processing) || '')).join('##')
            } else {
              newValue = CodingFactory.getValueAsString(r.value, coding.sourceParameters?.processing) || ''
            }
            valuesToCompare.push(newValue);
          }
        });
        const duplicates = valuesToCompare.filter((value, index, array) => array.indexOf(value) < index);
        return <Response>{
          id: coding.id,
          value: duplicates.length === 0,
          state: 'VALUE_CHANGED'
        }
      case 'SOLVER':
        if (coding.sourceParameters && coding.sourceParameters.processing && coding.sourceParameters.solverExpression) {
          const varSearchPattern = new RegExp(/\$\{(\s*\w+\s*)}/, 'g');
          const sourceIds: string[] = [];
          const replacements = new Map();
          const regExExecReturn = coding.sourceParameters.solverExpression.matchAll(varSearchPattern);
          for (const match of regExExecReturn) {
            if (!sourceIds.includes(match[1].trim())) sourceIds.push(match[1].trim());
            if (!replacements.has(match[1])) replacements.set(match[1], match[1].trim());
          }
          if (sourceIds.length > 0) {
            const missingDeriveVars = sourceIds.filter(s => !coding.deriveSources.includes(s));
            if (missingDeriveVars.length === 0) {
              let newExpression = coding.sourceParameters.solverExpression;
              replacements.forEach((varId: string, toReplace: string) => {
                const responseToReplace = sourceResponses.find(r => r.id === varId);
                if (responseToReplace && !Array.isArray(responseToReplace.value)) {
                  const valueToReplace = CodingFactory.getValueAsNumber(responseToReplace.value)
                  if (valueToReplace === null) {
                    throw new Error('response value not numeric')
                  } else {
                    const replacePattern = new RegExp(`\\\$\\\{${toReplace}}`, 'g');
                    newExpression = newExpression.replace(replacePattern, valueToReplace.toString(10));
                  }
                } else {
                  throw new Error('response missing or value is array in solver')
                }
              })
              let newValue = evaluate(newExpression);
              if (isNaN(newValue) || newValue === Number.POSITIVE_INFINITY || newValue === Number.NEGATIVE_INFINITY) {
                newValue = null;
              }
              return <Response>{
                id: coding.id,
                value: newValue,
                state: newValue === null ? 'DERIVE_ERROR' : 'VALUE_CHANGED'
              }
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
    newResponses.filter(r => r.state === 'DISPLAYED').forEach(r => {
      const myCoding = this.variableCodings.find(c => c.id === r.id);
      if (myCoding && myCoding.sourceType === 'BASE' && myCoding.sourceParameters.processing &&
          myCoding.sourceParameters.processing.includes('TAKE_DISPLAYED_AS_VALUE_CHANGED')) {
        r.state = 'VALUE_CHANGED';
      }
    });

    // set invalid if value is empty
    newResponses.filter(r => r.state === 'VALUE_CHANGED' && r.value === '').forEach(r => {
      const myCoding = this.variableCodings.find(c => c.id === r.id);
      if (myCoding && myCoding.sourceType === 'BASE' && !(myCoding.sourceParameters.processing &&
          myCoding.sourceParameters.processing.includes('TAKE_EMPTY_AS_VALID'))) {
        r.state = 'INVALID';
      }
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

    // set up derived variables
    this.variableCodings.forEach(c => {
      if (c.sourceType === 'BASE') {
        if (globalDeriveError) varDependencies.push({
          id: c.id,
          level: 0,
          sources: []
        });
      } else {
        const existingResponse = newResponses.find(r => r.id === c.id);
        if (!existingResponse) newResponses.push({
          id: c.id,
          value: null,
          state: globalDeriveError ? 'DERIVE_ERROR' : 'UNSET'
        })
      }
    })

    const maxVarLevel = Math.max(...varDependencies.map(n => n.level))

    for (var level = 0; level <= maxVarLevel; level++) {
      varDependencies.filter(n => n.level === level).forEach(varNode => {
        const targetResponse = newResponses.find(r => r.id === varNode.id);
        const varCoding = this.variableCodings.find(vc => vc.id === varNode.id);
        if (targetResponse && varCoding) {
          if (varNode.sources.length > 0 && validStatesToStartDeriving.includes(targetResponse.state)) {
            // derive
            try {
              const derivedResponse = CodingScheme.deriveValue(
                  varCoding, newResponses.filter(r => varNode.sources.includes(r.id)));
              targetResponse.state = derivedResponse.state;
              if (derivedResponse.state === 'VALUE_CHANGED') targetResponse.value = derivedResponse.value;
            } catch (e) {
              targetResponse.state = 'DERIVE_ERROR';
              targetResponse.value = null;
            }
          }
          if (targetResponse.state === 'VALUE_CHANGED') {
            if (varCoding.codes.length > 0) {
              const codedResponse = CodingFactory.code(targetResponse, varCoding);
              if (codedResponse.state !== targetResponse.state) {
                targetResponse.state = codedResponse.state;
                targetResponse.code = codedResponse.code;
                targetResponse.score = codedResponse.score;
              }
            } else {
              targetResponse.state = 'NO_CODING';
            }
          }
        }
      })
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
    const allPossibleSourceIds = [...allBaseVariableInfoIds, ...allDerivedVariableIds];
    const variableValuesCopied: string[] = [];
    this.variableCodings.filter(vc => vc.sourceType === 'COPY_VALUE').forEach(vc => {
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
          if (allPossibleSourceIds.indexOf(c.deriveSources[0]) >= 0 &&
              allBaseVariableInfoIds.indexOf(c.deriveSources[0]) < 0) {
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
              } else if (RuleMethodParameterCount[r.method] !== (r.parameters ? r.parameters.length : 0)) {
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

  asText(): CodingAsText[] {
    const returnTexts: CodingAsText[] = [];
    this.variableCodings.forEach(c => {
      const newCodingText: CodingAsText = {
        id: c.id,
        label: c.label,
        source: ToTextFactory.sourceAsText(c.id, c.sourceType, c.deriveSources),
        processing: ToTextFactory.processingAsText(c.processing, c.fragmenting),
        hasManualInstruction: !!c.manualInstruction,
        codes: c.codes.map(code => ToTextFactory.codeAsText(code))
      };
      const allScores = newCodingText.codes.map(ct => ct.score);
      const maxScore = Math.max(...allScores);
      const minScore = Math.min(...allScores);
      if (minScore < maxScore) {
        newCodingText.codes.forEach(code => {
          if (code.score === maxScore) {
            code.scoreLabel = 'RICHTIG';
          } else if (code.score === minScore) {
            code.scoreLabel = 'FALSCH';
          } else {
            code.scoreLabel = 'teilw. RICHTIG';
          }
        });
      }
      returnTexts.push(newCodingText);
    });
    return returnTexts;
  }

  getBaseVarsList(derivedVarsIds: string[]): string[] {
    const allBaseVariables:string[] = this.variableCodings
      .filter(c => c.deriveSources.length === 0)
      .map(c => c.id);
    const baseVariablesIds: string[] = [];
    if (derivedVarsIds.length > 0) {
      derivedVarsIds.forEach(derivedVarId => {
        const derivedVar: VariableCodingData | undefined = this.variableCodings
          .find(variableCoding => variableCoding.id === derivedVarId);
        if (derivedVar) {
          baseVariablesIds.push(...baseVariablesIds, ...this.derivedVarToBaseVars(derivedVar, allBaseVariables));
        }
      });
      return [...new Set(baseVariablesIds)];
    }
    return [];
  }

  derivedVarToBaseVars(derivedVariable:VariableCodingData, allBaseVariables:string[]) {
    let baseVariablesIds: string[] = [];
    derivedVariable.deriveSources.forEach(derivedVar => {
      if (allBaseVariables.includes(derivedVar)) {
        baseVariablesIds.push(derivedVar);
      } else {
        const variableCoding = this.variableCodings
          .find(c => c.id === derivedVar);
        if (variableCoding) {
          baseVariablesIds = [...baseVariablesIds, ...this.derivedVarToBaseVars(variableCoding, allBaseVariables)];
        }
      }
    });
    return [...new Set(baseVariablesIds)];
  }
}
