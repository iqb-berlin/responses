const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join, resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const behavior = require('./behavior.cjs');

const root = process.cwd();
const hostRequire = createRequire(join(root, 'package.json'));
const report = join(root, 'qualification');
mkdirSync(report, { recursive: true });
const record = (name, value) => writeFileSync(join(report, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
function frontendFiles(directory = join(root, 'dist/apps/frontend')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? frontendFiles(join(directory, entry.name)) : [join(directory, entry.name)]);
}
function size() {
  const files = frontendFiles().filter(file => file.endsWith('.js'));
  return { files: files.length, totalJavaScriptBytes: files.reduce((sum, file) => sum + readFileSync(file).length, 0) };
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'baseline') {
    record('baseline', { responses: hostRequire('@iqb/responses/package.json').version, ...size() });
  } else if (mode === 'runtime') {
    const expected = require('../../package.json').version;
    assert.equal(hostRequire('@iqb/responses/package.json').version, expected);
    const commonjs = behavior(hostRequire('@iqb/responses'));
    assert.ok(!hostRequire.resolve('@iqb/responses').includes('/esm/'), 'Node must select CommonJS');
    const esbuild = hostRequire('esbuild');
    const result = await esbuild.build({
      absWorkingDir: root,
      stdin: { contents: `import * as responses from '@iqb/responses'; export const result = (${behavior.toString()})(responses);`,
        resolveDir: root, sourcefile: 'responses-consumer.js' },
      bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', globalName: 'Consumer'
    });
    assert.ok(Object.keys(result.metafile.inputs).some(file => file.includes('@iqb/responses/esm/')),
      'Browser must select ESM');
    const context = { console, URL, TextEncoder, TextDecoder };
    runInNewContext(result.outputFiles[0].text, context, { timeout: 30000 });
    assert.deepEqual(JSON.parse(JSON.stringify(context.Consumer.result)), commonjs);
    record('runtime', { version: expected, commonjs, browser: context.Consumer.result });
  } else if (mode === 'bundle') {
    const stats = frontendFiles().find(file => file.endsWith('/stats.json'));
    assert.ok(stats, 'Angular must emit its build statistics');
    const metadata = readFileSync(stats, 'utf8');
    writeFileSync(join(report, 'bundle-stats.json'), metadata);
    record('candidate', { responses: hostRequire('@iqb/responses/package.json').version, ...size() });
    console.log('Responses bundle inputs:', Object.keys(JSON.parse(metadata).inputs || {})
      .filter(file => file.includes('@iqb/responses')));
    assert.ok(metadata.includes('@iqb/responses/esm/'), 'The real host frontend must use Responses ESM');
  } else if (mode === 'startup') {
    const child = spawn(process.execPath, ['--require', join(__dirname, 'initialize-test-database.cjs'),
      resolve(root, 'dist/apps', process.argv[3], 'main.js')], { cwd: root, env: process.env });
    let output = '';
    let childError;
    let exited = false;
    child.on('error', error => { childError = error; });
    child.on('exit', () => { exited = true; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
    try {
      const deadline = Date.now() + 60000;
      let status;
      while (Date.now() < deadline && !exited && !childError) {
        try {
          const response = await fetch('http://127.0.0.1:3333/api', { signal: AbortSignal.timeout(1000) });
          status = response.status;
          break;
        } catch { await new Promise(resolveDelay => setTimeout(resolveDelay, 500)); }
      }
      assert.ok(status && !exited && !childError, `Backend did not listen: ${childError || output}`);
      record('startup', { status, infrastructure: 'disposable PostgreSQL and Redis; schema synchronized for this smoke test' });
    } finally {
      writeFileSync(join(report, 'startup.log'), output);
      child.kill('SIGTERM');
      if (!exited) {
        await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)),
          new Promise(resolveDelay => setTimeout(resolveDelay, 5000))]);
        if (!exited) child.kill('SIGKILL');
      }
    }
  } else throw new Error(`Unknown qualification mode: ${mode}`);
  console.log(`Consumer ${mode} passed.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
