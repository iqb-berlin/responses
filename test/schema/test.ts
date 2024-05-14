/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
// options can be passed, e.g. {allErrors: true}
import Ajv, { ValidateFunction } from 'ajv';
import fs from 'fs';

const ajv = new Ajv();
let testFolders = fs.readdirSync(__dirname, { withFileTypes: true })
    .filter(dirEntry => dirEntry.isDirectory())
    .map(dirEntry => dirEntry.name);
if (process.argv[3] && testFolders.includes(process.argv[3])) testFolders = [process.argv[3]];

testFolders.forEach(testCaseFolder => {
  describe(testCaseFolder, () => {
    const schemaFileName = `${__dirname}/../../json_schema/${testCaseFolder}.schema.json`;
    const schemaFileContent = fs.readFileSync(schemaFileName, 'utf8');
    let compiledSchema: ValidateFunction<unknown> | null = ajv.compile(JSON.parse(schemaFileContent));
    test('schema valid as json file', () => {
      expect(compiledSchema).not.toBeNull();
    });
    describe('valid cases', () => {
      const validFolder = `${__dirname}/${testCaseFolder}/test_valid`;
      if (compiledSchema && fs.existsSync(validFolder)) {
        fs.readdirSync(validFolder).forEach((file: string) => {
          const data = fs.readFileSync(`${validFolder}/${file}`, 'utf8');
          const valid = compiledSchema ? compiledSchema(JSON.parse(data)) : null;
          test(file, () => {
            expect(valid).toBeTruthy();
          });
        })
      }
    })
    describe('invalid cases', () => {
      const invalidFolder = `${__dirname}/${testCaseFolder}/test_invalid`;
      if (compiledSchema && fs.existsSync(invalidFolder)) {
        fs.readdirSync(invalidFolder).forEach((file: string) => {
          const data = fs.readFileSync(`${invalidFolder}/${file}`, 'utf8');
          const valid = compiledSchema ? compiledSchema(JSON.parse(data)) : null;
          test(file, () => {
            expect(valid).not.toBeTruthy();
          });
        })
      }
    })
  })
});
