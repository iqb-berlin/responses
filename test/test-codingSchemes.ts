#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import { CodingScheme } from '../src';

type TestCodingSchemes = {
  test_label: string;
  codingscheme: string;
  responses: Array<{ input:string, output:string }>;
};

const sampleFolder = `${__dirname}/sample_data/${process.argv[2]}`;
let codingSchemes : TestCodingSchemes[];
try {
  let fileContent = fs.readFileSync(`${sampleFolder}/codingscheme-tests.json`, 'utf8');
  codingSchemes = JSON.parse(fileContent);
  codingSchemes.forEach(codingScheme => {
    fileContent = fs.readFileSync(`${sampleFolder}/${codingScheme.codingscheme}`, 'utf8');
    const parsedFilecontent = JSON.parse(fileContent);
    const codingSchemeObject = new CodingScheme(parsedFilecontent.variableCodings);
    codingScheme.responses.forEach(response => {
      try {
        fileContent = fs.readFileSync(`${sampleFolder}/${response.input}`, 'utf8');
        const parsedInput = JSON.parse(fileContent);
        fileContent = fs.readFileSync(`${sampleFolder}/${response.output}`, 'utf8');
        const parsedOutput = JSON.parse(fileContent);
        const result = codingSchemeObject.code(parsedInput);
        if (JSON.stringify(result) === JSON.stringify(parsedOutput)) {
          console.log(`TEST PASSED ${codingScheme.test_label}`);
        } else {
          console.log(`TEST NOT PASSED ${codingScheme.test_label}`);
          console.log('input:', response.input);
          console.log('expected:', response.output);
          console.log('got:', result);
        }
      } catch (err) {
        console.log('\x1b[0;31mERROR\x1b[0m reading data');
        console.error(err);
        process.exitCode = 1;
      }
    });
  });
} catch (err) {
  console.log('\x1b[0;31mERROR\x1b[0m reading data');
  console.error(err);
  process.exitCode = 1;
}
