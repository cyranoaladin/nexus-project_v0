/**
 * @jest-environment node
 */

/**
 * Tests for lib/rbac.ts — Coverage boost
 *
 * Covers: can, getPermissions, canAccess, getPoliciesForRole
 */

import { can, getPermissions, canAccess, getPoliciesForRole, RBAC_POLICIES } from '@/lib/rbac';
import { UserRole } from '@/types/enums';

describe('RBAC — can()', () => {
  it('ADMIN can MANAGE any resource', () => {
    expect(can(UserRole.ADMIN, 'MANAGE', 'USER')).toBe(true);
    expect(can(UserRole.ADMIN, 'MANAGE', 'SESSION')).toBe(true);
    expect(can(UserRole.ADMIN, 'MANAGE', 'PAYMENT')).toBe(true);
  });

  it('ADMIN MANAGE implies READ', () => {
    expect(can(UserRole.ADMIN, 'READ', 'USER')).toBe(true);
    expect(can(UserRole.ADMIN, 'DELETE', 'USER')).toBe(true);
  });

  it('COACH can READ STUDENT but not DELETE', () => {
    expect(can(UserRole.COACH, 'READ', 'STUDENT')).toBe(true);
    expect(can(UserRole.COACH, 'DELETE', 'STUDENT')).toBe(false);
  });

  it('COACH can CREATE REPORT', () => {
    expect(can(UserRole.COACH, 'CREATE', 'REPORT')).toBe(true);
  });

  it('PARENT READ_OWN satisfies READ check', () => {
    expect(can(UserRole.PARENT, 'READ', 'STUDENT')).toBe(true);
    expect(can(UserRole.PARENT, 'READ', 'BILAN')).toBe(true);
  });

  it('PARENT cannot DELETE anything', () => {
    expect(can(UserRole.PARENT, 'DELETE', 'USER')).toBe(false);
    expect(can(UserRole.PARENT, 'DELETE', 'SESSION')).toBe(false);
  });

  it('ELEVE READ_SELF satisfies READ check', () => {
    expect(can(UserRole.ELEVE, 'READ', 'USER')).toBe(true);
  });

  it('ELEVE cannot CREATE SESSION', () => {
    expect(can(UserRole.ELEVE, 'CREATE', 'SESSION')).toBe(false);
  });

  it('ASSISTANTE can VALIDATE BILAN', () => {
    expect(can(UserRole.ASSISTANTE, 'VALIDATE', 'BILAN')).toBe(true);
  });

  it('returns false for unknown role', () => {
    expect(can('UNKNOWN' as UserRole, 'READ', 'USER')).toBe(false);
  });
});

describe('RBAC — getPermissions()', () => {
  it('returns permissions for ADMIN', () => {
    const perms = getPermissions(UserRole.ADMIN);
    expect(perms.length).toBeGreaterThan(0);
    expect(perms.every(p => p.action === 'MANAGE')).toBe(true);
  });

  it('returns permissions for ELEVE', () => {
    const perms = getPermissions(UserRole.ELEVE);
    expect(perms.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown role', () => {
    const perms = getPermissions('UNKNOWN' as UserRole);
    expect(perms).toEqual([]);
  });
});

describe('RBAC — canAccess()', () => {
  it('ADMIN can access admin.dashboard', () => {
    expect(canAccess(UserRole.ADMIN, 'admin.dashboard')).toBe(true);
  });

  it('PARENT cannot access admin.dashboard', () => {
    expect(canAccess(UserRole.PARENT, 'admin.dashboard')).toBe(false);
  });

  it('PARENT can access parent.dashboard', () => {
    expect(canAccess(UserRole.PARENT, 'parent.dashboard')).toBe(true);
  });

  it('ELEVE can access student.dashboard', () => {
    expect(canAccess(UserRole.ELEVE, 'student.dashboard')).toBe(true);
  });

  it('returns false for unknown policy key', () => {
    expect(canAccess(UserRole.ADMIN, 'nonexistent.policy')).toBe(false);
  });
});

describe('RBAC — getPoliciesForRole()', () => {
  it('returns policies for ADMIN', () => {
    const policies = getPoliciesForRole(UserRole.ADMIN);
    expect(policies.length).toBeGreaterThan(0);
    expect(policies.some(p => p.key === 'admin.dashboard')).toBe(true);
  });

  it('returns policies for PARENT', () => {
    const policies = getPoliciesForRole(UserRole.PARENT);
    expect(policies.some(p => p.key === 'parent.dashboard')).toBe(true);
    expect(policies.some(p => p.key === 'admin.dashboard')).toBe(false);
  });

  it('returns policies for COACH', () => {
    const policies = getPoliciesForRole(UserRole.COACH);
    expect(policies.some(p => p.key === 'coach.dashboard')).toBe(true);
  });

  it('RBAC_POLICIES is not empty', () => {
    expect(Object.keys(RBAC_POLICIES).length).toBeGreaterThan(10);
  });
});
