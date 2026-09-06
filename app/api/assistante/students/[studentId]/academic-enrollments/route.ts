import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GradeLevel, AcademicTrack, StmgPathway, SchoolingStatus } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
  AcademicEnrollmentError,
  listStudentEnrollments,
  resolveStudentCourses,
} from '@/lib/curriculum/enrollment';
import {
  AcademicRevisionConflictError,
  updateStudentAcademicProfile,
  type StudentAcademicProfileChanges,
} from '@/lib/curriculum/student-academic-profile';
import { serializeError } from '@/lib/utils/serialize-error';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * Corps de la mutation. « Absent = inchangé » pour l'identité : ce que le
 * client n'envoie pas n'est pas touché — voir `StudentAcademicProfileChanges`
 * (`lib/curriculum/student-academic-profile.ts`). `.strict()` pour qu'un champ
 * mal nommé échoue bruyamment plutôt que d'être silencieusement ignoré.
 */
const putBodySchema = z
  .object({
    gradeLevel: z.nativeEnum(GradeLevel).optional(),
    academicTrack: z.nativeEnum(AcademicTrack).optional(),
    stmgPathway: z.nativeEnum(StmgPathway).nullable().optional(),
    schoolingStatus: z.nativeEnum(SchoolingStatus).nullable().optional(),
    courseKeys: z.array(z.string()).default([]),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

/**
 * GET /api/assistante/students/[studentId]/academic-enrollments
 *
 * Carte scolaire résolue d'un élève : identité courante + enseignements
 * obligatoires (DERIVED), choisis (ENROLLED) et proposables (NOT_ENROLLED)
 * pour son couple (niveau × voie), depuis le catalogue versionné.
 *
 * `studentId` est TOUJOURS un `Student.id` — jamais un `User.id`.
 * Requires: ASSISTANTE ou ADMIN.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    if (!can(session.user.role, 'READ', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 },
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        gradeLevel: true,
        academicTrack: true,
        stmgPathway: true,
        schoolingStatus: true,
        academicRevision: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 },
      );
    }

    const enrollments = await listStudentEnrollments(student.id);
    const courses = resolveStudentCourses(
      {
        gradeLevel: student.gradeLevel,
        academicTrack: student.academicTrack,
        stmgPathway: student.stmgPathway,
      },
      enrollments,
    );

    return NextResponse.json({
      success: true,
      studentId: student.id,
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      stmgPathway: student.stmgPathway,
      schoolingStatus: student.schoolingStatus,
      academicRevision: student.academicRevision,
      courses,
    });
  } catch (error) {
    console.error('[API Assistante Student Academic Enrollments GET] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/assistante/students/[studentId]/academic-enrollments
 *
 * Mutation atomique et révisionnée : délègue entièrement à
 * `updateStudentAcademicProfile` (Task 6). Le client DOIT renvoyer la
 * révision qu'il a lue (`expectedRevision`) : une révision périmée échoue en
 * 409 plutôt que d'écraser silencieusement une édition concurrente.
 *
 * Requires: ASSISTANTE ou ADMIN.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    if (!can(session.user.role, 'UPDATE', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 },
      );
    }

    // Vérifié en amont sur Student.id (jamais userId) : la commande elle-même
    // traiterait un élève introuvable comme une AcademicEnrollmentError (400),
    // catégorie distincte d'une ressource absente (404).
    const existing = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: { issues: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    // « Absent = inchangé » : on ne construit la clé QUE si le client l'a
    // envoyée — jamais `undefined` explicite, qui porterait une intention
    // différente pour `StudentAcademicProfileChanges`.
    const changes: StudentAcademicProfileChanges = {
      ...('gradeLevel' in parsed.data ? { gradeLevel: parsed.data.gradeLevel } : {}),
      ...('academicTrack' in parsed.data ? { academicTrack: parsed.data.academicTrack } : {}),
      ...('stmgPathway' in parsed.data ? { stmgPathway: parsed.data.stmgPathway ?? null } : {}),
      ...('schoolingStatus' in parsed.data ? { schoolingStatus: parsed.data.schoolingStatus ?? null } : {}),
    };

    const provenance =
      session.user.role === 'ADMIN'
        ? ({ source: 'ADMIN', verifiedById: session.user.id } as const)
        : ({ source: 'ASSISTANTE', verifiedById: session.user.id } as const);

    const result = await updateStudentAcademicProfile(
      studentId,
      changes,
      parsed.data.courseKeys,
      parsed.data.expectedRevision,
      provenance,
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AcademicRevisionConflictError) {
      return NextResponse.json(
        { error: 'ACADEMIC_REVISION_CONFLICT', message: error.message },
        { status: 409 },
      );
    }
    if (error instanceof AcademicEnrollmentError) {
      return NextResponse.json(
        { error: 'Validation failed', details: { issues: error.issues } },
        { status: 400 },
      );
    }
    console.error('[API Assistante Student Academic Enrollments PUT] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la mise à jour' },
      { status: 500 },
    );
  }
}
