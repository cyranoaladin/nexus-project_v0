/**
 * POST /api/assessments/predict
 *
 * Predict future SSN for a student at 8-week horizon.
 *
 * Body: { studentId: string, weeklyHours?: number, methodologyScore?: number }
 * Returns: { ssnProjected, confidence, modelVersion, inputSnapshot, confidenceBreakdown }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { predictSSNForStudent } from '@/lib/core/ml/predictSSN';
import { z } from 'zod';

const predictAssessmentSchema = z.object({
  studentId: z.string().min(1).max(128),
  weeklyHours: z.number().min(0).max(40).optional(),
  methodologyScore: z.number().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Auth guard: must be logged in
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    // RBAC check: only COACH, PARENT, ADMIN, ASSISTANTE can access
    const allowedRoles = ['COACH', 'PARENT', 'ADMIN', 'ASSISTANTE'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Accès refusé.' },
        { status: 403 }
      );
    }

    const parsed = predictAssessmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join('.') || 'payload';
      return NextResponse.json(
        { success: false, error: `Payload invalide: ${field}` },
        { status: 400 }
      );
    }

    const { studentId, weeklyHours, methodologyScore } = parsed.data;

    // Ownership verification
    if (session.user.role === 'PARENT') {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: {
          userId: session.user.id,
          children: { some: { id: studentId } },
        },
        select: { id: true },
      });
      if (!parentProfile) {
        return NextResponse.json(
          { success: false, error: 'Accès refusé à cet élève.' },
          { status: 403 }
        );
      }
    }

    if (session.user.role === 'COACH') {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!coachProfile) {
        return NextResponse.json(
          { success: false, error: 'Profil coach introuvable.' },
          { status: 403 }
        );
      }
      const now = new Date();
      const hasAssignment = await prisma.coachStudentAssignment.findFirst({
        where: {
          studentId,
          coachId: coachProfile.id,
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        select: { id: true },
      });
      if (!hasAssignment) {
        return NextResponse.json(
          { success: false, error: 'Accès refusé à cet élève.' },
          { status: 403 }
        );
      }
    }

    const hours = weeklyHours ?? 3;
    const methScore = methodologyScore;

    const result = await predictSSNForStudent(studentId, hours, methScore);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Données insuffisantes pour la prédiction. Au moins 1 bilan avec SSN requis.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[predict] Error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
