const fc = require('fast-check');
const { PROTOCOL_VERSION, stableId } = require('./protocol');

const STATUSES = [
  'UNSET', 'NOT_REACHED', 'DISPLAYED', 'VALUE_CHANGED', 'DERIVE_ERROR',
  'CODING_COMPLETE', 'NO_CODING', 'INVALID', 'CODING_INCOMPLETE',
  'CODING_ERROR', 'PARTLY_DISPLAYED', 'DERIVE_PENDING', 'INTENDED_INCOMPLETE'
];
const SOURCE_TYPES = [
  'BASE', 'BASE_NO_VALUE', 'MANUAL', 'COPY_VALUE', 'CONCAT_CODE',
  'SUM_CODE', 'SUM_SCORE', 'UNIQUE_VALUES', 'SOLVER'
];
const STRING_RULES = ['MATCH', 'MATCH_REGEX', 'IS_EMPTY', 'IS_NULL'];
const NUMERIC_RULES = [
  'NUMERIC_MATCH', 'NUMERIC_RANGE', 'NUMERIC_FULL_RANGE', 'NUMERIC_LESS_THAN',
  'NUMERIC_MORE_THAN', 'NUMERIC_MAX', 'NUMERIC_MIN', 'IS_EMPTY', 'IS_NULL'
];
const BOOLEAN_RULES = ['IS_TRUE', 'IS_FALSE', 'IS_EMPTY', 'IS_NULL'];
const ARRAY_POSITIONS = ['ANY', 'ANY_OPEN', 'SUM', 'LENGTH'];
const FAULTS = [
  'duplicate-id', 'duplicate-alias', 'missing-source', 'cycle', 'parameter-count',
  'reversed-range', 'invalid-regex', 'fragment-index', 'array-position', 'source-count'
];
const SOLVER_FUNCTIONS = [
  'abs', 'sqrt', 'cbrt', 'ceil', 'floor', 'fix', 'round', 'sign',
  'min', 'max', 'pow', 'mod', 'exp', 'log', 'log10', 'log2',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'hypot',
  'square', 'cube', 'nthRoot'
];
const ASCII = [...'abcXYZ0123 -_,.'];
const NUMBER_FORMAT_BOUNDARIES = [
  1e21, 1e20, 1e-6, 1e-7, 1000000000000000100
];

const asciiString = fc.array(fc.constantFrom(...ASCII), { maxLength: 12 }).map(chars => chars.join(''));
const scalar = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer({ min: -1000000, max: 1000000 }),
  fc.integer({ min: -10000, max: 10000 }).map(value => value / 10),
  asciiString
);
const responseValue = fc.oneof(scalar, fc.array(scalar, { maxLength: 5 }));

const nodeArbitrary = fc.record({
  sourceSelector: fc.nat(1000),
  sourceA: fc.nat(1000),
  sourceB: fc.nat(1000),
  alias: fc.boolean(),
  typeSelector: fc.nat(1000),
  statusSelector: fc.nat(1000),
  value: responseValue,
  subformSelector: fc.nat(5),
  processingSelector: fc.nat(1000),
  sourceProcessingSelector: fc.nat(1000),
  ruleSelector: fc.nat(1000),
  arrayPositionSelector: fc.nat(1000),
  codeId: fc.integer({ min: -20, max: 20 }),
  score: fc.integer({ min: -20, max: 20 }),
  useFragment: fc.boolean(),
  residual: fc.boolean()
});

const modelArbitrary = fc.record({
  nodes: fc.array(nodeArbitrary, { minLength: 1, maxLength: 8 }),
  faultSelector: fc.nat(1000),
  responseMutationSelector: fc.nat(1000),
  requestedAliases: fc.array(fc.nat(20), { maxLength: 5 })
});

function pick(values, selector) {
  return values[selector % values.length];
}

function unique(values) {
  return [...new Set(values)];
}

function sourceTypeFor(raw, index, profile) {
  if (index === 0) return 'BASE';
  if (profile === 'portable-valid-derive' && index === raw._lastIndex) return 'SOLVER';
  return pick(SOURCE_TYPES, raw.sourceSelector);
}

function valueType(sourceType, selector) {
  if (sourceType === 'BASE_NO_VALUE') return 'no-value';
  if (sourceType === 'CONCAT_CODE') return 'string';
  if (['SUM_CODE', 'SUM_SCORE', 'SOLVER'].includes(sourceType)) return 'number';
  if (sourceType === 'UNIQUE_VALUES') return 'boolean';
  return pick(['string', 'number', 'boolean'], selector);
}

function normalizeValue(value, type, multiple) {
  const values = Array.isArray(value) ? value : [value];
  const convert = candidate => {
    if (candidate === null) return null;
    if (type === 'number') {
      if (typeof candidate === 'number') return candidate;
      if (typeof candidate === 'boolean') return candidate ? 1 : 0;
      const parsed = Number.parseFloat(String(candidate).replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (type === 'boolean') return Boolean(candidate);
    return typeof candidate === 'string' ? candidate : String(candidate);
  };
  const converted = values.map(convert);
  return multiple ? converted : converted[0] ?? null;
}

function sourceIndexes(raw, index, sourceType) {
  if (sourceType === 'BASE' || sourceType === 'BASE_NO_VALUE' || index === 0) return [];
  const first = raw.sourceA % index;
  if (sourceType === 'COPY_VALUE' || index === 1) return [first];
  const second = raw.sourceB % index;
  return unique([first, second]).length > 1 ? unique([first, second]) : [first, (first + 1) % index];
}

function ruleFor(type, selector, useFragment) {
  const methods = type === 'number' ? NUMERIC_RULES : type === 'boolean' ? BOOLEAN_RULES : STRING_RULES;
  const method = pick(methods, selector);
  const rule = { method, parameters: [] };
  if (method === 'MATCH') rule.parameters = ['abc', '0'];
  if (method === 'MATCH_REGEX') rule.parameters = ['^[A-Za-z0-9 _.,-]*$'];
  if (method === 'NUMERIC_MATCH') rule.parameters = ['0', '1'];
  if (['NUMERIC_RANGE', 'NUMERIC_FULL_RANGE'].includes(method)) rule.parameters = ['-10', '10'];
  if (['NUMERIC_LESS_THAN', 'NUMERIC_MORE_THAN', 'NUMERIC_MAX', 'NUMERIC_MIN'].includes(method)) {
    rule.parameters = ['1'];
  }
  if (useFragment && type === 'string') rule.fragment = selector % 3 === 0 ? -1 : selector % 2;
  return rule;
}

function solverExpressionFor(raw, sourceAliases) {
  const name = pick(SOLVER_FUNCTIONS, raw.ruleSelector);
  const first = raw.codeId;
  const second = raw.score;
  const divisor = Math.abs(second) % 5 + 1;
  const decimals = Math.abs(second) % 4;
  const root = Math.abs(second) % 2 + 2;
  const expressions = {
    abs: `abs(${first})`,
    sqrt: `sqrt(abs(${first}))`,
    cbrt: 'cbrt(-8)',
    ceil: `ceil(${first} / 3)`,
    floor: `floor(${first} / 3)`,
    fix: `fix(${first} / 3)`,
    round: `round(${first} / 3, ${decimals})`,
    sign: `sign(${first})`,
    min: `min(${first}, ${second}, 0)`,
    max: `max(${first}, ${second}, 0)`,
    pow: `pow(abs(${first} % 5), ${Math.abs(second) % 4})`,
    mod: `mod(${first}, ${divisor})`,
    exp: `exp(${first} % 5)`,
    log: `log(exp(${first} % 5))`,
    log10: `log10(pow(10, abs(${first} % 4)))`,
    log2: `log2(abs(${first}) + 1)`,
    sin: 'sin(0)',
    cos: 'cos(0)',
    tan: 'tan(0)',
    asin: `asin((${first} % 3) / 3)`,
    acos: `acos((${first} % 3) / 3)`,
    atan: 'atan(0)',
    atan2: `atan2(0, ${divisor})`,
    hypot: `hypot(${first}, ${second})`,
    square: `square(${first})`,
    cube: `cube(${first})`,
    nthRoot: `nthRoot(pow(abs(${first} % 5), ${root}), ${root})`
  };
  const sourceTerm = sourceAliases.length > 0 ? ` + 0 * \${${sourceAliases[0]}:0:0}` : '';
  return `${expressions[name]}${sourceTerm}`;
}

function makeCoding(raw, index, sourceType, type, sources, ids, multiple) {
  const fragmentingEnabled = raw.useFragment && type === 'string' && sourceType === 'BASE';
  const rule = ruleFor(type, raw.ruleSelector, fragmentingEnabled);
  const valueArrayPos = multiple ? pick(ARRAY_POSITIONS, raw.arrayPositionSelector) : undefined;
  const ruleSet = { rules: [rule], ruleOperatorAnd: false };
  if (valueArrayPos !== undefined) ruleSet.valueArrayPos = valueArrayPos;
  const codes = [{
    id: raw.codeId,
    type: 'UNSET',
    label: '',
    score: raw.score,
    manualInstruction: '',
    ruleSetOperatorAnd: false,
    ruleSets: [ruleSet]
  }];
  if (raw.residual) {
    codes.push({
      id: 0,
      type: 'RESIDUAL_AUTO',
      label: '',
      score: 0,
      manualInstruction: '',
      ruleSetOperatorAnd: false,
      ruleSets: []
    });
  }
  const alias = raw.alias ? `a${index}` : ids[index];
  const sourceProcessing = [
    [], ['TAKE_EMPTY_AS_VALID'], ['TAKE_DISPLAYED_AS_VALUE_CHANGED'],
    ['TAKE_NOT_REACHED_AS_VALUE_CHANGED'], ['TO_NUMBER'], ['SORT']
  ];
  const processing = [
    [], ['IGNORE_CASE'], ['IGNORE_ALL_SPACES'], ['IGNORE_DISPENSABLE_SPACES'],
    ['SORT_ARRAY'], ['REPLAY_REQUIRED']
  ];
  const sourceAliases = sources.map(source => ids[source]);
  let solverExpression = '';
  if (sourceType === 'SOLVER') {
    solverExpression = solverExpressionFor(raw, sourceAliases);
  }
  return {
    id: ids[index],
    alias,
    label: '',
    sourceType,
    sourceParameters: {
      solverExpression,
      processing: pick(sourceProcessing, raw.sourceProcessingSelector)
    },
    deriveSources: sourceAliases,
    processing: pick(processing, raw.processingSelector),
    fragmenting: fragmentingEnabled ? '([A-Za-z]+)([0-9]+)' : '',
    manualInstruction: '',
    codeModel: sourceType === 'MANUAL' ? 'MANUAL_ONLY' : 'RULES_ONLY',
    page: '0',
    codes
  };
}

function makeVariableInfo(id, type, multiple) {
  return {
    id,
    type,
    format: '',
    multiple,
    nullable: true,
    values: [],
    valuePositionLabels: multiple ? ['0', '1', '2', '3', '4'] : [],
    valuesComplete: false,
    page: '0'
  };
}

function applySchemeFault(input, model) {
  const fault = pick(FAULTS, model.faultSelector);
  const codings = input.variableCodings;
  if (codings.length < 2) {
    const clone = JSON.parse(JSON.stringify(codings[0]));
    clone.id = 'v1';
    clone.alias = 'v1';
    codings.push(clone);
  }
  const first = codings[0];
  const last = codings.at(-1);
  switch (fault) {
    case 'duplicate-id': last.id = first.id; break;
    case 'duplicate-alias': last.alias = first.alias; break;
    case 'missing-source':
      last.sourceType = 'SUM_CODE';
      last.deriveSources = ['missing', first.id];
      break;
    case 'cycle':
      first.sourceType = 'SUM_CODE';
      first.deriveSources = [last.id, last.id];
      last.sourceType = 'SUM_CODE';
      last.deriveSources = [first.id, first.id];
      break;
    case 'parameter-count': last.codes[0].ruleSets[0].rules[0] = { method: 'IS_TRUE', parameters: ['extra'] }; break;
    case 'reversed-range': last.codes[0].ruleSets[0].rules[0] = { method: 'NUMERIC_RANGE', parameters: ['10', '-10'] }; break;
    case 'invalid-regex': last.codes[0].ruleSets[0].rules[0] = { method: 'MATCH_REGEX', parameters: ['['] }; break;
    case 'fragment-index':
      last.fragmenting = '(.)';
      last.codes[0].ruleSets[0].rules[0].fragment = 0.5;
      break;
    case 'array-position': last.codes[0].ruleSets[0].valueArrayPos = -2; break;
    case 'source-count': last.sourceType = 'COPY_VALUE'; last.deriveSources = [first.id, last.id]; break;
    default: break;
  }
  return fault;
}

function applyResponseMutation(input, selector) {
  const mutations = ['duplicate', 'unknown', 'missing', 'derived-input', 'status-value', 'alias-id'];
  const mutation = pick(mutations, selector);
  if (input.responses.length === 0) return mutation;
  switch (mutation) {
    case 'duplicate': input.responses.push(JSON.parse(JSON.stringify(input.responses[0]))); break;
    case 'unknown': input.responses.push({ id: 'unknown', status: 'VALUE_CHANGED', value: 'x' }); break;
    case 'missing': input.responses.shift(); break;
    case 'derived-input': {
      const derived = input.variableCodings.find(coding => !['BASE', 'BASE_NO_VALUE'].includes(coding.sourceType));
      if (derived) input.responses.push({ id: derived.alias, status: 'UNSET', value: null });
      break;
    }
    case 'status-value': input.responses[0].status = 'INVALID'; input.responses[0].value = ''; break;
    case 'alias-id': input.responses[0].id = input.variableCodings[0].alias; break;
    default: break;
  }
  return mutation;
}

function materialize(model, profile) {
  const ids = model.nodes.map((_, index) => `v${index}`);
  model.nodes.forEach(raw => { raw._lastIndex = model.nodes.length - 1; });
  const variableCodings = [];
  const baseVariables = [];
  const responses = [];
  const coverage = {
    sources: [], rules: [], statuses: [], values: [], arrayPositions: [], faults: [], solverFunctions: []
  };

  model.nodes.forEach((raw, index) => {
    const sourceType = sourceTypeFor(raw, index, profile);
    const type = valueType(sourceType, raw.typeSelector);
    const multiple = Array.isArray(raw.value) && sourceType === 'BASE';
    const sources = sourceIndexes(raw, index, sourceType);
    const coding = makeCoding(raw, index, sourceType, type, sources, ids, multiple);
    variableCodings.push(coding);
    if (sourceType === 'BASE' || sourceType === 'BASE_NO_VALUE') {
      baseVariables.push(makeVariableInfo(ids[index], type, multiple));
    }
    const status = pick(STATUSES, raw.statusSelector);
    let responseValueForCoding = normalizeValue(raw.value, type, multiple);
    if (coding.fragmenting && sourceType === 'BASE') {
      responseValueForCoding = multiple
        ? (Array.isArray(responseValueForCoding) ? responseValueForCoding : [responseValueForCoding])
          .map(() => 'abc1')
        : 'abc1';
    }
    responses.push({
      id: raw.alias ? coding.alias : coding.id,
      status,
      value: responseValueForCoding,
      ...(raw.subformSelector === 0 ? { subform: 's0' } : {}),
      ...(status === 'CODING_COMPLETE' ? { code: raw.codeId, score: raw.score } : {})
    });
    coverage.sources.push(sourceType);
    coverage.rules.push(coding.codes[0].ruleSets[0].rules[0].method);
    coverage.statuses.push(status);
    coverage.values.push(multiple ? 'array' : type);
    if (sourceType === 'SOLVER') coverage.solverFunctions.push(pick(SOLVER_FUNCTIONS, raw.ruleSelector));
    if (multiple) coverage.arrayPositions.push(coding.codes[0].ruleSets[0].valueArrayPos);
  });

  const input = { baseVariables, variableCodings, responses };
  if (profile === 'portable-invalid-scheme') coverage.faults.push(applySchemeFault(input, model));
  if (profile === 'portable-invalid-response') {
    coverage.faults.push(applyResponseMutation(input, model.responseMutationSelector));
  }
  if (profile === 'wire-factory') {
    const duplicate = JSON.parse(JSON.stringify(baseVariables[0] || makeVariableInfo('v0', 'string', false)));
    duplicate.id = ` ${duplicate.id} `;
    input.baseVariables.push(duplicate);
    if (Array.isArray(input.responses[0]?.value)) {
      input.responses[0].value = input.responses[0].value[0] ?? null;
    }
    if (input.baseVariables[0]) {
      input.baseVariables[0].multiple = false;
      input.baseVariables[0].valuePositionLabels = [];
    }
    if (input.responses[0] && model.faultSelector % 4 === 0) {
      input.responses[0].value = pick(NUMBER_FORMAT_BOUNDARIES, model.faultSelector);
    }
    const firstRuleSet = input.variableCodings[0]?.codes?.[0]?.ruleSets?.[0];
    if (firstRuleSet) delete firstRuleSet.valueArrayPos;
  }

  let calls;
  if (profile === 'portable-valid-derive') {
    const codingIndex = Math.max(0, variableCodings.length - 1);
    const sourceIds = variableCodings[codingIndex].deriveSources;
    const sourceResponseIndexes = sourceIds
      .map(sourceId => responses.findIndex(response => response.id === sourceId || response.id === variableCodings.find(c => c.id === sourceId)?.alias))
      .filter(index => index >= 0);
    calls = [
      { op: 'validate' },
      { op: 'dependencyTree' },
      { op: 'deriveValue', codingIndex, sourceResponseIndexes }
    ];
  } else if (profile === 'wire-factory') {
    calls = [
      { op: 'normalizeScheme' }, { op: 'variableList' },
      { op: 'singleCode', codingIndex: 0, responseIndex: 0 },
      { op: 'getValueAsNumber', responseIndex: 0 },
      { op: 'getValueAsString', responseIndex: 0, processing: ['IGNORE_CASE'] },
      { op: 'isEmptyValue', responseIndex: 0 },
      { op: 'schemeText', mode: 'SIMPLE' }, { op: 'schemeText', mode: 'EXTENDED' }
    ];
  } else if (profile === 'portable-invalid-scheme') {
    calls = [
      { op: 'normalizeScheme' }, { op: 'validate' }, { op: 'dependencyTree' }, { op: 'code' }
    ];
  } else {
    calls = [
      { op: 'normalizeScheme' }, { op: 'validate' }, { op: 'dependencyTree' }, { op: 'code' },
      {
        op: 'getBaseVarsList',
        aliases: model.requestedAliases.map(index => variableCodings[index % variableCodings.length].alias)
      },
      { op: 'schemeText', mode: 'SIMPLE' }, { op: 'schemeText', mode: 'EXTENDED' }
    ];
  }
  const body = { protocolVersion: PROTOCOL_VERSION, kind: 'case', input, calls };
  return { request: { ...body, id: `${profile}:${stableId(body)}` }, coverage };
}

module.exports = {
  ARRAY_POSITIONS,
  FAULTS,
  NUMERIC_RULES,
  SOURCE_TYPES,
  SOLVER_FUNCTIONS,
  STATUSES,
  STRING_RULES,
  BOOLEAN_RULES,
  materialize,
  modelArbitrary,
  solverExpressionFor
};
