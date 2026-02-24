/**
 * RBAC Policy — Complete Test Suite
 *
 * Tests: can, getPermissions, canAccess, getPoliciesForRole, RBAC_POLICIES, enforcePolicy
 *
 * Source: lib/rbac.ts
 */

import { can, getPermissions, canAccess, getPoliciesForRole, RBAC_POLICIES, enforcePolicy } from '@/lib/rbac';

const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── can (Resource/Action Permission Matrix) ─────────────────────────────────

describe('can', () => {
  it('ADMIN should MANAGE all resources', () => {
    expect(can('ADMIN' as any, 'MANAGE', 'USER')).toBe(true);
    expect(can('ADMIN' as any, 'READ', 'SESSION')).toBe(true);
    expect(can('ADMIN' as any, 'DELETE', 'PAYMENT')).toBe(true);
    expect(can('ADMIN' as any, 'CREATE', 'REPORT')).toBe(true);
  });

  it('ASSISTANTE should READ USER but not MANAGE', () => {
    expect(can('ASSISTANTE' as any, 'READ', 'USER')).toBe(true);
    expect(can('ASSISTANTE' as any, 'MANAGE', 'USER')).toBe(false);
  });

  it('ASSISTANTE should MANAGE RESERVATION', () => {
    expect(can('ASSISTANTE' as any, 'MANAGE', 'RESERVATION')).toBe(true);
  });

  it('COACH should READ STUDENT but not UPDATE', () => {
    expect(can('COACH' as any, 'READ', 'STUDENT')).toBe(true);
    expect(can('COACH' as any, 'UPDATE', 'STUDENT')).toBe(false);
  });

  it('COACH should CREATE REPORT', () => {
    expect(can('COACH' as any, 'CREATE', 'REPORT')).toBe(true);
  });

  it('PARENT should READ_OWN STUDENT', () => {
    expect(can('PARENT' as any, 'READ_OWN', 'STUDENT')).toBe(true);
  });

  it('PARENT should READ STUDENT (READ_OWN satisfies READ)', () => {
    expect(can('PARENT' as any, 'READ', 'STUDENT')).toBe(true);
  });

  it('PARENT should not DELETE anything', () => {
    expect(can('PARENT' as any, 'DELETE', 'USER')).toBe(false);
    expect(can('PARENT' as any, 'DELETE', 'SESSION')).toBe(false);
  });

  it('ELEVE should READ_SELF USER', () => {
    expect(can('ELEVE' as any, 'READ_SELF', 'USER')).toBe(true);
  });

  it('ELEVE should not CREATE SESSION', () => {
    expect(can('ELEVE' as any, 'CREATE', 'SESSION')).toBe(false);
  });

  it('should return false for unknown role', () => {
    expect(can('UNKNOWN' as any, 'READ', 'USER')).toBe(false);
  });
});

// ─── getPermissions ──────────────────────────────────────────────────────────

describe('getPermissions', () => {
  it('should return permissions for ADMIN', () => {
    const perms = getPermissions('ADMIN' as any);
    expect(perms.length).toBeGreaterThan(0);
    expect(perms.every((p) => p.action === 'MANAGE')).toBe(true);
  });

  it('should return permissions for ELEVE', () => {
    const perms = getPermissions('ELEVE' as any);
    expect(perms.length).toBeGreaterThan(0);
  });

  it('should return empty array for unknown role', () => {
    const perms = getPermissions('UNKNOWN' as any);
    expect(perms).toEqual([]);
  });
});

// ─── RBAC_POLICIES ───────────────────────────────────────────────────────────

describe('RBAC_POLICIES', () => {
  it('should have admin.dashboard policy', () => {
    expect(RBAC_POLICIES['admin.dashboard']).toBeDefined();
    expect(RBAC_POLICIES['admin.dashboard'].allowedRoles).toContain('ADMIN');
  });

  it('should have assistant.dashboard policy allowing ADMIN and ASSISTANTE', () => {
    const policy = RBAC_POLICIES['assistant.dashboard'];
    expect(policy.allowedRoles).toContain('ADMIN');
    expect(policy.allowedRoles).toContain('ASSISTANTE');
  });

  it('should have coach.dashboard policy', () => {
    expect(RBAC_POLICIES['coach.dashboard']).toBeDefined();
    expect(RBAC_POLICIES['coach.dashboard'].allowedRoles).toContain('COACH');
  });

  it('should have parent.dashboard policy', () => {
    expect(RBAC_POLICIES['parent.dashboard']).toBeDefined();
    expect(RBAC_POLICIES['parent.dashboard'].allowedRoles).toContain('PARENT');
  });

  it('should have student.dashboard policy', () => {
    expect(RBAC_POLICIES['student.dashboard']).toBeDefined();
    expect(RBAC_POLICIES['student.dashboard'].allowedRoles).toContain('ELEVE');
  });

  it('should have description for all policies', () => {
    Object.values(RBAC_POLICIES).forEach((policy) => {
      expect(policy.description.length).toBeGreaterThan(0);
    });
  });

  it('should have non-empty allowedRoles for all policies', () => {
    Object.values(RBAC_POLICIES).forEach((policy) => {
      expect(policy.allowedRoles.length).toBeGreaterThan(0);
    });
  });
});

// ─── canAccess ───────────────────────────────────────────────────────────────

describe('canAccess', () => {
  it('should return true for ADMIN on admin.dashboard', () => {
    expect(canAccess('ADMIN' as any, 'admin.dashboard')).toBe(true);
  });

  it('should return false for ELEVE on admin.dashboard', () => {
    expect(canAccess('ELEVE' as any, 'admin.dashboard')).toBe(false);
  });

  it('should return true for PARENT on parent.dashboard', () => {
    expect(canAccess('PARENT' as any, 'parent.dashboard')).toBe(true);
  });

  it('should return false for unknown policy key', () => {
    expect(canAccess('ADMIN' as any, 'nonexistent.policy')).toBe(false);
  });

  it('should return true for COACH on coach.dashboard', () => {
    expect(canAccess('COACH' as any, 'coach.dashboard')).toBe(true);
  });

  it('should return false for COACH on admin.dashboard', () => {
    expect(canAccess('COACH' as any, 'admin.dashboard')).toBe(false);
  });
});

// ─── getPoliciesForRole ──────────────────────────────────────────────────────

describe('getPoliciesForRole', () => {
  it('should return policies for ADMIN', () => {
    const policies = getPoliciesForRole('ADMIN' as any);
    expect(policies.length).toBeGreaterThan(0);
    const keys = policies.map((p) => p.key);
    expect(keys).toContain('admin.dashboard');
  });

  it('should return policies for ELEVE', () => {
    const policies = getPoliciesForRole('ELEVE' as any);
    expect(policies.length).toBeGreaterThan(0);
    const keys = policies.map((p) => p.key);
    expect(keys).toContain('student.dashboard');
  });

  it('should not include admin policies for ELEVE', () => {
    const policies = getPoliciesForRole('ELEVE' as any);
    const keys = policies.map((p) => p.key);
    expect(keys).not.toContain('admin.dashboard');
  });

  it('should return policies with key and policy properties', () => {
    const policies = getPoliciesForRole('PARENT' as any);
    policies.forEach((p) => {
      expect(p.key).toBeDefined();
      expect(p.policy).toBeDefined();
      expect(p.policy.allowedRoles).toContain('PARENT');
    });
  });
});

// ─── enforcePolicy ───────────────────────────────────────────────────────────

describe('enforcePolicy', () => {
  it('should return 500 for unknown policy key', async () => {
    const result: any = await enforcePolicy('nonexistent.policy');
    expect(result.status).toBe(500);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const result: any = await enforcePolicy('admin.dashboard');
    expect(result.status).toBe(401);
  });

  it('should return 403 when role not allowed', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', role: 'ELEVE' },
      expires: '2026-12-31',
    });

    const result: any = await enforcePolicy('admin.dashboard');
    expect(result.status).toBe(403);
  });

  it('should return session when authorized', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@test.com', role: 'ADMIN' },
      expires: '2026-12-31',
    });

    const result: any = await enforcePolicy('admin.dashboard');
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe('ADMIN');
  });
});
