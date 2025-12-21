import {
  CodeData,
  ProcessingParameterType,
  SourceType,
  VariableSourceParameters
} from '@iqbspecs/coding-scheme';
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

    test('unknown source type returns fallback', () => {
      const text = ToTextFactory.sourceAsText(
        'x',
        '__UNKNOWN__' as unknown as SourceType,
        []
      );
      expect(text).toBe('Unbekannte Quelle');
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

  describe('codeAsText', () => {
    test('uses type label mapping and uppercases in SIMPLE mode', () => {
      const code: CodeData = {
        id: 1,
        score: 2,
        type: 'FULL_CREDIT',
        ruleSetOperatorAnd: true,
        manualInstruction: '',
        ruleSets: [
          {
            ruleOperatorAnd: true,
            rules: [{ method: 'IS_EMPTY' }]
          }
        ]
      } as unknown as CodeData;

      const textSimple = ToTextFactory.codeAsText(code, 'SIMPLE');
      expect(textSimple.label).toBe('RICHTIG');

      const textExtended = ToTextFactory.codeAsText(code, 'EXTENDED');
      expect(textExtended.label).toBe('richtig');
    });

    test('EXTENDED includes rule set prefix when multiple ruleSets exist', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: false,
        ruleSets: [
          { ruleOperatorAnd: true, rules: [{ method: 'IS_NULL' }] },
          { ruleOperatorAnd: true, rules: [{ method: 'IS_EMPTY' }] }
        ]
      } as unknown as CodeData;

      const asText = ToTextFactory.codeAsText(code, 'EXTENDED');
      expect(asText.ruleSetDescriptions[0]).toContain('Regelset 1:');
      expect(asText.ruleSetDescriptions[1]).toContain('Regelset 2:');
    });

    test('EXTENDED renders numeric range and validates order', () => {
      const ok: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: true,
        ruleSets: [
          {
            ruleOperatorAnd: true,
            rules: [{ method: 'NUMERIC_RANGE', parameters: [1, 3] }]
          }
        ]
      } as unknown as CodeData;
      const okText = ToTextFactory.codeAsText(ok, 'EXTENDED')
        .ruleSetDescriptions[0];
      expect(okText).toContain("Wert größer als '1'");
      expect(okText).toContain("Wert ist maximal '3'");

      const invalid: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: true,
        ruleSets: [
          {
            ruleOperatorAnd: true,
            rules: [{ method: 'NUMERIC_RANGE', parameters: [3, 3] }]
          }
        ]
      } as unknown as CodeData;
      const invalidText = ToTextFactory.codeAsText(invalid, 'EXTENDED')
        .ruleSetDescriptions[0];
      expect(invalidText).toContain('VERGLEICHSWERTE UNGÜLTIG');
    });

    test('special code types ignore rules and return fixed text', () => {
      const residual: CodeData = {
        id: 1,
        score: 0,
        type: 'RESIDUAL',
        ruleSetOperatorAnd: true,
        ruleSets: [{ ruleOperatorAnd: true, rules: [{ method: 'IS_EMPTY' }] }]
      } as unknown as CodeData;
      expect(
        ToTextFactory.codeAsText(residual, 'EXTENDED').ruleSetDescriptions[0]
      ).toContain('Alle anderen Antworten.');

      const intendedIncomplete: CodeData = {
        id: 1,
        score: 0,
        type: 'INTENDED_INCOMPLETE',
        ruleSetOperatorAnd: true,
        ruleSets: [{ ruleOperatorAnd: true, rules: [{ method: 'IS_EMPTY' }] }]
      } as unknown as CodeData;
      expect(
        ToTextFactory.codeAsText(intendedIncomplete, 'EXTENDED')
          .ruleSetDescriptions[0]
      ).toContain('Kodierung soll unvollständig sein.');
    });

    test('EXTENDED appends connect and array position text', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: true,
        ruleSets: [
          {
            ruleOperatorAnd: true,
            valueArrayPos: 'SUM',
            rules: [{ method: 'IS_EMPTY' }, { method: 'IS_NULL' }]
          }
        ]
      } as unknown as CodeData;

      const text = ToTextFactory.codeAsText(code, 'EXTENDED')
        .ruleSetDescriptions[0];
      expect(text).toContain('UND-Verknüpfung');
      expect(text).toContain('A S');
    });

    test('SIMPLE inserts connectors between non-MATCH_REGEX rules', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: false,
        ruleSets: [
          {
            ruleOperatorAnd: false,
            rules: [
              { method: 'MATCH', parameters: ['a\nb'] },
              { method: 'IS_EMPTY' }
            ]
          }
        ]
      } as unknown as CodeData;

      const text = ToTextFactory.codeAsText(code, 'SIMPLE')
        .ruleSetDescriptions[0];
      expect(text).toContain('a');
      expect(text).toContain('ODER');
    });

    test('SIMPLE does not insert connector before MATCH_REGEX', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: false,
        ruleSets: [
          {
            ruleOperatorAnd: false,
            rules: [
              { method: 'IS_EMPTY' },
              { method: 'MATCH_REGEX', parameters: ['a'] }
            ]
          }
        ]
      } as unknown as CodeData;

      const text = ToTextFactory.codeAsText(code, 'SIMPLE')
        .ruleSetDescriptions[0];
      expect(text).not.toContain('\n\nODER\n\n');
      expect(text).toContain('Leerer Wert');
    });

    test('EXTENDED reports unknown rule method', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: false,
        ruleSets: [
          {
            ruleOperatorAnd: false,
            rules: [{ method: '__UNKNOWN__' }]
          }
        ]
      } as unknown as CodeData;

      const text = ToTextFactory.codeAsText(code, 'EXTENDED')
        .ruleSetDescriptions[0];
      expect(text).toContain("Problem: unbekannte Regel '__UNKNOWN__'");
    });

    test('EXTENDED numeric single-value rule reports wrong parameter count', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: false,
        ruleSets: [
          {
            ruleOperatorAnd: false,
            rules: [{ method: 'NUMERIC_MIN', parameters: [1, 2] }]
          }
        ]
      } as unknown as CodeData;

      const text = ToTextFactory.codeAsText(code, 'EXTENDED')
        .ruleSetDescriptions[0];
      expect(text).toContain('FALSCHE PARAMETERZAHL');
    });

    test('EXTENDED appends numeric array position as A<number>', () => {
      const code: CodeData = {
        id: 1,
        score: 0,
        type: 'UNSET',
        label: 'X',
        ruleSetOperatorAnd: false,
        ruleSets: [
          {
            ruleOperatorAnd: false,
            valueArrayPos: 0,
            rules: [{ method: 'IS_EMPTY' }]
          }
        ]
      } as unknown as CodeData;

      const text = ToTextFactory.codeAsText(code, 'EXTENDED')
        .ruleSetDescriptions[0];
      expect(text).toContain('(A1)');
    });
  });
});
