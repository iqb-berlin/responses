// Keep Babel 8's peer graph separate from Jest's Babel 7 helpers.
import assert from 'node:assert/strict';
import { transformSync, version } from '@babel/core';
import typescriptPreset from '@babel/preset-typescript';

const source = 'interface Value { amount: number }; export const read = (v: Value): number => v.amount;';
assert.match(version, /^8\./);
const { code } = transformSync(source, {
  filename: 'consumer.ts',
  configFile: false,
  babelrc: false,
  presets: [typescriptPreset]
});
const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
assert.equal(module.read({ amount: 42 }), 42);
console.log('Babel 8 TypeScript transform and emitted ESM execute successfully.');
