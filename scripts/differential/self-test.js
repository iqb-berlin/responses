const assert = require('node:assert/strict');
const fc = require('fast-check');
const { materialize, modelArbitrary } = require('./generators');
const { compareWithSolverTolerance, ulpDistance } = require('./numeric-comparison');
const { canonicalJson } = require('./protocol');
const { WorkerClient } = require('./worker-client');

const readyLine = `${JSON.stringify({
  protocolVersion: 1,
  kind: 'ready',
  capabilities: []
})}\n`;

async function assertWorkerFailureModes() {
  const timeoutWorker = await new WorkerClient({
    command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(readyLine)}); process.stdin.resume();`],
    timeoutMs: 50
  }).start();
  try {
    await assert.rejects(
      timeoutWorker.execute({ protocolVersion: 1, kind: 'case', input: {}, calls: [] }),
      /did not respond/
    );
  } finally {
    await timeoutWorker.close();
  }

  const abortWorker = await new WorkerClient({
    command: process.execPath,
    args: [
      '-e',
      `process.stdout.write(${JSON.stringify(readyLine)}); process.stdin.once('data', () => process.exit(17));`
    ],
    timeoutMs: 1000
  }).start();
  await assert.rejects(
    abortWorker.execute({ protocolVersion: 1, kind: 'case', input: {}, calls: [] }),
    /exited with code 17/
  );
  assert.equal(abortWorker.closed, true);
}

async function main() {
  assert.equal(ulpDistance(1, 1.0000000000000002), 1n);
  assert.equal(ulpDistance(1, 1.0000000000000004), 2n);
  assert.equal(ulpDistance(Number.POSITIVE_INFINITY, 1), null);

  const toleranceRequest = {
    input: {
      variableCodings: [{
        sourceType: 'SOLVER',
        sourceParameters: { solverExpression: 'sin(4)' }
      }]
    },
    calls: [{ op: 'deriveValue', codingIndex: 0 }]
  };
  const resultWithValue = value => ({
    calls: [{
      op: 'deriveValue',
      outcome: { kind: 'value', value: { id: 'x', status: 'VALUE_CHANGED', value } },
      diagnostics: []
    }]
  });
  const oneUlp = compareWithSolverTolerance(
    toleranceRequest,
    resultWithValue(1),
    resultWithValue(1.0000000000000002)
  );
  assert.equal(oneUlp.difference, null);
  assert.equal(oneUlp.tolerated.length, 1);
  assert.notEqual(
    compareWithSolverTolerance(
      toleranceRequest,
      resultWithValue(1),
      resultWithValue(1.0000000000000004)
    ).difference,
    null
  );
  assert.notEqual(
    compareWithSolverTolerance(
      { ...toleranceRequest, calls: [{ op: 'code' }] },
      resultWithValue(1),
      resultWithValue(1.0000000000000002)
    ).difference,
    null
  );
  const statusMismatch = resultWithValue(1.0000000000000002);
  statusMismatch.calls[0].outcome.value.status = 'DERIVE_ERROR';
  assert.notEqual(
    compareWithSolverTolerance(
      toleranceRequest,
      resultWithValue(1),
      statusMismatch
    ).difference,
    null
  );

  const first = fc.sample(modelArbitrary, { seed: 123456, numRuns: 25 })
    .map(model => canonicalJson(materialize(model, 'portable-valid-scheme').request));
  const second = fc.sample(modelArbitrary, { seed: 123456, numRuns: 25 })
    .map(model => canonicalJson(materialize(model, 'portable-valid-scheme').request));
  assert.deepEqual(first, second, 'The same seed must generate byte-identical requests.');

  const shrink = fc.check(
    fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 5, maxLength: 20 }), values =>
      !values.includes(7)),
    { seed: 424242, numRuns: 1000 }
  );
  assert.equal(shrink.failed, true, 'Injected mismatch must be detected.');
  assert.ok(shrink.numShrinks > 0, 'Injected mismatch must be minimized.');

  const worker = await new WorkerClient({ timeoutMs: 5000 }).start();
  try {
    assert.ok(worker.capabilities.includes('code'));
    const malformed = await worker.executeRaw('{');
    assert.equal(malformed.kind, 'error');
    assert.equal(malformed.outcome.category, 'INVALID_REQUEST');

    const unknown = await worker.execute({
      protocolVersion: 1,
      kind: 'case',
      id: 'self-test:unknown-operation',
      input: { baseVariables: [], variableCodings: [], responses: [] },
      calls: [{ op: 'unknownOperation' }]
    });
    assert.equal(unknown.calls[0].outcome.category, 'INVALID_OPERATION');

    const recovery = await worker.execute({
      protocolVersion: 1,
      kind: 'case',
      id: 'self-test:recovery',
      input: {
        baseVariables: [],
        variableCodings: [],
        responses: [{ id: 'x', status: 'VALUE_CHANGED', value: '' }]
      },
      calls: [{ op: 'isEmptyValue', responseIndex: 0 }]
    });
    assert.equal(recovery.calls[0].outcome.value, true);
  } finally {
    await worker.close();
  }
  assert.equal(worker.closed, true, 'Closing stdin must let the worker terminate on EOF.');
  await assertWorkerFailureModes();
  console.log('Differential protocol, deterministic generation and shrinking self-test passed.');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
