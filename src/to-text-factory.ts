import {
  CodeAsText, CodeData, DeriveConcatDelimiter, ProcessingParameterType, SourceType, VariableInfo
} from './coding-interfaces';

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

export abstract class ToTextFactory {
  static sourceAsText(variableId: string, sourceType: SourceType, sources: string[]): string {
    let returnText;
    switch (sourceType) {
      case 'BASE':
        returnText = `Basisvariable '${variableId}'`;
        break;
      case 'COPY_FIRST_VALUE':
        if (sources && sources.length > 0) {
          returnText = `Kopie von Variable '${sources[0]}'`;
        } else {
          returnText = 'Kopie, aber keine Quelle angegeben';
        }
        break;
      case 'CONCAT_CODE':
        returnText = `Codes von Variablen '${
          sources.join(', ')}' aneinandergehängt mit Trennzeichen '${DeriveConcatDelimiter}'`;
        break;
      case 'SUM_CODE':
        returnText = `Codes von Variablen '${sources.join(', ')}' summiert`;
        break;
      case 'SUM_SCORE':
        returnText = `Scores von Variablen '${sources.join(', ')}' summiert`;
        break;
      default:
        returnText = 'Unbekannte Quelle';
    }
    return returnText;
  }

  static processingAsText(processings: ProcessingParameterType[]): string {
    let returnText = '';
    if (processings && processings.length > 0) {
      returnText = '';
      processings.forEach((t, i) => {
        switch (t) {
          case 'REPLAY_REQUIRED':
            returnText += `${i > 0 ? ', ' : ''
            }Zur Kodierung ist muss die Antwort mit der Aufgabe angezeigt werden (Replay)`;
            break;
          case 'IGNORE_CASE':
            returnText += `${i > 0 ? ', ' : ''}Groß-/Kleinschreibung wird ignoriert`;
            break;
          case 'REMOVE_WHITE_SPACES':
            returnText += `${i > 0 ? ', ' : ''}Entfernen von Leerzeichen vor Kodierung`;
            break;
          case 'ATTACHMENT':
            returnText += `${i > 0 ? ', ' : ''}Zur Kodierung ist eine separate Datei erforderlich (Bild, Audio)`;
            break;
          case 'SPLIT_POSINT_POSINT_STRING':
            returnText += `${i > 0 ? ', ' : ''}Vor der Kodierung wird versucht, den Wert in drei separate Werte aufzuteilen: positive Ganzzahl, positive Ganzzahl und Text`;
            break;
          case 'SPLIT_FLOAT_STRING':
            returnText += `${i > 0 ? ', ' : ''}Vor der Kodierung wird versucht, den Wert in zwei separate Werte aufzuteilen: Fließkommazahl und Text`;
            break;
          default:
            returnText += `${i > 0 ? ', ' : ''}?? unbekannter Wer für Prozessparameter`;
        }
      });
    }
    return returnText;
  }

  static codeAsText(code: CodeData): CodeAsText {
    const codeText: CodeAsText = {
      code: code.id,
      score: code.score,
      scoreLabel: '',
      label: code.label,
      hasManualInstruction: !!code.manualInstruction,
      description: ''
    };
    const matchTexts: string[] = [];
    const matchRegexTexts: string[] = [];
    code.rules.forEach(r => {
      let parameterOk = false;
      switch (r.method) {
        case 'MATCH':
          if (r.parameters) {
            r.parameters.forEach(p => {
              matchTexts.push(...p.split('\n'));
            });
          }
          break;
        case 'MATCH_REGEX':
          if (r.parameters) {
            r.parameters.forEach(p => {
              matchRegexTexts.push(...p.split('\n'));
            });
          }
          break;
        case 'NUMERIC_RANGE':
          parameterOk = false;
          if (r.parameters && r.parameters.length === 2) {
            const compareValueLL = Number.parseFloat(r.parameters[0]);
            const compareValueUL = Number.parseFloat(r.parameters[1]);
            if (!Number.isNaN(compareValueLL) && !Number.isNaN(compareValueUL) && compareValueLL < compareValueUL) {
              codeText.description += `${codeText.description.length > 0 ? '; ' : ''
              }Wert ist größer als ${compareValueLL} und kleiner oder gleich ${compareValueUL}`;
              parameterOk = true;
            }
          }
          if (!parameterOk) {
            codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Problem mit Regelparameter`;
          }
          break;
        case 'NUMERIC_LESS_THEN':
          parameterOk = false;
          if (r.parameters && r.parameters.length === 1) {
            const compareValue = Number.parseFloat(r.parameters[0]);
            if (!Number.isNaN(compareValue)) {
              codeText.description += `${codeText.description.length > 0 ? '; ' : ''
              }Wert ist kleiner als ${compareValue}`;
              parameterOk = true;
            }
          }
          if (!parameterOk) {
            codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Problem mit Regelparameter`;
          }
          break;
        case 'NUMERIC_MORE_THEN':
          parameterOk = false;
          if (r.parameters && r.parameters.length === 1) {
            const compareValue = Number.parseFloat(r.parameters[0]);
            if (!Number.isNaN(compareValue)) {
              codeText.description += `${codeText.description.length > 0 ? '; ' : ''
              }Wert ist größer als ${compareValue}`;
              parameterOk = true;
            }
          }
          if (!parameterOk) {
            codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Problem mit Regelparameter`;
          }
          break;
        case 'NUMERIC_MAX':
          parameterOk = false;
          if (r.parameters && r.parameters.length === 1) {
            const compareValue = Number.parseFloat(r.parameters[0]);
            if (!Number.isNaN(compareValue)) {
              codeText.description += `${codeText.description.length > 0 ? '; ' : ''
              }Wert ist maximal gleich ${compareValue}`;
              parameterOk = true;
            }
          }
          if (!parameterOk) {
            codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Problem mit Regelparameter`;
          }
          break;
        case 'NUMERIC_MIN':
          parameterOk = false;
          if (r.parameters && r.parameters.length === 1) {
            const compareValue = Number.parseFloat(r.parameters[0]);
            if (!Number.isNaN(compareValue)) {
              codeText.description += `${codeText.description.length > 0 ? '; ' : ''
              }Wert ist mindestens gleich ${compareValue}`;
              parameterOk = true;
            }
          }
          if (!parameterOk) {
            codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Problem mit Regelparameter`;
          }
          break;
        case 'IS_EMPTY':
          codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Wert ist leer`;
          break;
        case 'ELSE':
          codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Alle anderen Werte`;
          break;
        case 'IS_NULL':
          codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Technischer Wert 'NULL'`;
          break;
        case 'IS_TRUE':
          codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Logischer Wert 'WAHR'`;
          break;
        case 'IS_FALSE':
          codeText.description += `${codeText.description.length > 0 ? '; ' : ''}Logischer Wert 'FALSCH'`;
          break;
        default:
          codeText.description += `${codeText.description.length > 0 ? '; ' : ''
          }Problem: unbekannte Regel '${r.method}'`;
      }
    });
    if (matchTexts.length > 0) {
      codeText.description += `${codeText.description.length > 0 ? '; ' : ''
      }Übereinstimmung mit: '${matchTexts.join('\', \'')}'`;
    }
    if (matchRegexTexts.length > 0) {
      codeText.description += `${codeText.description.length > 0 ? '; ' : ''
      }Übereinstimmung (match regex) mit: '${matchRegexTexts.join('\', \'')}'`;
    }
    return codeText;
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
