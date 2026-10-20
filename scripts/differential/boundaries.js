const assert = require('node:assert/strict');

function assertBoundary(boundary, result) {
  const label = `Boundary '${boundary.id}'`;
  switch (boundary.expectation) {
    case 'must-match':
      assert.equal(result.difference, null, `${label} differs at ${result.difference?.path}.`);
      break;
    case 'must-reject':
      for (const runtime of ['typescript', 'dotnet']) {
        const calls = result[runtime].calls;
        assert.ok(calls?.length > 0, `${label} has no ${runtime} call results.`);
        assert.ok(calls.every(call => call.outcome.kind === 'error'),
          `${label} was not rejected by ${runtime}.`);
      }
      break;
    case 'runtime-specific':
      for (const runtime of ['typescript', 'dotnet']) {
        const calls = boundary.expectedCalls?.[runtime];
        assert.ok(Array.isArray(calls) && calls.length > 0,
          `${label} needs explicit ${runtime} expectations.`);
        assert.deepEqual(result[runtime], {
          protocolVersion: boundary.request.protocolVersion,
          kind: 'result',
          id: boundary.request.id,
          calls
        }, `${label} changed its ${runtime} behavior.`);
      }
      break;
    default:
      assert.fail(`${label} has unknown expectation '${boundary.expectation}'.`);
  }
}

module.exports = { assertBoundary };
