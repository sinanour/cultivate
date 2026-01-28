module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'setup.ts', 'openapi.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/__tests__/**',
    '!src/utils/openapi.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 50,
      lines: 52,
      statements: 52,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  // Allow parallel test execution for better performance
  // maxWorkers: '50%', // Use 50% of available CPU cores
  // Default test timeout: 10 seconds (can be overridden per test)
  testTimeout: 10000,
};
