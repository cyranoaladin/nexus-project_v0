module.exports = {
  displayName: 'performance',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/.zenflow/tests/performance'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
      }
    }]
  },
  collectCoverageFrom: [
    '.zenflow/core/**/*.ts',
    '!.zenflow/core/**/*.test.ts',
    '!.zenflow/core/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/.zenflow/tests/performance/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 1200000,
  maxWorkers: 1,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    }
  },
  setupFiles: ['<rootDir>/.zenflow/tests/performance/setup.js'],
};
