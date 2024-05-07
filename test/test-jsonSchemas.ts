/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
// options can be passed, e.g. {allErrors: true}
import Ajv, { ValidateFunction } from 'ajv';
import fs from 'fs';

const schemaFolder = `${__dirname}/../json_schema/${process.argv[2]}`;
const schemaFilename = `${schemaFolder}/${process.argv[2]}.schema.json`;
const validFolder = `${schemaFolder}/test_valid`;
const invalidFolder = `${schemaFolder}/test_invalid`;

const ajv = new Ajv();
let compiledSchema: ValidateFunction<unknown> | null = null;

function evaluateFileOk(filename: string, checkForInvalid: boolean): boolean {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    const valid = compiledSchema ? compiledSchema(JSON.parse(data)) : null;
    if (valid) {
      if (checkForInvalid) {
        console.log(`\x1b[0;31mERROR\x1b[0m '${filename}' should be invalid`);
        return false;
      }
      return true;
    }
    if (checkForInvalid) {
      return true;
    }
    console.log(`\x1b[0;31mERROR\x1b[0m '${filename}':`);
    console.error(compiledSchema ? compiledSchema.errors : 'error unknown');
    return false;
  } catch (err) {
    console.log(`\x1b[0;31mERROR\x1b[0m '${filename}':`);
    console.error(err);
    return false;
  }
}

let schema;
try {
  schema = fs.readFileSync(schemaFilename, 'utf8');
} catch (err) {
  console.log(`\x1b[0;31mERROR\x1b[0m reading schema '${schemaFilename}':`);
  console.error(err);
  process.exitCode = 1;
  schema = null;
}

if (schema) {
  try {
    compiledSchema = ajv.compile(JSON.parse(schema));
  } catch (err) {
    console.log(`\x1b[0;31mERROR\x1b[0m parsing schema '${schemaFilename}':`);
    console.error(err);
    process.exitCode = 1;
    compiledSchema = null;
  }
  if (compiledSchema) {
    let checksOk = 0;
    let checksNotOk = 0;
    fs.readdirSync(validFolder).forEach((file: string) => {
      if (evaluateFileOk(`${validFolder}/${file}`, false)) {
        checksOk += 1;
      } else {
        checksNotOk += 1;
      }
    });
    fs.readdirSync(invalidFolder).forEach((file: string) => {
      if (evaluateFileOk(`${invalidFolder}/${file}`, true)) {
        checksOk += 1;
      } else {
        checksNotOk += 1;
      }
    });
    if (checksNotOk > 0) {
      console.log(`\x1b[0;31m${checksNotOk} check${checksNotOk > 1 ? 's' : ''} failed\x1b[0m`);
      process.exitCode = 1;
    }
    if (checksOk > 0) {
      console.log(`\x1b[0;32m${checksOk} check${checksOk > 1 ? 's' : ''} passed\x1b[0m`);
    }
  }
}
