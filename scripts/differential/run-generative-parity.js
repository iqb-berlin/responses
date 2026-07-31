const fc = require('fast-check');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { artifactDirectory, writeFinal, writeOriginal } = require('./artifacts');
const { evaluateTypeScript } = require('./evaluate-typescript');
const {
  ARRAY_POSITIONS,
  BOOLEAN_RULES,
  FAULTS,
  NUMERIC_RULES,
  SOURCE_TYPES,
  STATUSES,
  STRING_RULES,
  materialize,
  modelArbitrary
} = require('./generators');
const { canonicalize, firstDifference, signedSeed } = require('./protocol');
const { WorkerClient } = require('./worker-client');

const repositoryRoot = resolve(__dirname, '..', '..');
const profileDefinitions = [
  { name: 'portable-valid-scheme', runs: 7000, seed: 0x05220001 },
  { name: 'portable-valid-derive', runs: 3000, seed: 0x05220002 },
  { name: 'portable-invalid-scheme', runs: 4000, seed: 0x05220003 },
  { name: 'portable-invalid-response', runs: 3500, seed: 0x05220004 },
  { name: 'wire-factory', runs: 2500, seed: 0x05220005 }
];

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--profile') options.profile = argv[++index];
    else if (argument === '--seed') options.seed = Number(argv[++index]);
    else if (argument === '--path') options.path = argv[++index];
    else if (argument === '--case') options.caseFile = resolve(argv[++index]);
    else if (argument === '--runs') options.runs = Number(argv[++index]);
    else if (argument === '--multiplier') options.multiplier = Number(argv[++index]);
    else throw new Error(`Unknown argument '${argument}'.`);
  }
  return options;
}

function findJsonFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findJsonFiles(path) : entry.name.endsWith('.json') ? [path] : [];
  }).sort();
}

function increment(map, value) {
  if (value === undefined) return;
  map.set(String(value), (map.get(String(value)) || 0) + 1);
}

function collectCoverage(counters, coverage, id) {
  if (counters.ids.has(id)) return;
  counters.ids.add(id);
  for (const [name, values] of Object.entries(coverage)) {
    for (const value of values) increment(counters[name], value);
  }
}

function makeCounters() {
  return {
    ids: new Set(),
    sources: new Map(),
    rules: new Map(),
    statuses: new Map(),
    values: new Map(),
    arrayPositions: new Map(),
    faults: new Map()
  };
}

function assertCoverage(counters, totalRuns) {
  if (totalRuns < 20000) return;
  const expected = {
    sources: SOURCE_TYPES,
    rules: [...STRING_RULES, ...NUMERIC_RULES, ...BOOLEAN_RULES],
    statuses: STATUSES,
    arrayPositions: ARRAY_POSITIONS,
    faults: [...FAULTS, 'duplicate', 'unknown', 'missing', 'derived-input', 'status-value', 'alias-id']
  };
  const missing = [];
  for (const [group, values] of Object.entries(expected)) {
    for (const value of new Set(values)) {
      const count = counters[group].get(value) || 0;
      if (count < 50) missing.push(`${group}.${value}=${count}`);
    }
  }
  if (missing.length > 0) throw new Error(`Generator coverage floors failed: ${missing.join(', ')}`);
}

async function compare(worker, request) {
  const typescript = canonicalize(evaluateTypeScript(request));
  const dotnet = canonicalize(await worker.execute(request));
  return { request, typescript, dotnet, difference: firstDifference(typescript, dotnet) };
}

async function runRequestFiles(worker, directory, label) {
  const files = findJsonFiles(directory);
  for (const file of files) {
    const request = JSON.parse(readFileSync(file, 'utf8'));
    const result = await compare(worker, request);
    if (result.difference) {
      throw new Error(`${label} mismatch in ${file} at ${result.difference.path}`);
    }
  }
  if (files.length > 0) console.log(`${label}: ${files.length} case(s) passed.`);
}

async function runBoundaries(worker) {
  const manifestPath = join(repositoryRoot, 'test', 'differential', 'boundaries', 'manifest.json');
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let known = 0;
  for (const boundary of manifest.cases) {
    const result = await compare(worker, boundary.request);
    if (boundary.expectation === 'must-match' && result.difference) {
      throw new Error(`Boundary '${boundary.id}' differs at ${result.difference.path}.`);
    }
    if (boundary.expectation === 'must-reject') {
      const outcomes = [result.typescript, result.dotnet]
        .flatMap(response => response.calls || []).map(call => call.outcome);
      if (outcomes.some(outcome => outcome.kind !== 'error')) {
        throw new Error(`Boundary '${boundary.id}' was not rejected by both runtimes.`);
      }
    }
    if (boundary.expectation === 'known-divergence') {
      known++;
      console.log(result.difference
        ? `Known boundary divergence '${boundary.id}' observed.`
        : `Known boundary divergence '${boundary.id}' is now aligned; tighten the manifest.`);
    }
  }
  console.log(`Boundary manifest: ${manifest.cases.length} case(s), ${known} documented divergence(s).`);
}

async function runProfile(worker, definition, options, counters) {
  const multiplier = options.multiplier || Number(process.env.DIFF_RUN_MULTIPLIER || 1);
  const configuredRuns = options.runs || Math.round(definition.runs * multiplier);
  const totalOverride = Number(process.env.DIFF_CASE_LIMIT || 0);
  const totalDefined = profileDefinitions.reduce((sum, profile) => sum + profile.runs, 0);
  const runs = totalOverride > 0
    ? Math.max(1, Math.round(totalOverride * definition.runs / totalDefined))
    : configuredRuns;
  const fixedRuns = options.seed !== undefined ? runs : Math.round(runs * 0.9);
  const commitRuns = runs - fixedRuns;
  const commitSeed = signedSeed(`${process.env.GITHUB_SHA || 'local'}:${definition.name}`);
  const runsToExecute = [
    { count: fixedRuns, seed: options.seed ?? definition.seed, path: options.path },
    ...(commitRuns > 0 ? [{ count: commitRuns, seed: commitSeed }] : [])
  ];
  const started = Date.now();

  for (const current of runsToExecute) {
    let originalFailure;
    let directory;
    let latestFailure;
    const property = fc.asyncProperty(modelArbitrary, async model => {
      const generated = materialize(model, definition.name);
      collectCoverage(counters, generated.coverage, generated.request.id);
      const result = await compare(worker, generated.request);
      if (!result.difference) return true;
      latestFailure = result;
      if (!originalFailure) {
        originalFailure = result;
        directory = artifactDirectory(definition.name, current.seed);
        writeOriginal(directory, result);
      }
      return false;
    });
    const details = await fc.check(property, {
      numRuns: current.count,
      seed: current.seed,
      ...(current.path ? { path: current.path } : {}),
      endOnFailure: false
    });
    if (details.failed) {
      const minimizedGenerated = materialize(details.counterexample[0], definition.name);
      const minimized = await compare(worker, minimizedGenerated.request);
      writeFinal(directory, {
        profile: definition.name,
        seed: current.seed,
        path: details.counterexamplePath,
        numRuns: details.numRuns,
        numShrinks: details.numShrinks,
        minimized,
        stderr: worker.stderr
      });
      throw new Error(
        `${definition.name} differs at ${latestFailure.difference.path}. ` +
        `Replay minimized case with --case ${join(directory, 'minimized.request.json')}`
      );
    }
  }
  console.log(`${definition.name}: ${runs} case(s) passed in ${Date.now() - started} ms.`);
  return runs;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const worker = await new WorkerClient().start();
  try {
    if (options.caseFile) {
      const request = JSON.parse(readFileSync(options.caseFile, 'utf8'));
      const result = await compare(worker, request);
      if (result.difference) throw new Error(`Replay differs at ${result.difference.path}.`);
      console.log(`Replay passed: ${options.caseFile}`);
      return;
    }

    await runRequestFiles(
      worker,
      join(repositoryRoot, 'test', 'differential', 'regressions'),
      'Committed regressions'
    );
    await runBoundaries(worker);
    const selected = options.profile
      ? profileDefinitions.filter(profile => profile.name === options.profile)
      : profileDefinitions;
    if (selected.length === 0) throw new Error(`Unknown profile '${options.profile}'.`);
    const counters = makeCounters();
    let totalRuns = 0;
    for (const definition of selected) {
      totalRuns += await runProfile(worker, definition, options, counters);
    }
    assertCoverage(counters, totalRuns);
    console.log(`Generative TypeScript/.NET parity passed for ${totalRuns} case(s).`);
  } finally {
    await worker.close();
  }
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
