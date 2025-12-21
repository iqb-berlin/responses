import {
  CodeData,
  DeriveConcatDelimiter,
  ProcessingParameterType,
  SourceProcessingType,
  SourceType,
  VariableSourceParameters
} from '@iqbspecs/coding-scheme';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { CodeAsText, CodingToTextMode } from './coding-interfaces';
import { CodingFactory } from './coding-factory';

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

export abstract class ToTextFactory {
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
        // eslint-disable-next-line max-len
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
    const codeType = code.type || 'UNSET';
    const codeLabel =
      codeType === 'UNSET' ? code.label : CODE_LABEL_BY_TYPE[codeType];
    return <CodeAsText>{
      id: code.id === null ? 'null' : code.id.toString(10),
      score: code.score,
      label:
        mode === 'SIMPLE' && codeType !== 'UNSET' ?
          codeLabel?.toUpperCase() :
          codeLabel,
      ruleSetOperatorAnd: code.ruleSetOperatorAnd,
      hasManualInstruction: !!code.manualInstruction,
      ruleSetDescriptions: code.ruleSets?.map((rs, i) => {
        let description =
          (code.ruleSets?.length || 0) > 1 && mode === 'EXTENDED' ?
            `Regelset ${i + 1}: ` :
            '';

        if (mode === 'EXTENDED') {
          if (!rs.rules || rs.rules.length === 0) {
            return `${description}Keine Regeln definiert.`;
          }
        }

        switch (codeType) {
          case 'RESIDUAL':
          case 'RESIDUAL_AUTO':
            return `${description}Alle anderen Antworten.`;

          case 'INTENDED_INCOMPLETE':
            return `${description}Kodierung soll unvollständig sein.`;

          default:
            break;
        }

        rs.rules.forEach((r, j) => {
          if (rs.rules.length > 1) {
            description +=
              mode === 'EXTENDED' ? `${j > 0 ? '; ' : ''}(R${j + 1}) ` : '';
          }
          switch (r.method) {
            case 'MATCH':
            case 'MATCH_REGEX':
              if (r.parameters?.[0] && typeof r.parameters[0] === 'string') {
                const parameter = r.parameters[0];
                if (mode === 'SIMPLE') {
                  if (r.method === 'MATCH') {
                    description += parameter.replace(/[\r\n]/g, '\nODER\n');
                  } else {
                    // Note: MATCH_REGEX is ignored in 'SIMPLE'-mode.
                  }
                } else {
                  const formattedParameter = parameter.replace(/\n/g, "', '");
                  const ruleText =
                    CODE_RULE_TEXT[r.method] || 'Unbekannte Regel';
                  description += `${ruleText} '${formattedParameter}'`;
                }
              } else {
                description += 'FALSCHE PARAMETERZAHL/TYPFEHLER';
              }
              break;
            case 'NUMERIC_MATCH':
            case 'NUMERIC_LESS_THAN':
            case 'NUMERIC_MORE_THAN':
            case 'NUMERIC_MAX':
            case 'NUMERIC_MIN':
              if (r.parameters?.length === 1) {
                const compareValue = CodingFactory.getValueAsNumber(
                  r.parameters[0]
                );
                description +=
                  compareValue === null ?
                    'VERGLEICHSWERT NICHT NUMERISCH' :
                    `${CODE_RULE_TEXT[r.method]} '${compareValue}'`;
              } else {
                description += 'FALSCHE PARAMETERZAHL';
              }

              break;
            case 'NUMERIC_RANGE':
              if (r.parameters?.length === 2) {
                const [lowerLimit, upperLimit] = r.parameters.map(
                  CodingFactory.getValueAsNumber
                );
                if (lowerLimit === null || upperLimit === null) {
                  description += 'VERGLEICHSWERT NICHT NUMERISCH';
                } else if (lowerLimit >= upperLimit) {
                  description += 'VERGLEICHSWERTE UNGÜLTIG';
                } else {
                  description +=
                    `${CODE_RULE_TEXT.NUMERIC_MORE_THAN} '${lowerLimit}' und ` +
                    `${CODE_RULE_TEXT.NUMERIC_MAX} '${upperLimit}'`;
                }
              }
              break;
            case 'NUMERIC_FULL_RANGE':
              if (r.parameters?.length === 2) {
                const [compareValueLL, compareValueUL] = r.parameters.map(
                  CodingFactory.getValueAsNumber
                );
                if (compareValueLL === null || compareValueUL === null) {
                  description += 'VERGLEICHSWERT NICHT NUMERISCH';
                } else if (compareValueLL >= compareValueUL) {
                  description += 'VERGLEICHSWERTE UNGÜLTIG';
                } else {
                  description +=
                    `${CODE_RULE_TEXT.NUMERIC_MIN} '${compareValueLL}' und ` +
                    `${CODE_RULE_TEXT.NUMERIC_MAX} '${compareValueUL}'`;
                }
              }
              break;
            case 'IS_EMPTY':
            case 'IS_NULL':
            case 'IS_TRUE':
            case 'IS_FALSE':
              description += `${CODE_RULE_TEXT[r.method]}`;
              break;
            default:
              description += `${
                description.length > 0 ? '; ' : ''
              }Problem: unbekannte Regel '${r.method}'`;
          }
          if (typeof r.fragment === 'number' && r.fragment >= 0) {
            description += ` - F${r.fragment + 1}`;
          }

          const hasMultipleRules = rs.rules.length > 1;
          const isNotLastRule = rs.rules.length > j + 1;

          if (mode === 'SIMPLE' && hasMultipleRules && isNotLastRule) {
            const nextRule = rs.rules[j + 1];
            const isDifferentMethod = nextRule.method !== 'MATCH_REGEX';

            if (isDifferentMethod) {
              const operator = rs.ruleOperatorAnd ? 'UND' : 'ODER';
              description += `\n\n${operator}\n\n`;
            }
          }
        });
        const connectText =
          rs.rules.length > 1 && mode === 'EXTENDED' ?
            `${rs.ruleOperatorAnd ? 'UND' : 'ODER'}-Verknüpfung` :
            '';

        const arrayPosMapping: Record<string, string> = {
          SUM: 'A S',
          LENGTH: 'A L',
          ANY_OPEN: 'A O'
        };

        const arrayPosText =
          typeof rs.valueArrayPos === 'number' && rs.valueArrayPos >= 0 ?
            `A${rs.valueArrayPos + 1}` :
            (typeof rs.valueArrayPos === 'string' ?
              arrayPosMapping[rs.valueArrayPos] :
              '') || '';

        if (connectText || arrayPosText) {
          description += ` (${connectText}${
            connectText && arrayPosText ? '; ' : ''
          }${arrayPosText})`;
        }

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
