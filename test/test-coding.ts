#!/usr/bin/env node
import {CodingScheme} from "../src";

const sample_folder = `${__dirname}/sample_data/${process.argv[2]}`;
const fs = require('fs');

let codingScheme;
let responses;
let varList;
try {
    let fileContent = fs.readFileSync(`${sample_folder}/responses.json`, 'utf8');
    responses = JSON.parse(fileContent);
    fileContent = fs.readFileSync(`${sample_folder}/coding-scheme.json`, 'utf8');
    codingScheme = JSON.parse(fileContent);
    fileContent = fs.readFileSync(`${sample_folder}/var-list.json`, 'utf8');
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
    } else {
        console.log(`\x1b[0;31mERROR\x1b[0m invalid scheme: ${fatalErrors.length} ${fatalErrors.length > 1 ? 'errors' : 'error'}`);
        process.exitCode = 1;
    }
}
