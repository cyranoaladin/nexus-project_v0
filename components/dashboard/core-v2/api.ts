/**
 * Browser client for the Core v2 staff API (app/api/v2). Speaks only the API
 * envelope — it never imports Core v2 runtime code (architecture guard).
 */
export type ApiOk<T> = { readonly ok: true; readonly status: number; readonly data: T };
export type ApiFail = {
  readonly ok: false;
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly correlationId?: string;
};
export type ApiResult<T> = ApiOk<T> | ApiFail;

export async function v2<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/v2${path}`, {
      method: init.method ?? 'GET',
      headers: init.json !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: 'Réseau indisponible. Réessayez.' };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const envelope = body as { ok?: boolean; data?: T; error?: { code?: string; message?: string; details?: Record<string, unknown> }; correlationId?: string } | null;
  if (response.ok && envelope?.ok === true) {
    return { ok: true, status: response.status, data: envelope.data as T };
  }
  return {
    ok: false,
    status: response.status,
    code: envelope?.error?.code ?? `HTTP_${response.status}`,
    message: envelope?.error?.message ?? 'Erreur inattendue.',
    details: envelope?.error?.details,
    correlationId: envelope?.correlationId,
  };
}

/** Human-readable text for an API failure, including validation issues when present. */
export function describeFailure(failure: ApiFail): string {
  const issues = (failure.details?.issues as Array<{ path: string; message: string }> | undefined) ?? [];
  if (issues.length > 0) {
    return `${failure.message} ${issues.map((i) => `${i.path || 'champ'} : ${i.message}`).join(' · ')}`;
  }
  if (failure.code === 'CORE_V2_UNAVAILABLE') return 'Le référentiel Core v2 n’est pas configuré sur ce déploiement.';
  if (failure.code === 'UNAUTHENTICATED') return 'Session expirée : reconnectez-vous.';
  return failure.message;
}

// ── Read-model shapes (mirror lib/core-v2/queries/staff.ts) ─────────────────

export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type Role = 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE';

export interface PublicUser {
  id: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  accountStatus: AccountStatus;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface HouseholdSummary {
  id: string;
  createdAt: string;
  parents: Array<PublicUser & { isPrimaryContact: boolean }>;
  students: Array<{ id: string; user: PublicUser }>;
}

export interface AcademicYear {
  id: string;
  startYear: number;
  startsAt: string;
  endsAt: string;
  status: 'UPCOMING' | 'CURRENT' | 'CLOSED';
}

export interface PlanningSeriesSummary {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';
  recurrenceRule: string;
  localStartTime: string;
  localEndTime: string;
  timezone: string;
  revision: number;
}

export interface AssignmentDetail {
  id: string;
  courseKey: string;
  status: 'ACTIVE' | 'ENDED';
  startsAt: string;
  endsAt: string | null;
  coach: { id: string; user: { id: string; firstName: string | null; lastName: string | null } };
  planningSeries: PlanningSeriesSummary[];
}

export interface EnrollmentDetail {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN';
  academicYear: { id: string; startYear: number; status: AcademicYear['status'] };
  gradeLevel: string;
  academicTrack: string;
  stmgPathway: string | null;
  schoolingStatus: string | null;
  school: string | null;
  academicRevision: number;
  approvedAt: string | null;
  courses: Array<{ id: string; courseKey: string; kind: 'SPECIALTY' | 'OPTION' }>;
  assignments: AssignmentDetail[];
}

export interface HouseholdDetail {
  id: string;
  createdAt: string;
  parents: Array<PublicUser & { isPrimaryContact: boolean }>;
  students: Array<{ id: string; birthDate: string | null; user: PublicUser; enrollments: EnrollmentDetail[] }>;
}

/** `GET /api/v2/student/me` (§AI). */
export interface StudentSelf {
  id: string;
  birthDate: string | null;
  user: PublicUser;
  parents: Array<{ id: string; firstName: string | null; lastName: string | null; isPrimaryContact: boolean }>;
  enrollments: EnrollmentDetail[];
}

/** `GET /api/v2/coach/me` (§AJ). */
export interface CoachSelf {
  id: string;
  user: PublicUser;
  capabilities: string[];
  assignments: Array<{
    id: string;
    courseKey: string;
    status: 'ACTIVE' | 'ENDED';
    startsAt: string;
    endsAt: string | null;
    enrollment: { id: string; status: EnrollmentDetail['status']; gradeLevel: string; academicTrack: string; academicYear: { id: string; startYear: number; status: AcademicYear['status'] } };
    student: { id: string; user: { id: string; firstName: string | null; lastName: string | null } };
    planningSeries: PlanningSeriesSummary[];
  }>;
}

export interface CoachSummary {
  id: string;
  user: PublicUser;
  capabilities: string[];
}

export interface DuplicateReport {
  hardConflict: (PublicUser & { householdId: string | null }) | null;
  possibleMatches: Array<PublicUser & { householdId: string | null; reason: 'PHONE' | 'NAME' }>;
}

export interface StaffActor {
  actor: { userId: string; role: Role };
  capabilities: string[];
}

export function displayName(user: { firstName: string | null; lastName: string | null; email?: string | null }): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email || '—';
}

export const GRADE_LEVELS = ['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC', 'AUTRE'] as const;
export const ACADEMIC_TRACKS = ['COLLEGE', 'EDS_GENERALE', 'STMG', 'STI2D', 'ST2S', 'STL', 'STD2A', 'STMG_NON_LYCEEN'] as const;
export const STMG_PATHWAYS = ['RHC', 'MERCATIQUE', 'GF', 'SIG', 'INDETERMINE'] as const;
