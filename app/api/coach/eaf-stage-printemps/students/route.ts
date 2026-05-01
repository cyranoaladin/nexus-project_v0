import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { getAssignedStudentsForCoach, getCoachProfileForUser } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const COACH_SOURCE_VERSION = 'coach_eaf_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'FRANCAIS';

function getBilanStatus(bilan: { status: string; isPublished: boolean } | null): 'NOT_STARTED' | 'DRAFT' | 'COMPLETED' | 'VALIDATED' {
  if (!bilan) return 'NOT_STARTED';
  if (bilan.status === 'COMPLETED' && bilan.isPublished) return 'VALIDATED';
  if (bilan.status === 'COMPLETED') return 'COMPLETED';
  return 'DRAFT';
}

/**
 * GET /api/coach/eaf-stage-printemps/students
 * Returns list of students assigned to the coach with their EAF bilan status.
 * Only students of grade PREMIERE are included (EAF is for Première).
 */
export async function GET() {
  try {
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Get assigned students
    const assignments = await getAssignedStudentsForCoach({ coachUserId: authSession.user.id });

    // Filter to PREMIERE students (EAF is for Première)
    const premiereStudents = assignments.filter(
      (a) => a.student.gradeLevel === 'PREMIERE'
    );

    if (premiereStudents.length === 0) {
      return NextResponse.json({ students: [], count: 0 });
    }

    const studentIds = premiereStudents.map((a) => a.student.id);

    // Get coach profile to filter bilans by coachId
    const coachProfile = await getCoachProfileForUser(authSession.user.id);

    // Fetch coach bilans for all these students
    const bilans = await prisma.bilan.findMany({
      where: {
        studentId: { in: studentIds },
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: COACH_SOURCE_VERSION,
        ...(coachProfile ? { coachId: coachProfile.id } : {}),
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        isPublished: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Index bilans by studentId
    const bilanByStudentId = new Map<string, (typeof bilans)[0]>();
    for (const bilan of bilans) {
      if (bilan.studentId && !bilanByStudentId.has(bilan.studentId)) {
        bilanByStudentId.set(bilan.studentId, bilan);
      }
    }

    const students = premiereStudents.map((a) => {
      const bilan = bilanByStudentId.get(a.student.id) ?? null;
      return {
        id: a.student.id,
        firstName: a.student.firstName,
        lastName: a.student.lastName,
        email: a.student.email,
        gradeLevel: a.student.gradeLevel,
        academicTrack: a.student.academicTrack,
        school: a.student.school,
        bilanStatus: getBilanStatus(bilan),
        bilanId: bilan?.id,
        lastSavedAt: bilan?.updatedAt?.toISOString(),
        completedAt: bilan?.status === 'COMPLETED' ? bilan.updatedAt?.toISOString() : undefined,
      };
    });

    return NextResponse.json({ students, count: students.length });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/eaf-stage-printemps/students GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
