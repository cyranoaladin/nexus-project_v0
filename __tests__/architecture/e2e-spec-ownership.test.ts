import { auditE2eOwnership } from '../../scripts/testing/e2e-ownership.mjs';

/**
 * Governance guard (identified during arbitration of stale PR #205, not a
 * cherry-pick from it): every Playwright spec under e2e/** must be
 * reachable by at least one CI-invoked config's real test selection, or it
 * silently never runs and nobody notices ("orphan spec").
 *
 * This does NOT assert zero orphans exist — 93 pre-existing ones are
 * recorded in scripts/testing/e2e-ownership-baseline.json, a known and
 * explicit (not silently accepted) debt inventory. The guard's job is to
 * stop that number from growing and to keep the baseline itself accurate,
 * not to force an out-of-scope cleanup of 93 files in this change.
 */
describe('E2E_SPEC_OWNERSHIP (no orphan specs beyond the recorded baseline)', () => {
  test('no new orphan specs (not wired into any CI job, not already in the baseline)', () => {
    const { newOrphans } = auditE2eOwnership();
    expect(newOrphans).toEqual([]);
  });

  test('the baseline contains no stale entries (specs since covered or deleted)', () => {
    const { staleBaselineEntries } = auditE2eOwnership();
    expect(staleBaselineEntries).toEqual([]);
  });

  test('sanity: the audit actually found the known pre-existing orphans, not an empty scan', () => {
    const { orphans } = auditE2eOwnership();
    expect(orphans.length).toBeGreaterThan(0);
  });
});
