/**
 * Read-only snapshot of the Core v1 objects the roster needs. Everything is
 * read inside ONE transaction opened `READ ONLY` at the database: a write on
 * this client inside the snapshot is refused by PostgreSQL itself, so the
 * "source is never written" invariant does not depend on code discipline.
 * Ordering is by id everywhere so the snapshot — and therefore the plan and
 * the hashes derived from it — is deterministic.
 */
import type { PrismaClient as V1Client } from '@prisma/client';
import type { ApprovalFile } from './approval';

export interface SourceUser {
  readonly id: string;
  readonly email: string | null;
  readonly password: string | null;
  readonly role: 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE';
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly activatedAt: Date | null;
  readonly sessionVersion: number;
  readonly mergedIntoUserId: string | null;
}

export interface SourceStudent {
  readonly id: string;
  readonly user: SourceUser;
  readonly parentProfileId: string;
  readonly parentUser: SourceUser;
  readonly gradeLevel: string;
  readonly academicTrack: string;
  readonly stmgPathway: string | null;
  readonly schoolingStatus: string | null;
  readonly school: string | null;
  readonly birthDate: Date | null;
  readonly courseEnrollments: ReadonlyArray<{ id: string; courseKey: string; kind: 'SPECIALTY' | 'OPTION'; source: string }>;
}

export interface SourceAssignment {
  readonly id: string;
  readonly coachProfileId: string;
  readonly coachUser: SourceUser;
  readonly studentId: string;
  readonly status: string;
  readonly courseScopeState: string;
  readonly academicCourseKeys: readonly string[];
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

export interface SourcePlanningSeries {
  readonly id: string;
  readonly assignmentId: string;
  readonly academicCourseKey: string;
  readonly timezone: string;
  readonly startDate: Date;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly recurrenceRule: string;
  readonly recurrenceCount: number | null;
  readonly recurrenceUntil: Date | null;
  readonly modality: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
  readonly location: string | null;
  readonly status: string;
}

export interface SourceSnapshot {
  /** Last applied Core v1 migration + object counts: names the exact source state the plan was computed from. */
  readonly fingerprint: string;
  readonly approvedIdsNotFound: readonly string[];
  readonly students: readonly SourceStudent[];
  readonly assignments: readonly SourceAssignment[];
  readonly planningSeries: readonly SourcePlanningSeries[];
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function toSourceUser(u: {
  id: string;
  email: string | null;
  password: string | null;
  role: SourceUser['role'];
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  activatedAt: Date | null;
  sessionVersion: number;
  mergedIntoUserId: string | null;
}): SourceUser {
  return {
    id: u.id,
    email: u.email,
    password: u.password,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    activatedAt: u.activatedAt,
    sessionVersion: u.sessionVersion,
    mergedIntoUserId: u.mergedIntoUserId,
  };
}

const userSelect = {
  id: true, email: true, password: true, role: true, firstName: true, lastName: true, phone: true, activatedAt: true, sessionVersion: true, mergedIntoUserId: true,
} as const;

export async function readSourceSnapshot(v1: V1Client, approval: ApprovalFile): Promise<SourceSnapshot> {
  const approvedIds = [...approval.approvedStudentIds].sort();
  return v1.$transaction(async (tx) => {
    // The database enforces read-only for the whole snapshot.
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '120s'");

    const lastMigration = await tx.$queryRawUnsafe<Array<{ migration_name: string }>>(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1',
    );

    const students = await tx.student.findMany({
      where: { id: { in: approvedIds } },
      orderBy: { id: 'asc' },
      include: {
        user: { select: userSelect },
        parent: { include: { user: { select: userSelect } } },
        academicEnrollments: { orderBy: { id: 'asc' }, select: { id: true, courseKey: true, kind: true, source: true } },
      },
    });
    const foundIds = new Set(students.map((s) => s.id));
    const studentIds = students.map((s) => s.id);

    const assignments = await tx.coachStudentAssignment.findMany({
      where: { studentId: { in: studentIds }, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
      include: { coach: { include: { user: { select: userSelect } } } },
    });

    const series = await tx.planningSeries.findMany({
      where: { assignmentId: { in: assignments.map((a) => a.id) }, status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });

    const counts = `students=${students.length};assignments=${assignments.length};series=${series.length}`;
    return {
      fingerprint: `v1:${lastMigration[0]?.migration_name ?? 'no-migration'};${counts}`,
      approvedIdsNotFound: approvedIds.filter((id) => !foundIds.has(id)),
      students: students
        .map((s) => ({
          id: s.id,
          user: toSourceUser(s.user),
          parentProfileId: s.parent.id,
          parentUser: toSourceUser(s.parent.user),
          gradeLevel: s.gradeLevel,
          academicTrack: s.academicTrack,
          stmgPathway: s.stmgPathway,
          schoolingStatus: s.schoolingStatus,
          school: s.school,
          birthDate: s.birthDate,
          courseEnrollments: s.academicEnrollments.map((e) => ({ id: e.id, courseKey: e.courseKey, kind: e.kind, source: e.source })),
        }))
        .sort(byId),
      assignments: assignments
        .map((a) => ({
          id: a.id,
          coachProfileId: a.coach.id,
          coachUser: toSourceUser(a.coach.user),
          studentId: a.studentId,
          status: a.status,
          courseScopeState: a.courseScopeState,
          academicCourseKeys: [...a.academicCourseKeys].sort(),
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        }))
        .sort(byId),
      planningSeries: series
        .map((p) => ({
          id: p.id,
          assignmentId: p.assignmentId,
          academicCourseKey: p.academicCourseKey,
          timezone: p.timezone,
          startDate: p.startDate,
          localStartTime: p.localStartTime,
          localEndTime: p.localEndTime,
          recurrenceRule: p.recurrenceRule,
          recurrenceCount: p.recurrenceCount,
          recurrenceUntil: p.recurrenceUntil,
          modality: p.modality,
          location: p.location,
          status: p.status,
        }))
        .sort(byId),
    };
  });
}
