const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, relative, resolve } = require('node:path');
const { CodingScheme } = require('@iqbspecs/coding-scheme');
const {
  CodingSchemeFactory,
  CodingSchemeTextFactory
} = require('../dist');

const repositoryRoot = resolve(__dirname, '..');
const fixtureRoot = join(repositoryRoot, 'test', 'coding');
const dotnetExecutable = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
const differentialProject = join(
  repositoryRoot,
  'dotnet',
  'differential',
  'Iqb.Responses.Differential',
  'Iqb.Responses.Differential.csproj'
);

const readJson = filePath => JSON.parse(readFileSync(filePath, 'utf8'));
const relativePath = filePath => relative(repositoryRoot, filePath).replaceAll('\\', '/');

function findFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory()
      ? findFiles(entryPath, predicate)
      : predicate(entry.name) ? [entryPath] : [];
  });
}

function createTypeScriptResults() {
  const result = {};
  const inputFiles = findFiles(fixtureRoot, name => name.endsWith('_input.json'))
    .sort();
  for (const inputPath of inputFiles) {
    const folder = dirname(inputPath);
    const schemeData = readJson(join(folder, 'coding-scheme.json'));
    const scheme = new CodingScheme(schemeData.variableCodings);
    result[relativePath(inputPath)] = CodingSchemeFactory.code(
      readJson(inputPath),
      scheme.variableCodings
    );
  }

  const textFiles = findFiles(
    fixtureRoot,
    name => name === 'coding-scheme.asText.json'
  ).sort();
  for (const textPath of textFiles) {
    const folder = dirname(textPath);
    const schemeData = readJson(join(folder, 'coding-scheme.json'));
    const scheme = new CodingScheme(schemeData.variableCodings);
    result[relativePath(textPath)] = CodingSchemeTextFactory.asText(
      scheme.variableCodings,
      'EXTENDED'
    );
  }
  return result;
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'iqb-responses-differential-'));
const dotnetOutput = join(temporaryRoot, 'dotnet-results.json');

try {
  execFileSync(
    dotnetExecutable,
    [
      'run',
      '--project', differentialProject,
      '--configuration', 'Release',
      '--no-build',
      '--', dotnetOutput
    ],
    { cwd: repositoryRoot, stdio: 'inherit' }
  );

  const typeScriptResults = JSON.parse(JSON.stringify(createTypeScriptResults()));
  const dotnetResults = readJson(dotnetOutput);
  assert.deepEqual(
    dotnetResults,
    typeScriptResults,
    'TypeScript and .NET returned different JSON structures.'
  );
  console.log(
    `TypeScript/.NET differential test passed for ${Object.keys(typeScriptResults).length} results.`
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
