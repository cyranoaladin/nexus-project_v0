import { auditE2eOwnership } from '../../scripts/testing/e2e-ownership.mjs';

/**
 * Governance guard (identified during arbitration of stale PR #205, not a
 * cherry-pick from it; the original baseline-of-93-orphans version of this
 * guard was superseded by a full triage -- see PR #235): every Playwright
 * spec under e2e/** must be reachable by exactly one CI-invoked config's
 * real test selection (directory-based ownership), or be the single
 * documented, named ARIA-blocked exclusion. Zero silent orphans, zero
 * baseline-of-debt.
 */
describe('E2E_SPEC_OWNERSHIP (zero orphan specs)', () => {
  test('every tracked spec is either collected by a CI-invoked config or a documented exclusion', () => {
    const { orphans } = auditE2eOwnership();
    expect(orphans).toEqual([]);
  });

  test('every documented exclusion still exists on disk (no stale exclusion entries)', () => {
    const { unknownExclusions } = auditE2eOwnership();
    expect(unknownExclusions).toEqual([]);
  });

  test('tracked and statically owned+excluded counts reconcile exactly', () => {
    const { tracked, owned, documentedExclusions } = auditE2eOwnership();
    expect(owned.length + documentedExclusions.length).toBe(tracked.length);
  });

  test('sanity: the audit actually scanned real specs, not an empty tree', () => {
    const { tracked } = auditE2eOwnership();
    expect(tracked.length).toBeGreaterThan(0);
  });
});
