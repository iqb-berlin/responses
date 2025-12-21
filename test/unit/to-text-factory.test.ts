import {
  ProcessingParameterType,
  SourceType,
  VariableSourceParameters
} from '@iqbspecs/coding-scheme/coding-scheme.interface';
import { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';
import { ToTextFactory } from '../../src';

describe('ToTextFactory', () => {
  describe('sourceAsText', () => {
    test('BASE includes processing annotations', () => {
      const parameters: VariableSourceParameters = {
        processing: ['TAKE_EMPTY_AS_VALID', 'TAKE_DISPLAYED_AS_VALUE_CHANGED']
      } as unknown as VariableSourceParameters;
      const text = ToTextFactory.sourceAsText(
        'var1',
        'BASE' as SourceType,
        [],
        parameters
      );
      expect(text).toContain("Basisvariable 'var1'");
      expect(text).toContain('leerer Wert ist gültig');
      expect(text).toContain('stets als geändert gesehen');
    });

    test('COPY_VALUE without source returns fallback text', () => {
      const text = ToTextFactory.sourceAsText(
        'x',
        'COPY_VALUE' as SourceType,
        []
      );
      expect(text).toBe('Kopie, aber keine Quelle angegeben');
    });
  });

  describe('processingAsText', () => {
    test('unknown processing value is reported', () => {
      const text = ToTextFactory.processingAsText([
        '__UNKNOWN__' as unknown as ProcessingParameterType
      ]);
      expect(text).toContain(
        "?? unbekannter Wert für Prozessparameter '__UNKNOWN__'"
      );
    });

    test('fragmenting appends fragmenting description', () => {
      const text = ToTextFactory.processingAsText([], '([0-9]+)');
      expect(text).toContain('Fragmentierung');
      expect(text).toContain("'([0-9]+)'");
    });
  });

  describe('varInfoAsText', () => {
    test('renders type/format/multiple/nullable and values', () => {
      const varInfo: VariableInfo = {
        id: 'v1',
        label: 'Var 1',
        type: 'string',
        format: 'latex',
        multiple: true,
        nullable: true,
        values: [
          { value: 'A', label: 'Alpha' },
          { value: 2, label: 'Two' },
          { value: true, label: 'Yes' }
        ],
        valuesComplete: true,
        valuePositionLabels: ['pos1', 'pos2'],
        page: 'P1'
      } as unknown as VariableInfo;

      const lines = ToTextFactory.varInfoAsText(varInfo);

      expect(lines[0]).toContain('Datentyp:');
      expect(lines[0]).toContain('String/Text');
      expect(lines[0]).toContain('Mathematische Formel im LaTeX-Format');
      expect(lines[0]).toContain('Liste/mehrfach');
      expect(lines[0]).toContain('"null"-Wert möglich');

      expect(lines.join('\n')).toContain('Mögliche Werte:');
      expect(lines.join('\n')).toContain('"A - Alpha"');
      expect(lines.join('\n')).toContain('"2 - Two"');
      expect(lines.join('\n')).toContain('"Ja/Wahr - Yes"');

      expect(lines.join('\n')).toContain(
        'Bezeichnungen der Werte-Positionen in der Liste'
      );
      expect(lines.join('\n')).toContain('geschlossenes Format');
      expect(lines.join('\n')).toContain('Variable ist auf Seite "P1"');
    });
  });
});
