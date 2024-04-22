import {
  VariableCodingData,
  Response,
  VariableInfo,
  CodingSchemeProblem,
  RuleMethodParameterCount, CodingAsText, CodeData, RuleSet
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';
import { ToTextFactory } from './to-text-factory';

export class CodingScheme {
  variableCodings: VariableCodingData[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(codings: any[]) {
    this.variableCodings = [];
    // transforming old versions
    codings.forEach(c => {
      const newCoding: VariableCodingData = {
        id: c.id,
        label: c.label || '',
        sourceType: 'BASE',
        deriveSources: c.deriveSources || [],
        processing: c.processing || c.preProcessing || c.valueTransformations || [],
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

  code(unitResponses: Response[]): Response[] {
    const stringifiedResponses = JSON.stringify(unitResponses);
    const newResponses: Response[] = JSON.parse(stringifiedResponses);
    let changed = true;
    let cycleCount = 0;
    while (changed && cycleCount < 1000) {
      cycleCount += 1;
      const changes = this.variableCodings.map((coding): boolean => {
        let codingChanged = false;
        let newResponse = newResponses.find(r => r.id === coding.id);
        if (coding.sourceType === 'BASE') {
          if (!newResponse) {
            newResponse = {
              id: coding.id,
              value: null,
              status: 'UNSET'
            };
            newResponses.push(newResponse);
            codingChanged = true;
          } else if (newResponse.status === 'VALUE_CHANGED') {
            if (coding.codes.length > 0) {
              const codedResponse = CodingFactory.code(newResponse, coding);
              if (codedResponse.status !== newResponse.status) {
                newResponse.status = codedResponse.status;
                newResponse.code = codedResponse.code;
                newResponse.score = codedResponse.score;
                codingChanged = true;
              }
            } else {
              newResponse.status = 'NO_CODING';
              codingChanged = true;
            }
          }
        } else if (coding.deriveSources.length > 0) {
          if (!newResponse) {
            newResponse = {
              id: coding.id,
              value: null,
              status: 'SOURCE_MISSING'
            };
            newResponses.push(newResponse);
            codingChanged = true;
          }
          if (newResponse.status === 'SOURCE_MISSING') {
            if (coding.sourceType === 'COPY_VALUE') {
              const sourceResponse = newResponses.find(r => r.id === coding.deriveSources[0]);
              if (sourceResponse &&
                  ['VALUE_CHANGED', 'CODING_COMPLETE', 'VALUE_DERIVED'].indexOf(sourceResponse.status) >= 0) {
                newResponse.value = JSON.stringify(sourceResponse.value);
                newResponse.status = 'VALUE_DERIVED';
                codingChanged = true;
              }
            } else {
              const deriveSources = newResponses.filter(r => coding.deriveSources
                .indexOf(r.id) >= 0 && r.status === 'CODING_COMPLETE');
              if (deriveSources.length === coding.deriveSources.length) {
                try {
                  newResponse.value = CodingFactory.deriveValue(coding, newResponses);
                  newResponse.status = 'VALUE_DERIVED';
                  codingChanged = true;
                } catch (e) {
                  newResponse.status = 'DERIVE_ERROR';
                  codingChanged = true;
                }
              }
            }
          }
          if (newResponse.status === 'VALUE_DERIVED') {
            const codedResponse = CodingFactory.code(newResponse, coding);
            if (codedResponse.status !== newResponse.status) {
              newResponse.status = codedResponse.status;
              newResponse.code = codedResponse.code;
              newResponse.score = codedResponse.score;
              codingChanged = true;
            }
          }
        }
        return codingChanged;
      }).filter((ch: boolean) => ch);
      changed = changes.length > 0;
    }
    // eslint-disable-next-line no-console
    if (cycleCount >= 1000) console.log('iteration cancelled');
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
