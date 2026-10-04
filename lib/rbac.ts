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

import { UserRole } from '@prisma/client';

export { can, getPermissions } from './rbac/permissions';
export type { Action, Resource, Permission } from './rbac/permissions';

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

  // ─── Nexus Planning Studio (planning hebdomadaire partagé) ──────────────
  'planning-studio.read': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH],
    description: 'Consulter le planning hebdomadaire canonique',
  },
  'planning-studio.write': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Enregistrer ou importer une nouvelle révision du planning',
  },
  'planning-studio.history': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Consulter l\'historique des révisions du planning',
  },
  'planning-studio.restore': {
    allowedRoles: [UserRole.ADMIN],
    description: 'Restaurer une révision antérieure ou réinitialiser le planning',
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
  'payments.bank-transfer': {
    allowedRoles: [UserRole.PARENT],
    description: 'Initiate bank transfer payment',
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

  // ─── Stages ──────────────────────────────────────────────────────────────
  'stages.list': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH, UserRole.PARENT, UserRole.ELEVE],
    description: 'List all visible stages (public with auth)',
  },
  'stages.manage': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Create, edit, close stages',
  },
  'stages.reservations.list': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'List all reservations for a stage',
  },
  'stages.reservations.confirm': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Confirm a stage reservation and send activation email',
  },
  'stages.bilans.write': {
    allowedRoles: [UserRole.COACH, UserRole.ADMIN],
    description: 'Write or update a student stage bilan',
  },
  'stages.bilans.read': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH, UserRole.ELEVE, UserRole.PARENT],
    description: 'Read published stage bilans',
  },
  'stages.documents.upload': {
    allowedRoles: [UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH],
    description: 'Upload documents for a stage or session',
  },
  'stages.enroll': {
    allowedRoles: [UserRole.PARENT, UserRole.ELEVE, UserRole.ADMIN, UserRole.ASSISTANTE],
    description: 'Public enrollment in a stage',
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

  // Role check
  const hasRole = policy.allowedRoles.includes(session.user.role);
  // Ownership fallback: if role is insufficient but allowOwner is set, check ownership
  if (!hasRole) {
    if (policy.allowOwner) {
      // Staff bypass ownership check
      if (['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
        // staff can access anything
      } else {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: `Accès refusé. Rôles autorisés: ${policy.allowedRoles.join(', ')}`,
          },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Accès refusé. Rôles autorisés: ${policy.allowedRoles.join(', ')}`,
        },
        { status: 403 }
      );
    }
  }

  // If policy has allowOwner and user has the role, optionally verify ownership for non-staff
  if (policy.allowOwner && !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
    // Ownership will be checked by the caller with the resourceId
    // We return the session; caller MUST call enforceOwnership(policyKey, session, resourceId)
  }

  return session;
}

/**
 * Enforce a named RBAC policy + ownership check in a single call.
 * Use this for routes that handle [id] resources where allowOwner matters.
 *
 * @param policyKey - Key from RBAC_POLICIES
 * @param resourceId - The resource ID to verify ownership against (e.g. studentId, invoiceId)
 * @returns AuthSession if authorized, NextResponse (401/403) if not
 *
 * @example
 * ```ts
 * const result = await enforcePolicyWithOwnership('parent.children', childId, 'read');
 * if (isErrorResponse(result)) return result;
 * const session = result;
 * ```
 */
export async function enforcePolicyWithOwnership(policyKey: string, resourceId: string | undefined, action: 'read' | 'mutation') {
  const { isErrorResponse, enforceOwnership } = await import('./guards');

  const sessionOrResponse = await enforcePolicy(policyKey);
  if (isErrorResponse(sessionOrResponse)) {
    return sessionOrResponse;
  }

  const session = sessionOrResponse;
  const policy = RBAC_POLICIES[policyKey];

  // If policy requires ownership and user is not staff, verify ownership
  if (policy?.allowOwner && resourceId && !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
    const ownershipResult = await enforceOwnership(policyKey, session, resourceId, action);
    if (isErrorResponse(ownershipResult)) {
      return ownershipResult;
    }
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
