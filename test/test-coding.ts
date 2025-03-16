#!/usr/bin/env node
/* eslint no-console: ["error", { allow: ["warn", "error", "log"] }] */
import fs from 'fs';
import path from 'path';
import { CodingSchemeFactory } from '../src';
const sampleFolder = path.resolve(__dirname, 'sample_data', process.argv[2]);

/**
 * Lädt eine JSON-Datei und gibt ihren Inhalt als Objekt zurück.
 * @param filePath - Der Pfad zur Datei.
 * @returns Das JSON-Objekt.
 * @throws Fehler, wenn die Datei nicht gelesen oder geparst werden kann.
 */
function loadJsonFile(filePath: string): any {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`\x1b[0;31mERROR\x1b[0m: Fehler beim Laden der Datei '${filePath}'.`);
    throw error;
  }
}

let codingSchemeData;
let responsesData;
let varListData;

try {
  responsesData = loadJsonFile(path.join(sampleFolder, 'responses.json'));
  codingSchemeData = loadJsonFile(path.join(sampleFolder, 'coding-scheme.json'));
  varListData = loadJsonFile(path.join(sampleFolder, 'var-list.json'));
} catch (error) {
  console.error(error);
  process.exit(1);
}

if (responsesData && codingSchemeData && varListData) {
  try {
    const problems = CodingSchemeFactory.validate(varListData,codingSchemeData.variableCodings);
    const fatalErrors = problems.filter((problem) => problem.breaking);

    if (fatalErrors.length === 0) {
      console.log(CodingSchemeFactory.code(responsesData,codingSchemeData.variableCodings));
    } else {
      console.error(`\x1b[0;31mFEHLER\x1b[0m im Kodierungsschema erkannt:`);
      fatalErrors.forEach((error) => console.error(error));
      process.exit(1);
    }
  } catch (error) {
    console.error(`\x1b[0;31mERROR\x1b[0m: Fehler bei der Verarbeitung der Daten.`);
    console.error(error);
    process.exit(1);
  }
}
