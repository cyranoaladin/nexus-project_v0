/**
 * Unit tests for centralized RBAC module (lib/rbac.ts)
 */

import { UserRole } from '@/types/enums';
import { RBAC_POLICIES, canAccess, getPoliciesForRole } from '@/lib/rbac';

describe('RBAC Policy Map', () => {
  describe('Policy structure', () => {
    it('should have at least 30 policies defined', () => {
      const policyCount = Object.keys(RBAC_POLICIES).length;
      expect(policyCount).toBeGreaterThanOrEqual(30);
    });

    it('every policy should have allowedRoles array and description', () => {
      for (const [key, policy] of Object.entries(RBAC_POLICIES)) {
        expect(policy.allowedRoles).toBeDefined();
        expect(Array.isArray(policy.allowedRoles)).toBe(true);
        expect(policy.allowedRoles.length).toBeGreaterThan(0);
        expect(policy.description).toBeTruthy();
        // Verify all roles are valid UserRole values
        for (const role of policy.allowedRoles) {
          expect(Object.values(UserRole)).toContain(role);
        }
      }
    });

    it('policy keys should use dot notation', () => {
      for (const key of Object.keys(RBAC_POLICIES)) {
        expect(key).toMatch(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/);
      }
    });
  });

  describe('Admin policies', () => {
    it('admin.dashboard should be ADMIN only', () => {
      expect(RBAC_POLICIES['admin.dashboard'].allowedRoles).toEqual([UserRole.ADMIN]);
    });

    it('admin.analytics should be ADMIN only', () => {
      expect(RBAC_POLICIES['admin.analytics'].allowedRoles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('Assistante policies', () => {
    it('assistant.dashboard should allow ADMIN and ASSISTANTE', () => {
      const roles = RBAC_POLICIES['assistant.dashboard'].allowedRoles;
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.ASSISTANTE);
      expect(roles).not.toContain(UserRole.ELEVE);
    });

    it('assistant.activate-student should allow ADMIN, ASSISTANTE, and PARENT', () => {
      const roles = RBAC_POLICIES['assistant.activate-student'].allowedRoles;
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.ASSISTANTE);
      expect(roles).toContain(UserRole.PARENT);
      expect(roles).not.toContain(UserRole.ELEVE);
      expect(roles).not.toContain(UserRole.COACH);
    });
  });

  describe('Coach policies', () => {
    it('coach.dashboard should be COACH only', () => {
      expect(RBAC_POLICIES['coach.dashboard'].allowedRoles).toEqual([UserRole.COACH]);
    });

    it('coach.sessions.report should allow owner access', () => {
      expect(RBAC_POLICIES['coach.sessions.report'].allowOwner).toBe(true);
    });
  });

  describe('Student policies', () => {
    it('student.dashboard should be ELEVE only', () => {
      expect(RBAC_POLICIES['student.dashboard'].allowedRoles).toEqual([UserRole.ELEVE]);
    });

    it('student.badges should allow ELEVE, PARENT, and ADMIN', () => {
      const roles = RBAC_POLICIES['student.badges'].allowedRoles;
      expect(roles).toContain(UserRole.ELEVE);
      expect(roles).toContain(UserRole.PARENT);
      expect(roles).toContain(UserRole.ADMIN);
    });
  });

  describe('Cross-role policies', () => {
    it('sessions.cancel should allow PARENT, COACH, ADMIN, ASSISTANTE', () => {
      const roles = RBAC_POLICIES['sessions.cancel'].allowedRoles;
      expect(roles).toContain(UserRole.PARENT);
      expect(roles).toContain(UserRole.COACH);
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.ASSISTANTE);
      expect(roles).not.toContain(UserRole.ELEVE);
    });

    it('messages.send should allow all authenticated roles', () => {
      const roles = RBAC_POLICIES['messages.send'].allowedRoles;
      expect(roles).toHaveLength(5);
      for (const role of Object.values(UserRole)) {
        expect(roles).toContain(role);
      }
    });
  });
});

describe('canAccess()', () => {
  it('should return true for allowed role', () => {
    expect(canAccess(UserRole.ADMIN, 'admin.dashboard')).toBe(true);
  });

  it('should return false for disallowed role', () => {
    expect(canAccess(UserRole.ELEVE, 'admin.dashboard')).toBe(false);
  });

  it('should return false for unknown policy key', () => {
    expect(canAccess(UserRole.ADMIN, 'nonexistent.policy')).toBe(false);
  });

  it('should correctly check cross-role policies', () => {
    expect(canAccess(UserRole.PARENT, 'sessions.book')).toBe(true);
    expect(canAccess(UserRole.COACH, 'sessions.book')).toBe(false);
    expect(canAccess(UserRole.ADMIN, 'sessions.book')).toBe(true);
  });
});

describe('getPoliciesForRole()', () => {
  it('ADMIN should have access to the most policies', () => {
    const adminPolicies = getPoliciesForRole(UserRole.ADMIN);
    const elevePolicies = getPoliciesForRole(UserRole.ELEVE);
    expect(adminPolicies.length).toBeGreaterThan(elevePolicies.length);
  });

  it('ELEVE should have access to student, aria, messages, and session policies', () => {
    const policies = getPoliciesForRole(UserRole.ELEVE);
    const keys = policies.map(p => p.key);
    expect(keys).toContain('student.dashboard');
    expect(keys).toContain('student.resources');
    expect(keys).toContain('aria.chat');
    expect(keys).toContain('messages.send');
    expect(keys).not.toContain('admin.dashboard');
  });

  it('COACH should have access to coach and session policies', () => {
    const policies = getPoliciesForRole(UserRole.COACH);
    const keys = policies.map(p => p.key);
    expect(keys).toContain('coach.dashboard');
    expect(keys).toContain('coach.sessions.report');
    expect(keys).toContain('aria.chat');
    expect(keys).not.toContain('admin.dashboard');
    expect(keys).not.toContain('parent.dashboard');
  });

  it('PARENT should have access to parent, session booking, and payment policies', () => {
    const policies = getPoliciesForRole(UserRole.PARENT);
    const keys = policies.map(p => p.key);
    expect(keys).toContain('parent.dashboard');
    expect(keys).toContain('parent.children');
    expect(keys).toContain('sessions.book');
    expect(keys).toContain('payments.wise');
    expect(keys).not.toContain('admin.dashboard');
    expect(keys).not.toContain('coach.dashboard');
  });
});
