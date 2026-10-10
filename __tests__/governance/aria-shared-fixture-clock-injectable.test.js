/**
 * Governance guard against the class of time-bomb that turned
 * `__tests__/db/aria-workshop-reminder.real.test.ts` silently red once real UTC
 * passed 2026-10-10T14:00Z.
 *
 * Root cause: a SHARED real-DB fixture seeded an entitlement *validity window*
 * relative to the database clock (`"startsAt" = NOW() - INTERVAL '1 day'`,
 * `"endsAt" = NOW() + INTERVAL '30 days'`) while the suite evaluated eligibility
 * at a FIXED Node instant. Mixing the two clocks means the window drifts past
 * the fixed test anchor as wall-clock advances — a dormant failure with no code
 * change.
 *
 * The lesson is specifically about SHARED fixtures (reused by many suites): a
 * shared fixture must let callers inject the instant its validity windows are
 * anchored to, so a caller that evaluates at a fixed clock seeds a window that
 * brackets THAT clock. Per-test inline data (a suite building its own varied
 * windows for the logic under test) is out of scope — that is the suite's own
 * concern and is evaluated at live time by the code it exercises.
 *
 * Static (no DB, no network). Authored as `.test.js` so it runs in the
 * governance lane (`jest.config.governance.js`, invoked by `npm run
 * test:governance` in ci.yml) — that config matches `__tests__/governance/**\/*.test.js`
 * only, and `jest.unit.config.js` deliberately excludes `__tests__/governance/`.
 */
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const HELPERS_DIR = join(process.cwd(), '__tests__', 'helpers');

// Validity-window columns: a row is "valid" only inside [start, end] / until a
// cutoff, so anchoring these to the DB clock is what drifts against a fixed
// test clock. Plain audit stamps (createdAt/updatedAt) are not validity windows.
const WINDOW_COLUMNS = ['startsAt', 'endsAt', 'expiresAt', 'validUntil', 'notBefore', 'deadline', 'reminderAt'];

// A shared fixture may still need a live-clock window in a narrowly justified
// case; it must say so explicitly on the offending line or the line above.
const EXEMPTION = 'deterministic-clock-exempt';

function sharedFixtureFiles() {
  return readdirSync(HELPERS_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(HELPERS_DIR, name));
}

// Flags a line that sets a validity window from the database clock. No trailing
// \b after NOW\(\): its last char ')' is a non-word char, so a boundary there
// never matches — that bug once made an earlier draft of this guard vacuous.
const CLOCK = /(?:NOW\(\)|CURRENT_TIMESTAMP\b)/;
const COLUMN_ON_LINE = new RegExp(`\\b(${WINDOW_COLUMNS.join('|')})\\b`);
const CLOCK_WITH_INTERVAL = /(?:NOW\(\)|CURRENT_TIMESTAMP\b)[^\n]*\bINTERVAL\b/;

function offendingLines(source) {
  const lines = source.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i];
    const prev = i > 0 ? lines[i - 1] : '';
    if (text.includes(EXEMPTION) || prev.includes(EXEMPTION)) continue;
    const windowColumnClocked = COLUMN_ON_LINE.test(text) && CLOCK.test(text);
    const intervalClocked = CLOCK_WITH_INTERVAL.test(text);
    if (windowColumnClocked || intervalClocked) hits.push({ line: i + 1, text: text.trim() });
  }
  return hits;
}

describe('shared ARIA/real-DB fixtures anchor validity windows to an injectable clock (time-bomb guard)', () => {
  it('no shared fixture under __tests__/helpers anchors a validity window to the database clock', () => {
    const violations = [];
    for (const file of sharedFixtureFiles()) {
      for (const hit of offendingLines(readFileSync(file, 'utf8'))) {
        violations.push(`${file.replace(`${process.cwd()}/`, '')}:${hit.line}  ${hit.text}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('seedAriaRealDbFixture exposes an injectable `now` and anchors its entitlement window to a bound parameter', () => {
    const source = readFileSync(join(HELPERS_DIR, 'aria-real-db.ts'), 'utf8');
    expect(source).toMatch(/seedAriaRealDbFixture[\s\S]*options\s*:\s*SeedAriaRealDbFixtureOptions/);
    expect(source).toMatch(/readonly\s+now\?:\s*Date/);
    const entitlementInsert = source.slice(source.indexOf('INSERT INTO entitlements'));
    const entitlementValues = entitlementInsert.slice(0, entitlementInsert.indexOf(');'));
    expect(entitlementValues).toMatch(/\$\d+::timestamptz\s*-\s*INTERVAL/);
    expect(entitlementValues).toMatch(/\$\d+::timestamptz\s*\+\s*INTERVAL/);
    expect(entitlementValues).not.toMatch(/"startsAt"[\s\S]*NOW\(\)\s*-\s*INTERVAL/);
  });
});
