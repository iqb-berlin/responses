// The same public behavior is exercised through Node CommonJS and bundled browser ESM.
module.exports = responses => {
  const { CodingFactory, CodingSchemeFactory, ToTextFactory } = responses;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  for (const [pattern, value] of [
    ['^[äöü]+$', 'äöü'], ['^(?=abc$)abc$', 'abc'], ['(?<=a)b', 'ab'],
    ['^(ab)\\1$', 'abab'], ['^\\u00e4$', 'ä'], ['^\\x61$', 'a']
  ]) {
    const coding = CodingFactory.createCodingVariable('text');
    coding.codes = [{ id: 1, type: 'FULL_CREDIT', score: 1,
      ruleSets: [{ rules: [{ method: 'MATCH_REGEX', parameters: [pattern] }] }] }];
    const info = [{ id: 'text', type: 'string', multiple: false, values: [], valuePositionLabels: [] }];
    check(CodingSchemeFactory.validate(info, [coding]).length === 0, `regex validation: ${pattern}`);
    const result = CodingFactory.code({ id: 'text', status: 'VALUE_CHANGED', value }, coding);
    check(result.status === 'CODING_COMPLETE' && result.code === 1 && result.score === 1,
      `regex coding: ${pattern}`);
  }
  const base = { id: 'a', alias: 'A', sourceType: 'BASE' };
  for (const [expression, expected] of [
    ['sum([${A},1,2])', 6], ['abs(complex(${A},4))', 5],
    ['number(unit(${A},"cm"),"mm")', 30],
    ['number(bignumber("0.1")+bignumber("0.2"))', 0.3]
  ]) {
    const target = { id: 'd', alias: 'D', sourceType: 'SOLVER', deriveSources: ['a'],
      sourceParameters: { processing: [], solverExpression: expression } };
    const result = CodingSchemeFactory.deriveValue([base, target], target,
      [{ id: 'a', status: 'VALUE_CHANGED', value: 3 }]);
    check(result.status === 'VALUE_CHANGED' && result.value === expected, `SOLVER: ${expression}`);
  }
  for (const [format, expected] of [
    ['CHEM_ELEMENT_SYMBOLS', 'Chemische Elementsymbole (durch Leerzeichen getrennt)'],
    ['chem-element-symbols', 'Chemische Elementsymbole (durch Leerzeichen getrennt)'],
    ['CHEM_MOLECULE', 'Molekül mit Bild (JSON)'], ['chem-molecule', 'Molekül mit Bild (JSON)']
  ]) {
    const info = { id: 'a', type: 'STRING', format, values: [], valuePositionLabels: [] };
    const before = JSON.stringify(info);
    check(ToTextFactory.varInfoAsText(info)[0].includes(expected), `chemistry: ${format}`);
    check(JSON.stringify(info) === before, 'VariableInfo payload changed');
  }
  for (const type of ['number', 'NUMBER']) {
    check(ToTextFactory.varInfoAsText({ id: 'a', type, values: [], valuePositionLabels: [] })[0] ===
      'Datentyp: Zahl (Fließkomma)', `floating-point label: ${type}`);
  }
  check(responses.normalizeVariableInfoType('no-value') === 'NO_VALUE', 'type normalization');
  check(responses.normalizeVariableInfoFormat('ggb-file') === 'GGB_FILE', 'format normalization');
  check(responses.normalizeVariableInfoType('Custom-Type') === 'Custom-Type', 'unknown type');
  return { regex: 6, solver: 4, chemistry: 4, floatingPoint: 2, normalization: 3 };
};

