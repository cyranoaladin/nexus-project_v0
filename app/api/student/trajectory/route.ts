import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { resolveStudentScope } from '@/lib/scopes';
import { getActiveTrajectory } from '@/lib/trajectory';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const trajectoryQuerySchema = z.object({
  studentId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();

/**
 * GET /api/student/trajectory?studentId=...
 *
 * Returns the active trajectory for the resolved student.
 *
 * Contract:
 *   { trajectory: TrajectoryWithProgress | null }
 *
 * Scope resolution via resolveStudentScope:
 * - ELEVE: own trajectory
 * - PARENT: child trajectory (supports ?studentId)
 * - ADMIN/ASSISTANTE: any student (requires ?studentId)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    const userId = session.user.id;

    if (!['ELEVE', 'PARENT', 'ADMIN', 'ASSISTANTE'].includes(role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    const parsedQuery = trajectoryQuerySchema.safeParse({
      studentId: request.nextUrl.searchParams.get('studentId') || undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }
    const { studentId } = parsedQuery.data;

    const scope = await resolveStudentScope(
      { id: userId, role },
      { studentId }
    );

    if (!scope.authorized) {
      if (role === 'PARENT' && scope.error.includes('enfant')) {
        return NextResponse.json({ trajectory: null });
      }
      return NextResponse.json(
        { error: scope.error },
        { status: 403 }
      );
    }

    const trajectory = await getActiveTrajectory(scope.studentId);

    if (!trajectory) {
      return NextResponse.json({ trajectory: null });
    }

    // Find next incomplete milestone
    const nextMilestone = trajectory.milestones
      .filter((m) => !m.completed)
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())[0] ?? null;

    return NextResponse.json({
      trajectory: {
        id: trajectory.id,
        title: trajectory.title,
        description: trajectory.description,
        status: trajectory.status,
        horizon: trajectory.horizon,
        startDate: trajectory.startDate.toISOString(),
        endDate: trajectory.endDate.toISOString(),
        progress: trajectory.progress,
        daysRemaining: trajectory.daysRemaining,
        milestones: trajectory.milestones,
        nextMilestoneDate: nextMilestone?.targetDate ?? null,
        nextMilestoneTitle: nextMilestone?.title ?? null,
      },
    });
  } catch (error) {
    console.error('[API] Trajectory error:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
