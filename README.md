[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](https://creativecommons.org/publicdomain/zero/1.0/)
[![npm](https://img.shields.io/npm/v/%40iqb%2Fresponses)](https://www.npmjs.com/package/@iqb/responses)

This package contains of type definitions for processing assessment data. Additionally, you find TypeScript interfaces and classes, so these data structures can be used in a coherent way. 


# JSON Schema
The definitions are available as JSON schema files. This way, you can validate your data. The schema files are also the source of documentation: [See here](https://pages.cms.hu-berlin.de/iqb/ci_cd/responses) to learn about the data structures.

There is one data structure specified by Verona Interfaces: [variable list](https://github.com/verona-interfaces/editor/blob/master/variable-list/variable-list.json). In this repository `responses`, you find a class to handle variable info of this structure, but the specification is not part of this repo. 

# For developers

* The data is defined via json schema documents. Every folder stands for one definition.
* Every schema is validated against a number of json implementations. Validation is part of the CI, so an invalid schema will not lead to a new documentation. Add valid and invalid json implementations!
* The documentation is also part of the CI. Don't generate it manually!

## Adding new spec

1) Add new folder with new json schema
2) Add valid and invalid tests.
3) Add new script entry in `package.json`
4) Add new script call in `.gitlab-ci.yml` to add the test to CI
5) Add new operation in `asyncapi.yaml` to document the new spec. 
