/**
 * Staff read models (§AD): server-side search + cursor pagination over the
 * Core v2 authorities. Read access is a capability like any write — every
 * query asserts one. No legacy table is ever read here.
 */
import { z } from 'zod';
import type { PrismaClient, Prisma } from '@/core-v2/generated/client';
import { normalizeEmail, normalizePhone } from '../contact';
import { assertCapability } from '../rbac';
import type { ServiceContext } from '../services/context';
import { idSchema } from '../services/validation';
import { publicUser, type PublicUser } from '../http/respond';

export const pageQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

export interface Page<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
}

function pageArgs(query: PageQuery) {
  return {
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  };
}

function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

function userSearchWhere(q: string | undefined): Prisma.UserWhereInput {
  if (!q) return {};
  const or: Prisma.UserWhereInput[] = [
    { firstName: { contains: q, mode: 'insensitive' } },
    { lastName: { contains: q, mode: 'insensitive' } },
    { email: { contains: q.toLowerCase() } },
  ];
  try {
    or.push({ phone: normalizePhone(q) });
  } catch {
    // not a phone — name/email search only
  }
  return { OR: or };
}

const userSelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  accountStatus: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface HouseholdSummary {
  readonly id: string;
  readonly createdAt: Date;
  readonly parents: Array<PublicUser & { isPrimaryContact: boolean }>;
  readonly students: Array<{ id: string; user: PublicUser }>;
}

export async function searchHouseholds(client: PrismaClient, ctx: ServiceContext, query: PageQuery): Promise<Page<HouseholdSummary>> {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const userWhere = userSearchWhere(query.q);
  const rows = await client.household.findMany({
    where: query.q ? { OR: [{ parents: { some: { user: userWhere } } }, { students: { some: { user: userWhere } } }] } : {},
    ...pageArgs(query),
    include: {
      parents: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'asc' } },
      students: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'asc' } },
    },
  });
  const page = toPage(rows, query.limit);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      parents: h.parents.map((p) => ({ ...(p.user as PublicUser), isPrimaryContact: p.isPrimaryContact })),
      students: h.students.map((s) => ({ id: s.id, user: s.user as PublicUser })),
    })),
  };
}

export async function searchParents(client: PrismaClient, ctx: ServiceContext, query: PageQuery) {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const rows = await client.user.findMany({
    where: { role: 'PARENT', ...userSearchWhere(query.q) },
    ...pageArgs(query),
    select: { ...userSelect, householdParent: { select: { householdId: true, isPrimaryContact: true } } },
  });
  const page = toPage(rows, query.limit);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map(({ householdParent, ...user }) => ({
      ...(user as PublicUser),
      householdId: householdParent?.householdId ?? null,
      isPrimaryContact: householdParent?.isPrimaryContact ?? false,
    })),
  };
}

export async function searchStudents(client: PrismaClient, ctx: ServiceContext, query: PageQuery) {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const rows = await client.student.findMany({
    where: query.q ? { user: userSearchWhere(query.q) } : {},
    ...pageArgs(query),
    include: {
      user: { select: userSelect },
      academicYearEnrollments: {
        include: { academicYear: { select: { id: true, startYear: true, status: true } } },
        orderBy: { academicYear: { startYear: 'desc' } },
        take: 1,
      },
    },
  });
  const page = toPage(rows, query.limit);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((s) => ({
      id: s.id,
      householdId: s.householdId,
      birthDate: s.birthDate,
      user: s.user as PublicUser,
      latestEnrollment: s.academicYearEnrollments[0]
        ? {
            id: s.academicYearEnrollments[0].id,
            status: s.academicYearEnrollments[0].status,
            gradeLevel: s.academicYearEnrollments[0].gradeLevel,
            academicTrack: s.academicYearEnrollments[0].academicTrack,
            academicYear: s.academicYearEnrollments[0].academicYear,
          }
        : null,
    })),
  };
}

/** Staff read: requires HOUSEHOLD_READ. */
export async function getHouseholdDetail(client: PrismaClient, ctx: ServiceContext, householdId: string) {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  return loadHouseholdDetail(client, householdId);
}

/** Public user projection shared by every read model (never password / sessionVersion). */
export const publicUserSelect = userSelect;

export const planningSeriesSelect = {
  id: true,
  status: true,
  recurrenceRule: true,
  localStartTime: true,
  localEndTime: true,
  timezone: true,
  revision: true,
} satisfies Prisma.PlanningSeriesSelect;

/** One student's annual enrollments with courses, coach assignments and series — the shape every dashboard shows. */
export const enrollmentsInclude = {
  include: {
    academicYear: { select: { id: true, startYear: true, status: true } },
    courseEnrollments: { orderBy: { courseKey: 'asc' } },
    assignments: {
      include: {
        coach: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        planningSeries: { select: planningSeriesSelect },
      },
      orderBy: { startsAt: 'desc' },
    },
  },
  orderBy: { academicYear: { startYear: 'desc' } },
} satisfies Prisma.Student$academicYearEnrollmentsArgs;

type EnrollmentRow = Prisma.StudentAcademicYearEnrollmentGetPayload<typeof enrollmentsInclude>;

export function mapEnrollment(e: EnrollmentRow) {
  return {
    id: e.id,
    status: e.status,
    academicYear: e.academicYear,
    gradeLevel: e.gradeLevel,
    academicTrack: e.academicTrack,
    stmgPathway: e.stmgPathway,
    schoolingStatus: e.schoolingStatus,
    school: e.school,
    academicRevision: e.academicRevision,
    approvedAt: e.approvedAt,
    courses: e.courseEnrollments.map((c) => ({ id: c.id, courseKey: c.courseKey, kind: c.kind })),
    assignments: e.assignments.map((a) => ({
      id: a.id,
      courseKey: a.courseKey,
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      coach: { id: a.coach.id, user: a.coach.user },
      planningSeries: a.planningSeries,
    })),
  };
}

export type EnrollmentDetail = ReturnType<typeof mapEnrollment>;

/**
 * The household read model itself, without an access decision: callers
 * decide WHO may see it (staff capability above, household membership in
 * queries/parent.ts). Never export this through a route directly.
 */
export async function loadHouseholdDetail(client: PrismaClient, householdId: string) {
  const household = await client.household.findUnique({
    where: { id: householdId },
    include: {
      parents: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'asc' } },
      students: {
        include: { user: { select: userSelect }, academicYearEnrollments: enrollmentsInclude },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!household) return null;
  return {
    id: household.id,
    createdAt: household.createdAt,
    parents: household.parents.map((p) => ({ ...(p.user as PublicUser), isPrimaryContact: p.isPrimaryContact })),
    students: household.students.map((s) => ({
      id: s.id,
      birthDate: s.birthDate,
      user: s.user as PublicUser,
      enrollments: s.academicYearEnrollments.map(mapEnrollment),
    })),
  };
}

export async function listCoaches(client: PrismaClient, ctx: ServiceContext, query: PageQuery) {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const rows = await client.coachProfile.findMany({
    where: query.q ? { user: userSearchWhere(query.q) } : {},
    ...pageArgs(query),
    include: { user: { select: userSelect }, capabilities: { orderBy: { courseKey: 'asc' } } },
  });
  const page = toPage(rows, query.limit);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((c) => ({
      id: c.id,
      user: c.user as PublicUser,
      capabilities: c.capabilities.map((cap) => cap.courseKey),
    })),
  };
}

export async function listAcademicYears(client: PrismaClient, ctx: ServiceContext) {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  return client.academicYear.findMany({ orderBy: { startYear: 'desc' } });
}

/**
 * A page plus the exact total over the WHOLE matching set (never derived
 * from the loaded page) — the operational indicators (§Jalon B) need a
 * counter and a list that can never disagree, so both are computed from the
 * same `where` in the same round trip.
 */
export interface IndicatorPage<T> extends Page<T> {
  readonly totalCount: number;
}

/**
 * Indicator A — pedagogical enrollments pending validation (go-live mission,
 * Jalon B). Counted object: StudentAcademicYearEnrollment. Status: PENDING
 * only (ACTIVE/COMPLETED/WITHDRAWN are excluded — nothing to act on).
 * Period: the CURRENT academic year only — a PENDING row in an UPCOMING or
 * CLOSED year is not part of today's operational queue. Rights: HOUSEHOLD_READ,
 * same as every other staff list (the action itself asserts ENROLLMENT_APPROVE
 * separately, in services/enrollment.ts).
 */
const pendingEnrollmentWhere = {
  status: 'PENDING',
  academicYear: { status: 'CURRENT' },
} satisfies Prisma.StudentAcademicYearEnrollmentWhereInput;

export interface PendingEnrollmentSummary {
  readonly id: string;
  readonly createdAt: Date;
  readonly gradeLevel: string;
  readonly academicTrack: string | null;
  readonly academicYear: { id: string; startYear: number; status: string };
  readonly student: { id: string; householdId: string; user: PublicUser };
}

export async function listPendingEnrollments(
  client: PrismaClient,
  ctx: ServiceContext,
  query: PageQuery,
): Promise<IndicatorPage<PendingEnrollmentSummary>> {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const [rows, totalCount] = await Promise.all([
    client.studentAcademicYearEnrollment.findMany({
      where: pendingEnrollmentWhere,
      ...pageArgs(query),
      include: {
        academicYear: { select: { id: true, startYear: true, status: true } },
        student: { select: { id: true, householdId: true, user: { select: userSelect } } },
      },
    }),
    client.studentAcademicYearEnrollment.count({ where: pendingEnrollmentWhere }),
  ]);
  const page = toPage(rows, query.limit);
  return {
    totalCount,
    nextCursor: page.nextCursor,
    items: page.items.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      gradeLevel: e.gradeLevel,
      academicTrack: e.academicTrack,
      academicYear: e.academicYear,
      student: { id: e.student.id, householdId: e.student.householdId, user: e.student.user as PublicUser },
    })),
  };
}

/**
 * Indicator B — course enrollments needing a coach assignment (go-live
 * mission, Jalon B). This deliberately does NOT assume every course
 * enrollment needs a coach: `lib/core-v2/repositories/coach-student-course-
 * assignment.ts` documents that Core v2 has no versioned curriculum catalog
 * yet, so the only rule this foundation actually enforces is "an explicit
 * StudentCourseEnrollment row is required before a coach can be assigned to
 * it" — it never claims every such row must eventually get one. This
 * indicator surfaces the objective gap (an assignable course with no ACTIVE
 * assignment covering it) for a human to judge, not a normative "must-have".
 *
 * Counted object: StudentCourseEnrollment. Status/exclusion: its parent
 * enrollment must be ACTIVE (a PENDING/WITHDRAWN/COMPLETED enrollment is not
 * on this year's live roster) in the CURRENT academic year; the course
 * enrollment itself is excluded once a CoachStudentCourseAssignment with
 * status ACTIVE exists for the same (academicYearEnrollmentId, courseKey)
 * pair. Rights: HOUSEHOLD_READ (the action asserts COACH_ASSIGN separately,
 * in services/coach.ts).
 *
 * No curriculum catalog exists to push this "NOT EXISTS" down into an SQL
 * join without duplicating that catalog's absence as a second query
 * concept, so this computes the gap in application code over the bounded
 * "ACTIVE enrollment in the CURRENT year" cohort — small by construction (one
 * school's live roster), not the whole history. If that cohort ever outgrows
 * an in-process scan, revisit with a real measurement, not preemptively.
 */
const activeCurrentYearEnrollmentArgs = {
  where: { status: 'ACTIVE', academicYear: { status: 'CURRENT' } },
  include: {
    academicYear: { select: { id: true, startYear: true, status: true } },
    student: { select: { id: true, householdId: true, user: { select: userSelect } } },
    courseEnrollments: true,
    assignments: { where: { status: 'ACTIVE' }, select: { courseKey: true } },
  },
} satisfies Prisma.StudentAcademicYearEnrollmentFindManyArgs;

export interface UnassignedCourseEnrollment {
  readonly id: string;
  readonly courseKey: string;
  readonly kind: 'SPECIALTY' | 'OPTION';
  readonly createdAt: Date;
  readonly enrollment: {
    readonly id: string;
    readonly gradeLevel: string;
    readonly academicTrack: string | null;
    readonly academicYear: { id: string; startYear: number; status: string };
  };
  readonly student: { id: string; householdId: string; user: PublicUser };
}

async function computeUnassignedCourseEnrollments(client: PrismaClient): Promise<UnassignedCourseEnrollment[]> {
  const enrollments = await client.studentAcademicYearEnrollment.findMany(activeCurrentYearEnrollmentArgs);
  const items: UnassignedCourseEnrollment[] = [];
  for (const e of enrollments) {
    const assignedCourseKeys = new Set(e.assignments.map((a) => a.courseKey));
    for (const c of e.courseEnrollments) {
      if (assignedCourseKeys.has(c.courseKey)) continue;
      items.push({
        id: c.id,
        courseKey: c.courseKey,
        kind: c.kind,
        createdAt: c.createdAt,
        enrollment: { id: e.id, gradeLevel: e.gradeLevel, academicTrack: e.academicTrack, academicYear: e.academicYear },
        student: { id: e.student.id, householdId: e.student.householdId, user: e.student.user as PublicUser },
      });
    }
  }
  // Same deterministic order as every other staff list (newest first, id tiebreak) —
  // the list and the "load more" cursor below both walk this one order.
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return items;
}

export async function listUnassignedCourseEnrollments(
  client: PrismaClient,
  ctx: ServiceContext,
  query: PageQuery,
): Promise<IndicatorPage<UnassignedCourseEnrollment>> {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const all = await computeUnassignedCourseEnrollments(client);
  // A cursor that no longer matches (the row got assigned or its enrollment
  // changed between two page loads) restarts from the top rather than
  // erroring — a stale decision here costs a re-read, never a wrong count.
  const cursorIndex = query.cursor ? all.findIndex((item) => item.id === query.cursor) : -1;
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const slice = all.slice(startIndex, startIndex + query.limit + 1);
  const hasMore = slice.length > query.limit;
  const items = hasMore ? slice.slice(0, query.limit) : slice;
  return {
    totalCount: all.length,
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export const auditQuerySchema = pageQuerySchema.extend({
  subjectType: z.string().trim().min(1).max(64).optional(),
  subjectId: idSchema.optional(),
  correlationId: z.string().trim().min(1).max(128).optional(),
});

export async function listAuditEvents(client: PrismaClient, ctx: ServiceContext, query: z.infer<typeof auditQuerySchema>) {
  assertCapability(ctx.actor, 'AUDIT_READ');
  const rows = await client.auditEvent.findMany({
    where: {
      ...(query.subjectType ? { subjectType: query.subjectType } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
    },
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

export const duplicateQuerySchema = z
  .object({
    email: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.email || v.phone || (v.firstName && v.lastName), { message: 'Provide email, phone, or first+last name.' });

export type DuplicateMatch = PublicUser & { householdId: string | null; reason: 'PHONE' | 'NAME' };

/**
 * §AE: a normalized-email match is a HARD identity conflict (the account
 * exists); phone or name matches are POSSIBLE duplicates shown to staff
 * before they create anything — never merged automatically.
 */
export async function findPossibleDuplicates(
  client: PrismaClient,
  ctx: ServiceContext,
  input: z.infer<typeof duplicateQuerySchema>,
): Promise<{ hardConflict: (PublicUser & { householdId: string | null }) | null; possibleMatches: DuplicateMatch[] }> {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  const select = { ...userSelect, householdParent: { select: { householdId: true } }, student: { select: { householdId: true } } };
  const withHousehold = (u: { householdParent: { householdId: string } | null; student: { householdId: string } | null }) =>
    u.householdParent?.householdId ?? u.student?.householdId ?? null;

  let hardConflict: (PublicUser & { householdId: string | null }) | null = null;
  if (input.email) {
    const email = normalizeEmail(input.email);
    const user = await client.user.findUnique({ where: { email }, select });
    if (user) hardConflict = { ...publicUser(user as never), householdId: withHousehold(user) };
  }

  const possible = new Map<string, DuplicateMatch>();
  if (input.phone) {
    const phone = normalizePhone(input.phone);
    for (const user of await client.user.findMany({ where: { phone }, select, take: 20 })) {
      if (user.id !== hardConflict?.id) possible.set(user.id, { ...publicUser(user as never), householdId: withHousehold(user), reason: 'PHONE' });
    }
  }
  if (input.firstName && input.lastName) {
    const byName = await client.user.findMany({
      where: {
        firstName: { equals: input.firstName, mode: 'insensitive' },
        lastName: { equals: input.lastName, mode: 'insensitive' },
      },
      select,
      take: 20,
    });
    for (const user of byName) {
      if (user.id !== hardConflict?.id && !possible.has(user.id)) {
        possible.set(user.id, { ...publicUser(user as never), householdId: withHousehold(user), reason: 'NAME' });
      }
    }
  }
  return { hardConflict, possibleMatches: [...possible.values()] };
}
