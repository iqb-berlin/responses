const { CodingScheme } = require('@iqbspecs/coding-scheme');
const {
  CodingFactory,
  CodingSchemeFactory,
  CodingSchemeTextFactory,
  VariableList
} = require('../../dist');
const { PROTOCOL_VERSION, jsonRoundTrip } = require('./protocol');

function category(error) {
  const message = String(error && error.message || error);
  if (/circular dependency/i.test(message)) return 'DEPENDENCY_CYCLE';
  if (/regular expression|invalid group|unterminated/i.test(message)) return 'REGEX_SYNTAX';
  if (/solver|unexpected|parenthes|expression/i.test(message)) return 'SOLVER_SYNTAX';
  if (error instanceof RangeError) return 'INVALID_REQUEST';
  if (error instanceof TypeError) return 'INVALID_OPERATION';
  return 'UNEXPECTED';
}

function normalized(input) {
  return new CodingScheme({ version: '3.4', variableCodings: input.variableCodings || [] })
    .variableCodings;
}

function at(values, index, kind) {
  if (!Number.isInteger(index) || index < 0 || index >= values.length) {
    throw new RangeError(`Invalid ${kind} index.`);
  }
  return values[index];
}

function executeCall(input, call) {
  const diagnostics = [];
  const onError = error => diagnostics.push({ phase: call.op, category: category(error) });
  try {
    const codings = normalized(input);
    let value;
    switch (call.op) {
      case 'normalizeScheme': value = codings; break;
      case 'validate': value = CodingSchemeFactory.validate(input.baseVariables || [], codings); break;
      case 'dependencyTree': value = CodingSchemeFactory.getVariableDependencyTree(codings); break;
      case 'code': value = CodingSchemeFactory.code(input.responses || [], codings, { onError }); break;
      case 'deriveValue': {
        const coding = at(codings, call.codingIndex ?? 0, 'coding');
        const sources = (call.sourceResponseIndexes || [])
          .map(index => at(input.responses || [], index, 'response'));
        value = CodingSchemeFactory.deriveValue(codings, coding, sources);
        break;
      }
      case 'getBaseVarsList':
        value = CodingSchemeFactory.getBaseVarsList(call.aliases || [], codings);
        break;
      case 'schemeText':
        value = CodingSchemeTextFactory.asText(codings, call.mode || 'EXTENDED');
        break;
      case 'singleCode':
        value = CodingFactory.code(
          at(input.responses || [], call.responseIndex ?? 0, 'response'),
          at(codings, call.codingIndex ?? 0, 'coding'),
          { onError }
        );
        break;
      case 'getValueAsNumber':
        value = CodingFactory.getValueAsNumber(
          at(input.responses || [], call.responseIndex ?? 0, 'response').value
        );
        break;
      case 'getValueAsString':
        value = CodingFactory.getValueAsString(
          at(input.responses || [], call.responseIndex ?? 0, 'response').value,
          call.processing || []
        );
        break;
      case 'isEmptyValue':
        value = CodingFactory.isEmptyValue(
          at(input.responses || [], call.responseIndex ?? 0, 'response').value
        );
        break;
      case 'variableList': value = new VariableList(input.baseVariables || []).variables; break;
      default: throw new TypeError(`Unknown operation '${call.op}'.`);
    }
    return { op: call.op, outcome: { kind: 'value', value }, diagnostics };
  } catch (error) {
    return {
      op: call.op,
      outcome: { kind: 'error', phase: call.op, category: category(error) },
      diagnostics
    };
  }
}

function evaluateTypeScript(request) {
  const wireRequest = jsonRoundTrip(request);
  if (wireRequest.protocolVersion !== PROTOCOL_VERSION || wireRequest.kind !== 'case') {
    return {
      protocolVersion: PROTOCOL_VERSION,
      kind: 'error',
      id: wireRequest.id || null,
      outcome: { kind: 'error', phase: 'request', category: 'INVALID_REQUEST' }
    };
  }
  return jsonRoundTrip({
    protocolVersion: PROTOCOL_VERSION,
    kind: 'result',
    id: wireRequest.id,
    calls: wireRequest.calls.map(call => executeCall(wireRequest.input, call))
  });
}

module.exports = { evaluateTypeScript };
