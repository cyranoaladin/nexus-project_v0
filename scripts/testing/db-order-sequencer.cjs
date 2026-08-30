'use strict';

const path = require('path');
const BaseSequencer = require('@jest/test-sequencer').default;

const EXPECTED_DB_SUITES = Object.freeze([
  '__tests__/concurrency/credit-debit-idempotency.test.ts',
  '__tests__/concurrency/credit-race.complete.test.ts',
  '__tests__/concurrency/double-booking.test.ts',
  '__tests__/concurrency/payment-idempotency.test.ts',
  '__tests__/database/migrations.test.ts',
  '__tests__/database/quote-persistence.test.ts',
  '__tests__/database/schema.test.ts',
  '__tests__/db/aria-pgvector.test.ts',
  '__tests__/db/assessment-pipeline.test.ts',
  '__tests__/db/canonical-bilans-schema.test.ts',
  '__tests__/transactions/payment-validation-rollback.complete.test.ts',
  '__tests__/transactions/payment-validation-rollback.test.ts',
]);
const DEFAULT_SEED = 20260830;

function seededShuffle(values, seed) {
  const shuffled = [...values];
  let state = seed >>> 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function orderedSuitePaths(mode, seed = DEFAULT_SEED) {
  if (mode === 'normal') return [...EXPECTED_DB_SUITES];
  if (mode === 'reverse') return [...EXPECTED_DB_SUITES].reverse();
  if (mode === 'seeded') return seededShuffle(EXPECTED_DB_SUITES, seed);
  throw new Error(`Unsupported DB_TEST_ORDER: ${mode}`);
}

class DbOrderSequencer extends BaseSequencer {
  sort(tests) {
    const rootDir = tests[0]?.context.config.rootDir ?? process.cwd();
    const byRelativePath = new Map(
      tests.map((test) => [path.relative(rootDir, test.path).split(path.sep).join('/'), test])
    );
    const discovered = [...byRelativePath.keys()].sort();
    const expected = [...EXPECTED_DB_SUITES].sort();
    if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
      throw new Error(
        `DB suite topology drift: expected ${expected.length} suites, received ${discovered.length}\n`
        + `expected=${JSON.stringify(expected)}\nreceived=${JSON.stringify(discovered)}`
      );
    }

    const mode = process.env.DB_TEST_ORDER;
    const seed = Number.parseInt(process.env.DB_TEST_SEED ?? String(DEFAULT_SEED), 10);
    if (!Number.isSafeInteger(seed)) throw new Error('DB_TEST_SEED must be a safe integer');
    const order = orderedSuitePaths(mode, seed);
    process.stdout.write(`DB_TEST_ORDER=${mode}\nDB_TEST_SEED=${seed}\nDB_SUITE_ORDER=${order.join(',')}\n`);
    return order.map((suitePath) => byRelativePath.get(suitePath));
  }
}

module.exports = DbOrderSequencer;
module.exports.DEFAULT_SEED = DEFAULT_SEED;
module.exports.EXPECTED_DB_SUITES = EXPECTED_DB_SUITES;
module.exports.orderedSuitePaths = orderedSuitePaths;
