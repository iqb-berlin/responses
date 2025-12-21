import { deepClone } from '../../src/utils/deep-clone';
import { isErrorStatus } from '../../src/status-helpers';
import { CODING_SCHEME_STATUS } from '../../src';
import { getValueAsString, transformString } from '../../src/value-transform';

describe('utils/helpers', () => {
  describe('status-helpers', () => {
    test('isErrorStatus matches CODING_ERROR, DERIVE_ERROR and NO_CODING', () => {
      expect(isErrorStatus(CODING_SCHEME_STATUS.CODING_ERROR)).toBe(true);
      expect(isErrorStatus(CODING_SCHEME_STATUS.DERIVE_ERROR)).toBe(true);
      expect(isErrorStatus(CODING_SCHEME_STATUS.NO_CODING)).toBe(true);
      expect(isErrorStatus(CODING_SCHEME_STATUS.VALUE_CHANGED)).toBe(false);
    });
  });

  describe('value-transform', () => {
    test('transformString trims and normalizes dispensable spaces', () => {
      expect(transformString('  A   B  ', ['REMOVE_DISPENSABLE_SPACES'])).toBe(
        'A B'
      );
    });

    test('getValueAsString stringifies number and boolean', () => {
      expect(getValueAsString(12)).toBe('12');
      expect(getValueAsString(true)).toBe('true');
      expect(getValueAsString(false)).toBe('false');
    });
  });

  describe('deep-clone', () => {
    test('falls back to JSON clone when structuredClone is unavailable', () => {
      const originalStructuredClone = (
        globalThis as unknown as { structuredClone?: unknown }
      ).structuredClone;

      try {
        Object.defineProperty(globalThis, 'structuredClone', {
          value: undefined,
          writable: true,
          configurable: true
        });

        const input = { a: 1, b: { c: 2 } };
        const cloned = deepClone(input);

        expect(cloned).toEqual(input);
        expect(cloned).not.toBe(input);
        expect(cloned.b).not.toBe(input.b);
      } finally {
        Object.defineProperty(globalThis, 'structuredClone', {
          value: originalStructuredClone,
          writable: true,
          configurable: true
        });
      }
    });
  });
});
