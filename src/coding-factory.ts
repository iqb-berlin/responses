import {CodeData, CodeModel, SourceType, ValueTransformation, VariableCodingData} from "./coding-scheme/coding-scheme";
import {VariableInfo} from "./variable-list/variable-list";
import {ValueType} from "./response/response";

export abstract class CodingFactory {
    public static createCodingVariableFromVarInfo(varInfo: VariableInfo): VariableCodingData {
        let newVariable: VariableCodingData = {
            id: varInfo.id,
            label: "",
            sourceType: "BASE",
            deriveSources: [],
            valueTransformations: [],
            manualInstruction: "",
            codeModel: null,
            codeModelParameters: [],
            codes: []
        }
        return newVariable
    }

    public static transformValue(value: ValueType, transformations: ValueTransformation[]): ValueType {
        // raises exceptions if transformation fails
        // todo: clone if array
        let newValue = value;
        if (typeof newValue === 'string' && transformations && transformations.length > 0) {
            if (transformations.indexOf('TO_UPPER') >= 0) {
                newValue = newValue.toUpperCase();
            }
            if (transformations.indexOf('REMOVE_WHITE_SPACES') >= 0) {
                newValue = newValue.trim();
            }
            if (transformations.indexOf('TO_NUMBER') >= 0) {
                newValue = Number.parseFloat(newValue.replace(',', '.'));
            }
        }
        return newValue;
    }
}

