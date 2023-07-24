const schema_filename = './response/response.json';
const valid_folder = './response/test_valid';

const Ajv = require("ajv")
const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

const fs = require('fs');
console.log(`load schema "${schema_filename}"`);
let schema = null;
try {
    schema = fs.readFileSync(schema_filename, 'utf8');
} catch (err) {
    console.error(err);
    schema = null;
}

if (schema) {
    console.log('validate schema syntax');
    let compiledSchema = null;
    try {
        compiledSchema = ajv.compile(JSON.parse(schema))
    } catch (err) {
        compiledSchema = null;
        console.error(err);
    }
    if (compiledSchema) {
        fs.readdirSync(valid_folder).forEach((file) => {
            console.log(`evaluating ${file}`);
            try {
                const data = fs.readFileSync(`${valid_folder}/${file}`, 'utf8');
                const valid = compiledSchema(JSON.parse(data))
                if (valid) {
                    console.log('ok');
                } else {
                    console.error(compiledSchema.errors)
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
}
console.log('test finished');

