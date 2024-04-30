#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import { CodingScheme } from '../src';

const sampleFolder = `${__dirname}/sample_data/${process.argv[2]}`;
let codingScheme;
try {
  const fileContent = fs.readFileSync(`${sampleFolder}/coding-scheme.json`, 'utf8');
  codingScheme = JSON.parse(fileContent);
} catch (err) {
  console.log('\x1b[0;31mERROR\x1b[0m reading data');
  console.error(err);
  process.exitCode = 1;
}

if (codingScheme) {
  const codings = new CodingScheme(codingScheme.variableCodings);
  const codingAsText = codings.asText();
  codingAsText.forEach(c => {
    c.codes.forEach(cc => {
      console.log('\t', cc);
      cc.ruleSetDescriptions.forEach(xcc => {
        console.log('\t\t\x1b[0;33m>>>\x1b[0m', xcc);
      });
    });
  });
} else {
  console.log(
    '\x1b[0;31merrors\x1b[0m in coding scheme:'
  );
  process.exitCode = 1;
}
