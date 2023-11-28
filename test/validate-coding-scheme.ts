#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import { CodingScheme } from '../src';

const sampleFolder = `${__dirname}/sample_data/${process.argv[2]}`;
let codingScheme;
let varList;
try {
  let fileContent = fs.readFileSync(`${sampleFolder}/coding-scheme.json`, 'utf8');
  codingScheme = JSON.parse(fileContent);
  fileContent = fs.readFileSync(`${sampleFolder}/var-list.json`, 'utf8');
  varList = JSON.parse(fileContent);
} catch (err) {
  console.log('\x1b[0;31mERROR\x1b[0m reading data');
  console.error(err);
  process.exitCode = 1;
}

if (codingScheme && varList) {
  const codings = new CodingScheme(codingScheme.variableCodings);
  const problems = codings.validate(varList);
  if (problems.length > 0) {
    problems.forEach(p => {
      if (p.breaking) {
        console.log(`\x1b[0;31m${p.type}\x1b[0m ${p.variableId}${p.code ? ' / ' + p.code : ''}`);
        process.exitCode = 1;
      } else {
        console.log(`\x1b[0;32m${p.type}\x1b[0m ${p.variableId}${p.code ? ' / ' + p.code : ''}`);
      }
    })
  } else {
    console.log('no problems');
  }
}
