import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { serializeError } from '@/lib/utils/serialize-error';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/assistante/students/[studentId]
 *
 * Returns an overview of a student (profile, parent, credits, subscriptions, assignments).
 * Requires: ASSISTANTE or ADMIN role
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
        { status: 403 }
      );
    }

    const now = new Date();

    const [student, creditSum, recentTransactions, assignments] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          userId: true,
          grade: true,
          gradeLevel: true,
          academicTrack: true,
          specialties: true,
          stmgPathway: true,
          school: true,
          birthDate: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              activatedAt: true,
              createdAt: true,
            },
          },
          parent: {
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              planName: true,
              monthlyPrice: true,
              creditsPerMonth: true,
              status: true,
              startDate: true,
              endDate: true,
              ariaCost: true,
              ariaSubjects: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.creditTransaction.aggregate({
        where: { studentId },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
          expiresAt: true,
          sessionId: true,
        },
      }),
      prisma.coachStudentAssignment.findMany({
        where: { studentId, ...activeAssignmentWhere(now) },
        orderBy: { createdAt: 'desc' },
        include: {
          coach: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          assignedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
    ]);

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
      creditBalance: creditSum._sum.amount ?? 0,
      recentTransactions,
      assignments,
    });
  } catch (error) {
    console.error('[API Assistante Student Overview GET] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

