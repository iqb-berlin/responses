import fs from 'fs';
import Ajv, { ValidateFunction } from 'ajv';
import {CodingScheme} from "../../src";

const codingSchemeSchemaFileName = `${__dirname}/../../json_schema/coding-scheme.schema.json`;
const codingSchemeSchemaFileContent = fs.readFileSync(codingSchemeSchemaFileName, 'utf8');
const responseSchemaFileName = `${__dirname}/../../json_schema/response.schema.json`;
const responseSchemaFileContent = fs.readFileSync(responseSchemaFileName, 'utf8');
const sampleFolder = __dirname;
const ajv = new Ajv();
let compiledCodingSchemeSchema: ValidateFunction<unknown> | null = ajv.compile(JSON.parse(codingSchemeSchemaFileContent));
let compiledResponseSchema: ValidateFunction<unknown> | null = ajv.compile(JSON.parse(responseSchemaFileContent));
const regexInput = /^(.+)_input.json$/;
describe('schema is valid', () => {
    test('for coding scheme', () => {
        expect(compiledCodingSchemeSchema).not.toBeNull();
    });
    test('for response', () => {
        expect(compiledResponseSchema).not.toBeNull();
    });
});

let fileContent;
let testFolders = fs.readdirSync(sampleFolder, { withFileTypes: true })
    .filter(dirEntry => dirEntry.isDirectory())
    .map(dirEntry => dirEntry.name);
if (process.argv[3] && testFolders.includes(process.argv[3])) testFolders = [process.argv[3]];

testFolders.forEach(testCaseFolder => {
  describe(testCaseFolder, () => {
      let codingScheme: CodingScheme | null = null;
      const codingSchemeFilename = `${sampleFolder}/${testCaseFolder}/coding-scheme.json`;
      if (fs.existsSync(codingSchemeFilename)) {
          const fileContentCodingScheme = fs.readFileSync(codingSchemeFilename, 'utf8');
          codingScheme = JSON.parse(fileContentCodingScheme);
          const codingSchemeValid = compiledCodingSchemeSchema ? compiledCodingSchemeSchema(codingScheme) : null
          test('valid coding scheme', () => {
              expect(codingSchemeValid).not.toBeNull();
          });
          if (codingSchemeValid === null) codingScheme = null;
      }
      const inputFiles = fs.readdirSync(`${sampleFolder}/${testCaseFolder}`).filter(fn => fn.endsWith('_input.json'));
      if (codingScheme && inputFiles.length > 0) {
          const codingSchemeObject = new CodingScheme((codingScheme as CodingScheme).variableCodings);
          inputFiles.forEach(inputFile => {
              const matches = regexInput.exec(inputFile);
              const inputId =  matches ? matches[1] : '';
              let problems: string[] = [];
              fileContent = fs.readFileSync(`${sampleFolder}/${testCaseFolder}/${inputId}_input.json`, 'utf8');
              if (fileContent) {
                  let parsedInput;
                  try {
                      parsedInput = JSON.parse(fileContent);
                  } catch (err) {
                      parsedInput = null;
                      problems.push('parsing input file')
                  }
                  if (parsedInput) {
                      parsedInput.forEach((r: any) => {
                          if (problems.length === 0) {
                              const ok = compiledResponseSchema ? compiledResponseSchema(r) : null;
                              if (!ok) problems.push('input file invalid')
                          }
                      });
                  }
                  if (problems.length === 0) {
                      fileContent = fs.readFileSync(`${sampleFolder}/${testCaseFolder}/${inputId}_outcome.json`, 'utf8');
                      if (fileContent) {
                          let parsedOutcome: any[] | null;
                          try {
                              parsedOutcome = JSON.parse(fileContent);
                          } catch (err) {
                              parsedOutcome = null;
                              problems.push('parsing outcome file')
                          }
                          if (parsedOutcome) {
                              parsedOutcome.forEach((r: any) => {
                                  if (problems.length === 0) {
                                      const ok = compiledResponseSchema ? compiledResponseSchema(r) : null;
                                      if (!ok) problems.push('outcome file invalid')
                                  }
                              });
                              if (problems.length === 0) {
                                  const result = codingSchemeObject.code(parsedInput);
                                  test(inputId, () => {
                                      expect(JSON.stringify(result)).toBe(JSON.stringify(parsedOutcome));
                                  });
                              }
                          }
                      } else {
                          problems.push('reading outcome file')
                      }
                  }
              } else {
                  problems.push('reading input file')
              }
              if (problems.length > 0) {
                  test(`${inputId}: no problems`, () => {
                      expect(problems).toStrictEqual([]);
                  })
              }
          })
      }
  })
})
