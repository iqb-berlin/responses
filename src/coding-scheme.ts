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
  DeriveConcatDelimiter, responseStatusInOrder
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';
import { ToTextFactory } from './to-text-factory';

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
      if (valueProcessing && valueProcessing.indexOf('REMOVE_WHITE_SPACES') > 0) {
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

  getVariableGraph(): VariableGraphNode[] {
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
    const validResponseStatuses = ['CODING_COMPLETE'];
    if (['SOLVER', 'COPY_VALUE', 'UNIQUE_VALUES'].indexOf(coding.sourceType) >= 0) {
      validResponseStatuses.push('VALUE_CHANGED', 'NO_CODING', 'CODING_INCOMPLETE', 'CODING_ERROR');
    }
    const errorStatuses: string[] = [];
    sourceResponses.forEach(r => {
      if (validResponseStatuses.indexOf(r.state) < 0) errorStatuses.push(r.state)
    })
    if (errorStatuses.length > 0 && (coding.sourceType !== 'UNIQUE_VALUES' || errorStatuses.length === sourceResponses.length)) {
      const minStatusIndex = Math.min(...errorStatuses.map(s => responseStatusInOrder.indexOf(s)));
      return <Response>{
        id: coding.id,
        value: null,
        state: responseStatusInOrder[minStatusIndex]
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
        return <Response>{
          id: coding.id,
          value: coding.deriveSources.map(s => {
            const myResponse = sourceResponses.find(r => r.id === s);
            if (myResponse) return myResponse.code || 'X';
            throw new Error('response not found in derive');
          }).join(DeriveConcatDelimiter),
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
          myCoding.sourceParameters.processing.indexOf('TAKE_DISPLAYED_AS_VALUE_CHANGED') >= 0) {
        r.state = 'VALUE_CHANGED';
      }
    });

    // set invalid if value is empty
    newResponses.filter(r => r.state === 'VALUE_CHANGED' && r.value === '').forEach(r => {
      const myCoding = this.variableCodings.find(c => c.id === r.id);
      if (myCoding && myCoding.sourceType === 'BASE' && (!myCoding.sourceParameters.processing ||
          myCoding.sourceParameters.processing.indexOf('TAKE_EMPTY_AS_VALID') < 0)) {
        r.state = 'INVALID';
      }
    });

    // set up derived variables
    this.variableCodings.filter(c => c.sourceType !== 'BASE').forEach(c => {
      const existingResponse = newResponses.find(r => r.id === c.id);
      if (!existingResponse) newResponses.push({
        id: c.id,
        value: null,
        state: 'UNSET'
      })
    })

    // set up variable graph
    const varGraph = this.getVariableGraph();
    const maxVarLevel = Math.max(...varGraph.map(n => n.level))

    for (var level = 0; level <= maxVarLevel; level++) {
      varGraph.filter(n => n.level === level).forEach(varNode => {
        const targetResponse = newResponses.find(r => r.id === varNode.id);
        const varCoding = this.variableCodings.find(vc => vc.id === varNode.id);
        if (targetResponse && varCoding) {
          if (varNode.sources.length > 0 && targetResponse.state === 'UNSET') {
            // derive
            const derivedResponse = CodingScheme.deriveValue(
                varCoding, newResponses.filter(r => varNode.sources.indexOf(r.id) >= 0));
            targetResponse.state = derivedResponse.state;
            if (derivedResponse.state === 'VALUE_CHANGED') targetResponse.value = derivedResponse.value;
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
