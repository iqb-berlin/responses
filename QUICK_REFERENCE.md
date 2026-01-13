# Coding Process - Quick Reference Guide

## 🚀 Quick Start

### Basic Usage

```typescript
import { CodingSchemeFactory } from '@iqb/responses';
import type { Response } from '@iqbspecs/response/response.interface';
import type { VariableCodingData } from '@iqbspecs/coding-scheme';

// Your responses
const responses: Response[] = [
  { id: 'A1', value: 'hello', status: 'VALUE_CHANGED' },
  { id: 'A2', value: 42, status: 'VALUE_CHANGED' }
];

// Your coding scheme
const variableCodings: VariableCodingData[] = [ /* ... */ ];

// Code all responses
const coded = CodingSchemeFactory.code(responses, variableCodings, {
  onError: (err) => console.error('Coding error:', err)
});
```

---

## 📊 Process Flow Overview

```
INPUT → GROUP → NORMALIZE → RESOLVE → PLAN → DERIVE → CODE → OUTPUT
```

1. **INPUT**: Responses + Coding Scheme
2. **GROUP**: Separate by subform
3. **NORMALIZE**: Standardize statuses
4. **RESOLVE**: Remove shadowed base variables
5. **PLAN**: Build dependency graph
6. **DERIVE**: Compute derived values
7. **CODE**: Apply coding rules
8. **OUTPUT**: Coded responses

---

## 🎯 Key Concepts

### Response Status Values

| Status | When Used |
|--------|-----------|
| `VALUE_CHANGED` | Ready for coding |
| `CODING_COMPLETE` | Successfully coded |
| `CODING_INCOMPLETE` | No matching rule |
| `CODING_ERROR` | Error during coding |
| `DERIVE_ERROR` | Error during derivation |
| `NO_CODING` | No rules defined |
| `INVALID` | Invalid value |

### Variable Types

| Type | Description | Example |
|------|-------------|---------|
| `BASE` | Raw response | User input |
| `SUM` | Sum of sources | Total score |
| `UNIQUE_VALUES` | Unique values | Distinct answers |
| `SOLVER` | Math expression | `V1 + V2 * 3` |
| `CONCAT_TEXT` | Concatenate text | Combined responses |

### Rule Types

| Rule | Description | Example |
|------|-------------|---------|
| `MATCH` | Exact string match | "yes" |
| `MATCH_REGEX` | Regex pattern | `/^[0-9]+$/` |
| `NUMERIC_MATCH` | Exact number | 42 |
| `NUMERIC_LESS_THAN` | Value < threshold | < 10 |
| `NUMERIC_MORE_THAN` | Value > threshold | > 5 |
| `NUMERIC_RANGE` | min ≤ value ≤ max | 5-10 |

---

## 🔧 Common Operations

### Validate Coding Scheme

```typescript
import { CodingSchemeFactory } from '@iqb/responses';
import type { VariableInfo } from '@iqbspecs/variable-info/variable-info.interface';

const problems = CodingSchemeFactory.validate(baseVariables, variableCodings);

problems.forEach(problem => {
  console.log(`${problem.type}: ${problem.variableId}`);
  console.log(`  ${problem.message}`);
  console.log(`  Breaking: ${problem.breaking}`);
});
```

### Get Dependency Tree

```typescript
const tree = CodingSchemeFactory.getVariableDependencyTree(variableCodings);

// Each node:
{
  id: 'V3',
  alias: 'Variable3',
  sourceType: 'SUM',
  children: [/* variables that depend on this */],
  depth: 1
}
```

### Find Required Base Variables

```typescript
// What base variables do I need to code V3 and V4?
const required = CodingSchemeFactory.getBaseVarsList(
  ['V3', 'V4'], 
  variableCodings
);
// Returns: ['V1', 'V2', 'V5']
```

### Code Single Response

```typescript
import { CodingFactory } from '@iqb/responses';

const response = { id: 'A1', value: 'test', status: 'VALUE_CHANGED' };
const coding = variableCodings.find(v => v.id === 'A1');

const coded = CodingFactory.code(response, coding, {
  onError: (err) => console.error(err)
});
```

---

## 🏗️ Module Reference

### Main Factories

| Module | Purpose | Key Method |
|--------|---------|------------|
| `CodingSchemeFactory` | Orchestrate pipeline | `code()` |
| `CodingFactory` | Code single response | `code()` |

### Processing Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Subform Grouping | `src/subform/` | Group by subform |
| Alias Mapper | `src/mapping/` | Map ID ↔ alias |
| Normalize | `src/normalize/` | Standardize statuses |
| Merge | `src/merge/` | Resolve conflicts |
| Graph | `src/graph/` | Build dependency tree |
| Derive | `src/derive/` | Compute derived values |
| Rule Engine | `src/rule-engine/` | Evaluate rules |
| Value Transform | `src/value-transform.ts` | Transform values |
| Finalize | `src/finalize/` | Deduplicate |
| Validation | `src/validation/` | Validate scheme |

---

## ⚙️ Processing Parameters

### Source Processing

| Parameter | Effect |
|-----------|--------|
| `TO_LOWER_CASE` | Convert to lowercase |
| `TO_NUMBER` | Convert to number |
| `REMOVE_ALL_SPACES` | Remove all whitespace |
| `REMOVE_DISPENSABLE_SPACES` | Normalize whitespace |
| `TAKE_DISPLAYED_AS_VALUE_CHANGED` | Treat DISPLAYED as VALUE_CHANGED |
| `TAKE_NOT_REACHED_AS_VALUE_CHANGED` | Treat NOT_REACHED as VALUE_CHANGED |
| `TAKE_EMPTY_AS_VALID` | Allow empty values |
| `SORT` | Sort values |

### Coding Processing

| Parameter | Effect |
|-----------|--------|
| `SORT_ARRAY` | Sort array before coding |
| `IGNORE_CASE` | Case-insensitive matching |
| `IGNORE_ALL_SPACES` | Ignore all whitespace |
| `IGNORE_DISPENSABLE_SPACES` | Ignore extra whitespace |

---

## 🐛 Debugging

### Enable Error Logging

```typescript
const coded = CodingSchemeFactory.code(responses, variableCodings, {
  onError: (error) => {
    console.error('Error:', error);
    console.trace();
  }
});
```

### Check Response Status

```typescript
coded.forEach(response => {
  if (response.status === 'CODING_ERROR') {
    console.log(`Error in ${response.id}`);
  }
  if (response.status === 'CODING_INCOMPLETE') {
    console.log(`No match for ${response.id}: ${response.value}`);
  }
});
```

### Inspect Dependency Issues

```typescript
const tree = CodingSchemeFactory.getVariableDependencyTree(variableCodings);

// Find circular dependencies
tree.forEach(node => {
  if (node.depth === -1) {
    console.log(`Circular dependency detected: ${node.id}`);
  }
});
```

---

## 📝 Code Examples

### Example 1: Simple Coding

```typescript
const responses = [
  { id: 'Q1', value: 'yes', status: 'VALUE_CHANGED' }
];

const variableCodings = [{
  id: 'Q1',
  alias: 'Q1',
  sourceType: 'BASE',
  codes: [
    {
      id: 1,
      score: 1,
      ruleSets: [{
        rules: [{ method: 'MATCH', parameters: ['yes'] }]
      }]
    },
    {
      id: 0,
      score: 0,
      ruleSets: [{
        rules: [{ method: 'MATCH', parameters: ['no'] }]
      }]
    }
  ]
}];

const coded = CodingSchemeFactory.code(responses, variableCodings);
// Result: { id: 'Q1', value: 'yes', status: 'CODING_COMPLETE', code: 1, score: 1 }
```

### Example 2: Derived Variable

```typescript
const responses = [
  { id: 'Q1', value: 5, status: 'VALUE_CHANGED' },
  { id: 'Q2', value: 3, status: 'VALUE_CHANGED' }
];

const variableCodings = [
  { id: 'Q1', alias: 'Q1', sourceType: 'BASE', codes: [] },
  { id: 'Q2', alias: 'Q2', sourceType: 'BASE', codes: [] },
  {
    id: 'TOTAL',
    alias: 'TOTAL',
    sourceType: 'SUM',
    deriveSources: ['Q1', 'Q2'],
    codes: [
      {
        id: 1,
        score: 1,
        ruleSets: [{
          rules: [{ method: 'NUMERIC_MORE_THAN', parameters: ['7'] }]
        }]
      }
    ]
  }
];

const coded = CodingSchemeFactory.code(responses, variableCodings);
// Result includes: { id: 'TOTAL', value: 8, status: 'CODING_COMPLETE', code: 1, score: 1 }
```

### Example 3: Regex Matching

```typescript
const responses = [
  { id: 'EMAIL', value: 'test@example.com', status: 'VALUE_CHANGED' }
];

const variableCodings = [{
  id: 'EMAIL',
  alias: 'EMAIL',
  sourceType: 'BASE',
  codes: [
    {
      id: 1,
      score: 1,
      ruleSets: [{
        rules: [{
          method: 'MATCH_REGEX',
          parameters: ['^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$']
        }]
      }]
    }
  ]
}];

const coded = CodingSchemeFactory.code(responses, variableCodings);
// Result: { id: 'EMAIL', value: 'test@example.com', status: 'CODING_COMPLETE', code: 1, score: 1 }
```

---

## 🎨 Best Practices

### ✅ Do

- Always provide an `onError` callback for production code
- Validate coding schemes before deployment
- Use meaningful variable IDs and aliases
- Test edge cases (empty values, special characters)
- Document complex derivation logic
- Use `RESIDUAL_AUTO` for catch-all cases

### ❌ Don't

- Don't create circular dependencies
- Don't use duplicate IDs or aliases
- Don't rely on processing order within the same dependency level
- Don't ignore validation errors
- Don't use overly complex regex patterns
- Don't forget to handle empty values

---

## 🔍 Troubleshooting

### Problem: CODING_INCOMPLETE

**Cause**: No rule matched the response value

**Solutions**:
- Check rule parameters
- Add a `RESIDUAL_AUTO` code
- Verify value transformation (fragmenting, processing)
- Check case sensitivity settings

### Problem: DERIVE_ERROR

**Cause**: Error computing derived value

**Solutions**:
- Verify source variables exist
- Check solver expression syntax
- Ensure source values are correct type
- Check for missing dependencies

### Problem: Circular Dependency

**Cause**: Variable depends on itself (directly or indirectly)

**Solutions**:
- Run `validate()` to identify the cycle
- Restructure derivation dependencies
- Remove circular references

### Problem: Wrong Code Applied

**Cause**: Rule matching incorrectly

**Solutions**:
- Check rule order (first match wins)
- Verify `ruleSetOperatorAnd` setting
- Test rule matching in isolation
- Check processing parameters (IGNORE_CASE, etc.)

---

## 📚 Additional Resources

- **Full Documentation**: See `CODING_PROCESS.md`
- **API Documentation**: See `README.md`
- **IQB Specifications**: https://iqb-specifications.github.io/
- **npm Package**: https://www.npmjs.com/package/@iqb/responses
- **GitHub**: https://github.com/iqb-berlin/responses

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test_coding
```

---

## 📞 Support

For issues or questions:
- Check the validation output
- Review error messages
- Consult the full documentation
- Open an issue on GitHub
