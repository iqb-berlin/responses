const { firstDifference } = require('./protocol');

/* eslint-disable no-bitwise -- IEEE-754 ULP comparison requires raw bit ordering. */

const TRANSCENDENTAL_FUNCTIONS = [
  'exp', 'log', 'log10', 'log2', 'sin', 'cos', 'tan',
  'asin', 'acos', 'atan', 'atan2', 'hypot'
];
const functionPattern = new RegExp(
  `\\b(?:${TRANSCENDENTAL_FUNCTIONS.join('|')})\\s*\\(`
);
const signMask = 0x8000000000000000n;
const allBits = 0xffffffffffffffffn;
const bits = new DataView(new ArrayBuffer(8));

function orderedBits(value) {
  bits.setFloat64(0, value, false);
  const raw = bits.getBigUint64(0, false);
  return (raw & signMask) === 0 ? raw | signMask : (~raw) & allBits;
}

function ulpDistance(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const leftBits = orderedBits(left);
  const rightBits = orderedBits(right);
  return leftBits >= rightBits ? leftBits - rightBits : rightBits - leftBits;
}

function compareWithSolverTolerance(request, typescript, dotnet) {
  const adjustedDotnet = JSON.parse(JSON.stringify(dotnet));
  const tolerated = [];
  (request.calls || []).forEach((call, index) => {
    if (call.op !== 'deriveValue') return;
    const coding = request.input?.variableCodings?.[call.codingIndex ?? 0];
    const expression = coding?.sourceParameters?.solverExpression || '';
    if (coding?.sourceType !== 'SOLVER' || !functionPattern.test(expression)) return;

    const typescriptValue = typescript.calls?.[index]?.outcome?.value?.value;
    const dotnetValue = dotnet.calls?.[index]?.outcome?.value?.value;
    if (typeof typescriptValue !== 'number' || typeof dotnetValue !== 'number') return;
    const distance = ulpDistance(typescriptValue, dotnetValue);
    if (distance === null || distance > 1n) return;

    if (!Object.is(typescriptValue, dotnetValue)) {
      adjustedDotnet.calls[index].outcome.value.value = typescriptValue;
      tolerated.push({
        path: `/calls/${index}/outcome/value/value`,
        distance: Number(distance),
        typescript: typescriptValue,
        dotnet: dotnetValue
      });
    }
  });
  return {
    difference: firstDifference(typescript, adjustedDotnet),
    tolerated
  };
}

module.exports = {
  TRANSCENDENTAL_FUNCTIONS,
  compareWithSolverTolerance,
  ulpDistance
};
