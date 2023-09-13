import {Response} from "../response/response";
import {CoderVariable} from "./coder-variable";

export type RuleMethod = 'MATCH' | 'MATCH_REGEX' | 'NUMERIC_RANGE' | 'NUMERIC_LESS_THEN' | 'NUMERIC_MORE_THEN' |
    'NUMERIC_MAX' | 'NUMERIC_MIN' | 'IS_EMPTY' | 'ELSE';

export type ValueTransformation = 'TO_UPPER' | 'REMOVE_WHITE_SPACES' | 'DATE_TO_ISO' | 'TIME_TO_ISO';

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
    sourceType: 'BASE' | 'DERIVE_CONCAT' | 'DERIVE_SUM';
    deriveSources: string[];
    deriveSourceType: 'VALUE' | 'CODE' | 'SCORE';
    valueTransformations: ValueTransformation[];
    manualInstruction: string;
    codes: CodeData[];
}

export class ResponseScheme {
    public variableCodings: VariableCodingData[] = [];

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
}
