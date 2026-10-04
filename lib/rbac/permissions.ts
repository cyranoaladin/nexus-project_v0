/** Pure canonical permission matrix shared by server and browser. */
import type { UserRole } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Resource/Action Permission Matrix (fine-grained RBAC)
// ═══════════════════════════════════════════════════════════════════════════════

/** Business resources that can be acted upon */
export type Resource =
  | 'USER'
  | 'STUDENT'
  | 'COACH_ASSIGNMENT'
  | 'DOCUMENT'
  | 'DOCUMENT_ASSIGNMENT'
  | 'BILAN'
  | 'SESSION'
  | 'RESERVATION'
  | 'PAYMENT'
  | 'SUBSCRIPTION'
  | 'RESOURCE_CONTENT'
  | 'NOTIFICATION'
  | 'CONFIG'
  | 'REPORT'
  // NPC - Nexus Pedagogy Cockpit
  | 'COPY_SUBMISSION'
  | 'PEDAGOGICAL_REPORT'
  | 'AI_PROCESSING_JOB'
  | 'REMEDIATION_ROADMAP';

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
  | 'EXPORT'
  | 'ASSIGN'
  | 'UNASSIGN';

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
  ADMIN: [
    { action: 'MANAGE', resource: 'USER' },
    { action: 'MANAGE', resource: 'STUDENT' },
    { action: 'MANAGE', resource: 'COACH_ASSIGNMENT' },
    { action: 'MANAGE', resource: 'DOCUMENT' },
    { action: 'MANAGE', resource: 'DOCUMENT_ASSIGNMENT' },
    { action: 'MANAGE', resource: 'BILAN' },
    { action: 'MANAGE', resource: 'SESSION' },
    { action: 'MANAGE', resource: 'RESERVATION' },
    { action: 'MANAGE', resource: 'PAYMENT' },
    { action: 'MANAGE', resource: 'SUBSCRIPTION' },
    { action: 'MANAGE', resource: 'RESOURCE_CONTENT' },
    { action: 'MANAGE', resource: 'NOTIFICATION' },
    { action: 'MANAGE', resource: 'CONFIG' },
    { action: 'MANAGE', resource: 'REPORT' },
    // NPC - Nexus Pedagogy Cockpit
    { action: 'MANAGE', resource: 'COPY_SUBMISSION' },
    { action: 'MANAGE', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'MANAGE', resource: 'AI_PROCESSING_JOB' },
    { action: 'MANAGE', resource: 'REMEDIATION_ROADMAP' },
  ],
  ASSISTANTE: [
    { action: 'READ', resource: 'USER' },
    { action: 'READ', resource: 'STUDENT' },
    { action: 'CREATE', resource: 'STUDENT' },
    { action: 'UPDATE', resource: 'STUDENT' },
    { action: 'READ', resource: 'COACH_ASSIGNMENT' },
    { action: 'ASSIGN', resource: 'COACH_ASSIGNMENT' },
    { action: 'UNASSIGN', resource: 'COACH_ASSIGNMENT' },
    { action: 'READ', resource: 'DOCUMENT' },
    { action: 'CREATE', resource: 'DOCUMENT' },
    { action: 'ASSIGN', resource: 'DOCUMENT_ASSIGNMENT' },
    { action: 'VALIDATE', resource: 'BILAN' },
    { action: 'READ', resource: 'BILAN' },
    { action: 'CREATE', resource: 'SESSION' },
    { action: 'UPDATE', resource: 'SESSION' },
    { action: 'READ', resource: 'SESSION' },
    { action: 'MANAGE', resource: 'RESERVATION' },
    { action: 'READ', resource: 'PAYMENT' },
    { action: 'UPDATE', resource: 'SUBSCRIPTION' },
    { action: 'READ', resource: 'SUBSCRIPTION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
    { action: 'READ', resource: 'REPORT' },
    // NPC - Read-only access for support purposes
    { action: 'READ', resource: 'COPY_SUBMISSION' },
    { action: 'READ', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'READ', resource: 'REMEDIATION_ROADMAP' },
  ],
  COACH: [
    { action: 'READ', resource: 'USER' },
    { action: 'READ_OWN', resource: 'STUDENT' }, // Only assigned students
    { action: 'READ', resource: 'DOCUMENT' },
    { action: 'CREATE', resource: 'DOCUMENT' },
    { action: 'ASSIGN', resource: 'DOCUMENT_ASSIGNMENT' },
    { action: 'READ', resource: 'BILAN' },
    { action: 'UPDATE', resource: 'SESSION' },
    { action: 'READ', resource: 'SESSION' },
    { action: 'READ', resource: 'RESERVATION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
    { action: 'CREATE', resource: 'REPORT' },
    { action: 'READ', resource: 'REPORT' },
    // NPC - Coach manages pedagogical reports for their students
    { action: 'READ', resource: 'COPY_SUBMISSION' },
    { action: 'CREATE', resource: 'COPY_SUBMISSION' },
    { action: 'READ', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'CREATE', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'UPDATE', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'VALIDATE', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'READ', resource: 'REMEDIATION_ROADMAP' },
    { action: 'CREATE', resource: 'REMEDIATION_ROADMAP' },
  ],
  PARENT: [
    { action: 'READ_SELF', resource: 'USER' },
    { action: 'READ_OWN', resource: 'STUDENT' },
    { action: 'READ', resource: 'DOCUMENT' },
    { action: 'CREATE', resource: 'BILAN' },
    { action: 'READ_OWN', resource: 'BILAN' },
    { action: 'READ_OWN', resource: 'SESSION' },
    { action: 'CREATE', resource: 'RESERVATION' },
    { action: 'READ_OWN', resource: 'PAYMENT' },
    { action: 'READ', resource: 'SUBSCRIPTION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
    // NPC - Parents can view reports for their children
    { action: 'READ_OWN', resource: 'COPY_SUBMISSION' },
    { action: 'READ_OWN', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'READ_OWN', resource: 'REMEDIATION_ROADMAP' },
  ],
  ELEVE: [
    { action: 'READ_SELF', resource: 'USER' },
    { action: 'READ_SELF', resource: 'STUDENT' },
    { action: 'READ', resource: 'DOCUMENT' },
    { action: 'READ', resource: 'BILAN' },
    { action: 'READ_OWN', resource: 'SESSION' },
    { action: 'READ', resource: 'RESOURCE_CONTENT' },
    // NPC - Students can view their own reports
    { action: 'READ_SELF', resource: 'COPY_SUBMISSION' },
    { action: 'READ_SELF', resource: 'PEDAGOGICAL_REPORT' },
    { action: 'READ_SELF', resource: 'REMEDIATION_ROADMAP' },
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
