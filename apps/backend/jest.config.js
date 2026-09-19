/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@sara/shared(.*)$': '<rootDir>/../../packages/shared/dist$1',
    '^@sara/site-adapters(.*)$': '<rootDir>/../../packages/site-adapters/dist$1',
    '^@sara/recommendation-engine(.*)$': '<rootDir>/../../packages/recommendation-engine/dist$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }]
  }
};
