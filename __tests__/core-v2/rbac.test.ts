import { CAPABILITIES, assertCapability, capabilitiesForRole, roleHasCapability } from '@/lib/core-v2/rbac';
import { ForbiddenError } from '@/lib/core-v2/errors';

describe('Core v2 RBAC capability matrix (§Y)', () => {
  test('ADMIN holds every capability', () => {
    expect(capabilitiesForRole('ADMIN')).toEqual([...CAPABILITIES]);
  });

  test('ASSISTANTE holds every capability except the explicit ADMIN-only set', () => {
    const assistante = new Set(capabilitiesForRole('ASSISTANTE'));
    expect(assistante.has('ACCOUNT_SUSPEND')).toBe(false);
    expect(assistante.has('ACCOUNT_REACTIVATE')).toBe(false);
    expect(assistante.has('AUDIT_READ')).toBe(false);
    expect(assistante.size).toBe(CAPABILITIES.length - 3);
    for (const c of ['HOUSEHOLD_CREATE', 'STUDENT_CREATE', 'ENROLLMENT_APPROVE', 'COACH_ASSIGN', 'PLANNING_MANAGE', 'ACCOUNT_INVITE'] as const) {
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
});
