// Copied into a fresh tarball consumer by verify-package.js.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as esm from '@iqb/responses';
import { CodingScheme } from '@iqbspecs/coding-scheme';

const require = createRequire(import.meta.url);
const commonjs = require('@iqb/responses');
const reference = require('@iqb/responses-reference');
assert.equal(require('@iqb/responses-reference/package.json').version, '5.4.0');
assert.deepEqual(Object.keys(esm).sort(), [...Object.keys(commonjs)].sort());
assert.ok(import.meta.resolve('@iqb/responses').endsWith('/esm/index.js'));
assert.ok(require.resolve('@iqb/responses').endsWith('/responses/index.js'));

for (const path of ['coding-factory', 'coding-factory.js', 'value-transform',
  'derive/derive-value', 'presentation', 'presentation/to-text-factory']) {
  const imported = await import(`@iqb/responses/${path}`);
  const required = require(`@iqb/responses/${path}`);
  assert.deepEqual(Object.keys(imported).sort(), Object.keys(required).sort(), path);
}

const base = { id: 'a', alias: 'A', sourceType: 'BASE', codes: [] };
const expressions = [
  '${A}+1', 'round(${A}/3,2)', 'ceil(${A})', '${A}==0 ? 1:0',
  'abs(complex(${A},4))', 'number(unit(${A},"cm"),"mm")',
  'sum([${A},1,2])', 'number(bignumber("0.1")+bignumber("0.2"))',
  'number(fraction(1,3))', 'det([[1,2],[3,4]])', 'null', '${A}/0', '${A}+'
];
let derivations = 0;
const statuses = {};
for (const expression of expressions) {
  for (const value of [0, 1e-15, 3, -5, null, 'abc']) {
    for (const status of ['VALUE_CHANGED', 'CODING_COMPLETE', 'INVALID']) {
      const target = { id: 'd', alias: 'D', sourceType: 'SOLVER', deriveSources: ['a'],
        sourceParameters: { processing: [], solverExpression: expression } };
      const args = [[base, target], target, [{ id: 'a', status, value }]];
      const result = esm.CodingSchemeFactory.deriveValue(...structuredClone(args));
      statuses[result.status] = (statuses[result.status] || 0) + 1;
      assert.deepEqual(result,
        commonjs.CodingSchemeFactory.deriveValue(...structuredClone(args)),
        JSON.stringify({ expression, value, status }));
      assert.deepEqual(result, reference.CodingSchemeFactory.deriveValue(...structuredClone(args)),
        `published 5.4.0: ${JSON.stringify({ expression, value, status })}`);
      derivations += 1;
    }
  }
}

// Comparing two emit formats alone could hide a shared packaging error.
const solver = expression => esm.CodingSchemeFactory.deriveValue([base, {
  id: 'd', alias: 'D', sourceType: 'SOLVER', deriveSources: ['a'],
  sourceParameters: { processing: [], solverExpression: expression }
}], { id: 'd', alias: 'D', sourceType: 'SOLVER', deriveSources: ['a'],
  sourceParameters: { processing: [], solverExpression: expression }
}, [{ id: 'a', status: 'VALUE_CHANGED', value: 3 }]);
assert.equal(solver('sum([${A},1,2])').value, 6);
assert.equal(solver('abs(complex(${A},4))').value, 5);
assert.equal(solver('number(unit(${A},"cm"),"mm")').value, 30);
assert.equal(solver('number(bignumber("0.1")+bignumber("0.2"))').value, 0.3);

assert.ok(statuses.VALUE_CHANGED > 0, 'SOLVER expressions must actually evaluate');
assert.ok(statuses.DERIVE_ERROR > 0, 'error paths must also run');

const engines = { esm, commonjs, reference };
const legacyInfo = { id: ' old ', type: 'string', format: 'ggb-file', multiple: false,
  nullable: false, values: [], valuePositionLabels: [], page: 'P1', visualAnchor: 'widget' };
const currentInfo = { ...legacyInfo, id: ' current ', type: 'STRING', format: 'GGB_FILE' };
for (const [name, engine] of Object.entries({ esm, commonjs })) {
  const infos = Object.freeze([Object.freeze(legacyInfo), Object.freeze(currentInfo)]);
  const before = JSON.stringify(infos);
  assert.deepEqual(new engine.VariableList(infos).variables, new reference.VariableList(infos).variables, name);
  assert.deepEqual(engine.ToTextFactory.varInfoAsText(legacyInfo),
    reference.ToTextFactory.varInfoAsText(legacyInfo), name);
  assert.deepEqual(engine.ToTextFactory.varInfoAsText(currentInfo),
    engine.ToTextFactory.varInfoAsText(legacyInfo), name);
  assert.deepEqual(engine.ToTextFactory.varInfoAsText({ id: 'minimal', type: 'STRING',
    values: [{ value: 'A' }] }), ['Datentyp: String/Text', 'Mögliche Werte: "A"'], name);
  for (const type of ['STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'ATTACHMENT', 'JSON', 'NO_VALUE', 'CODED']) {
    const minimal = Object.freeze({ id: 'minimal', type });
    assert.equal(engine.ToTextFactory.varInfoAsText(minimal).length, 1, `${name}: ${type}`);
    assert.deepEqual(new engine.VariableList([minimal]).variables, [minimal], `${name}: ${type}`);
  }
  assert.equal(JSON.stringify(infos), before, `${name}: VariableInfo inputs must remain unchanged`);
}
const regexCases = [
  ['^[äöü]+$', 'äöü'], ['^(?=abc$)abc$', 'abc'], ['(?<=a)b', 'ab'],
  ['^(ab)\\1$', 'abab'], ['^\\u00e4$', 'ä'], ['^\\x61$', 'a']
];
for (const [pattern, value] of regexCases) {
  for (const [name, engine] of Object.entries(engines)) {
    const coding = engine.CodingFactory.createCodingVariable('text');
    coding.codes = [{ id: 1, type: 'FULL_CREDIT', score: 1,
      ruleSets: [{ rules: [{ method: 'MATCH_REGEX', parameters: [pattern] }] }] }];
    const info = [{ id: 'text', type: 'string', multiple: false, values: [], valuePositionLabels: [] }];
    assert.deepEqual(engine.CodingSchemeFactory.validate(info, [coding]), [], `${name}: ${pattern}`);
    const response = { id: 'text', status: 'VALUE_CHANGED', value };
    assert.deepEqual(engine.CodingFactory.code(response, coding),
      { ...response, status: 'CODING_COMPLETE', code: 1, score: 1 }, `${name}: ${pattern}`);
  }
}

let partialCreditCases = 0;
for (const sourceType of ['SUM_SCORE', 'SUM_CODE', 'CONCAT_CODE']) {
  for (const partial of [
    { status: 'DISPLAYED', value: null, option: 'TAKE_DISPLAYED_AS_ZERO_IF_PARTIAL' },
    ...[null, '', []].map(value =>
      ({ status: 'INVALID', value, option: 'TAKE_EMPTY_AS_ZERO_IF_PARTIAL' }))
  ]) {
    const coding = { id: 'd', sourceType, deriveSources: ['a', 'b'],
      sourceParameters: { processing: [partial.option] } };
    const sources = [{ id: 'a', status: 'CODING_COMPLETE', value: false, code: 0, score: 0 },
      { id: 'b', status: partial.status, value: partial.value }];
    const expected = reference.CodingSchemeFactory.deriveValue([], coding, structuredClone(sources));
    assert.equal(expected.status, 'VALUE_CHANGED');
    assert.equal(expected.value, sourceType === 'CONCAT_CODE' ? '0_x' : 0);
    for (const [name, engine] of Object.entries(engines)) {
      const input = structuredClone(sources);
      assert.deepEqual(engine.CodingSchemeFactory.deriveValue([], coding, input), expected,
        `${name}: ${sourceType}, ${partial.option}`);
      assert.deepEqual(input, sources, `${name}: partial-credit sources must remain unchanged`);
    }
    partialCreditCases++;
  }
}

let fixtures = 0;
function checkFolder(folder) {
  const files = readdirSync(folder, { withFileTypes: true });
  const scheme = files.find(file => file.name === 'coding-scheme.json');
  if (scheme) {
    const raw = JSON.parse(readFileSync(join(folder, scheme.name), 'utf8'));
    const variables = new CodingScheme(raw.variableCodings).variableCodings;
    for (const file of files.filter(item => item.name.endsWith('_input.json'))) {
      const input = JSON.parse(readFileSync(join(folder, file.name), 'utf8'));
      const actual = esm.CodingSchemeFactory.code(structuredClone(input), structuredClone(variables));
      const other = commonjs.CodingSchemeFactory.code(structuredClone(input), structuredClone(variables));
      const expected = JSON.parse(readFileSync(join(folder,
        file.name.replace('_input.json', '_outcome.json')), 'utf8'));
      assert.deepEqual(actual, other, join(folder, file.name));
      assert.deepEqual(actual,
        reference.CodingSchemeFactory.code(structuredClone(input), structuredClone(variables)),
        `published 5.4.0: ${join(folder, file.name)}`);
      assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, `golden: ${join(folder, file.name)}`);
      fixtures += 1;
    }
    assert.deepEqual(esm.CodingSchemeTextFactory.asText(variables, 'EXTENDED'),
      commonjs.CodingSchemeTextFactory.asText(variables, 'EXTENDED'));
  }
  for (const file of files.filter(item => item.isDirectory())) checkFolder(join(folder, file.name));
}
checkFolder(process.argv[2]);
assert.ok(fixtures > 0, 'golden coding fixtures must run');
console.log(JSON.stringify({ esmCommonjsDerivations: derivations, publishedReference: '5.4.0',
  goldenFixtures: fixtures, statuses,
  partialCreditCases, stableRegexCases: regexCases.length,
  deepImports: true, fullMathFeatures: true }));
