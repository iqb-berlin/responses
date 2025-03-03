
    const schema = {
  "asyncapi": "2.5.0",
  "info": {
    "title": "Object specifications for storing and processing response in assessments",
    "description": "After the assessment is finished, the response data are to be processed in various ways. The data structures describe here are part of interface specifications of IQB.\n\nGo to the Schema section of this document and select one schema. Expand all nodes and explore.\n",
    "license": {
      "name": "CC0 1.0",
      "url": "https://creativecommons.org/publicdomain/zero/1.0/"
    },
    "version": "(see schema id for version)",
    "contact": {
      "name": "Institute for Educational Quality Improvement (IQB)",
      "url": "https://www.iqb.hu-berlin.de",
      "email": "iqb-tbadev@hu-berlin.de"
    }
  },
  "channels": {
    "iqb_data_structures": {
      "subscribe": {
        "operationId": "Please select one schema",
        "message": {
          "messageId": "select_schema",
          "x-parser-message-name": "select_schema"
        }
      }
    }
  },
  "components": {
    "schemas": {
      "response": {
        "$id": "response@iqb-standard@1.4",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Response",
        "description": "Data structure produced by verona players",
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[0-9a-zA-Z_-]+$",
            "description": "Identifier for the data source (variable)",
            "x-parser-schema-id": "<anonymous-schema-1>"
          },
          "status": {
            "type": "string",
            "enum": [
              "UNSET",
              "NOT_REACHED",
              "DISPLAYED",
              "PARTLY_DISPLAYED",
              "VALUE_CHANGED",
              "DERIVE_PENDING",
              "DERIVE_ERROR",
              "NO_CODING",
              "INVALID",
              "CODING_INCOMPLETE",
              "CODING_ERROR",
              "CODING_COMPLETE",
              "INTENDED_INCOMPLETE"
            ],
            "description": "Status as stage in the workflow of creating and coding a variable's value",
            "x-parser-schema-id": "<anonymous-schema-2>"
          },
          "value": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "x-parser-schema-id": "<anonymous-schema-5>"
                },
                "x-parser-schema-id": "<anonymous-schema-4>"
              },
              {
                "type": "array",
                "items": {
                  "type": [
                    "number",
                    "null"
                  ],
                  "x-parser-schema-id": "<anonymous-schema-7>"
                },
                "x-parser-schema-id": "<anonymous-schema-6>"
              },
              {
                "type": "array",
                "items": {
                  "type": [
                    "boolean",
                    "null"
                  ],
                  "x-parser-schema-id": "<anonymous-schema-9>"
                },
                "x-parser-schema-id": "<anonymous-schema-8>"
              },
              {
                "type": "number",
                "x-parser-schema-id": "<anonymous-schema-10>"
              },
              {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-11>"
              },
              {
                "type": "null",
                "x-parser-schema-id": "<anonymous-schema-12>"
              },
              {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-13>"
              }
            ],
            "x-parser-schema-id": "<anonymous-schema-3>"
          },
          "subform": {
            "type": "string",
            "description": "If variables i. e. data source ids are not unique in the unit, 'subform' can specify the sub object related to the specific variable.",
            "x-parser-schema-id": "<anonymous-schema-14>"
          },
          "code": {
            "type": "integer",
            "description": "Code representing the category of the value after coding process.",
            "x-parser-schema-id": "<anonymous-schema-15>"
          },
          "score": {
            "type": "integer",
            "description": "This value represents the result evaluation of the code after coding process.",
            "x-parser-schema-id": "<anonymous-schema-16>"
          }
        },
        "required": [
          "id",
          "status",
          "value"
        ],
        "x-parser-schema-id": "response@iqb-standard@1.4"
      },
      "coding_scheme": {
        "$id": "coding-scheme@iqb-standard@3.2",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Coding Scheme",
        "description": "Data structure to specify all processing steps of response data in order to get coded and scored data for analyses.",
        "type": "object",
        "properties": {
          "version": {
            "type": "string",
            "description": "Major and minor of the version of the data structure.",
            "pattern": "^\\d+\\.\\d+$",
            "examples": [
              "3.5",
              "4.10"
            ],
            "x-parser-schema-id": "<anonymous-schema-17>"
          },
          "variableCodings": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Identifier for the variable. In case of a scheme for a base variable, this id is identical with the source variable's id. All ids of a response scheme should be unique.",
                  "pattern": "^[0-9a-zA-Z_]+$",
                  "x-parser-schema-id": "<anonymous-schema-20>"
                },
                "alias": {
                  "type": "string",
                  "description": "Alternative identifier for the variable. In case of a scheme for a base variable, this id is identical with the source variable's alternative id. All alternative ids of a response scheme should be unique.",
                  "pattern": "^[0-9a-zA-Z_]+$",
                  "x-parser-schema-id": "<anonymous-schema-21>"
                },
                "label": {
                  "type": "string",
                  "description": "Some additional info for UI",
                  "x-parser-schema-id": "<anonymous-schema-22>"
                },
                "sourceType": {
                  "type": "string",
                  "description": "Specifies how to derive (concatenate, check uniqueness, sum code etc.).",
                  "enum": [
                    "BASE",
                    "BASE_NO_VALUE",
                    "MANUAL",
                    "COPY_VALUE",
                    "CONCAT_CODE",
                    "SUM_CODE",
                    "SUM_SCORE",
                    "UNIQUE_VALUES",
                    "SOLVER"
                  ],
                  "x-parser-schema-id": "<anonymous-schema-23>"
                },
                "sourceParameters": {
                  "type": "object",
                  "description": "Parameters to specify the derive method",
                  "properties": {
                    "solverExpression": {
                      "type": "string",
                      "description": "If sourceType 'solver', this expression is evaluated when deriving. Placeholder for variables are in curly brakes.",
                      "examples": [
                        "${01}*${03}-100"
                      ],
                      "x-parser-schema-id": "<anonymous-schema-25>"
                    },
                    "processing": {
                      "type": "array",
                      "description": "Some options to change value or status",
                      "items": {
                        "type": "string",
                        "enum": [
                          "TO_LOWER_CASE",
                          "TO_NUMBER",
                          "REMOVE_ALL_SPACES",
                          "REMOVE_DISPENSABLE_SPACES",
                          "TAKE_DISPLAYED_AS_VALUE_CHANGED",
                          "TAKE_NOT_REACHED_AS_VALUE_CHANGED",
                          "TAKE_EMPTY_AS_VALID",
                          "SORT"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      },
                      "x-parser-schema-id": "<anonymous-schema-26>"
                    }
                  },
                  "x-parser-schema-id": "<anonymous-schema-24>"
                },
                "deriveSources": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "pattern": "^[0-9a-zA-Z_]+$",
                    "x-parser-schema-id": "<anonymous-schema-29>"
                  },
                  "x-parser-schema-id": "<anonymous-schema-28>"
                },
                "processing": {
                  "type": "array",
                  "description": "This parameter defines what (pre)processing should be done.",
                  "items": {
                    "type": "string",
                    "enum": [
                      "IGNORE_CASE",
                      "IGNORE_ALL_SPACES",
                      "IGNORE_DISPENSABLE_SPACES",
                      "SORT_ARRAY",
                      "REPLAY_REQUIRED",
                      "ATTACHMENT"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-31>"
                  },
                  "x-parser-schema-id": "<anonymous-schema-30>"
                },
                "fragmenting": {
                  "type": "string",
                  "description": "Regular expression to get fragments out of the value if of type string",
                  "x-parser-schema-id": "<anonymous-schema-32>"
                },
                "manualInstruction": {
                  "type": "string",
                  "description": "Instructions for manual coding.",
                  "x-parser-schema-id": "<anonymous-schema-33>"
                },
                "codeModel": {
                  "type": "string",
                  "enum": [
                    "MANUAL_AND_RULES",
                    "RULES_ONLY",
                    "MANUAL_ONLY"
                  ],
                  "description": "Info for applications to simplify UI",
                  "x-parser-schema-id": "<anonymous-schema-34>"
                },
                "page": {
                  "type": "string",
                  "description": "If the unit supports paging, this property defines the page to be presented to the coder if manually coded.",
                  "x-parser-schema-id": "<anonymous-schema-35>"
                },
                "codes": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "oneOf": [
                          {
                            "type": "integer",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          {
                            "type": "string",
                            "enum": [
                              "INVALID",
                              "INTENDED_INCOMPLETE"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          }
                        ],
                        "description": "If this code's rules/instructions match, the code and score is taken for the response. If the code id is of type 'string', the status 'INVALID' or 'INTENDED_INCOMPLETE' will be set.",
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      },
                      "type": {
                        "type": "string",
                        "enum": [
                          "UNSET",
                          "FULL_CREDIT",
                          "PARTIAL_CREDIT",
                          "TO_CHECK",
                          "NO_CREDIT",
                          "RESIDUAL",
                          "RESIDUAL_AUTO",
                          "INTENDED_INCOMPLETE"
                        ],
                        "description": "To ease some processing and documentation",
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      },
                      "label": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      },
                      "score": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-43>"
                      },
                      "manualInstruction": {
                        "type": "string",
                        "description": "Instructions for manual coding.",
                        "x-parser-schema-id": "<anonymous-schema-44>"
                      },
                      "ruleSetOperatorAnd": {
                        "type": "boolean",
                        "description": "If true, all rule sets must match to take that code. Otherwise (default: false), one matching rule set will satisfy.",
                        "x-parser-schema-id": "<anonymous-schema-45>"
                      },
                      "ruleSets": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "valueArrayPos": {
                              "anyOf": [
                                {
                                  "type": "integer",
                                  "description": "Refers to a specific position in the value array [0..n-1].",
                                  "x-parser-schema-id": "<anonymous-schema-49>"
                                },
                                {
                                  "type": "string",
                                  "description": "Refers to any position in the value array, to the sum of all array values or the length of the value array.",
                                  "enum": [
                                    "ANY",
                                    "ANY_OPEN",
                                    "SUM",
                                    "LENGTH"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-50>"
                                }
                              ],
                              "x-parser-schema-id": "<anonymous-schema-48>"
                            },
                            "ruleOperatorAnd": {
                              "type": "boolean",
                              "description": "If true, all rules must match to take that code. Otherwise (default: false), one matching rule will satisfy.",
                              "x-parser-schema-id": "<anonymous-schema-51>"
                            },
                            "rules": {
                              "type": "array",
                              "items": {
                                "type": "object",
                                "properties": {
                                  "fragment": {
                                    "type": "integer",
                                    "description": "Refers to a specific fragment of the value [0..n-1] or to any -1.",
                                    "x-parser-schema-id": "<anonymous-schema-54>"
                                  },
                                  "method": {
                                    "type": "string",
                                    "description": "Condition for evaluation",
                                    "enum": [
                                      "MATCH",
                                      "MATCH_REGEX",
                                      "NUMERIC_MATCH",
                                      "NUMERIC_FULL_RANGE",
                                      "NUMERIC_RANGE",
                                      "NUMERIC_LESS_THAN",
                                      "NUMERIC_MORE_THAN",
                                      "NUMERIC_MAX",
                                      "NUMERIC_MIN",
                                      "IS_EMPTY",
                                      "IS_NULL",
                                      "IS_TRUE",
                                      "IS_FALSE"
                                    ],
                                    "x-parser-schema-id": "<anonymous-schema-55>"
                                  },
                                  "parameters": {
                                    "type": "array",
                                    "description": "Depending on the method, additional parameter(s) is needed. See separate documentation",
                                    "items": {
                                      "type": "string",
                                      "x-parser-schema-id": "<anonymous-schema-57>"
                                    },
                                    "x-parser-schema-id": "<anonymous-schema-56>"
                                  }
                                },
                                "required": [
                                  "method"
                                ],
                                "x-parser-schema-id": "<anonymous-schema-53>"
                              },
                              "x-parser-schema-id": "<anonymous-schema-52>"
                            }
                          },
                          "required": [
                            "rules"
                          ],
                          "x-parser-schema-id": "<anonymous-schema-47>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-46>"
                      }
                    },
                    "required": [
                      "id"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-37>"
                  },
                  "x-parser-schema-id": "<anonymous-schema-36>"
                }
              },
              "required": [
                "id",
                "sourceType"
              ],
              "x-parser-schema-id": "<anonymous-schema-19>"
            },
            "x-parser-schema-id": "<anonymous-schema-18>"
          }
        },
        "required": [
          "version",
          "variables"
        ],
        "x-parser-schema-id": "coding-scheme@iqb-standard@3.2"
      }
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  