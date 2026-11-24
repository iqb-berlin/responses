/*
MIT License

Copyright (c) 2012 Airbnb
Copyright (c) 2021 Institute for Educational Quality Improvement (IQB)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// JavaScript settings from @iqb/eslint-config 2.2.0 and airbnb-base 15.
// Preserve the historical JavaScript checks alongside the project TypeScript rules.
export default {
  '@stylistic/indent': [
    'error',
    2,
    {
      SwitchCase: 1,
      FunctionExpression: { parameters: 'first' },
      flatTernaryExpressions: false,
      offsetTernaryExpressions: false,
      ignoreComments: false
    }
  ],
  'array-bracket-spacing': ['error', 'never'],
  'array-callback-return': ['error', { allowImplicit: true, checkForEach: false, allowVoid: false }],
  'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
  'arrow-spacing': ['error', { before: true, after: true }],
  'block-scoped-var': 'error',
  'block-spacing': ['error', 'always'],
  'brace-style': ['error', '1tbs', { allowSingleLine: true }],
  camelcase: ['error', { properties: 'never', ignoreDestructuring: false, ignoreImports: false, ignoreGlobals: false }],
  'class-methods-use-this': ['error', { exceptMethods: [], enforceForClassFields: true }],
  'comma-spacing': ['error', { before: false, after: true }],
  'comma-style': [
    'error',
    'last',
    {
      exceptions: {
        ArrayExpression: false,
        ArrayPattern: false,
        ArrowFunctionExpression: false,
        CallExpression: false,
        FunctionDeclaration: false,
        FunctionExpression: false,
        ImportDeclaration: false,
        ObjectExpression: false,
        ObjectPattern: false,
        VariableDeclaration: false,
        NewExpression: false
      }
    }
  ],
  'computed-property-spacing': ['error', 'never'],
  'consistent-return': 'error',
  curly: ['error', 'multi-line'],
  'default-case': ['error', { commentPattern: '^no default$' }],
  'default-case-last': 'error',
  'default-param-last': 'error',
  'dot-location': ['error', 'property'],
  'dot-notation': ['error', { allowKeywords: true, allowPattern: '' }],
  'eol-last': ['error', 'always'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'func-call-spacing': ['error', 'never'],
  'func-names': 'warn',
  'function-call-argument-newline': ['error', 'consistent'],
  'function-paren-newline': ['error', 'multiline-arguments'],
  'generator-star-spacing': ['error', { before: false, after: true }],
  'getter-return': ['error', { allowImplicit: true }],
  'global-require': 'error',
  'grouped-accessor-pairs': 'error',
  'guard-for-in': 'error',
  'implicit-arrow-linebreak': ['error', 'beside'],
  'import-x/export': 'error',
  'import-x/extensions': ['error', 'ignorePackages', { js: 'never', mjs: 'never', jsx: 'never' }],
  'import-x/first': 'error',
  'import-x/named': 'error',
  'import-x/newline-after-import': 'error',
  'import-x/no-absolute-path': 'error',
  'import-x/no-amd': 'error',
  'import-x/no-cycle': ['error', { maxDepth: '∞', ignoreExternal: false, allowUnsafeDynamicCyclicDependency: false }],
  'import-x/no-duplicates': 'error',
  'import-x/no-dynamic-require': 'error',
  'import-x/no-extraneous-dependencies': [
    'error',
    {
      devDependencies: [
        'test/**',
        'tests/**',
        'spec/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        'test.{js,jsx}',
        'test-*.{js,jsx}',
        '**/*{.,_}{test,spec}.{js,jsx}',
        '**/jest.config.js',
        '**/jest.setup.js',
        '**/vue.config.js',
        '**/webpack.config.js',
        '**/webpack.config.*.js',
        '**/rollup.config.js',
        '**/rollup.config.*.js',
        '**/gulpfile.js',
        '**/gulpfile.*.js',
        '**/Gruntfile{,.js}',
        '**/protractor.conf.js',
        '**/protractor.conf.*.js',
        '**/karma.conf.js',
        '**/.eslintrc.js'
      ],
      optionalDependencies: false
    }
  ],
  'import-x/no-import-module-exports': ['error', { exceptions: [] }],
  'import-x/no-mutable-exports': 'error',
  'import-x/no-named-as-default': 'error',
  'import-x/no-named-as-default-member': 'error',
  'import-x/no-named-default': 'error',
  'import-x/no-relative-packages': 'error',
  'import-x/no-self-import': 'error',
  'import-x/no-unresolved': ['error', { commonjs: true, caseSensitive: true, caseSensitiveStrict: false }],
  'import-x/no-useless-path-segments': ['error', { commonjs: true }],
  'import-x/no-webpack-loader-syntax': 'error',
  'import-x/order': [
    'error',
    { groups: [['builtin', 'external', 'internal']], distinctGroup: true, warnOnUnassignedImports: false }
  ],
  'import-x/prefer-default-export': 'error',
  'key-spacing': ['error', { beforeColon: false, afterColon: true }],
  'keyword-spacing': [
    'error',
    { before: true, after: true, overrides: { return: { after: true }, throw: { after: true }, case: { after: true } } }
  ],
  'linebreak-style': ['error', 'unix'],
  'lines-around-directive': ['error', { before: 'always', after: 'always' }],
  'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
  'max-classes-per-file': ['error', 1],
  'new-cap': [
    'error',
    {
      newIsCap: true,
      newIsCapExceptions: [],
      capIsNew: false,
      capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
      properties: true
    }
  ],
  'new-parens': 'error',
  'newline-per-chained-call': ['error', { ignoreChainWithDepth: 4 }],
  'no-alert': 'warn',
  'no-array-constructor': 'error',
  'no-await-in-loop': 'error',
  'no-bitwise': 'error',
  'no-buffer-constructor': 'error',
  'no-caller': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-confusing-arrow': ['error', { allowParens: true, onlyOneSimpleParam: false }],
  'no-console': 'warn',
  'no-constant-binary-expression': 'off',
  'no-constant-condition': ['warn', { checkLoops: true }],
  'no-constructor-return': 'error',
  'no-continue': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  'no-empty': 'error',
  'no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
  'no-empty-pattern': 'error',
  'no-empty-static-block': 'off',
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-extra-bind': 'error',
  'no-extra-boolean-cast': 'error',
  'no-extra-label': 'error',
  'no-extra-semi': 'error',
  'no-fallthrough': 'error',
  'no-floating-decimal': 'error',
  'no-implied-eval': 'error',
  'no-inner-declarations': ['error', 'functions', { blockScopedFunctions: 'disallow' }],
  'no-invalid-regexp': 'error',
  'no-irregular-whitespace': 'error',
  'no-iterator': 'error',
  'no-label-var': 'error',
  'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
  'no-lone-blocks': 'error',
  'no-lonely-if': 'error',
  'no-loop-func': 'error',
  'no-misleading-character-class': 'error',
  'no-mixed-operators': [
    'error',
    {
      groups: [
        ['%', '**'],
        ['%', '+'],
        ['%', '-'],
        ['%', '*'],
        ['%', '/'],
        ['/', '*'],
        ['&', '|', '<<', '>>', '>>>'],
        ['==', '!=', '===', '!=='],
        ['&&', '||']
      ],
      allowSamePrecedence: false
    }
  ],
  'no-mixed-spaces-and-tabs': 'error',
  'no-multi-assign': 'error',
  'no-multi-spaces': ['error', { ignoreEOLComments: false }],
  'no-multi-str': 'error',
  'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
  'no-nested-ternary': 'error',
  'no-new': 'error',
  'no-new-func': 'error',
  'no-new-native-nonconstructor': 'off',
  'no-new-object': 'error',
  'no-new-require': 'error',
  'no-new-symbol': 'error',
  'no-new-wrappers': 'error',
  'no-octal-escape': 'error',
  'no-param-reassign': [
    'error',
    {
      props: true,
      ignorePropertyModificationsFor: [
        'acc',
        'accumulator',
        'e',
        'ctx',
        'context',
        'req',
        'request',
        'res',
        'response',
        '$scope',
        'staticContext'
      ]
    }
  ],
  'no-path-concat': 'error',
  'no-plusplus': 'error',
  'no-promise-executor-return': 'error',
  'no-proto': 'error',
  'no-redeclare': 'error',
  'no-restricted-exports': ['error', { restrictedNamedExports: ['default', 'then'] }],
  'no-restricted-globals': [
    'error',
    {
      name: 'isFinite',
      message: 'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite'
    },
    { name: 'isNaN', message: 'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan' },
    'addEventListener',
    'blur',
    'close',
    'closed',
    'confirm',
    'defaultStatus',
    'defaultstatus',
    'event',
    'external',
    'find',
    'focus',
    'frameElement',
    'frames',
    'history',
    'innerHeight',
    'innerWidth',
    'length',
    'location',
    'locationbar',
    'menubar',
    'moveBy',
    'moveTo',
    'name',
    'onblur',
    'onerror',
    'onfocus',
    'onload',
    'onresize',
    'onunload',
    'open',
    'opener',
    'opera',
    'outerHeight',
    'outerWidth',
    'pageXOffset',
    'pageYOffset',
    'parent',
    'print',
    'removeEventListener',
    'resizeBy',
    'resizeTo',
    'screen',
    'screenLeft',
    'screenTop',
    'screenX',
    'screenY',
    'scroll',
    'scrollbars',
    'scrollBy',
    'scrollTo',
    'scrollX',
    'scrollY',
    'self',
    'status',
    'statusbar',
    'stop',
    'toolbar',
    'top'
  ],
  'no-restricted-properties': [
    'error',
    { object: 'arguments', property: 'callee', message: 'arguments.callee is deprecated' },
    { object: 'global', property: 'isFinite', message: 'Please use Number.isFinite instead' },
    { object: 'self', property: 'isFinite', message: 'Please use Number.isFinite instead' },
    { object: 'window', property: 'isFinite', message: 'Please use Number.isFinite instead' },
    { object: 'global', property: 'isNaN', message: 'Please use Number.isNaN instead' },
    { object: 'self', property: 'isNaN', message: 'Please use Number.isNaN instead' },
    { object: 'window', property: 'isNaN', message: 'Please use Number.isNaN instead' },
    { property: '__defineGetter__', message: 'Please use Object.defineProperty instead.' },
    { property: '__defineSetter__', message: 'Please use Object.defineProperty instead.' },
    { object: 'Math', property: 'pow', message: 'Use the exponentiation operator (**) instead.' }
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ForInStatement',
      message:
        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.'
    },
    {
      selector: 'ForOfStatement',
      message:
        'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.'
    },
    {
      selector: 'LabeledStatement',
      message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.'
    },
    {
      selector: 'WithStatement',
      message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.'
    }
  ],
  'no-return-assign': ['error', 'always'],
  'no-return-await': 'error',
  'no-script-url': 'error',
  'no-self-compare': 'error',
  'no-sequences': 'error',
  'no-shadow': 'error',
  'no-shadow-restricted-names': 'error',
  'no-spaced-func': 'error',
  'no-tabs': 'error',
  'no-template-curly-in-string': 'error',
  'no-throw-literal': 'error',
  'no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
  'no-undef': 'error',
  'no-undef-init': 'error',
  'no-underscore-dangle': [
    'error',
    {
      allow: [],
      allowAfterThis: false,
      allowAfterSuper: false,
      enforceInMethodNames: true,
      allowAfterThisConstructor: false,
      allowFunctionParams: true,
      enforceInClassFields: false,
      allowInArrayDestructuring: true,
      allowInObjectDestructuring: true
    }
  ],
  'no-unneeded-ternary': ['error', { defaultAssignment: false }],
  'no-unreachable-loop': ['error', { ignore: [] }],
  'no-unsafe-negation': 'error',
  'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
  'no-unused-expressions': [
    'error',
    { allowShortCircuit: false, allowTernary: false, allowTaggedTemplates: false, enforceForJSX: false }
  ],
  'no-unused-private-class-members': 'off',
  'no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true, caughtErrors: 'none' }],
  'no-use-before-define': ['error', { functions: true, classes: true, variables: true }],
  'no-useless-computed-key': 'error',
  'no-useless-concat': 'error',
  'no-useless-constructor': 'error',
  'no-useless-escape': 'error',
  'no-useless-rename': ['error', { ignoreDestructuring: false, ignoreImport: false, ignoreExport: false }],
  'no-useless-return': 'error',
  'no-var': 'error',
  'no-void': 'error',
  'no-whitespace-before-property': 'error',
  'nonblock-statement-body-position': ['error', 'beside', { overrides: {} }],
  'object-curly-newline': [
    'error',
    {
      ObjectExpression: { minProperties: 4, multiline: true, consistent: true },
      ObjectPattern: { minProperties: 4, multiline: true, consistent: true },
      ImportDeclaration: { minProperties: 4, multiline: true, consistent: true },
      ExportDeclaration: { minProperties: 4, multiline: true, consistent: true }
    }
  ],
  'object-curly-spacing': ['error', 'always'],
  'object-property-newline': ['error', { allowAllPropertiesOnSameLine: true, allowMultiplePropertiesPerLine: false }],
  'object-shorthand': ['error', 'always', { ignoreConstructors: false, avoidQuotes: true }],
  'one-var': ['error', 'never'],
  'one-var-declaration-per-line': ['error', 'always'],
  'operator-assignment': ['error', 'always'],
  'operator-linebreak': ['error', 'before', { overrides: { '=': 'none' } }],
  'padded-blocks': ['error', { blocks: 'never', classes: 'never', switches: 'never' }, { allowSingleLineBlocks: true }],
  'prefer-arrow-callback': ['error', { allowNamedFunctions: false, allowUnboundThis: true }],
  'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
  'prefer-exponentiation-operator': 'error',
  'prefer-numeric-literals': 'error',
  'prefer-object-spread': 'error',
  'prefer-promise-reject-errors': ['error', { allowEmptyReject: true }],
  'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  'prefer-template': 'error',
  'quote-props': ['error', 'as-needed', { keywords: false, unnecessary: true, numbers: false }],
  quotes: ['error', 'single', { avoidEscape: true }],
  radix: 'error',
  'rest-spread-spacing': ['error', 'never'],
  semi: ['error', 'always'],
  'semi-spacing': ['error', { before: false, after: true }],
  'semi-style': ['error', 'last'],
  'space-before-blocks': 'error',
  'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
  'space-in-parens': ['error', 'never'],
  'space-infix-ops': 'error',
  'space-unary-ops': ['error', { words: true, nonwords: false, overrides: {} }],
  'spaced-comment': [
    'error',
    'always',
    {
      line: { exceptions: ['-', '+'], markers: ['=', '!', '/'] },
      block: { exceptions: ['-', '+'], markers: ['=', '!', ':', '::'], balanced: true }
    }
  ],
  strict: ['error', 'never'],
  'switch-colon-spacing': ['error', { after: true, before: false }],
  'symbol-description': 'error',
  'template-curly-spacing': 'error',
  'template-tag-spacing': ['error', 'never'],
  'unicode-bom': ['error', 'never'],
  'use-isnan': 'error',
  'valid-typeof': ['error', { requireStringLiterals: true }],
  'vars-on-top': 'error',
  'wrap-iife': ['error', 'outside', { functionPrototypeMethods: false }],
  'yield-star-spacing': ['error', 'after'],
  yoda: 'error'
};
