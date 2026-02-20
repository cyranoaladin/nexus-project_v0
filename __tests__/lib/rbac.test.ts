/**
 * Unit tests for centralized RBAC module (lib/rbac.ts)
 */

import { UserRole } from '@/types/enums';
import {
  RBAC_POLICIES,
  canAccess,
  getPoliciesForRole,
  can,
  getPermissions,
  type Resource,
  type Action,
} from '@/lib/rbac';

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
    expect(keys).toContain('payments.bank-transfer');
    expect(keys).not.toContain('admin.dashboard');
    expect(keys).not.toContain('coach.dashboard');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Resource/Action Permission Matrix Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('can() — Resource/Action Permission Matrix', () => {
  describe('ADMIN — full MANAGE on all resources', () => {
    const resources: Resource[] = [
      'USER', 'STUDENT', 'BILAN', 'SESSION', 'RESERVATION',
      'PAYMENT', 'SUBSCRIPTION', 'RESOURCE_CONTENT', 'NOTIFICATION', 'CONFIG', 'REPORT',
    ];
    const actions: Action[] = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE', 'VALIDATE', 'EXPORT'];

    it.each(resources)('should MANAGE %s', (resource) => {
      for (const action of actions) {
        expect(can(UserRole.ADMIN, action, resource)).toBe(true);
      }
    });
  });

  describe('ASSISTANTE — operational permissions', () => {
    it('can READ and UPDATE students', () => {
      expect(can(UserRole.ASSISTANTE, 'READ', 'STUDENT')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'UPDATE', 'STUDENT')).toBe(true);
    });

    it('can VALIDATE bilans', () => {
      expect(can(UserRole.ASSISTANTE, 'VALIDATE', 'BILAN')).toBe(true);
    });

    it('can MANAGE reservations', () => {
      expect(can(UserRole.ASSISTANTE, 'CREATE', 'RESERVATION')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'UPDATE', 'RESERVATION')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'DELETE', 'RESERVATION')).toBe(true);
    });

    it('can READ payments but not CREATE or DELETE', () => {
      expect(can(UserRole.ASSISTANTE, 'READ', 'PAYMENT')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'CREATE', 'PAYMENT')).toBe(false);
      expect(can(UserRole.ASSISTANTE, 'DELETE', 'PAYMENT')).toBe(false);
    });

    it('cannot MANAGE config', () => {
      expect(can(UserRole.ASSISTANTE, 'MANAGE', 'CONFIG')).toBe(false);
      expect(can(UserRole.ASSISTANTE, 'UPDATE', 'CONFIG')).toBe(false);
    });
  });

  describe('COACH — teaching permissions', () => {
    it('can READ students and bilans', () => {
      expect(can(UserRole.COACH, 'READ', 'STUDENT')).toBe(true);
      expect(can(UserRole.COACH, 'READ', 'BILAN')).toBe(true);
    });

    it('can UPDATE sessions (submit report)', () => {
      expect(can(UserRole.COACH, 'UPDATE', 'SESSION')).toBe(true);
    });

    it('can CREATE and READ reports', () => {
      expect(can(UserRole.COACH, 'CREATE', 'REPORT')).toBe(true);
      expect(can(UserRole.COACH, 'READ', 'REPORT')).toBe(true);
    });

    it('cannot CREATE students or manage payments', () => {
      expect(can(UserRole.COACH, 'CREATE', 'STUDENT')).toBe(false);
      expect(can(UserRole.COACH, 'READ', 'PAYMENT')).toBe(false);
      expect(can(UserRole.COACH, 'MANAGE', 'PAYMENT')).toBe(false);
    });

    it('cannot access config or subscriptions', () => {
      expect(can(UserRole.COACH, 'READ', 'CONFIG')).toBe(false);
      expect(can(UserRole.COACH, 'READ', 'SUBSCRIPTION')).toBe(false);
    });
  });

  describe('PARENT — ownership-scoped permissions', () => {
    it('can READ_SELF user data (satisfies READ)', () => {
      expect(can(UserRole.PARENT, 'READ', 'USER')).toBe(true);
      expect(can(UserRole.PARENT, 'READ_SELF', 'USER')).toBe(true);
    });

    it('can READ_OWN student data', () => {
      expect(can(UserRole.PARENT, 'READ', 'STUDENT')).toBe(true);
      expect(can(UserRole.PARENT, 'READ_OWN', 'STUDENT')).toBe(true);
    });

    it('can CREATE bilans and reservations', () => {
      expect(can(UserRole.PARENT, 'CREATE', 'BILAN')).toBe(true);
      expect(can(UserRole.PARENT, 'CREATE', 'RESERVATION')).toBe(true);
    });

    it('can READ own payments', () => {
      expect(can(UserRole.PARENT, 'READ', 'PAYMENT')).toBe(true);
      expect(can(UserRole.PARENT, 'READ_OWN', 'PAYMENT')).toBe(true);
    });

    it('cannot UPDATE or DELETE students', () => {
      expect(can(UserRole.PARENT, 'UPDATE', 'STUDENT')).toBe(false);
      expect(can(UserRole.PARENT, 'DELETE', 'STUDENT')).toBe(false);
    });

    it('cannot access config or reports', () => {
      expect(can(UserRole.PARENT, 'READ', 'CONFIG')).toBe(false);
      expect(can(UserRole.PARENT, 'READ', 'REPORT')).toBe(false);
    });
  });

  describe('ELEVE — minimal read-only permissions', () => {
    it('can READ_SELF user and student data', () => {
      expect(can(UserRole.ELEVE, 'READ_SELF', 'USER')).toBe(true);
      expect(can(UserRole.ELEVE, 'READ_SELF', 'STUDENT')).toBe(true);
    });

    it('can READ bilans and resource content', () => {
      expect(can(UserRole.ELEVE, 'READ', 'BILAN')).toBe(true);
      expect(can(UserRole.ELEVE, 'READ', 'RESOURCE_CONTENT')).toBe(true);
    });

    it('can READ_OWN sessions', () => {
      expect(can(UserRole.ELEVE, 'READ_OWN', 'SESSION')).toBe(true);
      expect(can(UserRole.ELEVE, 'READ', 'SESSION')).toBe(true);
    });

    it('cannot CREATE, UPDATE, or DELETE anything', () => {
      expect(can(UserRole.ELEVE, 'CREATE', 'BILAN')).toBe(false);
      expect(can(UserRole.ELEVE, 'UPDATE', 'SESSION')).toBe(false);
      expect(can(UserRole.ELEVE, 'DELETE', 'USER')).toBe(false);
    });

    it('cannot access payments, subscriptions, config, or reservations', () => {
      expect(can(UserRole.ELEVE, 'READ', 'PAYMENT')).toBe(false);
      expect(can(UserRole.ELEVE, 'READ', 'SUBSCRIPTION')).toBe(false);
      expect(can(UserRole.ELEVE, 'READ', 'CONFIG')).toBe(false);
      expect(can(UserRole.ELEVE, 'READ', 'RESERVATION')).toBe(false);
    });
  });

  describe('MANAGE semantics', () => {
    it('MANAGE should grant all actions including VALIDATE and EXPORT', () => {
      expect(can(UserRole.ADMIN, 'VALIDATE', 'BILAN')).toBe(true);
      expect(can(UserRole.ADMIN, 'EXPORT', 'USER')).toBe(true);
      expect(can(UserRole.ADMIN, 'DELETE', 'SESSION')).toBe(true);
    });

    it('ASSISTANTE MANAGE on RESERVATION should grant all actions', () => {
      expect(can(UserRole.ASSISTANTE, 'CREATE', 'RESERVATION')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'READ', 'RESERVATION')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'UPDATE', 'RESERVATION')).toBe(true);
      expect(can(UserRole.ASSISTANTE, 'DELETE', 'RESERVATION')).toBe(true);
    });
  });

  describe('READ hierarchy', () => {
    it('READ_SELF should satisfy READ check', () => {
      // PARENT has READ_SELF on USER
      expect(can(UserRole.PARENT, 'READ', 'USER')).toBe(true);
    });

    it('READ_OWN should satisfy READ check', () => {
      // PARENT has READ_OWN on STUDENT
      expect(can(UserRole.PARENT, 'READ', 'STUDENT')).toBe(true);
    });

    it('READ should NOT satisfy READ_SELF check (stricter)', () => {
      // COACH has READ on USER (not READ_SELF)
      expect(can(UserRole.COACH, 'READ', 'USER')).toBe(true);
      // But READ_SELF is a different permission — COACH has READ which is broader
      expect(can(UserRole.COACH, 'READ_SELF', 'USER')).toBe(false);
    });
  });
});

describe('getPermissions()', () => {
  it('ADMIN should have permissions on all 11 resources', () => {
    const perms = getPermissions(UserRole.ADMIN);
    const resources = new Set(perms.map(p => p.resource));
    expect(resources.size).toBe(11);
  });

  it('ELEVE should have the fewest permissions', () => {
    const elevePerms = getPermissions(UserRole.ELEVE);
    const coachPerms = getPermissions(UserRole.COACH);
    expect(elevePerms.length).toBeLessThan(coachPerms.length);
  });

  it('every permission should have valid action and resource', () => {
    const validActions: Action[] = ['READ', 'READ_SELF', 'READ_OWN', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE', 'VALIDATE', 'EXPORT'];
    const validResources: Resource[] = ['USER', 'STUDENT', 'BILAN', 'SESSION', 'RESERVATION', 'PAYMENT', 'SUBSCRIPTION', 'RESOURCE_CONTENT', 'NOTIFICATION', 'CONFIG', 'REPORT'];

    for (const role of Object.values(UserRole)) {
      for (const perm of getPermissions(role)) {
        expect(validActions).toContain(perm.action);
        expect(validResources).toContain(perm.resource);
      }
    }
  });
});
