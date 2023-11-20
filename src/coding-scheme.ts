import {
  VariableCodingData,
  Response,
  VariableInfo,
  CodingSchemeProblem,
  RuleMethodParameterCount
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';

export class CodingScheme {
  variableCodings: VariableCodingData[] = [];

  constructor(codings: any[]) {
    this.variableCodings = [];
    // transforming old versions
    codings.forEach(c => {
      const newCoding: VariableCodingData = {
        id: c.id,
        label: c.label || '',
        sourceType: 'BASE',
        deriveSources: c.deriveSources || [],
        valueTransformations: c.valueTransformations || [],
        manualInstruction: c.manualInstruction || '',
        codeModel: c.codeModel || null,
        codeModelParameters: c.codeModelParameters || [],
        codes: c.codes || []
      };
      if (c.sourceType === 'DERIVE_CONCAT') {
        if (c.deriveSourceType === 'VALUE') {
          newCoding.sourceType = 'COPY_FIRST_VALUE';
        } else {
          // concat score will be changed to concat code
          newCoding.sourceType = 'CONCAT_CODE';
        }
      } else if (c.sourceType === 'DERIVE_SUM') {
        if (c.deriveSourceType === 'VALUE') {
          // sum of values is invalid
          newCoding.sourceType = 'COPY_FIRST_VALUE';
        } else if (c.deriveSourceType === 'CODE') {
          newCoding.sourceType = 'SUM_CODE';
        } else {
          newCoding.sourceType = 'SUM_SCORE';
        }
      } else {
        newCoding.sourceType = c.sourceType;
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
        if (coding.sourceType === 'BASE' && newResponse &&
                    newResponse.status === 'VALUE_CHANGED' && coding.codes.length > 0) {
          const codedResponse = CodingFactory.code(newResponse, coding);
          if (codedResponse.status !== newResponse.status) {
            newResponse.status = codedResponse.status;
            newResponse.code = codedResponse.code;
            newResponse.score = codedResponse.score;
            codingChanged = true;
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
            if (coding.sourceType === 'COPY_FIRST_VALUE') {
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
    const allDerivedVariables: string[] = [];
    this.variableCodings.forEach(vc => allDerivedVariables.concat(vc.deriveSources));
    const allBaseVariableIds = baseVariables.map(bv => bv.id);
    this.variableCodings.forEach(c => {
      if (c.sourceType === 'BASE') {
        if (allBaseVariableIds.indexOf(c.id) < 0) {
          problems.push({
            type: 'SOURCE_MISSING',
            breaking: true,
            variable_id: c.id
          });
        }
      } else if (c.deriveSources && c.deriveSources.length > 0) {
        if (c.sourceType === 'COPY_FIRST_VALUE') {
          if (c.deriveSources.length > 1) {
            problems.push({
              type: 'MORE_THEN_ONE_SOURCE',
              breaking: false,
              variable_id: c.id
            });
          } else {
            const source = this.variableCodings.find(vc => vc.id === c.deriveSources[0]);
            if (source) {
              if (source.sourceType !== 'BASE') {
                problems.push({
                  type: 'VALUE_COPY_NOT_FROM_BASE',
                  breaking: false,
                  variable_id: c.id
                });
              }
            } else {
              problems.push({
                type: 'SOURCE_MISSING',
                breaking: true,
                variable_id: c.id
              });
            }
          }
        } else {
          if (c.deriveSources.length === 1) {
            problems.push({
              type: 'ONLY_ONE_SOURCE',
              breaking: false,
              variable_id: c.id
            });
          }
          const sources = this.variableCodings.filter(vc => c.deriveSources.indexOf(vc.id) >= 0);
          if (sources.length !== c.deriveSources.length) {
            problems.push({
              type: 'SOURCE_MISSING',
              breaking: true,
              variable_id: c.id
            });
          }
        }
      } else {
        problems.push({
          type: 'SOURCE_MISSING',
          breaking: true,
          variable_id: c.id
        });
      }
      if (c.codes.length > 0) {
        c.codes.forEach(code => {
          code.rules.forEach(r => {
            if (RuleMethodParameterCount[r.method] < 0) {
              if (!r.parameters || r.parameters.length < 1) {
                problems.push({
                  type: 'RULE_PARAMETER_COUNT_MISMATCH',
                  breaking: true,
                  variable_id: c.id,
                  code: code.id
                });
              }
            } else if (RuleMethodParameterCount[r.method] !== (r.parameters ? r.parameters.length : 0)) {
              problems.push({
                type: 'RULE_PARAMETER_COUNT_MISMATCH',
                breaking: true,
                variable_id: c.id,
                code: code.id
              });
            }
          });
        });
      } else if (allDerivedVariables.indexOf(c.id) < 0) {
        problems.push({
          type: 'VACANT',
          breaking: false,
          variable_id: c.id
        });
      }
    });
    return problems;
  }
}
