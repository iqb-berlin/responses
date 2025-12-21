import {
  CodeData,
  DeriveConcatDelimiter,
  ProcessingParameterType,
  SourceProcessingType,
  SourceType,
  VariableSourceParameters
} from '@iqbspecs/coding-scheme';
import { ResponseValueSingleType } from '@iqbspecs/response/response.interface';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodeAsText, CodingToTextMode } from '../coding-interfaces';
import { CodingFactory } from '../coding-factory';

const VARINFO_TYPE_TEXT = {
  string: 'String/Text',
  integer: 'Ganze Zahl',
  number: 'Zahl (Fließkoma)',
  boolean: 'Ja/Nein',
  attachment: 'Datei',
  json: 'Daten im JSON-Format',
  'no-value': 'Ohne Antwortwert'
};
const VARINFO_FORMAT_TEXT = {
  'text-selection': 'Textmarkierung',
  image: 'Bild',
  'capture-image': 'Foto',
  audio: 'Sprachaufnahme',
  'ggb-file': 'GeoGebra-Definition',
  'ggb-variable': 'GeoGebra-Variable',
  'non-negative': 'Nicht negativ',
  latex: 'Mathematische Formel im LaTeX-Format',
  'math-ml': 'Mathematische Formel im Html-Format, MathML eingebettet',
  'math-table': 'Tabelle mit Zahlen für Rechenkästchen (JSON)',
  'math-text-mix': 'Text und mathematische Formeln gemischt'
};

const CODE_RULE_TEXT = {
  MATCH: 'Übereinstimmung (Zahl/Text) mit',
  MATCH_REGEX: 'Übereinstimmung (reg. Ausdruck) mit',
  NUMERIC_MATCH: 'Übereinstimmung (numerisch) mit',
  NUMERIC_RANGE: '..Kombi..',
  NUMERIC_FULL_RANGE: '..Kombi..',
  NUMERIC_LESS_THAN: 'Wert geringer als',
  NUMERIC_MORE_THAN: 'Wert größer als',
  NUMERIC_MAX: 'Wert ist maximal',
  NUMERIC_MIN: 'Wert ist mindestens',
  IS_EMPTY: 'Leerer Wert',
  IS_NULL: 'Wert ist NULL',
  IS_TRUE: 'Wert ist WAHR',
  IS_FALSE: 'Wert ist FALSCH'
};

const CODE_LABEL_BY_TYPE = {
  UNSET: '-',
  FULL_CREDIT: 'richtig',
  PARTIAL_CREDIT: 'teilweise richtig',
  NO_CREDIT: 'falsch',
  TO_CHECK: 'zu prüfen',
  INTENDED_INCOMPLETE: 'absichtlich unvollständig',
  RESIDUAL: 'falsch',
  RESIDUAL_AUTO: 'falsch'
};

type RuleData = {
  method: string;
  parameters?: unknown[];
  fragment?: number;
};

export abstract class ToTextFactory {
  private static getCodeType(code: CodeData): string {
    return code.type || 'UNSET';
  }

  private static getCodeLabel(
    code: CodeData,
    mode: CodingToTextMode
  ): string | undefined {
    const codeType = ToTextFactory.getCodeType(code);
    const codeLabel =
      codeType === 'UNSET' ?
        code.label :
        (CODE_LABEL_BY_TYPE as Record<string, string>)[codeType];
    return mode === 'SIMPLE' && codeType !== 'UNSET' ?
      codeLabel?.toUpperCase() :
      codeLabel;
  }

  private static buildRuleSetPrefix(
    ruleSetCount: number,
    ruleSetIndex: number,
    mode: CodingToTextMode
  ): string {
    return ruleSetCount > 1 && mode === 'EXTENDED' ?
      `Regelset ${ruleSetIndex + 1}: ` :
      '';
  }

  private static buildEmptyRuleSetText(
    prefix: string,
    mode: CodingToTextMode,
    hasRules?: boolean
  ): string | null {
    if (mode !== 'EXTENDED') return null;
    if (hasRules) return null;
    return `${prefix}Keine Regeln definiert.`;
  }

  private static buildSpecialCodeTypeText(
    codeType: string,
    prefix: string
  ): string | null {
    switch (codeType) {
      case 'RESIDUAL':
      case 'RESIDUAL_AUTO':
        return `${prefix}Alle anderen Antworten.`;

      case 'INTENDED_INCOMPLETE':
        return `${prefix}Kodierung soll unvollständig sein.`;

      default:
        return null;
    }
  }

  private static appendMatchRuleText(
    description: string,
    method: string,
    parameter: string,
    mode: CodingToTextMode
  ): string {
    if (mode === 'SIMPLE') {
      if (method === 'MATCH') {
        return description + parameter.replace(/[\r\n]/g, '\nODER\n');
      }
      // Note: MATCH_REGEX is ignored in 'SIMPLE'-mode.
      return description;
    }

    const formattedParameter = parameter.replace(/\n/g, "', '");
    const ruleText =
      (CODE_RULE_TEXT as Record<string, string>)[method] || 'Unbekannte Regel';
    return `${description}${ruleText} '${formattedParameter}'`;
  }

  private static appendNumericSingleValueRuleText(
    description: string,
    method: string,
    parameters?: unknown[]
  ): string {
    if (parameters?.length === 1) {
      const compareValue = CodingFactory.getValueAsNumber(
        parameters[0] as ResponseValueSingleType
      );
      return (
        description +
        (compareValue === null ?
          'VERGLEICHSWERT NICHT NUMERISCH' :
          `${
            (CODE_RULE_TEXT as Record<string, string>)[method]
          } '${compareValue}'`)
      );
    }

    return `${description}FALSCHE PARAMETERZAHL`;
  }

  private static appendNumericRangeRuleText(
    description: string,
    method: string,
    parameters?: unknown[]
  ): string {
    if (parameters?.length !== 2) return description;

    const [lowerLimit, upperLimit] = parameters.map(v => CodingFactory.getValueAsNumber(v as ResponseValueSingleType)
    );
    if (lowerLimit === null || upperLimit === null) {
      return `${description}VERGLEICHSWERT NICHT NUMERISCH`;
    }
    if (lowerLimit >= upperLimit) {
      return `${description}VERGLEICHSWERTE UNGÜLTIG`;
    }

    if (method === 'NUMERIC_RANGE') {
      return (
        `${description}${CODE_RULE_TEXT.NUMERIC_MORE_THAN} '${lowerLimit}' und ` +
        `${CODE_RULE_TEXT.NUMERIC_MAX} '${upperLimit}'`
      );
    }

    return (
      `${description}${CODE_RULE_TEXT.NUMERIC_MIN} '${lowerLimit}' und ` +
      `${CODE_RULE_TEXT.NUMERIC_MAX} '${upperLimit}'`
    );
  }

  private static buildRuleIndexPrefix(
    hasMultipleRules: boolean,
    ruleIndex: number,
    mode: CodingToTextMode
  ): string {
    if (!hasMultipleRules) return '';
    return mode === 'EXTENDED' ?
      `${ruleIndex > 0 ? '; ' : ''}(R${ruleIndex + 1}) ` :
      '';
  }

  private static appendRuleText(
    description: string,
    rule: RuleData,
    ruleIndex: number,
    ruleCount: number,
    mode: CodingToTextMode
  ): string {
    const hasMultipleRules = ruleCount > 1;
    let text =
      description +
      ToTextFactory.buildRuleIndexPrefix(hasMultipleRules, ruleIndex, mode);

    switch (rule.method) {
      case 'MATCH':
      case 'MATCH_REGEX':
        if (rule.parameters?.[0] && typeof rule.parameters[0] === 'string') {
          text = ToTextFactory.appendMatchRuleText(
            text,
            rule.method,
            rule.parameters[0],
            mode
          );
        } else {
          text += 'FALSCHE PARAMETERZAHL/TYPFEHLER';
        }
        break;

      case 'NUMERIC_MATCH':
      case 'NUMERIC_LESS_THAN':
      case 'NUMERIC_MORE_THAN':
      case 'NUMERIC_MAX':
      case 'NUMERIC_MIN':
        text = ToTextFactory.appendNumericSingleValueRuleText(
          text,
          rule.method,
          rule.parameters
        );
        break;

      case 'NUMERIC_RANGE':
      case 'NUMERIC_FULL_RANGE':
        text = ToTextFactory.appendNumericRangeRuleText(
          text,
          rule.method,
          rule.parameters
        );
        break;

      case 'IS_EMPTY':
      case 'IS_NULL':
      case 'IS_TRUE':
      case 'IS_FALSE':
        text += `${(CODE_RULE_TEXT as Record<string, string>)[rule.method]}`;
        break;

      default:
        text += `${text.length > 0 ? '; ' : ''}Problem: unbekannte Regel '${
          rule.method
        }'`;
    }

    if (typeof rule.fragment === 'number' && rule.fragment >= 0) {
      text += ` - F${rule.fragment + 1}`;
    }

    return text;
  }

  private static appendSimpleModeConnectorIfNeeded(
    description: string,
    mode: CodingToTextMode,
    ruleCount: number,
    ruleIndex: number,
    ruleOperatorAnd: boolean,
    nextRuleMethod?: string
  ): string {
    const hasMultipleRules = ruleCount > 1;
    const isNotLastRule = ruleCount > ruleIndex + 1;
    if (mode !== 'SIMPLE' || !hasMultipleRules || !isNotLastRule) return description;

    const isDifferentMethod = nextRuleMethod !== 'MATCH_REGEX';
    if (!isDifferentMethod) return description;

    const operator = ruleOperatorAnd ? 'UND' : 'ODER';
    return `${description}\n\n${operator}\n\n`;
  }

  private static buildConnectAndArrayPosText(
    ruleCount: number,
    mode: CodingToTextMode,
    ruleOperatorAnd: boolean,
    valueArrayPos?: unknown
  ): string {
    const connectText =
      ruleCount > 1 && mode === 'EXTENDED' ?
        `${ruleOperatorAnd ? 'UND' : 'ODER'}-Verknüpfung` :
        '';

    const arrayPosMapping: Record<string, string> = {
      SUM: 'A S',
      LENGTH: 'A L',
      ANY_OPEN: 'A O'
    };

    const arrayPosText =
      typeof valueArrayPos === 'number' && valueArrayPos >= 0 ?
        `A${valueArrayPos + 1}` :
        (typeof valueArrayPos === 'string' ?
          arrayPosMapping[valueArrayPos] :
          '') || '';

    if (!connectText && !arrayPosText) return '';

    return ` (${connectText}${
      connectText && arrayPosText ? '; ' : ''
    }${arrayPosText})`;
  }

  static sourceAsText(
    variableId: string,
    sourceType: SourceType,
    sources: string[],
    parameters?: VariableSourceParameters
  ): string {
    let returnText;
    switch (sourceType) {
      case 'BASE': {
        const processingMessages: Record<string, string> = {
          TAKE_DISPLAYED_AS_VALUE_CHANGED: 'stets als geändert gesehen',
          TAKE_EMPTY_AS_VALID: 'leerer Wert ist gültig',
          TAKE_NOT_REACHED_AS_VALUE_CHANGED: 'stets als geändert gesehen'
        };

        const parameterTextsBase: string[] =
          parameters?.processing
            ?.filter(key => processingMessages[key])
            .map(key => processingMessages[key]) || [];

        const parameterTextBase =
          parameterTextsBase.length > 0 ?
            ` (${parameterTextsBase.join('; ')})` :
            '';

        returnText = `Basisvariable '${variableId}'${parameterTextBase}`;
        break;
      }
      case 'COPY_VALUE':
        returnText = sources?.length ?
          `Kopie von Variable '${sources[0]}'` :
          'Kopie, aber keine Quelle angegeben';
        break;
      case 'CONCAT_CODE': {
        const isSorted = parameters?.processing?.includes('SORT') ?
          ' (sortiert)' :
          '';
        const joinedSources = sources.join(', ');
        returnText =
          `Codes von Variablen '${joinedSources}' aneinandergehängt ` +
          `mit Trennzeichen '${DeriveConcatDelimiter}'${isSorted}`;
        break;
      }
      case 'SUM_CODE':
        returnText = `Codes von Variablen '${sources.join(', ')}' summiert`;
        break;
      case 'UNIQUE_VALUES': {
        const parameterProcessingMessages: Record<string, string> = {
          REMOVE_ALL_SPACES: 'alle Leerzeichen werden entfernt',
          REMOVE_DISPENSABLE_SPACES:
            'alle Leerzeichen vorn und hinten sowie die doppelten werden entfernt',
          TO_NUMBER: 'Umwandlung vorher in numerischen Wert',
          TO_LOWER_CASE: 'Umwandlung vorher in Kleinbuchstaben'
        };

        const parameterTextsUniqueValues = Object.entries(
          parameterProcessingMessages
        )
          .filter(([key]) => parameters?.processing?.includes(key as SourceProcessingType)
          )
          .map(([, message]) => message);

        const parameterTextUniqueValues =
          parameterTextsUniqueValues.length > 0 ?
            ` (${parameterTextsUniqueValues.join('; ')})` :
            '';

        returnText = `Prüft, ob die Werte der Variablen '${sources.join(
          ', '
        )}' unique/einzigartig sind${parameterTextUniqueValues}`;
        break;
      }
      case 'SOLVER': {
        const parameterTextSolver =
          parameters && parameters.solverExpression ?
            `"${parameters.solverExpression}"` :
            'FEHLT';
        returnText = `Werte von Variablen '${sources.join(
          ', '
        )}' werden über einen mathematischen Ausdruck verknüpft (Ausdruck: ${parameterTextSolver})`;
        break;
      }
      case 'SUM_SCORE':
        returnText = `Scores von Variablen '${sources.join(', ')}' summiert`;
        break;
      default:
        returnText = 'Unbekannte Quelle';
    }
    return returnText;
  }

  static processingAsText(
    processing: ProcessingParameterType[],
    fragmenting?: string
  ): string {
    const processDescriptions: Record<string, string> = {
      REPLAY_REQUIRED:
        'Zur Kodierung muss die Antwort mit der Aufgabe angezeigt werden (Replay)',
      IGNORE_CASE: 'Groß-/Kleinschreibung wird ignoriert',
      IGNORE_ALL_SPACES: 'Entfernen aller Leerzeichen vor Kodierung',
      IGNORE_DISPENSABLE_SPACES:
        'Entfernen unnötiger Leerzeichen vor Kodierung',
      SORT_ARRAY: 'Sortieren von Listenwerten vor Kodierung',
      ATTACHMENT:
        'Zur Kodierung ist eine separate Datei erforderlich (Bild, Audio)'
    };

    let returnText = '';
    if (processing && processing.length > 0) {
      returnText = processing
        .map(t => (processDescriptions[t] ?
          processDescriptions[t] :
          `?? unbekannter Wert für Prozessparameter '${t}'`)
        )
        .join(', ');
    }
    if (fragmenting) {
      if (returnText.length > 0) returnText += '; ';
      // eslint-disable-next-line max-len
      returnText += `Es wurde ein Ausdruck festgelegt, mit dem Teile der Antwort
        vor der Kodierung extrahiert werden (Fragmentierung): '${fragmenting}'`;
    }
    return returnText;
  }

  static codeAsText(
    code: CodeData,
    mode: CodingToTextMode = 'EXTENDED'
  ): CodeAsText {
    const label = ToTextFactory.getCodeLabel(code, mode);
    return <CodeAsText>{
      id: code.id === null ? 'null' : code.id.toString(10),
      score: code.score,
      ...(label !== undefined ? { label } : {}),
      ruleSetOperatorAnd: code.ruleSetOperatorAnd,
      hasManualInstruction: !!code.manualInstruction,
      ruleSetDescriptions: code.ruleSets?.map((rs, i) => {
        const codeType = ToTextFactory.getCodeType(code);
        const rules = rs.rules || [];
        let description = ToTextFactory.buildRuleSetPrefix(
          code.ruleSets?.length || 0,
          i,
          mode
        );

        const emptyRuleSetText = ToTextFactory.buildEmptyRuleSetText(
          description,
          mode,
          rules.length > 0
        );
        if (emptyRuleSetText) return emptyRuleSetText;

        const specialCodeTypeText = ToTextFactory.buildSpecialCodeTypeText(
          codeType,
          description
        );
        if (specialCodeTypeText) return specialCodeTypeText;

        rules.forEach((r, j) => {
          description = ToTextFactory.appendRuleText(
            description,
            r,
            j,
            rules.length,
            mode
          );

          const nextRuleMethod = rules[j + 1]?.method;
          description = ToTextFactory.appendSimpleModeConnectorIfNeeded(
            description,
            mode,
            rules.length,
            j,
            Boolean(rs.ruleOperatorAnd),
            nextRuleMethod
          );
        });

        description += ToTextFactory.buildConnectAndArrayPosText(
          rules.length,
          mode,
          Boolean(rs.ruleOperatorAnd),
          rs.valueArrayPos
        );

        return description;
      })
    };
  }

  static varInfoAsText(varInfo: VariableInfo): string[] {
    const returnText: string[] = [];

    // Helper function: Determine data type and format
    const buildTypeString = (): string => {
      const typeText =
        VARINFO_TYPE_TEXT[varInfo.type as keyof typeof VARINFO_TYPE_TEXT] ||
        `unbekannt "${varInfo.type}"`;
      const formatText = varInfo.format ?
        `; Format: ${
          VARINFO_FORMAT_TEXT[varInfo.format] ||
            `unbekannt "${varInfo.format}"`
        }` :
        '';
      const multipleText = varInfo.multiple ? '; Liste/mehrfach' : '';
      const nullableText = varInfo.nullable ? '; "null"-Wert möglich' : '';
      return `Datentyp: ${typeText}${formatText}${multipleText}${nullableText}`;
    };

    // Helper function to display possible values.
    const buildValueString = (): string => {
      const valuesText = varInfo.values
        .map(v => {
          let valueString: string;
          if (typeof v.value === 'number') {
            valueString = v.value.toString(10);
          } else if (typeof v.value === 'string') {
            valueString = v.value;
          } else {
            valueString = v.value ? 'Ja/Wahr' : 'Nein/Falsch';
          }
          const labelText = v.label ? ` - ${v.label}` : '';
          return `"${valueString}${labelText}"`;
        })
        .join('; ');
      return `Mögliche Werte: ${valuesText}`;
    };

    returnText.push(buildTypeString());

    if (varInfo.values.length > 0) {
      returnText.push(buildValueString());
    }

    if (varInfo.valuePositionLabels?.length > 0) {
      returnText.push(
        `Bezeichnungen der Werte-Positionen in der Liste: ${varInfo.valuePositionLabels.join(
          '; '
        )}`
      );
    }

    if (varInfo.valuesComplete) {
      returnText.push(
        'Es sind keine anderen als die gelisteten Werte möglich (geschlossenes Format).'
      );
    }

    if (varInfo.page) {
      returnText.push(`Variable ist auf Seite "${varInfo.page}" verortet`);
    }

    return returnText;
  }
}
