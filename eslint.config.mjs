import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { createNodeResolver } from 'eslint-plugin-import-x';
import { parser, parserPath, plugin } from './tooling/lint/typescript.mjs';
import typescriptRules from './tooling/lint/typescript-rules.mjs';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import javascriptCompat from './scripts/eslint-javascript-compat.mjs';

export default [
  { ignores: ['dist/**', 'coverage/**', '**/.*'] },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,jsx,cjs,mjs}'],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      ...js.configs.recommended.rules,
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/max-len': ['warn', 120],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1, FunctionExpression: { parameters: 'first' } }],
      'prefer-destructuring': ['error', {
        VariableDeclarator: { array: false, object: false },
        AssignmentExpression: { array: false, object: false }
      }]
    }
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
  {
    files: ['**/*.js'],
    plugins: { 'import-x': importX },
    languageOptions: { ecmaVersion: 2021, globals: globals.node },
    settings: {
      'import-x/resolver': { node: { extensions: ['.mjs', '.js', '.json'] } },
      'import-x/extensions': ['.js', '.mjs', '.jsx'],
      'import-x/core-modules': [],
      'import-x/ignore': ['node_modules', '\\.(coffee|scss|css|less|hbs|svg|json)$']
    },
    rules: javascriptCompat
  },
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    plugins: { '@typescript-eslint': plugin, '@stylistic': stylistic, 'import-x': importX },
    settings: {
      'import-x/parsers': { [parserPath]: ['.ts', '.tsx', '.d.ts'] },
      'import-x/extensions': ['.js', '.mjs', '.jsx', '.ts', '.tsx', '.d.ts'],
      'import-x/resolver-next': [createNodeResolver({
        extensions: ['.mjs', '.js', '.json', '.ts', '.d.ts'],
        extensionAlias: { '.js': ['.ts', '.js'] }
      })]
    },
    languageOptions: {
      parser,
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        projectService: false,
        project: './test/tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      ...typescriptRules,
      'import-x/no-unresolved': 'off',
      'import-x/named': 'off',
      // Keep the active rules added by this project's former typescript-eslint 8 adapter.
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      'no-loss-of-precision': 'error',
      'global-require': 'error',
      'lines-around-directive': ['error', { before: 'always', after: 'always' }],
      'no-buffer-constructor': 'error',
      'no-new-require': 'error',
      'no-path-concat': 'error',
      'no-inner-declarations': ['error', 'functions', { blockScopedFunctions: 'disallow' }],
      'no-constant-condition': ['error', { checkLoops: true }],
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      // Node ESM requires explicit runtime extensions in source and declaration imports.
      'import-x/extensions': ['error', 'ignorePackages', { js: 'always', ts: 'never' }]
    }
  }
];
