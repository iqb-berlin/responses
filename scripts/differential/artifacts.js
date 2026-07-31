const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { canonicalize } = require('./protocol');

const repositoryRoot = resolve(__dirname, '..', '..');

function safeVersion(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function artifactDirectory(profile, seed) {
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const directory = join(repositoryRoot, 'artifacts', 'differential', `${profile}-${seed}-${timestamp}`);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function writeJson(directory, name, value) {
  writeFileSync(join(directory, name), `${JSON.stringify(canonicalize(value), null, 2)}\n`);
}

function writeOriginal(directory, failure) {
  writeJson(directory, 'original.request.json', failure.request);
  writeJson(directory, 'typescript.original.result.json', failure.typescript);
  writeJson(directory, 'dotnet.original.result.json', failure.dotnet);
  writeJson(directory, 'original.diff.json', failure.difference);
}

function writeFinal(directory, details) {
  writeJson(directory, 'minimized.request.json', details.minimized.request);
  writeJson(directory, 'typescript.result.json', details.minimized.typescript);
  writeJson(directory, 'dotnet.result.json', details.minimized.dotnet);
  writeJson(directory, 'diff.json', details.minimized.difference);
  writeJson(directory, 'replay.json', {
    protocolVersion: 1,
    generatorVersion: 1,
    profile: details.profile,
    seed: details.seed,
    path: details.path,
    numRuns: details.numRuns,
    numShrinks: details.numShrinks,
    gitSha: process.env.GITHUB_SHA || safeVersion('git', ['rev-parse', 'HEAD']),
    nodeVersion: process.version,
    dotnetVersion: safeVersion(process.platform === 'win32' ? 'dotnet.exe' : 'dotnet', ['--version'])
  });
  writeFileSync(join(directory, 'dotnet.stderr.txt'), details.stderr || '');
}

module.exports = { artifactDirectory, writeFinal, writeOriginal };
