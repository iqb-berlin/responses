import fs from 'fs';
import { CodingScheme } from '@iqbspecs/coding-scheme';
import { CodingSchemeFactory } from '../../src';

const folder = process.env.FOLDER;
const regexInput = /^(.+)_input.json$/;

function testOneFolder(path: string, label: string) {
  describe(label, () => {
    const codingSchemeFilename = `${path}/coding-scheme.json`;
    if (fs.existsSync(codingSchemeFilename)) {
      const fileContentCodingScheme = fs.readFileSync(
        codingSchemeFilename,
        'utf8'
      );
      const codingScheme = JSON.parse(fileContentCodingScheme);
      const codingSchemeObject = new CodingScheme(
        (codingScheme as CodingSchemeFactory).variableCodings
      );
      const inputFiles = fs
        .readdirSync(path)
        .filter(fn => fn.endsWith('_input.json'));
      if (inputFiles.length > 0) {
        inputFiles.forEach(inputFile => {
          const matches = regexInput.exec(inputFile);
          const inputId = matches ? matches[1] : '';
          const problems: string[] = [];
          let fileContent = fs.readFileSync(
            `${path}/${inputId}_input.json`,
            'utf8'
          );
          if (fileContent) {
            let parsedInput;
            try {
              parsedInput = JSON.parse(fileContent);
            } catch (err) {
              parsedInput = null;
              problems.push('parsing input file');
            }
            if (problems.length === 0) {
              fileContent = fs.readFileSync(
                `${path}/${inputId}_outcome.json`,
                'utf8'
              );
              if (fileContent) {
                let parsedOutcome: unknown[] | null;
                try {
                  parsedOutcome = JSON.parse(fileContent);
                } catch (err) {
                  parsedOutcome = null;
                  problems.push('parsing outcome file');
                }
                if (parsedOutcome) {
                  if (problems.length === 0) {
                    const result = CodingSchemeFactory.code(
                      parsedInput,
                      codingSchemeObject.variableCodings
                    );
                    test(inputId, () => {
                      expect(JSON.stringify(result)).toBe(
                        JSON.stringify(parsedOutcome)
                      );
                    });
                  }
                }
              } else {
                problems.push('reading outcome file');
              }
            }
          } else {
            problems.push('reading input file');
          }
          if (problems.length > 0) {
            test(`${inputId}: no problems`, () => {
              expect(problems).toStrictEqual([]);
            });
          }
        });
      }
      const codingToText = CodingSchemeFactory.asText(
        codingSchemeObject.variableCodings,
        'EXTENDED'
      );
      const codingToTextStringified = JSON.stringify(codingToText);
      const codingToTextFilename = `${path}/coding-scheme.asText.json`;
      if (fs.existsSync(codingToTextFilename)) {
        const fileContent = fs.readFileSync(codingToTextFilename, 'utf8');
        const fileContentAsJson = JSON.parse(fileContent);
        test('valid as text', () => {
          expect(codingToTextStringified).toBe(
            JSON.stringify(fileContentAsJson)
          );
        });
      } else {
        fs.writeFileSync(codingToTextFilename, codingToTextStringified, 'utf8');
        test('as text file exists', () => {
          expect(fs.existsSync(codingToTextFilename)).toBe(true);
        });
      }
    }
    const subFolders = fs
      .readdirSync(path, { withFileTypes: true })
      .filter(dirEntry => dirEntry.isDirectory())
      .map(dirEntry => dirEntry.name);
    subFolders.forEach(testCaseFolder => {
      testOneFolder(`${path}/${testCaseFolder}`, testCaseFolder);
    });
  });
}

testOneFolder(folder ? `${__dirname}/${folder}` : __dirname, folder || '.');
