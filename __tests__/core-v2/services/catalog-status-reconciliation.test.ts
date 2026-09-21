import { resolveCatalogStatus } from '@/lib/core-v2/diagnostics/catalog-status-reconciliation';

describe('resolveCatalogStatus', () => {
  test('unknown/empty item list is never promoted by default', () => {
    expect(resolveCatalogStatus({ itemStatuses: [], diffusionDecisionMade: true, technicallyAvailable: true })).toBe('UNAVAILABLE');
  });

  test('any COMPROMISED item makes the whole form COMPROMISED, regardless of the rest', () => {
    expect(
      resolveCatalogStatus({
        itemStatuses: ['ACTIVE', 'ACTIVE', 'COMPROMISED'],
        diffusionDecisionMade: true,
        technicallyAvailable: true,
      }),
    ).toBe('COMPROMISED');
  });

  test('PEDAGOGICALLY_REVIEWED items (not yet ACTIVE) resolve to IN_REVIEW even with diffusion decided and engine available', () => {
    expect(
      resolveCatalogStatus({
        itemStatuses: ['PEDAGOGICALLY_REVIEWED', 'PEDAGOGICALLY_REVIEWED'],
        diffusionDecisionMade: true,
        technicallyAvailable: true,
      }),
    ).toBe('IN_REVIEW');
  });

  test('all items ACTIVE/USED but no direction diffusion decision yet resolves to IN_REVIEW, not AUTHORIZED', () => {
    expect(
      resolveCatalogStatus({ itemStatuses: ['ACTIVE', 'USED'], diffusionDecisionMade: false, technicallyAvailable: true }),
    ).toBe('IN_REVIEW');
  });

  test('all items ready, diffusion decided, but engine/storage not technically available resolves to UNAVAILABLE', () => {
    expect(
      resolveCatalogStatus({ itemStatuses: ['ACTIVE', 'USED'], diffusionDecisionMade: true, technicallyAvailable: false }),
    ).toBe('UNAVAILABLE');
  });

  test('only when all three authorities align does a form resolve to AUTHORIZED', () => {
    expect(
      resolveCatalogStatus({ itemStatuses: ['ACTIVE', 'USED', 'ACTIVE'], diffusionDecisionMade: true, technicallyAvailable: true }),
    ).toBe('AUTHORIZED');
  });

  describe('applied to the real private-catalog snapshot read 2026-09-21', () => {
    // referentiels/item_lifecycle.json + review/form-a/INDEX.md +
    // review/form-a/{EDS-MATH,FR-EAF}/README.md + V3_PILOT_REVIEW.md, all
    // independently confirming: every pilot item is PEDAGOGICALLY_REVIEWED,
    // no direction diffusion decision has been made for either form, and
    // review/form-a/INDEX.md itself flags the rendering engine (PR #296,
    // unmerged) and the confidential distribution storage as PENDING.
    const EDS_MATH_N1_ITEMS = new Array(15).fill('PEDAGOGICALLY_REVIEWED' as const);
    const FR_EAF_ITEMS = new Array(11).fill('PEDAGOGICALLY_REVIEWED' as const);

    test('EDS-MATH/N1 resolves to IN_REVIEW today', () => {
      expect(
        resolveCatalogStatus({ itemStatuses: EDS_MATH_N1_ITEMS, diffusionDecisionMade: false, technicallyAvailable: false }),
      ).toBe('IN_REVIEW');
    });

    test('FR-EAF/ecrit_2027 resolves to IN_REVIEW today', () => {
      expect(
        resolveCatalogStatus({ itemStatuses: FR_EAF_ITEMS, diffusionDecisionMade: false, technicallyAvailable: false }),
      ).toBe('IN_REVIEW');
    });

    test('even if the direction decided diffusion today, item-level readiness alone still blocks AUTHORIZED', () => {
      // Demonstrates authority 1 (item status) is independently necessary —
      // flipping only authority 2 must not promote the form.
      expect(
        resolveCatalogStatus({ itemStatuses: EDS_MATH_N1_ITEMS, diffusionDecisionMade: true, technicallyAvailable: true }),
      ).toBe('IN_REVIEW');
    });
  });
});
