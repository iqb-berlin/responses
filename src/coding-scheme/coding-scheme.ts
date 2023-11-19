import {Response} from "../response/response";
import {CoderVariable} from "./coder-variable";
import {VariableInfo} from "../variable-list/variable-list";

export type RuleMethod = 'MATCH' | 'MATCH_REGEX' | 'NUMERIC_RANGE' | 'NUMERIC_LESS_THEN' | 'NUMERIC_MORE_THEN' |
    'NUMERIC_MAX' | 'NUMERIC_MIN' | 'IS_EMPTY' | 'ELSE';
export type ValueTransformation = 'TO_UPPER' | 'REMOVE_WHITE_SPACES' | 'DATE_TO_ISO' | 'TIME_TO_ISO';
export type CodeModel = null | 'CHOICE' | 'INPUT_INTEGER' | 'INPUT_STRING';
export type SourceType = 'BASE' | 'COPY_FIRST_VALUE' | 'CONCAT_CODE' | 'SUM_CODE' | 'SUM_SCORE';

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


export class CodingScheme {
    public variableCodings: VariableCodingData[] = [];

    constructor(codings: any[] = []) {
        this.variableCodings = [];
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

    codeAndScore(sourceValues: Response[]): Response[] {
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

    public static copy(source: VariableCodingData): VariableCodingData {
        const dataSerialized = JSON.stringify(source); // decouple objects
        return JSON.parse(dataSerialized);
    }
}
