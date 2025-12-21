/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/test.ts',
    '**/test/**/*.test.ts',
    '**/test/**/*.spec.ts'
  ],
  collectCoverageFrom: ['src/**/*.ts'],
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
