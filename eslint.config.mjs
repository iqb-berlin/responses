import typescript from '@iqb/eslint-config/compat';
import javascript from '@iqb/eslint-config/javascript';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import javascriptCompat from './scripts/eslint-javascript-compat.mjs';

export default [
  { ignores: ['dist/**', 'coverage/**', '**/.*'] },
  ...javascript,
  ...typescript,
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
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
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
  }
];
