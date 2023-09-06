const schema_folder = `${__dirname}/json_schema/${process.argv[2]}`;
const schema_filename = `${schema_folder}/${process.argv[2]}.json`;
const valid_folder = `${schema_folder}/test_valid`;
const invalid_folder = `${schema_folder}/test_invalid`;

const Ajv = require("ajv")
const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

const fs = require('fs');
let compiledSchema: { (arg0: any): any; errors: any; } | null = null;

function evaluateFileOk(filename: string, checkForInvalid: boolean): boolean {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        const valid = compiledSchema ? compiledSchema(JSON.parse(data)) : null;
        if (valid) {
            if (checkForInvalid) {
                console.log(`\x1b[0;31mERROR\x1b[0m '${filename}' should be invalid`);
                return false;
            } else {
                return true;
            }
        } else {
            if (checkForInvalid) {
                return true;
            } else {
                console.log(`\x1b[0;31mERROR\x1b[0m '${filename}':`);
                console.error(compiledSchema ? compiledSchema.errors : 'error unknown')
                return false;
            }
        }
    } catch (err) {
        console.log(`\x1b[0;31mERROR\x1b[0m '${filename}':`);
        console.error(err);
        return false;
    }
}

let schema;
try {
    schema = fs.readFileSync(schema_filename, 'utf8');
} catch (err) {
    console.log(`\x1b[0;31mERROR\x1b[0m reading schema '${schema_filename}':`);
    console.error(err);
    process.exitCode = 1;
    schema = null;
}

if (schema) {
    try {
        compiledSchema = ajv.compile(JSON.parse(schema))
    } catch (err) {
        console.log(`\x1b[0;31mERROR\x1b[0m parsing schema '${schema_filename}':`);
        console.error(err);
        process.exitCode = 1;
        compiledSchema = null;
    }
    if (compiledSchema) {
        let checksOk = 0;
        let checksNotOk = 0;
        fs.readdirSync(valid_folder).forEach((file: string) => {
            if (evaluateFileOk(`${valid_folder}/${file}`, false)) {
                checksOk += 1;
            } else {
                checksNotOk += 1;
            }
        });
        fs.readdirSync(invalid_folder).forEach((file: string) => {
            if (evaluateFileOk(`${invalid_folder}/${file}`, true)) {
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
