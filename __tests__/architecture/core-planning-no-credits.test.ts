/**
 * Task 15 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md) —
 * repo-scanning proof that the retirement of per-session credit balances
 * (Amendement 11) has not been accidentally reintroduced anywhere by Tasks
 * 1-14's planning/dashboard overhaul.
 *
 * Two invariants, enforced at the repo-scanning level rather than by
 * mocking every call site (same convention as
 * __tests__/architecture/session-revocation-boundary.test.ts's exhaustive
 * User-mutation inventory and __tests__/architecture/email-outbox-boundary.test.ts):
 *
 *   1. Every `sessionBooking.create(...)` call in `app/` or `lib/` writes
 *      `creditsUsed: 0` as a literal — never a computed/deducted value.
 *      Exhaustive: the approved list below is the complete set of creation
 *      sites; a new one must be added here deliberately (and explicitly
 *      justified) rather than silently reintroducing credit deduction.
 *   2. The scheduling/booking pipeline (lib/planning/*.ts, the assistant/
 *      parent/student booking routes, and the series edit route) never
 *      reads or writes `CreditTransaction` or `Student.credits`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

describe('core planning/scheduling never consumes retired session credits', () => {
  test('every sessionBooking.create(...) call site writes creditsUsed: 0 literally, and the set of sites is exhaustive', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('lib')].sort();
    const callSites: string[] = [];

    for (const relative of files) {
      const absolute = join(root, relative);
      const sourceText = read(relative);
      const source = ts.createSourceFile(
        absolute,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        relative.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      const walk = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'create'
        ) {
          const owner = node.expression.expression;
          if (ts.isPropertyAccessExpression(owner) && owner.name.text === 'sessionBooking') {
            callSites.push(relative);
            const callText = node.getText(source);
            // Must write a LITERAL 0 — never a variable, an expression, or a
            // caller-supplied field (this is the whole invariant: no path
            // reintroduces a computed/deducted credits value).
            expect(callText).toMatch(/creditsUsed\s*:\s*0\b/);
            // Belt-and-braces: no other numeric/variable creditsUsed value
            // sneaks in elsewhere in the same call (e.g. a second, later key
            // in a spread that overrides the literal above).
            const creditsUsedOccurrences = callText.match(/creditsUsed\s*:/g) ?? [];
            expect(creditsUsedOccurrences.length).toBe(1);
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(source);
    }

    // Exhaustive: the ONLY two places in app/ or lib/ that ever create a
    // SessionBooking row today.
    //   - lib/planning/series.ts: materializeOccurrencesForSeries, the
    //     single governed materialization path reused by every booking route
    //     (Task 11).
    //   - lib/session-booking.ts: SessionBookingService.bookSession, a
    //     pre-existing legacy service not called from any route today (grep
    //     confirms no `SessionBookingService` import outside this file) —
    //     kept out of scope for this task (not listed in its Files) but
    //     still covered here since it DOES create SessionBooking rows and
    //     must not silently regress if ever revived.
    expect(callSites.sort()).toEqual(['lib/planning/series.ts', 'lib/session-booking.ts']);
  });

  test('SessionBookingService.bookSession (legacy) is dead code — no production import outside its own file', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('lib')].filter(
      (f) => f !== 'lib/session-booking.ts',
    );
    // A doc-comment MENTION (e.g. lib/planning/effective-availability.ts
    // explaining what it replaced) is not an import — only an actual
    // `import { SessionBookingService }`/`from '@/lib/session-booking'`
    // wiring counts as a live production dependency.
    const importers = files.filter((f) => /from ['"]@\/lib\/session-booking['"]/.test(read(f)));
    expect(importers).toEqual([]);
  });

  test.each([
    'lib/planning/series.ts',
    'lib/planning/invariants.ts',
    'lib/planning/identities.ts',
    'lib/planning/effective-availability.ts',
    'app/api/assistante/sessions/route.ts',
    'app/api/sessions/book/route.ts',
    'app/api/assistante/planning/series/[seriesId]/route.ts',
  ])('%s never reads or writes CreditTransaction or Student.credits', (path) => {
    const text = read(path);
    expect(text).not.toMatch(/\bcreditTransaction\b/i);
    expect(text).not.toMatch(/\.credits\b(?!Used|PerMonth)/);
  });
});
