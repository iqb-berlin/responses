const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
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
      tarballPath
    ],
    { cwd: consumerDirectory, stdio: 'inherit' }
  );

  const runtimeCheck = [
    "const responses = require('@iqb/responses');",
    "for (const name of ['CodingFactory', 'CodingSchemeFactory', 'VariableList']) {",
    "  if (typeof responses[name] !== 'function') {",
    "    throw new Error(`Missing public export: ${name}`);",
    '  }',
    '}'
  ].join('\n');
  execFileSync(process.execPath, ['-e', runtimeCheck], {
    cwd: consumerDirectory,
    stdio: 'inherit'
  });

  writeFileSync(
    join(consumerDirectory, 'consumer.ts'),
    [
      "import { CodingFactory, CodingSchemeFactory, VariableList } from '@iqb/responses';",
      'void CodingFactory;',
      'void CodingSchemeFactory;',
      'void VariableList;'
    ].join('\n')
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
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
