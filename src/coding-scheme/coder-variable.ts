import {CodingStatus, Response, ValueType} from "../response/response";
import {VariableCodingData} from "./coding-scheme";

export class CoderVariable implements Response {
    id: string;
    status: CodingStatus;
    value: string | number | boolean | string[] | number[] | boolean[] | null;
    code?: number;
    score?: number;
    codingScheme: VariableCodingData | null;

    constructor(sourceValue: Response | null, codingScheme: VariableCodingData | null) {
        this.id = '';
        if (sourceValue) {
            this.id = sourceValue.id;
            this.status = sourceValue.status;
            this.value = sourceValue.value;
            this.code = sourceValue.code;
            this.score = sourceValue.score;
        } else {
            this.status = 'UNSET';
            this.value = null;
        }
        this.codingScheme = null;
        if (codingScheme) {
            this.codingScheme = codingScheme;
            this.id = codingScheme.id;
            if (this.codingScheme?.sourceType !== 'BASE') this.status = 'SOURCE_MISSING';
        }
        if (!this.id) throw new RangeError();
    }

    deriveAndCode_changesMade(otherVariables: CoderVariable[]): boolean {
        const codingComplete = ['CODING_ERROR', 'DERIVE_ERROR', 'NO_CODING', 'CODING_INCOMPLETE', 'CODING_COMPLETE',
            'NOT_SET', 'NOT_REACHED', 'DISPLAYED'].indexOf(this.status) >= 0;
        if (codingComplete) {
            return false;
        } if (this.codingScheme) {
            if (this.codingScheme?.sourceType === 'BASE') {
                return this.code_changesMade();
            }
            const mySources: Response[] = [];
            this.codingScheme.deriveSources.forEach(source => {
                let newSource: Response | null = null;
                otherVariables.forEach(other => {
                    if (!newSource && other.id === source && this.codingScheme) {
                        if (other.status === 'CODING_COMPLETE' || (
                            this.codingScheme.deriveSourceType === 'VALUE' &&
                            ['SOURCE_MISSING', 'DERIVE_ERROR', 'NOT_SET', 'NOT_REACHED', 'DISPLAYED'].indexOf(other.status) < 0
                        )) {
                            newSource = {
                                id: other.id,
                                status: other.status,
                                value: other.value,
                                code: other.code,
                                score: other.score
                            };
                        }
                    }
                });
                if (newSource) mySources.push(newSource);
            });
            if (this.codingScheme.deriveSources.length > 0 && mySources.length === this.codingScheme.deriveSources.length) {
                const valuesToDerive: (string | number)[] = [];
                mySources.forEach(s => {
                    if (this.codingScheme) {
                        if (this.codingScheme.deriveSourceType === 'VALUE') {
                            valuesToDerive.push(s.value ? s.value.toString() : '');
                        } else if (this.codingScheme.deriveSourceType === 'CODE') {
                            valuesToDerive.push(s.code ? s.code : 0);
                        } else {
                            valuesToDerive.push(s.score ? s.score : 0);
                        }
                    }
                });
                if (this.codingScheme.sourceType === 'DERIVE_CONCAT') {
                    this.value = valuesToDerive.map(v => v.toString()).join('');
                    this.status = 'VALUE_DERIVED';
                    this.code_changesMade();
                    return true;
                }
                let newValue = 0;
                valuesToDerive.forEach(v => {
                    let valueAsNumber;
                    if (typeof v === 'number') {
                        valueAsNumber = v;
                    } else {
                        valueAsNumber = Number.parseFloat(v);
                        if (Number.isNaN(valueAsNumber)) this.status = 'DERIVE_ERROR';
                    }
                    if (this.status !== 'DERIVE_ERROR') newValue += valueAsNumber;
                });
                if (this.status === 'DERIVE_ERROR') {
                    return true;
                }
                this.value = newValue.toString();
                this.status = 'VALUE_DERIVED';
                this.code_changesMade();
                return true;
            }
            if (this.status === 'SOURCE_MISSING') {
                return false;
            }
            this.status = 'SOURCE_MISSING';
            return true;
        }
        this.status = 'NO_CODING';
        return true;
    }

    private code_changesMade(): boolean {
        let changed = false;
        if (this.codingScheme && this.codingScheme.codes.length > 0) {
            const valueToCheck = this.transformValue();
            if (typeof valueToCheck === 'string') {
                let hasElse = false;
                let elseCode = 0;
                let elseScore = 0;
                this.codingScheme?.codes.forEach(c => {
                    if (!changed) {
                        c.rules.forEach(r => {
                            if (!changed) {
                                const valueAsNumeric = this.checkValueForNumber();
                                // eslint-disable-next-line default-case
                                switch (r.method) {
                                    case 'ELSE':
                                        hasElse = true;
                                        elseCode = c.id;
                                        elseScore = c.score;
                                        break;
                                    case 'IS_EMPTY':
                                        if (valueToCheck === '') {
                                            this.code = c.id;
                                            this.score = c.score;
                                            this.status = 'CODING_COMPLETE';
                                            changed = true;
                                        }
                                        break;
                                    case 'MATCH':
                                        if (CoderVariable.getMatchStrings(r.parameters).indexOf(valueToCheck) >= 0) {
                                            this.code = c.id;
                                            this.score = c.score;
                                            this.status = 'CODING_COMPLETE';
                                            changed = true;
                                        }
                                        break;
                                    case 'MATCH_REGEX':
                                        CoderVariable.getMatchStrings(r.parameters).forEach(s => {
                                            const regEx = new RegExp(s);
                                            if (regEx.exec(valueToCheck)) {
                                                this.code = c.id;
                                                this.score = c.score;
                                                this.status = 'CODING_COMPLETE';
                                                changed = true;
                                            }
                                        });
                                        break;
                                    case 'NUMERIC_LESS_THEN':
                                        if (this.status === 'CODING_ERROR') {
                                            changed = true;
                                        } else {
                                            const compareValue = Number.parseFloat(r.parameters[0]);
                                            if (valueAsNumeric < compareValue) {
                                                this.code = c.id;
                                                this.score = c.score;
                                                this.status = 'CODING_COMPLETE';
                                                changed = true;
                                            }
                                        }
                                        break;
                                    case 'NUMERIC_MAX':
                                        if (this.status === 'CODING_ERROR') {
                                            changed = true;
                                        } else {
                                            const compareValue = Number.parseFloat(r.parameters[0]);
                                            if (valueAsNumeric <= compareValue) {
                                                this.code = c.id;
                                                this.score = c.score;
                                                this.status = 'CODING_COMPLETE';
                                                changed = true;
                                            }
                                        }
                                        break;
                                    case 'NUMERIC_MORE_THEN':
                                        if (this.status === 'CODING_ERROR') {
                                            changed = true;
                                        } else {
                                            const compareValue = Number.parseFloat(r.parameters[0]);
                                            if (valueAsNumeric > compareValue) {
                                                this.code = c.id;
                                                this.score = c.score;
                                                this.status = 'CODING_COMPLETE';
                                                changed = true;
                                            }
                                        }
                                        break;
                                    case 'NUMERIC_MIN':
                                        if (this.status === 'CODING_ERROR') {
                                            changed = true;
                                        } else {
                                            const compareValue = Number.parseFloat(r.parameters[0]);
                                            if (valueAsNumeric >= compareValue) {
                                                this.code = c.id;
                                                this.score = c.score;
                                                this.status = 'CODING_COMPLETE';
                                                changed = true;
                                            }
                                        }
                                        break;
                                    case 'NUMERIC_RANGE':
                                        if (this.status === 'CODING_ERROR') {
                                            changed = true;
                                        } else {
                                            const compareValueLL = Number.parseFloat(r.parameters[0]);
                                            const compareValueUL = Number.parseFloat(r.parameters[1]);
                                            if (valueAsNumeric > compareValueLL && valueAsNumeric <= compareValueUL) {
                                                this.code = c.id;
                                                this.score = c.score;
                                                this.status = 'CODING_COMPLETE';
                                                changed = true;
                                            }
                                        }
                                        break;
                                }
                            }
                        });
                    }
                });
                if (!changed) {
                    if (hasElse) {
                        this.code = elseCode;
                        this.score = elseScore;
                        this.status = 'CODING_COMPLETE';
                        changed = true;
                    } else {
                        this.code = 0;
                        this.score = 0;
                        this.status = 'CODING_INCOMPLETE';
                        changed = true;
                    }
                }
            }
        } else if (this.status !== 'NO_CODING') {
            this.status = 'NO_CODING';
            changed = true;
        }
        return changed;
    }

    private transformValue(): ValueType {
        let returnValue = this.value;
        if (typeof returnValue === 'string' && this.codingScheme) {
            if (this.codingScheme?.valueTransformations.indexOf('TO_UPPER') >= 0) {
                returnValue = returnValue.toUpperCase();
            }
            if (this.codingScheme?.valueTransformations.indexOf('REMOVE_WHITE_SPACES') >= 0) {
                returnValue = returnValue.trim();
            }
        }
        return returnValue;
    }

    private static getMatchStrings(parameter: string[]): string[] {
        let result: string[] = [];
        parameter.forEach(p => {
            result = result.concat(p.split('\n'));
        });
        return result;
    }

    private checkValueForNumber(): number {
        if (typeof this.value === 'string') {
            const colonValue = this.value.replace(',', '.');
            const parsed = Number.parseFloat(colonValue);
            if (Number.isNaN(parsed)) {
                this.status = 'CODING_ERROR';
                return 0;
            }
            return parsed;
        }
        this.status = 'CODING_ERROR';
        return 0;
    }
}
