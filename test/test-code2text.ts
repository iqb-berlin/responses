#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import { VariableCodingData } from '@iqbspecs/coding-scheme';
import { CodingSchemeTextFactory } from '../src';

const ERROR_COLOR = '\x1b[0;31m';
const WARNING_COLOR = '\x1b[0;33m';
const RESET_COLOR = '\x1b[0m';

const sampleFolderPath = `${__dirname}/sample_data/${process.argv[2]}`;
const codingSchemeFilePath = `${sampleFolderPath}/coding-scheme.json`;

function logError(message: string, errorDetails?: Error): void {
  console.error(`${ERROR_COLOR}ERROR${RESET_COLOR} ${message}`);
  if (errorDetails) console.error(errorDetails);
}

function processCodings(codingSchemeData: unknown): void {
  const variableCodings = (
    codingSchemeData as { variableCodings: VariableCodingData[] }
  ).variableCodings;
  const codingTexts = CodingSchemeTextFactory.asText(variableCodings, 'SIMPLE');
  codingTexts?.forEach(({ codes }) => {
    codes?.forEach(({ ruleSetDescriptions }) => {
      console.log('\t', ruleSetDescriptions);
      ruleSetDescriptions?.forEach(description => console.log(`\t\t${WARNING_COLOR}>>>${RESET_COLOR} ${description}`)
      );
    });
  });
}

let codingSchemeData;
try {
  const fileContent = fs.readFileSync(codingSchemeFilePath, 'utf8');
  codingSchemeData = JSON.parse(fileContent);
  console.log('Coding scheme data:', codingSchemeData);
} catch (err) {
  logError('reading data', err as Error);
  process.exitCode = 1;
}

if (!codingSchemeData) {
  logError('in coding scheme.');
  process.exitCode = 1;
} else {
  processCodings(codingSchemeData);
}
