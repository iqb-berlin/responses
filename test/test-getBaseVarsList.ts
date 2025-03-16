#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import { CodingScheme } from '@iqbspecs/coding-scheme/coding-scheme.interface';
import { CodingSchemeFactory } from '../src';
const sampleFolder = `${__dirname}/sample_data/${process.argv[2]}`;
let codings: CodingScheme;
try {
  const fileContent = fs.readFileSync(`${sampleFolder}/coding-scheme.json`, 'utf8');
  const codingScheme = JSON.parse(fileContent);
  codings = new CodingScheme(codingScheme.variableCodings);
} catch (err) {
  console.log('\x1b[0;31mERROR\x1b[0m reading data / parsing coding scheme');
  console.error(err);
  process.exit(1);
}

interface Expectation {
  name: string;
  in: string[];
  out: string[];
}

let expectations: Array<Expectation>;
try {
  let fileContent = fs.readFileSync(`${sampleFolder}/expectations.json`, 'utf8');
  expectations = JSON.parse(fileContent);
  if (!('length' in expectations) || (expectations == null)) {
    console.log(expectations);
    throw new Error('expectation file malformed');
  }
} catch (err) {
  console.log('\x1b[0;31mERROR\x1b[0m reading expectation data');
  console.error(err);
  process.exit(1);
}

const compareArrays = (a: Array<string>, b: Array<string>) => {
  a.sort();
  b.sort();
  return JSON.stringify(a) === JSON.stringify(b);
};

CodingSchemeFactory.asText(codings.variableCodings,'EXTENDED');

expectations
  .forEach(expectation => {
    const baseVarList = CodingSchemeFactory.getBaseVarsList(expectation.in,codings.variableCodings);
    if (compareArrays(expectation.out, baseVarList)) {
      console.log(`\x1b[0;32m'${expectation.name}' check passed\x1b[0m`);
    } else {
      console.log(`\x1b[0;31m'${expectation.name}' failed\x1b[0m`);
      console.log('Expectation:', expectation.out);
      console.log('Result:', baseVarList);
    }
  });
