/**
 * One-shot Core v1 → Core v2 migrator — contract (go-live §AP/§AQ/§AR).
 *
 * Non-negotiable invariants, each enforced in code (not prose):
 *   - SOURCE (Core v1) is opened READ ONLY: the snapshot is taken inside one
 *     `SET TRANSACTION READ ONLY` transaction — any write attempt fails at the
 *     database.
 *   - TARGET (Core v2) is the only place written to. No dual-write: the
 *     application runtime is never part of this process.
 *   - Explicit roster: only students listed in an owner-produced APPROVAL file
 *     are migrated. The file's digest goes into the manifest.
 *   - Deterministic: the same source snapshot + approval + declared
 *     `migratedAt` produce the same target rows and the same object hashes
 *     (no clock, no randomness inside transform; ids are reused or derived).
 *   - Manifest evidence per object: entity, source id, target id, transform
 *     version, hash, result, warnings — and a reconciliation with UNKNOWN =
 *     SILENT_DROPPED = DUPLICATE_TARGET = UNMAPPED_APPROVED = 0 expected.
 *   - Idempotent rerun: every write is an upsert keyed on a deterministic id;
 *     an unchanged object is reported UNCHANGED, a changed one UPDATED.
 *   - No silent coercion: anything the rules cannot map is REJECTED or SKIPPED
 *     with a reason, never guessed.
 */

export const TRANSFORM_VERSION = 'core-v2-migration/1';

export type MigrationEntity =
  | 'AcademicYear'
  | 'User'
  | 'Household'
  | 'HouseholdParent'
  | 'Student'
  | 'StudentAcademicYearEnrollment'
  | 'StudentCourseEnrollment'
  | 'CoachProfile'
  | 'CoachCourseCapability'
  | 'CoachStudentCourseAssignment'
  | 'PlanningSeries';

export const MIGRATION_ENTITIES: readonly MigrationEntity[] = [
  'AcademicYear',
  'User',
  'Household',
  'HouseholdParent',
  'Student',
  'StudentAcademicYearEnrollment',
  'StudentCourseEnrollment',
  'CoachProfile',
  'CoachCourseCapability',
  'CoachStudentCourseAssignment',
  'PlanningSeries',
];

/** Closed set: a manifest row with any other value is an UNKNOWN in the reconciliation. */
export type ObjectResult = 'CREATED' | 'UNCHANGED' | 'UPDATED' | 'SKIPPED' | 'REJECTED' | 'PLANNED';
export const OBJECT_RESULTS: readonly ObjectResult[] = ['CREATED', 'UNCHANGED', 'UPDATED', 'SKIPPED', 'REJECTED', 'PLANNED'];

export interface ObjectManifestEntry {
  readonly entity: MigrationEntity;
  readonly sourceId: string;
  readonly targetId: string | null;
  readonly transformVersion: string;
  /** sha256 of the canonical target payload; null when nothing is written. */
  readonly hash: string | null;
  readonly result: ObjectResult;
  readonly reason?: string;
  readonly warnings: readonly string[];
}

export interface Reconciliation {
  readonly UNKNOWN: number;
  readonly SILENT_DROPPED: number;
  readonly DUPLICATE_TARGET: number;
  readonly UNMAPPED_APPROVED: number;
}

export interface MigrationManifest {
  readonly transformVersion: string;
  readonly mode: 'DRY_RUN' | 'EXECUTE';
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly migratedAt: string;
  readonly approvalDigest: string;
  readonly approvedStudentCount: number;
  readonly sourceFingerprint: string;
  readonly targetFingerprint: string;
  readonly counts: Record<MigrationEntity, Record<ObjectResult, number>>;
  readonly objects: readonly ObjectManifestEntry[];
  readonly reconciliation: Reconciliation;
  readonly anomalies: readonly string[];
}

/** What migrates and what does not — the policy the transform enforces (tested). */
export const MigrationPolicy = {
  migrates: [
    'APPROVED roster only: one ACTIVE StudentAcademicYearEnrollment per approved student, for the approval file’s academic year',
    'Users (parent, student, coach) with the SAME ids as Core v1 — the session→actor mapping and Core v1 billing keyed on Student.id keep working',
    'Households: one per Core v1 ParentProfile of an approved student, the parent as primary contact',
    'StudentCourseEnrollments whose source is ADMIN / ASSISTANTE / SEED (a human or an explicit seed said so)',
    'Coaches needed by the roster, with CoachCourseCapabilities derived only from verified assignment scopes (STAFF_VERIFIED / BACKFILL_AUTO), never from the CoachProfile.subjects JSON',
    'CoachStudentCourseAssignments REBUILT one per course key from verified scopes, and only for a course the student is enrolled in',
    'ACTIVE PlanningSeries attached to a rebuilt assignment with occurrences still ahead of migratedAt, occurrences materialized by the Core v2 planning engine',
  ],
  doesNotMigrateAutomatically: [
    'Students outside the approved roster (and every object that exists only for them)',
    'StudentCourseEnrollments sourced from BACKFILL_LEGACY_SPECIALTIES (owner review)',
    'Assignments whose courseScopeState is BACKFILL_UNRESOLVED or BACKFILL_AMBIGUOUS (owner review), and never a copy of courseScopeState itself',
    'Billing: Subscription / Payment / Invoice / Entitlement stay in Core v1 (§AN — Core v2 holds no billing truth); Student.id is preserved so they keep pointing at the same student',
    'Legacy Session rows (zero runtime consumers), past bookings, test accounts, obsolete invitations',
    'Passwords of PARENT / ELEVE accounts that were never activated (they receive a Core v2 invitation instead)',
  ],
} as const;
