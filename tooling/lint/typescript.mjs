import plugin from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import { createRequire } from 'node:module';

// Resolve both packages with the classic compiler required by typescript-eslint.
export { plugin, parser };
export const parserPath = createRequire(import.meta.url).resolve('@typescript-eslint/parser');
