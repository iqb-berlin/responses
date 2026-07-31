export type PortableRegexStatus = 'portable' | 'invalid' | 'unsupported';

const containsUnsupportedConstruct = (pattern: string): boolean => {
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern.charCodeAt(index) > 0x7f) return true;

    if (pattern[index] === '\\' && index + 1 < pattern.length) {
      const escaped = pattern[index + 1];
      if (/[1-9kpPux]/.test(escaped)) return true;
      index += 1;
    } else if (pattern[index] === '(' && pattern[index + 1] === '?') {
      if (pattern[index + 2] !== ':') return true;
    }
  }
  return false;
};

export const analyzePortableRegex = (pattern: string): PortableRegexStatus => {
  if (containsUnsupportedConstruct(pattern)) return 'unsupported';
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return 'portable';
  } catch (error) {
    return 'invalid';
  }
};

export const createPortableRegex = (
  pattern: string,
  ignoreCase: boolean
): RegExp | null => {
  const status = analyzePortableRegex(pattern);
  if (status === 'unsupported') {
    throw new TypeError('Pattern is outside the portable ECMAScript subset.');
  }
  if (status === 'invalid') return null;
  return new RegExp(pattern, ignoreCase ? 'i' : undefined);
};
