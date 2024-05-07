import fs from 'fs';
import Ajv, { ValidateFunction } from 'ajv';
import { CodingScheme } from '../src';

type TestCodingResultsTest = {
  test_label: string;
  subfolder: string;
};

const codingSchemeSchemaFileName = `${__dirname}/../json_schema/coding-scheme/coding-scheme.schema.json`;
const codingSchemeSchemaFileContent = fs.readFileSync(codingSchemeSchemaFileName, 'utf8');
const responseSchemaFileName = `${__dirname}/../json_schema/response/response.schema.json`;
const responseSchemaFileContent = fs.readFileSync(responseSchemaFileName, 'utf8');
const sampleFolder = `${__dirname}/sample_data/coding-results-cases`;
let fileContent = fs.readFileSync(`${sampleFolder}/codingscheme-tests.json`, 'utf8');
const ajv = new Ajv();
let compiledCodingSchemeSchema: ValidateFunction<unknown> | null = ajv.compile(JSON.parse(codingSchemeSchemaFileContent));
let compiledResponseSchema: ValidateFunction<unknown> | null = ajv.compile(JSON.parse(responseSchemaFileContent));
const testConfigs : TestCodingResultsTest[] = JSON.parse(fileContent);
const regexInput = /^(.+)_input.json$/;
describe('schema is valid', () => {
    test('for coding scheme', () => {
        expect(compiledCodingSchemeSchema).not.toBeNull();
    });
    test('for response', () => {
        expect(compiledResponseSchema).not.toBeNull();
    });
});

testConfigs.forEach(testConfig => {
  describe(testConfig.test_label, () => {
      let inputIds: string[] = [];
      let codingScheme: CodingScheme | null = null;
      const fileContentCodingScheme = fs.readFileSync(`${sampleFolder}/${testConfig.subfolder}/coding-scheme.json`, 'utf8');
      test('coding scheme: file exists', () => {
          expect(fileContentCodingScheme).not.toBeNull();
      });
      codingScheme = JSON.parse(fileContentCodingScheme);
      test('coding scheme: valid', () => {
          expect(compiledCodingSchemeSchema ? compiledCodingSchemeSchema(codingScheme) : null).not.toBeNull();
      });
      const allFileNames = fs.readdirSync(`${sampleFolder}/${testConfig.subfolder}`);
      inputIds = allFileNames.filter(fn => fn.match(regexInput)).map(fn => {
          const matches = regexInput.exec(fn);
          return matches ? matches[1] : ''
      });
      test('number of input files greater then 0', () => {
          expect(inputIds.length).toBeGreaterThan(0);
      })
      if (codingScheme) {
          const codingSchemeObject = new CodingScheme((codingScheme as CodingScheme).variableCodings);
          inputIds.forEach(inputId => {
              let problems: string[] = [];
              fileContent = fs.readFileSync(`${sampleFolder}/${testConfig.subfolder}/${inputId}_input.json`, 'utf8');
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
                      fileContent = fs.readFileSync(`${sampleFolder}/${testConfig.subfolder}/${inputId}_outcome.json`, 'utf8');
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
                                  test(`${inputId}: outcome as expected`, () => {
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
