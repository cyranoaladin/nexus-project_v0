'use strict';

const { runFatalDbSuiteCleanup } = require('../fatal-db-suite-cleanup.cjs');

test('passes its body before cleanup', () => {
  expect(true).toBe(true);
});

afterAll(async () => {
  await runFatalDbSuiteCleanup(
    async () => {
      throw new Error('FORCED_AFTER_ALL_DATABASE_CLEANUP_FAILURE');
    },
    async () => {},
  );
});
