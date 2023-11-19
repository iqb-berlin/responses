import {CodeData, CodeModel, SourceType, ValueTransformation, VariableCodingData} from "./coding-scheme/coding-scheme";
import {VariableInfo} from "./variable-list/variable-list";

export abstract class CodingFactory {
    public static createCodingVariableFromVarInfo(varInfo: VariableInfo): VariableCodingData {
        let returnVariable: VariableCodingData = {
            id: varInfo.id,
            label: "",
            
        }
    }
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
