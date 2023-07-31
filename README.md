This package contains of type definitions for processing assessment data.

Browse through [this document](https://pages.cms.hu-berlin.de/iqb/ci_cd/responses) to learn about the data structures of IQB.

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
