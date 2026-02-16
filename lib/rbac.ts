/**
 * Centralized RBAC Policy Map
 *
 * Single source of truth for route-level access control.
 * Each route declares which roles can access it and what ownership rules apply.
 *
 * Usage in API routes:
 *   import { enforcePolicy } from '@/lib/rbac';
 *   const session = await enforcePolicy('admin.dashboard');
 *   if (isErrorResponse(session)) return session;
 */

import { UserRole } from '@/types/enums';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Resource/Action Permission Matrix (fine-grained RBAC)
// ═══════════════════════════════════════════════════════════════════════════════

/** Business resources that can be acted upon */
export type Resource =
  | 'USER'
  | 'STUDENT'
  | 'BILAN'
  | 'SESSION'
  | 'RESERVATION'
  | 'PAYMENT'
  | 'SUBSCRIPTION'
  | 'RESOURCE_CONTENT'
  | 'NOTIFICATION'
  | 'CONFIG'
  | 'REPORT';

/** Actions that can be performed on resources */
export type Action =
  | 'READ'
  | 'READ_SELF'
  | 'READ_OWN'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'MANAGE'
  | 'VALIDATE'
  | 'EXPORT';

/** A single permission entry */
export interface Permission {
  action: Action;
  resource: Resource;
}

/**
 * Resource/Action permission matrix.
 * MANAGE implies all actions on that resource.
 * READ_SELF = can only read own data.
 * READ_OWN = can read data of owned entities (e.g. parent reads children).
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    { action: 'MANAGE', resource: 'USER' },
    { action: 'MANAGE', resource: 'STUDENT' },
    { action: 'MANAGE', resource: 'BILAN' },
    { action: 'MANAGE', resource: 'SESSION' },
    { action: 'MANAGE', resource: 'RESERVATION' },
    { action: 'MANAGE', resource: 'PAYMENT' },
    { action: 'MANAGE', resource: 'SUBSCRIPTION' },
    { action: 'MANAGE', resource: 'RESOURCE_CONTENT' },
    { action: 'MANAGE', resource: 'NOTIFICATION' },
    { action: 'MANAGE', resource: 'CONFIG' },
    { action: 'MANAGE', resource: 'REPORT' },
  ],
  [UserRole.ASSISTANTE]: [
    { action: 'READ', resource: 'USER' },
    { action: 'READ', resource: 'STUDENT' },
    { action: 'UPDATE', resource: 'STUDENT' },
    { action: 'VALIDATE', resource: 'BILAN' },
    { action: 'READ', resource: 'BILAN' },
    { action: 'UPDATE', resource: 'SESSION' },
    { action: 'READ', resource: 'SESSION' },
    { action: 'MANAGE', resource: 'RESERVATION' },
    { action: 'READ', resource: 'PAYMENT' },
    { action: 'UPDATE', resource: 'SUBSCRIPTION' },
    { action: 'READ', resource: 'SUBSCRIPTION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
    { action: 'READ', resource: 'REPORT' },
  ],
  [UserRole.COACH]: [
    { action: 'READ', resource: 'USER' },
    { action: 'READ', resource: 'STUDENT' },
    { action: 'READ', resource: 'BILAN' },
    { action: 'UPDATE', resource: 'SESSION' },
    { action: 'READ', resource: 'SESSION' },
    { action: 'READ', resource: 'RESERVATION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
    { action: 'CREATE', resource: 'REPORT' },
    { action: 'READ', resource: 'REPORT' },
  ],
  [UserRole.PARENT]: [
    { action: 'READ_SELF', resource: 'USER' },
    { action: 'READ_OWN', resource: 'STUDENT' },
    { action: 'CREATE', resource: 'BILAN' },
    { action: 'READ_OWN', resource: 'BILAN' },
    { action: 'READ_OWN', resource: 'SESSION' },
    { action: 'CREATE', resource: 'RESERVATION' },
    { action: 'READ_OWN', resource: 'PAYMENT' },
    { action: 'READ', resource: 'SUBSCRIPTION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
  ],
  [UserRole.ELEVE]: [
    { action: 'READ_SELF', resource: 'USER' },
    { action: 'READ_SELF', resource: 'STUDENT' },
    { action: 'READ', resource: 'BILAN' },
    { action: 'READ_OWN', resource: 'SESSION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
  ],
};

/**
 * Check if a role can perform an action on a resource.
 * MANAGE grants all actions. READ encompasses READ_SELF and READ_OWN.
 *
 * @param role - The user role
 * @param action - The action to check
 * @param resource - The resource to check
 * @returns true if the role has the permission
 *
 * @example
 * ```ts
 * if (!can(session.user.role, 'UPDATE', 'SESSION')) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 */
export function can(role: UserRole, action: Action, resource: Resource): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) return false;

  return permissions.some((p) => {
    if (p.resource !== resource) return false;
    // MANAGE grants everything
    if (p.action === 'MANAGE') return true;
    // Exact match
    if (p.action === action) return true;
    // READ_SELF and READ_OWN satisfy READ checks (but not vice versa)
    if (action === 'READ' && (p.action === 'READ_SELF' || p.action === 'READ_OWN')) return true;
    return false;
  });
}

/**
 * Get all permissions for a given role.
 * Useful for debugging and admin views.
 */
export function getPermissions(role: UserRole): Permission[] {
  return rolePermissions[role] ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Route-Level Policy Map (coarse-grained RBAC)
// ═══════════════════════════════════════════════════════════════════════════════

/** Access policy for a single route/resource */
export interface AccessPolicy {
  /** Roles allowed to access this resource */
  allowedRoles: UserRole[];
  /** If true, user can also access if they own the resource */
  allowOwner?: boolean;
  /** Human-readable description */
  description: string;
}

/**
 * Declarative RBAC policy map.
 * Keys use dot notation: "namespace.resource" or "namespace.resource.action"
 */
export const RBAC_POLICIES: Record<string, AccessPolicy> = {
  // ─── Admin ───────────────────────────────────────────────────────────────
  'admin.dashboard': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Admin dashboard with KPIs and system health',
  },
  'admin.analytics': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Analytics data (revenue, users, sessions)',
  },
  'admin.activities': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Recent platform activities',
  },
  'admin.subscriptions': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Manage all subscriptions',
  },
  'admin.test-email': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Send test emails (dev/staging only)',
  },
  'admin.test-payments': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Simulate payments (dev/staging only)',
  },

  // ─── Assistante ──────────────────────────────────────────────────────────
  'assistant.dashboard': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Assistante dashboard with pending tasks',
  },
  'assistant.coaches': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Manage coach profiles',
  },
  'assistant.students.credits': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Manage student credits',
  },
  'assistant.credit-requests': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Process credit purchase requests',
  },
  'assistant.subscription-requests': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Process subscription requests',
  },
  'assistant.subscriptions': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Manage subscriptions',
  },
  'assistant.activate-student': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.PARENT],
    description: 'Initiate student account activation (Modèle B)',
  },

  // ─── Coach ───────────────────────────────────────────────────────────────
  'coach.dashboard': {
    allowedRoles: [UserRole.COACH],
    description: 'Coach dashboard with schedule and students',
  },
  'coach.sessions.report': {
    allowedRoles: [UserRole.COACH],
    allowOwner: true,
    description: 'Submit session report (coach who conducted the session)',
  },
  'coaches.availability': {
    allowedRoles: [UserRole.COACH, UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Manage coach availability slots',
  },
  'coaches.available': {
    allowedRoles: [UserRole.PARENT, UserRole.ELEVE, UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'List available coaches for booking',
  },

  // ─── Parent ──────────────────────────────────────────────────────────────
  'parent.dashboard': {
    allowedRoles: [UserRole.PARENT],
    description: 'Parent dashboard with children overview',
  },
  'parent.children': {
    allowedRoles: [UserRole.PARENT],
    allowOwner: true,
    description: 'View/manage own children',
  },
  'parent.subscriptions': {
    allowedRoles: [UserRole.PARENT],
    allowOwner: true,
    description: 'View own subscriptions',
  },
  'parent.subscription-requests': {
    allowedRoles: [UserRole.PARENT],
    description: 'Request new subscription',
  },
  'parent.credit-request': {
    allowedRoles: [UserRole.PARENT],
    description: 'Request credit purchase',
  },

  // ─── Student ─────────────────────────────────────────────────────────────
  'student.dashboard': {
    allowedRoles: [UserRole.ELEVE],
    description: 'Student dashboard with progress',
  },
  'student.resources': {
    allowedRoles: [UserRole.ELEVE],
    description: 'Student learning resources',
  },
  'student.badges': {
    allowedRoles: [UserRole.ELEVE, UserRole.PARENT, UserRole.ADMIN],
    allowOwner: true,
    description: 'View student badges',
  },

  // ─── Sessions ────────────────────────────────────────────────────────────
  'sessions.book': {
    allowedRoles: [UserRole.PARENT, UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Book a coaching session',
  },
  'sessions.cancel': {
    allowedRoles: [UserRole.PARENT, UserRole.COACH, UserRole.ADMIN, UserRole.ASSISTANTE],
    allowOwner: true,
    description: 'Cancel a session (owner or staff)',
  },
  'sessions.video': {
    allowedRoles: [UserRole.COACH, UserRole.ELEVE, UserRole.PARENT],
    allowOwner: true,
    description: 'Access video session link',
  },

  // ─── Payments ────────────────────────────────────────────────────────────
  'payments.validate': {
    allowedRoles: [UserRole.PARENT, UserRole.ADMIN],
    description: 'Validate payment',
  },
  'payments.wise': {
    allowedRoles: [UserRole.PARENT],
    description: 'Initiate Wise payment',
  },

  // ─── Subscriptions ───────────────────────────────────────────────────────
  'subscriptions.change': {
    allowedRoles: [UserRole.PARENT, UserRole.ADMIN],
    description: 'Change subscription plan',
  },
  'subscriptions.aria-addon': {
    allowedRoles: [UserRole.PARENT, UserRole.ADMIN],
    description: 'Add/remove ARIA AI addon',
  },

  // ─── ARIA AI ─────────────────────────────────────────────────────────────
  'aria.chat': {
    allowedRoles: [UserRole.ELEVE, UserRole.COACH, UserRole.PARENT],
    description: 'Chat with ARIA AI assistant',
  },
  'aria.conversations': {
    allowedRoles: [UserRole.ELEVE, UserRole.COACH, UserRole.PARENT],
    description: 'List ARIA conversations',
  },
  'aria.feedback': {
    allowedRoles: [UserRole.ELEVE, UserRole.COACH, UserRole.PARENT],
    description: 'Submit ARIA feedback',
  },

  // ─── Messages ────────────────────────────────────────────────────────────
  'messages.send': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH, UserRole.PARENT, UserRole.ELEVE],
    description: 'Send a message (all authenticated users)',
  },
};

/**
 * Enforce a named RBAC policy.
 * Imports Next.js server APIs lazily to keep the policy map testable in Jest.
 *
 * @param policyKey - Key from RBAC_POLICIES (e.g. 'admin.dashboard')
 * @returns AuthSession if authorized, NextResponse (401/403) if not
 *
 * @example
 * ```ts
 * const result = await enforcePolicy('admin.dashboard');
 * if (isErrorResponse(result)) return result;
 * const session = result; // typed as AuthSession
 * ```
 */
export async function enforcePolicy(policyKey: string) {
  const { NextResponse } = await import('next/server');
  const { requireAuth, isErrorResponse } = await import('./guards');

  const policy = RBAC_POLICIES[policyKey];
  if (!policy) {
    console.error(`[RBAC] Unknown policy key: ${policyKey}`);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Invalid RBAC policy configuration' },
      { status: 500 }
    );
  }

  const sessionOrResponse = await requireAuth();
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const session = sessionOrResponse;

  if (!('user' in session) || !policy.allowedRoles.includes(session.user.role)) {
    console.warn('[RBAC] Access denied', {
      policy: policyKey,
      allowedRoles: policy.allowedRoles,
    });

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Accès refusé. Rôles autorisés: ${policy.allowedRoles.join(', ')}`,
      },
      { status: 403 }
    );
  }

  return session;
}

/**
 * Check if a role has access to a policy (without session — for UI rendering).
 *
 * @param role - The user role to check
 * @param policyKey - Key from RBAC_POLICIES
 * @returns true if the role is allowed
 */
export function canAccess(role: UserRole, policyKey: string): boolean {
  const policy = RBAC_POLICIES[policyKey];
  if (!policy) return false;
  return policy.allowedRoles.includes(role);
}

/**
 * Get all policies accessible by a given role.
 * Useful for building role-specific navigation menus.
 *
 * @param role - The user role
 * @returns Array of { key, policy } objects
 */
export function getPoliciesForRole(role: UserRole): { key: string; policy: AccessPolicy }[] {
  return Object.entries(RBAC_POLICIES)
    .filter(([, policy]) => policy.allowedRoles.includes(role))
    .map(([key, policy]) => ({ key, policy }));
}
