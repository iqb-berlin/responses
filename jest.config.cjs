/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', {
      jsc: { parser: { syntax: 'typescript' }, target: 'es2016' },
      module: { type: 'commonjs' }
    }]
  },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testEnvironment: 'node',
  testMatch: ['**/test/**/test.ts', '**/test/**/*.test.ts', '**/test/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  watchPathIgnorePatterns: ['<rootDir>/dist/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 60,
      functions: 70,
      lines: 75
    }
  }
};
