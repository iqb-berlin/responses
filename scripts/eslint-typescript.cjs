// Port the existing IQB/Airbnb policy to typescript-eslint 8 without losing its style rules.
// The two explicit peer overrides in package.json are paired with this adapter.
const iqb = require('@iqb/eslint-config');
const airbnb = require('eslint-config-airbnb-typescript/lib/shared');
const previousRules = { ...airbnb.rules, ...iqb.rules };
const rules = {};

for (const name of [
  'brace-style', 'comma-dangle', 'comma-spacing', 'func-call-spacing', 'indent',
  'keyword-spacing', 'lines-between-class-members', 'no-extra-parens', 'no-extra-semi',
  'space-before-blocks', 'quotes', 'semi', 'space-before-function-paren',
  'space-infix-ops', 'object-curly-spacing'
]) {
  rules[`@typescript-eslint/${name}`] = 'off';
  rules[`@stylistic/${name === 'func-call-spacing' ? 'function-call-spacing' : name}`] =
    previousRules[`@typescript-eslint/${name}`];
}
rules['@typescript-eslint/no-loss-of-precision'] = 'off';
rules['no-loss-of-precision'] = previousRules['@typescript-eslint/no-loss-of-precision'];
rules['@typescript-eslint/no-throw-literal'] = 'off';
rules['@typescript-eslint/only-throw-error'] = previousRules['@typescript-eslint/no-throw-literal'];
// Version 8 changed this default; retain the IQB policy's treatment of catch bindings.
rules['@typescript-eslint/no-unused-vars'] = ['error', { caughtErrors: 'none' }];

module.exports = {
  extends: ['@iqb/eslint-config'],
  plugins: ['@stylistic'],
  rules
};
