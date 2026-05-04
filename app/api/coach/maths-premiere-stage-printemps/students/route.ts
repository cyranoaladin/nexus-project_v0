import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { getAssignedStudentsForCoach, getCoachProfileForUser } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const COACH_SOURCE_VERSION = 'coach_maths_premiere_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT_DEFAULT = 'MATHEMATIQUES';

function getBilanStatus(bilan: { status: string; isPublished: boolean } | null): 'NOT_STARTED' | 'DRAFT' | 'COMPLETED' | 'VALIDATED' {
  if (!bilan) return 'NOT_STARTED';
  if (bilan.status === 'COMPLETED' && bilan.isPublished) return 'VALIDATED';
  if (bilan.status === 'COMPLETED') return 'COMPLETED';
  return 'DRAFT';
}

export async function GET() {
  try {
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const assignments = await getAssignedStudentsForCoach({ coachUserId: authSession.user.id });

    // Filter to PREMIERE students
    const premiereStudents = assignments.filter(
      (a) => a.student.gradeLevel === 'PREMIERE'
    );

    if (premiereStudents.length === 0) {
      return NextResponse.json({ students: [], count: 0 });
    }

    const studentIds = premiereStudents.map((a) => a.student.id);

    const coachProfile = await getCoachProfileForUser(authSession.user.id);

    // Build a map of studentId -> appropriate subject based on academicTrack
    const subjectByStudentId = new Map<string, string>();
    for (const a of premiereStudents) {
      const subject = a.student.academicTrack === 'STMG' ? 'STMG' : BILAN_SUBJECT_DEFAULT;
      subjectByStudentId.set(a.student.id, subject);
    }

    // Fetch all bilans for these students with either MATHEMATIQUES or STMG subject
    const bilans = await prisma.bilan.findMany({
      where: {
        studentId: { in: studentIds },
        type: BILAN_TYPE,
        subject: { in: [BILAN_SUBJECT_DEFAULT, 'STMG'] },
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

    const bilanByStudentId = new Map<string, (typeof bilans)[0]>();
    for (const bilan of bilans) {
      if (!bilan.studentId) continue;
      const expectedSubject = subjectByStudentId.get(bilan.studentId);
      // Only include the bilan if its subject matches the student's academic track
      if (bilan.subject === expectedSubject && !bilanByStudentId.has(bilan.studentId)) {
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
    logger.error({ err: error }, '[API] coach/maths-premiere/students GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
