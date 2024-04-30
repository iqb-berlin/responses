import fs from 'fs';
import { CodingScheme } from '../src';

type TestCodingResultsTest = {
  test_label: string;
  codingscheme: string;
  responses: Array<{ input:string, output:string }>;
};

const sampleFolder = `${__dirname}/sample_data/coding-results-cases`;
let codingSchemes : TestCodingResultsTest[];
let fileContent = fs.readFileSync(`${sampleFolder}/codingscheme-tests.json`, 'utf8');
codingSchemes = JSON.parse(fileContent);
codingSchemes.forEach(codingScheme => {
  describe(codingScheme.test_label, () => {
    fileContent = fs.readFileSync(`${sampleFolder}/${codingScheme.codingscheme}`, 'utf8');
    const parsedFilecontent = JSON.parse(fileContent);
    const codingSchemeObject = new CodingScheme(parsedFilecontent.variableCodings);
    codingScheme.responses.forEach(response => {
      it(response.input.replace('_in', ''), async () => {
        fileContent = fs.readFileSync(`${sampleFolder}/${response.input}`, 'utf8');
        const parsedInput = JSON.parse(fileContent);
        fileContent = fs.readFileSync(`${sampleFolder}/${response.output}`, 'utf8');
        const parsedOutput = JSON.parse(fileContent);
        const result = codingSchemeObject.code(parsedInput);
        expect(JSON.stringify(result)).toBe(JSON.stringify(parsedOutput));
      });
    });
  });
});
