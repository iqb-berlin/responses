#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import { CodingScheme } from '../src';

const sampleFolder = `${__dirname}/sample_data/${process.argv[2]}`;
let codingScheme;
let responses;
let varList;
try {
  let fileContent = fs.readFileSync(`${sampleFolder}/responses.json`, 'utf8');
  responses = JSON.parse(fileContent);
  fileContent = fs.readFileSync(`${sampleFolder}/coding-scheme.json`, 'utf8');
  codingScheme = JSON.parse(fileContent);
  fileContent = fs.readFileSync(`${sampleFolder}/var-list.json`, 'utf8');
  varList = JSON.parse(fileContent);
} catch (err) {
  console.log('\x1b[0;31mERROR\x1b[0m reading data');
  console.error(err);
  process.exitCode = 1;
}

if (responses && codingScheme && varList) {
  const codings = new CodingScheme(codingScheme);
  const problems = codings.validate(varList);
  console.log(problems);
  const fatalErrors = problems.filter(p => p.breaking);
  if (fatalErrors.length === 0) {
    console.log(codings.code(responses));
    codings.asText().forEach(c => {
      console.log(`\x1b[0;34m${c.id}\x1b[0m`);
      console.log(c.source);
      if (c.processing) console.log(c.processing);
      console.log(c.codes);
    });
  } else {
    console.log(
      `\x1b[0;31mERROR\x1b[0m invalid scheme: ${fatalErrors.length} ${fatalErrors.length > 1 ? 'errors' : 'error'}`
    );
    process.exitCode = 1;
  }
}
