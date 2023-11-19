import {Response} from "../response/response";
import {CoderVariable} from "./coder-variable";
import {VariableInfo} from "../variable-list/variable-list";

export type RuleMethod = 'MATCH' | 'MATCH_REGEX' | 'NUMERIC_RANGE' | 'NUMERIC_LESS_THEN' | 'NUMERIC_MORE_THEN' |
    'NUMERIC_MAX' | 'NUMERIC_MIN' | 'IS_EMPTY' | 'ELSE' | 'IS_NULL';
export const RuleMethodParameterCount = {
    'MATCH': -1, 'MATCH_REGEX': -1, 'NUMERIC_RANGE': 2, 'NUMERIC_LESS_THEN': 1, 'NUMERIC_MORE_THEN': 1,
    'NUMERIC_MAX': 1, 'NUMERIC_MIN': 1, 'IS_EMPTY': 0, 'ELSE': 0, 'IS_NULL': 0
}
export type ValueTransformation = 'TO_UPPER' | 'REMOVE_WHITE_SPACES' | 'TO_NUMBER';
export type CodeModel = null | 'CHOICE' | 'INPUT_INTEGER' | 'INPUT_STRING';
export type SourceType = 'BASE' | 'COPY_FIRST_VALUE' | 'CONCAT_CODE' | 'SUM_CODE' | 'SUM_SCORE';
export type CodingSchemeProblemType = 'VACANT' | 'SOURCE_MISSING' | 'INVALID_SOURCE' | 'RULE_PARAMETER_COUNT_MISMATCH'
    | 'MORE_THEN_ONE_SOURCE' | 'ONLY_ONE_SOURCE' | 'VALUE_COPY_NOT_FROM_BASE';

export interface CodingRule {
    method: RuleMethod,
    parameters: string[],
}

export interface CodeData {
    id: number,
    label: string,
    score: number,
    rules: CodingRule[],
    manualInstruction: string
}

export interface VariableCodingData {
    id: string;
    label: string;
    sourceType: SourceType;
    deriveSources: string[];
    valueTransformations: ValueTransformation[];
    manualInstruction: string;
    codeModel: CodeModel;
    codeModelParameters: string[],
    codes: CodeData[];
}

export interface CodingSchemeProblem {
    type: CodingSchemeProblemType,
    breaking: boolean,
    variable_id: string,
    code?: number
}

export class CodingScheme {
    public variableCodings: VariableCodingData[] = [];

    constructor(codings: any[]) {
        this.variableCodings = [];
        // transforming old versions
        codings.forEach(c => {
            let newCoding: VariableCodingData = {
                id: c.id,
                label: c.label || "",
                sourceType: "BASE",
                deriveSources: c.deriveSources || [],
                valueTransformations: c.valueTransformations || [],
                manualInstruction: c.manualInstruction || "",
                codeModel: c.codeModel || null,
                codeModelParameters: c.codeModelParameters || [],
                codes: c.codes || []
            }
            if (c.sourceType === "DERIVE_CONCAT") {
                if (c.deriveSourceType === "VALUE") {
                    newCoding.sourceType = "COPY_FIRST_VALUE"
                } else {
                    // concat score will be changed to concat code
                    newCoding.sourceType = "CONCAT_CODE"
                }
            } else if (c.sourceType === "DERIVE_SUM") {
                if (c.deriveSourceType === "VALUE") {
                    // sum of values is invalid
                    newCoding.sourceType = "COPY_FIRST_VALUE"
                } else if (c.deriveSourceType === "CODE") {
                    newCoding.sourceType = "SUM_CODE"
                } else {
                    newCoding.sourceType = "SUM_SCORE"
                }
            } else {
                newCoding.sourceType = c.sourceType
            }
            this.variableCodings.push(newCoding);
        })
    }

    code(sourceValues: Response[]): Response[] {

        const usedSources: string[] = [];
        const coderVariables: CoderVariable[] = [];
        sourceValues.forEach(v => {
            let myCodingScheme: VariableCodingData | null = null;
            this.variableCodings.forEach(cs => {
                if (cs.id === v.id) myCodingScheme = cs;
            });
            coderVariables.push(new CoderVariable(v, myCodingScheme));
            usedSources.push(v.id);
        });
        this.variableCodings.forEach(cs => {
            if (usedSources.indexOf(cs.id) < 0) coderVariables.push(new CoderVariable(null, cs));
        });
        let changed = true;
        let cycleCount = 0;
        while (changed && cycleCount < 1000) {
            changed = false;
            cycleCount += 1;
            coderVariables.forEach(cv => {
                if (cv.deriveAndCode_changesMade(coderVariables)) changed = true;
            });
        }
        if (cycleCount >= 1000) console.log('iteration cancelled');
        return coderVariables;
    }

    validate(baseVariables: VariableInfo[]): CodingSchemeProblem[] {
        // todo: check against VarInfo
        let problems: CodingSchemeProblem[] = [];
        let allDerivedVariables: string[];
        allDerivedVariables = [];
        this.variableCodings.forEach(vc => allDerivedVariables.concat(vc.deriveSources));
        const allBaseVariableIds = baseVariables.map(bv => bv.id);
        this.variableCodings.forEach(c => {
            if (c.sourceType === 'BASE') {
                if (allBaseVariableIds.indexOf(c.id) < 0) problems.push({
                    type: "SOURCE_MISSING",
                    breaking: true,
                    variable_id: c.id
                })
            } else {
                if (c.deriveSources && c.deriveSources.length > 0) {
                    if (c.sourceType === 'COPY_FIRST_VALUE') {
                        if (c.deriveSources.length > 1) {
                            problems.push({
                                type: "MORE_THEN_ONE_SOURCE",
                                breaking: false,
                                variable_id: c.id
                            })
                        } else {
                            const source = this.variableCodings.find(vc => vc.id === c.deriveSources[0]);
                            if (source) {
                                if (source.sourceType !== 'BASE') problems.push({
                                    type: "VALUE_COPY_NOT_FROM_BASE",
                                    breaking: false,
                                    variable_id: c.id
                                })
                            } else {
                                problems.push({
                                    type: "SOURCE_MISSING",
                                    breaking: true,
                                    variable_id: c.id
                                })
                            }
                        }
                    } else {
                        if (c.deriveSources.length === 1) problems.push({
                            type: "ONLY_ONE_SOURCE",
                            breaking: false,
                            variable_id: c.id
                        });
                        const sources = this.variableCodings.filter(vc => c.deriveSources.indexOf(vc.id) >= 0);
                        if (sources.length !== c.deriveSources.length) problems.push({
                            type: "SOURCE_MISSING",
                            breaking: true,
                            variable_id: c.id
                        })
                    }
                } else {
                    problems.push({
                        type: "SOURCE_MISSING",
                        breaking: true,
                        variable_id: c.id
                    })
                }
            }
            if (c.codes.length > 0) {
                c.codes.forEach(code => {
                    code.rules.forEach(r => {
                        if (RuleMethodParameterCount[r.method] < 0) {
                            if (r.parameters.length < 1) problems.push({
                                type: "RULE_PARAMETER_COUNT_MISMATCH",
                                breaking: true,
                                variable_id: c.id,
                                code: code.id
                            });
                        } else {
                            if (RuleMethodParameterCount[r.method] !== r.parameters.length) {
                                problems.push({
                                    type: "RULE_PARAMETER_COUNT_MISMATCH",
                                    breaking: true,
                                    variable_id: c.id,
                                    code: code.id
                                });
                            }
                        }
                    })
                })
            } else if (allDerivedVariables.indexOf(c.id) < 0) {
                problems.push({
                    type: "VACANT",
                    breaking: false,
                    variable_id: c.id
                })
            }
        })
        return problems;
    }
}
