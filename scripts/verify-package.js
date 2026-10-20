const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const repositoryRoot = resolve(__dirname, '..');
const distDirectory = join(repositoryRoot, 'dist');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const readJson = filePath => JSON.parse(readFileSync(filePath, 'utf8'));

const rootManifest = readJson(join(repositoryRoot, 'package.json'));
const publishManifest = readJson(join(distDirectory, 'package.json'));

assert.equal(
  publishManifest.version,
  rootManifest.version,
  'Published package version must match the root package version.'
);
assert.deepEqual(
  publishManifest.dependencies,
  rootManifest.dependencies,
  'Published package dependencies must match the root package dependencies.'
);

const temporaryRoot = mkdtempSync(join(tmpdir(), 'iqb-responses-package-'));

try {
  const packOutput = execFileSync(
    npmExecutable,
    ['pack', distDirectory, '--json', '--pack-destination', temporaryRoot],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit']
    }
  );
  const packResult = JSON.parse(packOutput);
  assert.equal(packResult.length, 1, 'Expected npm pack to create one tarball.');

  const tarballPath = join(temporaryRoot, packResult[0].filename);
  const consumerDirectory = join(temporaryRoot, 'consumer');
  mkdirSync(consumerDirectory);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ name: 'package-consumer', private: true }, null, 2)
  );

  execFileSync(
    npmExecutable,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarballPath,
      '@iqb/responses-reference@npm:@iqb/responses@5.4.0',
      '@iqbspecs/variable-info-v13@npm:@iqbspecs/variable-info@1.3.0',
      '@iqbspecs/variable-info-v14@npm:@iqbspecs/variable-info@1.4.0',
      ...(process.env.IQB_CODING_SCHEME_TARBALL ? [resolve(process.env.IQB_CODING_SCHEME_TARBALL)] : [])
    ],
    { cwd: consumerDirectory, stdio: 'inherit' }
  );

  const runtimeCheck = [
    "const assert = require('node:assert/strict');",
    "const responses = require('@iqb/responses');",
    "for (const name of ['CodingFactory', 'CodingSchemeFactory', 'VariableList']) {",
    "  if (typeof responses[name] !== 'function') {",
    "    throw new Error('Missing public export: ' + name);",
    '  }',
    '}',
    "const sources = [{id: 'a', status: 'CODING_COMPLETE', value: false, code: 0, score: 0},",
    "  {id: 'b', status: 'DISPLAYED', value: null}];",
    "const coding = {id: 'derived', sourceType: 'CONCAT_CODE', deriveSources: ['a', 'b'],",
    "  sourceParameters: {processing: ['TAKE_DISPLAYED_AS_ZERO_IF_PARTIAL']}};",
    'const result = responses.CodingSchemeFactory.deriveValue([], coding, sources);',
    "if (result.status !== 'VALUE_CHANGED' || result.value !== '0_x' || sources[1].status !== 'DISPLAYED') {",
    "  throw new Error('Packaged partial-credit derivation failed');",
    '}',
    'const regexCases = [',
    "  ['^[äöü]+$', 'äöü'], ['^(?=abc$)abc$', 'abc'], ['(?<=a)b', 'ab'],",
    "  ['^(ab)\\\\1$', 'abab'], ['^\\\\u00e4$', 'ä'], ['^\\\\x61$', 'a']",
    '];',
    'for (const [pattern, value] of regexCases) {',
    "  const variable = responses.CodingFactory.createCodingVariable('text');",
    "  variable.codes = [{id: 1, type: 'FULL_CREDIT', score: 1,",
    "    ruleSets: [{rules: [{method: 'MATCH_REGEX', parameters: [pattern]}]}]}];",
    "  const info = [{id: 'text', type: 'string', multiple: false, values: [], valuePositionLabels: []}];",
    '  assert.deepEqual(responses.CodingSchemeFactory.validate(info, [variable]), []);',
    "  const response = {id: 'text', status: 'VALUE_CHANGED', value};",
    '  assert.deepEqual(responses.CodingFactory.code(response, variable),',
    "    {...response, status: 'CODING_COMPLETE', code: 1, score: 1});",
    '}'
  ].join('\n');
  execFileSync(process.execPath, ['-e', runtimeCheck], {
    cwd: consumerDirectory,
    stdio: 'inherit'
  });

  copyFileSync(
    join(repositoryRoot, 'scripts/verify-esm-consumer.mjs'),
    join(consumerDirectory, 'verify-esm-consumer.mjs')
  );
  execFileSync(process.execPath, ['verify-esm-consumer.mjs', join(repositoryRoot, 'test/coding')], {
    cwd: consumerDirectory, stdio: 'inherit'
  });

  writeFileSync(
    join(consumerDirectory, 'consumer.ts'),
    [
      "import { CodingFactory, CodingSchemeFactory, VariableList } from '@iqb/responses';",
      'void CodingFactory;',
      'void CodingSchemeFactory;',
      'void VariableList;'
    ].join('\n') + '\n' + readFileSync(join(__dirname, 'variable-info-consumer.ts.txt'), 'utf8')
  );
  writeFileSync(
    join(consumerDirectory, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'commonjs',
          moduleResolution: 'node',
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: 'ES2020'
        },
        files: ['consumer.ts']
      },
      null,
      2
    )
  );

  const typescriptCompiler = require.resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [typescriptCompiler, '--project', 'tsconfig.json'], {
    cwd: consumerDirectory,
    stdio: 'inherit'
  });

  const source = [
    "import { CodingFactory, CodingSchemeFactory } from '@iqb/responses';",
    "import { CodingAsText } from '@iqb/responses/coding-interfaces';",
    "import { transformValue } from '@iqb/responses/value-transform.js';",
    "import { ToTextFactory } from '@iqb/responses/presentation';",
    'void CodingFactory; void CodingSchemeFactory; void transformValue; void ToTextFactory;',
    'const variables: CodingAsText[] = []; void variables;'
  ].join('\n');
  [
    ['node-esm', 'mts', 'NodeNext', 'NodeNext'],
    ['node-cjs', 'cts', 'NodeNext', 'NodeNext'],
    ['browser', 'mts', 'ES2020', 'bundler']
  ].forEach(([name, extension, module, moduleResolution]) => {
    writeFileSync(join(consumerDirectory, `${name}.${extension}`),
      source + '\n' + readFileSync(join(__dirname, 'variable-info-consumer.ts.txt'), 'utf8'));
    writeFileSync(join(consumerDirectory, `${name}.json`), JSON.stringify({
      compilerOptions: {
        module,
        moduleResolution,
        noEmit: true,
        strict: true,
        skipLibCheck: false,
        target: 'ES2020'
      },
      files: [`${name}.${extension}`]
    }));
    execFileSync(process.execPath, [typescriptCompiler, '--project', `${name}.json`], {
      cwd: consumerDirectory, stdio: 'inherit'
    });
  });
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
