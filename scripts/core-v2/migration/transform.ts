/**
 * Pure, deterministic transform: source snapshot + approval + declared
 * migratedAt → the exact target rows to write, plus a manifest entry for
 * every source object considered (written, skipped or rejected — nothing is
 * dropped silently). No clock, no randomness, no database.
 */
import { createHash } from 'node:crypto';
import type { ApprovalFile } from './approval';
import type { SourceSnapshot, SourceUser } from './source';
import { TRANSFORM_VERSION, type MigrationEntity, type ObjectManifestEntry } from './types';

export type Role = SourceUser['role'];
export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE';

export interface TargetUser {
  readonly id: string;
  readonly email: string | null;
  readonly password: string | null;
  readonly role: Role;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly accountStatus: AccountStatus;
  readonly activatedAt: Date | null;
  readonly sessionVersion: number;
}
export interface TargetHousehold { readonly id: string; readonly sourceParentProfileId: string }
export interface TargetHouseholdParent { readonly id: string; readonly householdId: string; readonly userId: string; readonly isPrimaryContact: true }
export interface TargetStudent { readonly id: string; readonly userId: string; readonly householdId: string; readonly birthDate: Date | null }
export interface TargetEnrollment {
  readonly id: string;
  readonly studentId: string;
  readonly gradeLevel: string;
  readonly academicTrack: string;
  readonly stmgPathway: string | null;
  readonly schoolingStatus: string | null;
  readonly school: string | null;
}
export interface TargetCourseEnrollment { readonly id: string; readonly enrollmentId: string; readonly courseKey: string; readonly kind: 'SPECIALTY' | 'OPTION' }
export interface TargetCoachProfile { readonly id: string; readonly userId: string }
export interface TargetCapability { readonly id: string; readonly coachId: string; readonly courseKey: string }
export interface TargetAssignment {
  readonly id: string;
  readonly sourceAssignmentId: string;
  readonly coachId: string;
  readonly enrollmentId: string;
  readonly courseKey: string;
  readonly startsAt: Date;
}
export interface TargetSeries {
  readonly id: string;
  readonly assignmentId: string;
  readonly timezone: string;
  readonly startDate: Date;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly recurrenceRule: string;
  readonly recurrenceCount: number | null;
  readonly recurrenceUntil: Date | null;
  readonly modality: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
  readonly location: string | null;
}

export interface TargetPlan {
  readonly academicYear: { readonly startYear: number; readonly startsAt: Date; readonly endsAt: Date };
  readonly users: readonly TargetUser[];
  readonly households: readonly TargetHousehold[];
  readonly householdParents: readonly TargetHouseholdParent[];
  readonly students: readonly TargetStudent[];
  readonly enrollments: readonly TargetEnrollment[];
  readonly courseEnrollments: readonly TargetCourseEnrollment[];
  readonly coachProfiles: readonly TargetCoachProfile[];
  readonly capabilities: readonly TargetCapability[];
  readonly assignments: readonly TargetAssignment[];
  readonly planningSeries: readonly TargetSeries[];
  /** Every source object considered, including the ones not written. */
  readonly entries: readonly ObjectManifestEntry[];
}

export const ALLOWED_COURSE_SOURCES = new Set(['ADMIN', 'ASSISTANTE', 'SEED']);
export const VERIFIED_SCOPE_STATES = new Set(['STAFF_VERIFIED', 'BACKFILL_AUTO']);

/** Stable JSON (sorted keys, Dates as ISO) → sha256. */
export function objectHash(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v instanceof Date) return v.toISOString();
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = (v as Record<string, unknown>)[k];
        return acc;
      }, {});
    }
    return v;
  });
}

export const householdIdFor = (parentProfileId: string) => `hh-${parentProfileId}`;
export const enrollmentIdFor = (studentId: string, startYear: number) => `aye-${studentId}-${startYear}`;
export const capabilityIdFor = (coachId: string, courseKey: string) => `cap-${coachId}-${courseKey}`;
export const assignmentIdFor = (sourceAssignmentId: string, courseKey: string) => `${sourceAssignmentId}-${courseKey}`;
export const householdParentIdFor = (householdId: string, userId: string) => `hp-${householdId}-${userId}`;

function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Account status is derived, never guessed: an account that could log in to
 * Core v1 (password + activated, or a staff/coach account with a password)
 * is ACTIVE; a family account that never activated is PENDING_ACTIVATION and
 * its Core v1 password (if any) is dropped — it will receive an invitation.
 */
export function deriveAccount(user: SourceUser): { accountStatus: AccountStatus; password: string | null; activatedAt: Date | null; warnings: string[] } {
  const warnings: string[] = [];
  const familyRole = user.role === 'PARENT' || user.role === 'ELEVE';
  if (user.password && (user.activatedAt || !familyRole)) {
    return { accountStatus: 'ACTIVE', password: user.password, activatedAt: user.activatedAt, warnings };
  }
  if (user.password && familyRole && !user.activatedAt) warnings.push('PASSWORD_DROPPED_PENDING_ACTIVATION');
  if (!user.password && user.activatedAt) warnings.push('ACTIVATED_WITHOUT_PASSWORD');
  return { accountStatus: 'PENDING_ACTIVATION', password: null, activatedAt: null, warnings };
}

export function buildTargetPlan(snapshot: SourceSnapshot, approval: ApprovalFile, migratedAt: Date): TargetPlan {
  const entries: ObjectManifestEntry[] = [];
  const entry = (e: Omit<ObjectManifestEntry, 'transformVersion' | 'warnings'> & { warnings?: string[] }) =>
    entries.push({ ...e, transformVersion: TRANSFORM_VERSION, warnings: e.warnings ?? [] });

  for (const missing of snapshot.approvedIdsNotFound) {
    entry({ entity: 'Student', sourceId: missing, targetId: null, hash: null, result: 'REJECTED', reason: 'APPROVED_ID_NOT_IN_SOURCE' });
  }

  // ── Users: collect everyone the roster needs, refuse case-insensitive e-mail collisions.
  const userCandidates = new Map<string, SourceUser>();
  for (const s of snapshot.students) {
    userCandidates.set(s.user.id, s.user);
    userCandidates.set(s.parentUser.id, s.parentUser);
  }
  const plannedAssignmentSources = snapshot.assignments.filter((a) => VERIFIED_SCOPE_STATES.has(a.courseScopeState));
  for (const a of plannedAssignmentSources) userCandidates.set(a.coachUser.id, a.coachUser);

  const emailOwners = new Map<string, string[]>();
  for (const u of userCandidates.values()) {
    const email = normalizeEmail(u.email);
    if (email) emailOwners.set(email, [...(emailOwners.get(email) ?? []), u.id]);
  }
  const rejectedUserIds = new Set<string>();
  const users: TargetUser[] = [];
  for (const u of [...userCandidates.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (u.mergedIntoUserId) {
      rejectedUserIds.add(u.id);
      entry({ entity: 'User', sourceId: u.id, targetId: null, hash: null, result: 'REJECTED', reason: 'MERGED_INTO_OTHER_ACCOUNT' });
      continue;
    }
    const email = normalizeEmail(u.email);
    if (email && (emailOwners.get(email)?.length ?? 0) > 1) {
      rejectedUserIds.add(u.id);
      entry({ entity: 'User', sourceId: u.id, targetId: null, hash: null, result: 'REJECTED', reason: 'EMAIL_CI_DUPLICATE' });
      continue;
    }
    const account = deriveAccount(u);
    const warnings = [...account.warnings];
    if (!email && (u.role === 'PARENT' || u.role === 'COACH')) warnings.push('NO_EMAIL_CANNOT_LOG_IN');
    const target: TargetUser = {
      id: u.id,
      email,
      password: account.password,
      role: u.role,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      accountStatus: account.accountStatus,
      activatedAt: account.activatedAt,
      sessionVersion: u.sessionVersion,
    };
    users.push(target);
    entry({ entity: 'User', sourceId: u.id, targetId: u.id, hash: objectHash(target), result: 'PLANNED', warnings });
  }
  const userPlanned = (id: string) => !rejectedUserIds.has(id);

  // ── Households, students, enrollments, course enrollments.
  const households = new Map<string, TargetHousehold>();
  const householdParents: TargetHouseholdParent[] = [];
  const students: TargetStudent[] = [];
  const enrollments: TargetEnrollment[] = [];
  const courseEnrollments: TargetCourseEnrollment[] = [];
  const enrolledCourses = new Map<string, Set<string>>(); // studentId → course keys planned
  const enrollmentIdByStudent = new Map<string, string>();

  for (const s of snapshot.students) {
    if (!userPlanned(s.user.id) || !userPlanned(s.parentUser.id)) {
      entry({ entity: 'Student', sourceId: s.id, targetId: null, hash: null, result: 'REJECTED', reason: 'ACCOUNT_REJECTED' });
      continue;
    }
    const householdId = householdIdFor(s.parentProfileId);
    if (!households.has(householdId)) {
      const household: TargetHousehold = { id: householdId, sourceParentProfileId: s.parentProfileId };
      households.set(householdId, household);
      entry({ entity: 'Household', sourceId: s.parentProfileId, targetId: householdId, hash: objectHash(household), result: 'PLANNED' });
      const hp: TargetHouseholdParent = { id: householdParentIdFor(householdId, s.parentUser.id), householdId, userId: s.parentUser.id, isPrimaryContact: true };
      householdParents.push(hp);
      entry({ entity: 'HouseholdParent', sourceId: s.parentProfileId, targetId: hp.id, hash: objectHash(hp), result: 'PLANNED' });
    }
    const student: TargetStudent = { id: s.id, userId: s.user.id, householdId, birthDate: s.birthDate };
    students.push(student);
    entry({ entity: 'Student', sourceId: s.id, targetId: s.id, hash: objectHash(student), result: 'PLANNED' });

    const enrollmentId = enrollmentIdFor(s.id, approval.academicYear.startYear);
    const enrollment: TargetEnrollment = {
      id: enrollmentId,
      studentId: s.id,
      gradeLevel: s.gradeLevel,
      academicTrack: s.academicTrack,
      stmgPathway: s.stmgPathway,
      schoolingStatus: s.schoolingStatus,
      school: s.school,
    };
    enrollments.push(enrollment);
    enrollmentIdByStudent.set(s.id, enrollmentId);
    entry({ entity: 'StudentAcademicYearEnrollment', sourceId: s.id, targetId: enrollmentId, hash: objectHash(enrollment), result: 'PLANNED' });

    const keys = new Set<string>();
    for (const c of s.courseEnrollments) {
      if (!ALLOWED_COURSE_SOURCES.has(c.source)) {
        entry({ entity: 'StudentCourseEnrollment', sourceId: c.id, targetId: null, hash: null, result: 'SKIPPED', reason: `SOURCE_${c.source}_NEEDS_REVIEW` });
        continue;
      }
      const target: TargetCourseEnrollment = { id: c.id, enrollmentId, courseKey: c.courseKey, kind: c.kind };
      courseEnrollments.push(target);
      keys.add(c.courseKey);
      entry({ entity: 'StudentCourseEnrollment', sourceId: c.id, targetId: c.id, hash: objectHash(target), result: 'PLANNED' });
    }
    enrolledCourses.set(s.id, keys);
  }

  // ── Coaches, capabilities, assignments (REBUILT one per verified course key).
  const coachProfiles = new Map<string, TargetCoachProfile>();
  const capabilities = new Map<string, TargetCapability>();
  const assignments: TargetAssignment[] = [];
  const plannedAssignmentIds = new Map<string, TargetAssignment[]>(); // source assignment id → rebuilt rows

  for (const a of snapshot.assignments) {
    if (!VERIFIED_SCOPE_STATES.has(a.courseScopeState)) {
      entry({ entity: 'CoachStudentCourseAssignment', sourceId: a.id, targetId: null, hash: null, result: 'SKIPPED', reason: `SCOPE_${a.courseScopeState}_NEEDS_REVIEW` });
      continue;
    }
    const enrollmentId = enrollmentIdByStudent.get(a.studentId);
    if (!enrollmentId) {
      entry({ entity: 'CoachStudentCourseAssignment', sourceId: a.id, targetId: null, hash: null, result: 'REJECTED', reason: 'STUDENT_NOT_MIGRATED' });
      continue;
    }
    if (!userPlanned(a.coachUser.id)) {
      entry({ entity: 'CoachStudentCourseAssignment', sourceId: a.id, targetId: null, hash: null, result: 'REJECTED', reason: 'COACH_ACCOUNT_REJECTED' });
      continue;
    }
    if (a.academicCourseKeys.length === 0) {
      entry({ entity: 'CoachStudentCourseAssignment', sourceId: a.id, targetId: null, hash: null, result: 'REJECTED', reason: 'NO_COURSE_KEY' });
      continue;
    }
    const rebuilt: TargetAssignment[] = [];
    for (const courseKey of a.academicCourseKeys) {
      if (!enrolledCourses.get(a.studentId)?.has(courseKey)) {
        entry({ entity: 'CoachStudentCourseAssignment', sourceId: `${a.id}:${courseKey}`, targetId: null, hash: null, result: 'REJECTED', reason: 'COURSE_NOT_ENROLLED' });
        continue;
      }
      if (!coachProfiles.has(a.coachProfileId)) {
        const profile: TargetCoachProfile = { id: a.coachProfileId, userId: a.coachUser.id };
        coachProfiles.set(profile.id, profile);
        entry({ entity: 'CoachProfile', sourceId: a.coachProfileId, targetId: a.coachProfileId, hash: objectHash(profile), result: 'PLANNED' });
      }
      const capId = capabilityIdFor(a.coachProfileId, courseKey);
      if (!capabilities.has(capId)) {
        const cap: TargetCapability = { id: capId, coachId: a.coachProfileId, courseKey };
        capabilities.set(capId, cap);
        entry({ entity: 'CoachCourseCapability', sourceId: `${a.id}:${courseKey}`, targetId: capId, hash: objectHash(cap), result: 'PLANNED' });
      }
      const target: TargetAssignment = { id: assignmentIdFor(a.id, courseKey), sourceAssignmentId: a.id, coachId: a.coachProfileId, enrollmentId, courseKey, startsAt: a.startsAt };
      assignments.push(target);
      rebuilt.push(target);
      entry({ entity: 'CoachStudentCourseAssignment', sourceId: `${a.id}:${courseKey}`, targetId: target.id, hash: objectHash(target), result: 'PLANNED' });
    }
    if (rebuilt.length > 0) plannedAssignmentIds.set(a.id, rebuilt);
  }

  // ── Planning series still ahead of migratedAt, on a rebuilt assignment for the same course.
  const planningSeries: TargetSeries[] = [];
  const migratedDay = migratedAt.toISOString().slice(0, 10);
  for (const p of snapshot.planningSeries) {
    const rebuilt = plannedAssignmentIds.get(p.assignmentId)?.find((a) => a.courseKey === p.academicCourseKey);
    if (!rebuilt) {
      entry({ entity: 'PlanningSeries', sourceId: p.id, targetId: null, hash: null, result: 'REJECTED', reason: 'ASSIGNMENT_NOT_REBUILT_FOR_COURSE' });
      continue;
    }
    if (p.recurrenceUntil && p.recurrenceUntil.toISOString().slice(0, 10) < migratedDay) {
      entry({ entity: 'PlanningSeries', sourceId: p.id, targetId: null, hash: null, result: 'SKIPPED', reason: 'ENDED_BEFORE_MIGRATION' });
      continue;
    }
    const target: TargetSeries = {
      id: p.id,
      assignmentId: rebuilt.id,
      timezone: p.timezone,
      startDate: p.startDate,
      localStartTime: p.localStartTime,
      localEndTime: p.localEndTime,
      recurrenceRule: p.recurrenceRule,
      recurrenceCount: p.recurrenceCount,
      recurrenceUntil: p.recurrenceUntil,
      modality: p.modality,
      location: p.location,
    };
    planningSeries.push(target);
    entry({ entity: 'PlanningSeries', sourceId: p.id, targetId: p.id, hash: objectHash(target), result: 'PLANNED' });
  }

  const year = approval.academicYear;
  return {
    academicYear: { startYear: year.startYear, startsAt: new Date(`${year.startsAt}T00:00:00Z`), endsAt: new Date(`${year.endsAt}T00:00:00Z`) },
    users,
    households: [...households.values()],
    householdParents,
    students,
    enrollments,
    courseEnrollments,
    coachProfiles: [...coachProfiles.values()],
    capabilities: [...capabilities.values()],
    assignments,
    planningSeries,
    entries,
  };
}

export function countByEntityAndResult(entries: readonly ObjectManifestEntry[]): Record<MigrationEntity, Record<string, number>> {
  const counts = {} as Record<MigrationEntity, Record<string, number>>;
  for (const e of entries) {
    counts[e.entity] ??= {};
    counts[e.entity][e.result] = (counts[e.entity][e.result] ?? 0) + 1;
  }
  return counts;
}
