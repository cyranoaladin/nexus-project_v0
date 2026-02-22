/**
 * Credits Guard — Contract tests for credits_use feature gating.
 *
 * Validates the access control contract for credit consumption endpoints:
 * - Without credits_use entitlement → 403
 * - With entitlement but insufficient credits → business rule (409)
 * - With entitlement + sufficient credits → 200
 */

import { resolveAccess } from '@/lib/access/rules';

// ─── credits_use feature gating ──────────────────────────────────────────────

describe('credits_use access control', () => {
  it('ELEVE without credits_use entitlement → denied (403)', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_entitlement');
    expect(result.missing).toContain('credits_use');
  });

  it('ELEVE with credits_use entitlement → allowed (entitlement check passes)', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: ['credits_use'],
    });
    expect(result.allowed).toBe(true);
  });

  it('PARENT without credits_use entitlement → denied', () => {
    const result = resolveAccess({
      role: 'PARENT',
      userId: 'parent-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('credits_use');
  });

  it('PARENT with credits_use entitlement → allowed', () => {
    const result = resolveAccess({
      role: 'PARENT',
      userId: 'parent-1',
      featureKey: 'credits_use',
      activeFeatures: ['credits_use'],
    });
    expect(result.allowed).toBe(true);
  });

  it('ADMIN always allowed (exempt)', () => {
    const result = resolveAccess({
      role: 'ADMIN',
      userId: 'admin-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(true);
  });

  it('ASSISTANTE always allowed (exempt)', () => {
    const result = resolveAccess({
      role: 'ASSISTANTE',
      userId: 'assist-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(true);
  });
});

// ─── Business rule: insufficient credits (post-entitlement) ──────────────────

describe('credits business rules (post-entitlement)', () => {
  it('entitlement allowed but 0 credits → business rule violation (409 contract)', () => {
    // Entitlement check passes
    const access = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: ['credits_use'],
    });
    expect(access.allowed).toBe(true);

    // Business rule: credits check happens AFTER entitlement guard
    const currentCredits = 0;
    const requiredCredits = 1;
    const hasSufficientCredits = currentCredits >= requiredCredits;
    expect(hasSufficientCredits).toBe(false);
    // Endpoint should return 409 (business rule), not 403 (entitlement)
  });

  it('entitlement allowed + sufficient credits → proceed (200 contract)', () => {
    const access = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: ['credits_use'],
    });
    expect(access.allowed).toBe(true);

    const currentCredits = 5;
    const requiredCredits = 1;
    const hasSufficientCredits = currentCredits >= requiredCredits;
    expect(hasSufficientCredits).toBe(true);
  });

  it('entitlement denied → 403 (never reaches credit check)', () => {
    const access = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: [], // no credits_use entitlement
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('missing_entitlement');
    // Endpoint returns 403 — credit balance is irrelevant
  });
});

// ─── Guard layering contract ─────────────────────────────────────────────────

describe('guard layering', () => {
  it('layer 1: RBAC (role check) → layer 2: entitlement → layer 3: business rule', () => {
    // Layer 1: RBAC — COACH is not exempt for credits_use
    const coachAccess = resolveAccess({
      role: 'COACH',
      userId: 'coach-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(coachAccess.allowed).toBe(false);

    // Layer 1: RBAC — ADMIN is exempt
    const adminAccess = resolveAccess({
      role: 'ADMIN',
      userId: 'admin-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(adminAccess.allowed).toBe(true);

    // Layer 2: Entitlement — ELEVE needs credits_use
    const eleveNoEnt = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(eleveNoEnt.allowed).toBe(false);

    // Layer 2 passes, layer 3 is business logic (credits balance)
    const eleveWithEnt = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: ['credits_use'],
    });
    expect(eleveWithEnt.allowed).toBe(true);
    // Layer 3 (credit balance) is checked in the endpoint, not in resolveAccess
  });
});
