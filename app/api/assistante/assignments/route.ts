import { createPaginationMeta,parsePagination } from '@/lib/api/pagination';
import { coachCapableCourseKeys } from '@/lib/assignments/allowed-courses';
import { getCourse,isKnownCourseKey } from '@/lib/curriculum/catalog';
import { listFollowedCourses,resolveStudentCourses,type EnrollmentRecord } from '@/lib/curriculum/enrollment';
import { isErrorResponse,requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { parseSubjects } from '@/lib/utils/subjects';
import { serializeError } from '@/lib/utils/serialize-error';
import { AssignmentStatus,AssignmentType,Prisma,type Subject } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for query parameters
const statusQuerySchema = z.nativeEnum(AssignmentStatus).optional().default(AssignmentStatus.ACTIVE);

/**
 * Schéma de création. `courseKeys` — jamais `subjects` — porte l'intention
 * de périmètre : c'est la SEULE entrée d'autorisation académique. `subjects`
 * (matière historique) est désormais TOUJOURS dérivé côté serveur depuis les
 * `courseKeys` validés (voir `deriveLegacySubjects`), jamais accepté du
 * client — accepter un `subjects` client permettrait de contourner la
 * validation de périmètre en écrivant directement le champ d'affichage
 * historique.
 */
const createAssignmentSchema = z.object({
  coachId: z.string().min(1, 'Coach ID requis'),
  studentIds: z.array(z.string().min(1))
    .min(1, 'Au moins un élève requis')
    .transform((ids) => Array.from(new Set(ids)))
    .refine((ids) => ids.length > 0, 'Au moins un élève unique requis'),
  assignmentType: z.nativeEnum(AssignmentType).default(AssignmentType.PRIMARY),
  courseKeys: z.array(z.string().min(1))
    .min(1, 'Au moins un cours requis')
    .transform((keys) => Array.from(new Set(keys))),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/** Dérive les matières historiques (affichage rétro-compatible uniquement) depuis des courseKeys déjà validés. */
function deriveLegacySubjects(courseKeys: readonly string[]): Subject[] {
  const subjects = new Set<Subject>();
  for (const courseKey of courseKeys) {
    const course = getCourse(courseKey);
    if (course?.legacySubject) subjects.add(course.legacySubject as Subject);
  }
  return [...subjects];
}

/**
 * Valide chaque `courseKey` demandé pour UN élève donné : connu du
 * catalogue, réellement suivi par cet élève, et dans les capacités
 * déclarées du coach. Retourne le premier problème rencontré — jamais un
 * 400 générique — pour que l'assistante corrige exactement ce qui bloque.
 */
function findCourseScopeIssue(
  courseKeys: readonly string[],
  followedKeys: ReadonlySet<string>,
  coachCapableKeys: ReadonlySet<string>,
): { readonly kind: 'UNKNOWN_COURSE_KEY' | 'COURSE_NOT_FOLLOWED' | 'COURSE_NOT_COACH_CAPABLE'; readonly courseKey: string } | null {
  for (const courseKey of courseKeys) {
    if (!isKnownCourseKey(courseKey)) {
      return { kind: 'UNKNOWN_COURSE_KEY', courseKey };
    }
    if (!followedKeys.has(courseKey)) {
      return { kind: 'COURSE_NOT_FOLLOWED', courseKey };
    }
    if (!coachCapableKeys.has(courseKey)) {
      return { kind: 'COURSE_NOT_COACH_CAPABLE', courseKey };
    }
  }
  return null;
}

/**
 * GET /api/assistante/assignments
 *
 * Returns a list of coach-student assignments.
 * Requires: ASSISTANTE or ADMIN role
 * Query params:
 *   - coachId: string (filter by coach)
 *   - studentId: string (filter by student)
 *   - status: AssignmentStatus (default: ACTIVE)
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 */
export async function GET(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const studentId = searchParams.get('studentId');

    // Validate status parameter with Zod
    const statusResult = statusQuerySchema.safeParse(searchParams.get('status'));
    if (!statusResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Statut invalide' },
        { status: 400 }
      );
    }
    const status = statusResult.data;

    const { page, limit, skip } = parsePagination(searchParams);

    const where: import('@prisma/client').Prisma.CoachStudentAssignmentWhereInput = {};
    if (coachId) where.coachId = coachId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    const [assignments, total] = await Promise.all([
      prisma.coachStudentAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          coach: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          assignedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.coachStudentAssignment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      pagination: createPaginationMeta(page, limit, total),
      assignments,
    });
  } catch (error) {
    console.error('[API Assistante Assignments GET] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assistante/assignments
 *
 * Creates one or multiple coach-student assignments.
 * Requires: ASSISTANTE or ADMIN role with ASSIGN permission
 */
export async function POST(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    if (!can(session.user.role, 'ASSIGN', 'COACH_ASSIGNMENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante pour créer des assignations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createAssignmentSchema.parse(body);

    // Verify coach exists
    const coach = await prisma.coachProfile.findUnique({
      where: { id: validated.coachId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!coach) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Coach non trouvé' },
        { status: 400 }
      );
    }

    // Verify all students exist
    const students = await prisma.student.findMany({
      where: { id: { in: validated.studentIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (students.length !== validated.studentIds.length) {
      const foundIds = students.map((s) => s.id);
      const missingIds = validated.studentIds.filter((id) => !foundIds.includes(id));
      return NextResponse.json(
        { error: 'Bad Request', message: `Élèves non trouvés: ${missingIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Reload each student's currently followed courses and the coach's
    // declared capabilities — le périmètre académique ne se déduit JAMAIS
    // d'un `subjects` envoyé par le client, seulement de ces données rechargées.
    const enrollmentRows = await prisma.studentAcademicEnrollment.findMany({
      where: { studentId: { in: validated.studentIds } },
      select: { studentId: true, courseKey: true, kind: true, source: true },
    });
    const enrollmentsByStudent = new Map<string, EnrollmentRecord[]>();
    for (const row of enrollmentRows) {
      const list = enrollmentsByStudent.get(row.studentId) ?? [];
      list.push({ courseKey: row.courseKey, kind: row.kind, source: row.source });
      enrollmentsByStudent.set(row.studentId, list);
    }

    const coachCapableKeys = coachCapableCourseKeys(parseSubjects(coach.subjects));

    for (const student of students) {
      const followedViews = listFollowedCourses(
        resolveStudentCourses(
          {
            gradeLevel: student.gradeLevel,
            academicTrack: student.academicTrack,
            stmgPathway: student.stmgPathway,
          },
          enrollmentsByStudent.get(student.id) ?? [],
        ),
      );
      const followedKeys = new Set(followedViews.map((view) => view.course.courseKey));

      const issue = findCourseScopeIssue(validated.courseKeys, followedKeys, coachCapableKeys);
      if (issue) {
        const studentName = `${student.user.firstName} ${student.user.lastName}`;
        const messagesByKind = {
          UNKNOWN_COURSE_KEY: `Cours inconnu du catalogue: ${issue.courseKey}`,
          COURSE_NOT_FOLLOWED: `${studentName} ne suit pas actuellement le cours ${issue.courseKey}`,
          COURSE_NOT_COACH_CAPABLE: `Le coach n'est pas déclaré capable d'enseigner le cours ${issue.courseKey}`,
        } as const;
        return NextResponse.json(
          { error: issue.kind, message: messagesByKind[issue.kind] },
          { status: 400 },
        );
      }
    }

    // Check for existing active assignments using active window (prevent duplicates)
    const now = new Date();
    const existingAssignments = await prisma.coachStudentAssignment.findMany({
      where: {
        coachId: validated.coachId,
        studentId: { in: validated.studentIds },
        ...activeAssignmentWhere(now),
      },
    });

    const existingStudentIds = existingAssignments.map((a) => a.studentId);

    // Any active coach/student assignment duplicate widens access unnecessarily.
    if (existingStudentIds.length > 0) {
      const existingStudents = students.filter((s) => existingStudentIds.includes(s.id));
      return NextResponse.json(
        {
          error: 'Conflict',
          message: `Ces élèves ont déjà une assignation active avec ce coach: ${existingStudents.map((s) => `${s.user.firstName} ${s.user.lastName}`).join(', ')}`,
        },
        { status: 409 }
      );
    }

    // `subjects` legacy n'est écrit qu'à titre d'affichage rétro-compatible,
    // dérivé des `courseKeys` déjà validés — jamais la source d'autorisation.
    const derivedSubjects = deriveLegacySubjects(validated.courseKeys);

    // Create assignments in a transaction
    const createdAssignments = await prisma.$transaction(
      validated.studentIds.map((studentId) =>
        prisma.coachStudentAssignment.create({
          data: {
            coachId: validated.coachId,
            studentId,
            assignedById: session.user.id,
            assignmentType: validated.assignmentType,
            academicCourseKeys: validated.courseKeys,
            courseScopeState: 'STAFF_VERIFIED',
            subjects: derivedSubjects,
            notes: validated.notes,
            startsAt: validated.startsAt ? new Date(validated.startsAt) : new Date(),
            endsAt: validated.endsAt ? new Date(validated.endsAt) : null,
            status: AssignmentStatus.ACTIVE,
          },
          include: {
            coach: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        })
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: `${createdAssignments.length} assignation(s) créée(s)`,
        assignments: createdAssignments,
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    // Handle Prisma unique constraint violation (P2002)
    // This can happen due to the partial unique index on active assignments
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Une assignation active existe déjà pour cette combinaison coach/élève/type',
        },
        { status: 409 }
      );
    }

    console.error('[API Assistante Assignments POST] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
