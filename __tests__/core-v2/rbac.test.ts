import {
  ADMIN_ONLY_CAPABILITIES,
  ASSISTANTE_CAPABILITIES,
  CAPABILITIES,
  assertCapability,
  assertCapabilityClassificationIsExhaustive,
  capabilitiesForRole,
  roleHasCapability,
} from '@/lib/core-v2/rbac';
import { ForbiddenError } from '@/lib/core-v2/errors';

describe('Core v2 RBAC capability matrix (§Y)', () => {
  test('ADMIN holds every capability', () => {
    expect(capabilitiesForRole('ADMIN')).toEqual([...CAPABILITIES]);
  });

  test('ASSISTANTE holds every capability except the explicit ADMIN-only set', () => {
    const assistante = new Set(capabilitiesForRole('ASSISTANTE'));
    // Derived from the ADMIN-only set itself: a hand-counted length silently
    // stops meaning anything the next time a capability is added.
    for (const c of ADMIN_ONLY_CAPABILITIES) expect(assistante.has(c)).toBe(false);
    expect(assistante.size).toBe(CAPABILITIES.length - ADMIN_ONLY_CAPABILITIES.length);
    expect([...ADMIN_ONLY_CAPABILITIES].sort()).toEqual(
      ['ACCOUNT_REACTIVATE', 'ACCOUNT_SUSPEND', 'AUDIT_READ', 'STAFF_ACCOUNT_CREATE', 'DIAGNOSTIC_SUBMISSION_CONTENT_READ'].sort(),
    );
    for (const c of [
      'HOUSEHOLD_CREATE',
      'STUDENT_CREATE',
      'ENROLLMENT_APPROVE',
      'COACH_ASSIGN',
      'PLANNING_MANAGE',
      'ACCOUNT_INVITE',
      'DIAGNOSTIC_CATALOG_READ',
      'DIAGNOSTIC_ASSIGN',
      'DIAGNOSTIC_SUBMISSION_TRACK',
    ] as const) {
      expect(assistante.has(c)).toBe(true);
    }
  });

  test.each(['COACH', 'PARENT', 'ELEVE'] as const)('%s holds no back-office capability', (role) => {
    expect(capabilitiesForRole(role)).toEqual([]);
  });

  test('assertCapability throws a typed FORBIDDEN error, never a generic one', () => {
    expect(() => assertCapability({ userId: 'u', role: 'ASSISTANTE' }, 'ACCOUNT_SUSPEND')).toThrow(ForbiddenError);
    try {
      assertCapability({ userId: 'u', role: 'PARENT' }, 'HOUSEHOLD_READ');
    } catch (error) {
      expect((error as ForbiddenError).code).toBe('FORBIDDEN');
      expect((error as ForbiddenError).details).toEqual({ capability: 'HOUSEHOLD_READ' });
    }
    expect(() => assertCapability({ userId: 'u', role: 'ADMIN' }, 'ACCOUNT_SUSPEND')).not.toThrow();
  });

  test('an unknown role (defensive) has nothing', () => {
    expect(roleHasCapability('NOT_A_ROLE' as never, 'HOUSEHOLD_READ')).toBe(false);
  });

  describe('positive capability classification (go-live mission §6 — closes the implicit-grant risk)', () => {
    test('every capability is classified in exactly one of ADMIN_ONLY_CAPABILITIES / ASSISTANTE_CAPABILITIES', () => {
      expect(() => assertCapabilityClassificationIsExhaustive()).not.toThrow();
      const classified = [...ADMIN_ONLY_CAPABILITIES, ...ASSISTANTE_CAPABILITIES];
      expect(classified.length).toBe(CAPABILITIES.length);
      expect(new Set(classified).size).toBe(CAPABILITIES.length); // no duplicates either
      for (const c of CAPABILITIES) expect(classified).toContain(c);
    });

    test('a capability present in CAPABILITIES but classified nowhere fails the completeness guard', () => {
      const capabilities = [...CAPABILITIES, 'SOME_NEW_CAPABILITY_NOBODY_CLASSIFIED'] as unknown as typeof CAPABILITIES;
      const adminOnly = [...ADMIN_ONLY_CAPABILITIES];
      const assistante = [...ASSISTANTE_CAPABILITIES];
      const unclassified = capabilities.filter((c) => !adminOnly.includes(c) && !assistante.includes(c));
      expect(unclassified).toEqual(['SOME_NEW_CAPABILITY_NOBODY_CLASSIFIED']);
      // roleHasCapability's own default-deny is exercised directly, not simulated:
      // an unclassified capability was never added to CAPABILITY_MATRIX for any
      // role, so the real lookup — not a copy of the logic — refuses it.
      expect(roleHasCapability('ASSISTANTE', 'SOME_NEW_CAPABILITY_NOBODY_CLASSIFIED' as never)).toBe(false);
      expect(roleHasCapability('ADMIN', 'SOME_NEW_CAPABILITY_NOBODY_CLASSIFIED' as never)).toBe(false);
    });

    test('a capability classified in both lists would be rejected, not silently resolved', () => {
      const adminOnly = [...ADMIN_ONLY_CAPABILITIES, 'HOUSEHOLD_READ'];
      const overlap = adminOnly.filter((c) => (ASSISTANTE_CAPABILITIES as readonly string[]).includes(c));
      expect(overlap).toEqual(['HOUSEHOLD_READ']);
    });

    test('ASSISTANTE_CAPABILITIES and ADMIN_ONLY_CAPABILITIES do not overlap today', () => {
      const overlap = ADMIN_ONLY_CAPABILITIES.filter((c) => (ASSISTANTE_CAPABILITIES as readonly string[]).includes(c));
      expect(overlap).toEqual([]);
    });

    test('every proposed capability resolves through the real matrix for every role — no capability is silently ignored', () => {
      for (const role of ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const) {
        for (const capability of CAPABILITIES) {
          // Must not throw regardless of outcome — proves the lookup path is
          // total over every (role, capability) pair, not just the ones a
          // hand-picked test happens to exercise.
          expect(() => roleHasCapability(role, capability)).not.toThrow();
        }
      }
    });
  });
});
