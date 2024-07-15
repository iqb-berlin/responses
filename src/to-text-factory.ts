import {
  CodeAsText,
  CodeData, CodingToTextMode,
  DeriveConcatDelimiter,
  ProcessingParameterType,
  SourceType,
  VariableInfo,
  VariableSourceParameters
} from './coding-interfaces';
import { CodingFactory } from './coding-factory';

const VARINFO_TYPE_TEXT = {
  string: 'String/Text',
  integer: 'Ganze Zahl',
  number: 'Zahl (Fließkoma)',
  boolean: 'Ja/Nein',
  attachment: 'Datei'
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
  'math-table': 'Tabelle mit Zahlen für Rechenkästchen (JSON)'
};

const CODE_RULE_TEXT = {
  MATCH: 'Übereinstimmung (Zahl/Text) mit',
  MATCH_REGEX: 'Übereinstimmung (reg. Ausdruck) mit',
  NUMERIC_MATCH: 'Übereinstimmung (numerisch) mit',
  NUMERIC_RANGE: '..Kombi..',
  NUMERIC_LESS_THAN: 'Wert geringer als',
  NUMERIC_MORE_THAN: 'Wert größer als',
  NUMERIC_MAX: 'Wert ist maximal als',
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
  RESIDUAL: 'falsch',
  RESIDUAL_AUTO: 'falsch'
};

export abstract class ToTextFactory {
  static sourceAsText(variableId: string,
                      sourceType: SourceType,
                      sources: string[],
                      parameters?: VariableSourceParameters): string {
    let returnText;
    switch (sourceType) {
      case 'BASE': {
        const parameterTextsBase: string[] = [];
        if (parameters && parameters.processing && parameters.processing.includes('TAKE_DISPLAYED_AS_VALUE_CHANGED')) {
          parameterTextsBase.push('stets als geändert gesehen');
        }
        if (parameters && parameters.processing && parameters.processing.includes('TAKE_EMPTY_AS_VALID')) {
          parameterTextsBase.push('leerer Wert ist gültig');
        }
        const parameterTextBase = parameterTextsBase.length > 0 ? ` (${parameterTextsBase.join('; ')})` : '';
        returnText = `Basisvariable '${variableId}'${parameterTextBase}`;
        break;
      }
      case 'COPY_VALUE':
        if (sources && sources.length > 0) {
          returnText = `Kopie von Variable '${sources[0]}'`;
        } else {
          returnText = 'Kopie, aber keine Quelle angegeben';
        }
        break;
      case 'CONCAT_CODE': {
        const parameterTextConcatCodeSolver = parameters && parameters.processing &&
        parameters.processing.includes('SORT') ? ' (sortiert)' : '';
        returnText = `Codes von Variablen '${
          // eslint-disable-next-line max-len
          sources.join(', ')}' aneinandergehängt mit Trennzeichen '${DeriveConcatDelimiter}'${parameterTextConcatCodeSolver}`;
        break;
      }
      case 'SUM_CODE':
        returnText = `Codes von Variablen '${sources.join(', ')}' summiert`;
        break;
      case 'UNIQUE_VALUES': {
        const parameterTextsUniqueValues: string[] = [];
        if (parameters && parameters.processing && parameters.processing.includes('REMOVE_ALL_SPACES')) {
          parameterTextsUniqueValues.push('alle Leerzeichen werden entfernt');
        }
        if (parameters && parameters.processing && parameters.processing.includes('REMOVE_DISPENSABLE_SPACES')) {
          parameterTextsUniqueValues.push('alle Leerzeichen vorn und hinten sowie die doppelten werden entfernt');
        }
        if (parameters && parameters.processing && parameters.processing.includes('TO_NUMBER')) {
          parameterTextsUniqueValues.push('Umwandlung vorher in numerischen Wert');
        }
        if (parameters && parameters.processing && parameters.processing.includes('TO_LOWER_CASE')) {
          parameterTextsUniqueValues.push('Umwandlung vorher in Kleinbuchstaben');
        }
        const parameterTextUniqueValues = parameterTextsUniqueValues.length > 0 ?
          ` (${parameterTextsUniqueValues.join('; ')})` : '';
        // eslint-disable-next-line max-len
        returnText = `Prüft, ob die Werte der Variablen '${sources.join(', ')}' unique/einzigartig sind${parameterTextUniqueValues}`;
        break;
      }
      case 'SOLVER': {
        const parameterTextSolver = parameters && parameters.solverExpression ?
          `"${parameters.solverExpression}"` : 'FEHLT';
        // eslint-disable-next-line max-len
        returnText = `Werte von Variablen '${sources.join(', ')}' werden über einen mathematischen Ausdruck verknüpft (Ausdruck: ${parameterTextSolver})`;
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

  static processingAsText(processing: ProcessingParameterType[], fragmenting?: string): string {
    let returnText = '';
    if (processing && processing.length > 0) {
      returnText = '';
      processing.forEach((t, i) => {
        switch (t) {
          case 'REPLAY_REQUIRED':
            returnText += `${i > 0 ? ', ' : ''
            }Zur Kodierung ist muss die Antwort mit der Aufgabe angezeigt werden (Replay)`;
            break;
          case 'IGNORE_CASE':
            returnText += `${i > 0 ? ', ' : ''}Groß-/Kleinschreibung wird ignoriert`;
            break;
          case 'IGNORE_ALL_SPACES':
            returnText += `${i > 0 ? ', ' : ''}Entfernen aller Leerzeichen vor Kodierung`;
            break;
          case 'IGNORE_DISPENSABLE_SPACES':
            returnText += `${i > 0 ? ', ' : ''}Entfernen unnötiger Leerzeichen vor Kodierung`;
            break;
          case 'SORT_ARRAY':
            returnText += `${i > 0 ? ', ' : ''}Sortieren von Listenwerten vor Kodierung`;
            break;
          case 'ATTACHMENT':
            returnText += `${i > 0 ? ', ' : ''}Zur Kodierung ist eine separate Datei erforderlich (Bild, Audio)`;
            break;
          default:
            returnText += `${i > 0 ? ', ' : ''}?? unbekannter Wer für Prozessparameter '${t}'`;
        }
      });
    }
    if (fragmenting) {
      if (returnText.length > 0) returnText += '; ';
      // eslint-disable-next-line max-len
      returnText += `Es wurde ein Ausdruck festgelegt, mit dem Teile der Antwort
        vor der Kodierung extrahiert werden (Fragmentierung): '${fragmenting}'`;
    }
    return returnText;
  }

  static codeAsText(code: CodeData, mode: CodingToTextMode = 'EXTENDED'): CodeAsText {
    const codeLabel = code.type === 'UNSET' ? code.label : CODE_LABEL_BY_TYPE[code.type];
    return <CodeAsText>{
      id: code.id === null ? 'null' : code.id.toString(10),
      score: code.score,
      label: mode === 'SIMPLE' && code.type !== 'UNSET' ? codeLabel.toUpperCase() : codeLabel,
      ruleSetOperatorAnd: code.ruleSetOperatorAnd,
      hasManualInstruction: !!code.manualInstruction,
      ruleSetDescriptions: code.ruleSets.map((rs, i) => {
        let description = (code.ruleSets.length > 1) && mode === 'EXTENDED' ? `Regelset ${i + 1}: ` : '';
        if ((!rs.rules || rs.rules.length === 0) && mode === 'EXTENDED') return `${description}Keine Regeln definiert.`;
        if (['RESIDUAL_AUTO', 'RESIDUAL'].indexOf(code.type) >= 0) return `${description}Alle anderen Antworten`;

        rs.rules.forEach((r, j) => {
          if (rs.rules.length > 1) description += mode === 'EXTENDED' ? `${j > 0 ? '; ' : ''}(R${j + 1}) ` : '';
          switch (r.method) {
            case 'MATCH':
            case 'MATCH_REGEX':
              if (r.parameters && r.parameters[0] && typeof r.parameters[0] === 'string') {
                if (mode === 'SIMPLE') {
                  if (r.method === 'MATCH') description += r.parameters[0].replace(/\\n/g, '\nODER\n');
                  // MATCH_REGEX will be ignored!
                } else {
                  description += `${CODE_RULE_TEXT[r.method]} '${r.parameters[0].replace('\n', '\', \'')}'`;
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
              if (r.parameters && r.parameters.length === 1) {
                const compareValue = CodingFactory.getValueAsNumber(r.parameters[0]);
                if (compareValue === null) {
                  description += 'VERGLEICHSWERT NICHT NUMERISCH';
                } else {
                  description += `${CODE_RULE_TEXT[r.method]} '${compareValue}'`;
                }
              } else {
                description += 'FALSCHE PARAMETERZAHL';
              }
              break;
            case 'NUMERIC_RANGE':
              if (r.parameters && r.parameters.length === 2) {
                const compareValueLL = CodingFactory.getValueAsNumber(r.parameters[0]);
                const compareValueUL = CodingFactory.getValueAsNumber(r.parameters[1]);
                if (compareValueLL === null || compareValueUL === null) {
                  description += 'VERGLEICHSWERT NICHT NUMERISCH';
                } else if (compareValueLL >= compareValueUL) {
                  description += 'VERGLEICHSWERTE UNGÜLTIG';
                } else {
                  // eslint-disable-next-line max-len
                  description += `${CODE_RULE_TEXT.NUMERIC_MORE_THAN} '${compareValueLL}' und ${CODE_RULE_TEXT.NUMERIC_MAX} '${compareValueUL}'`;
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
              description += `${description.length > 0 ? '; ' : ''
              }Problem: unbekannte Regel '${r.method}'`;
          }
          if (typeof r.fragment === 'number' && r.fragment >= 0) description += ` - F${r.fragment + 1}`;
          if (mode === 'SIMPLE' && rs.rules.length > 1 && rs.rules.length > j + 1) {
            description += `\n\n${rs.ruleOperatorAnd ? 'UND' : 'ODER'}\n\n`;
          }
        });
        const connectText = (rs.rules.length > 1) && mode === 'EXTENDED' ?
          `${rs.ruleOperatorAnd ? 'UND' : 'ODER'}-Verknüpfung` : '';
        let arrayPosText = '';
        if (typeof rs.valueArrayPos === 'number' && rs.valueArrayPos >= 0) {
          arrayPosText = `A${rs.valueArrayPos + 1}`;
        } else if (rs.valueArrayPos === 'SUM') {
          arrayPosText = 'A S';
        }
        if (connectText || arrayPosText) {
          description += ` (${connectText}${connectText && arrayPosText ? '; ' : ''}${arrayPosText})`;
        }

        return description;
      })
    };
  }

  static varInfoAsText(varInfo: VariableInfo): string[] {
    const returnText: string[] = [];
    let typeString = `Datentyp: ${VARINFO_TYPE_TEXT[varInfo.type] || `unbekannt "${varInfo.type}"`}`;
    if (varInfo.format) {
      typeString += `; Format: ${VARINFO_FORMAT_TEXT[varInfo.format] || `unbekannt "${varInfo.format}"`}`;
    }
    if (varInfo.multiple) typeString += '; Liste/mehrfach';
    if (varInfo.nullable) typeString += '; "null"-Wert möglich';
    returnText.push(typeString);
    const valueText = `Mögliche Werte: ${varInfo.values.map(v => {
      let vTxt = '"';
      if (typeof v.value === 'number') {
        vTxt += v.value.toString(10);
      } else if (typeof v.value === 'string') {
        vTxt += v.value;
      } else {
        vTxt += v.value ? 'Ja/Wahr' : 'Nein/Falsch';
      }
      vTxt += `"${v.label ? ` - ${v.label}` : ''}`;
      return vTxt;
    }).join('; ')}`;
    returnText.push(valueText);
    if (varInfo.valuePositionLabels && varInfo.valuePositionLabels.length > 0) {
      returnText.push(`Bezeichnungen der Werte-Positionen in der Liste: ${varInfo.valuePositionLabels.join('; ')}`);
    }
    if (varInfo.valuesComplete) {
      returnText.push('Es sind keine anderen als die gelisteten Werte möglich (geschlossenes Format).');
    }
    if (varInfo.page) returnText.push(`Variable ist auf Seite "${varInfo.page}" verortet`);
    return returnText;
  }
}
