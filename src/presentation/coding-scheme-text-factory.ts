import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingAsText, CodingToTextMode } from '../coding-interfaces';
import { ToTextFactory } from './to-text-factory';

export abstract class CodingSchemeTextFactory {
  static asText(
    variableCodings: VariableCodingData[],
    mode: CodingToTextMode = 'EXTENDED'
  ): CodingAsText[] {
    return variableCodings.map(coding => {
      const mappedSources = (coding.deriveSources ?? []).map(
        source => variableCodings.find(vc => vc.alias === source)?.alias || source
      );

      return {
        id: coding.alias || coding.id,
        label: coding.label || '',
        source: ToTextFactory.sourceAsText(
          coding.alias || coding.id,
          coding.sourceType,
          mappedSources,
          coding.sourceParameters
        ),
        processing: ToTextFactory.processingAsText(
          coding.processing || [],
          coding.fragmenting
        ),
        hasManualInstruction: Boolean(coding.manualInstruction),
        codes: (coding.codes || []).map(code => ToTextFactory.codeAsText(code, mode)
        )
      };
    });
  }
}
