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

    const body = await request.json();
    const { studentId, weeklyHours, methodologyScore } = body;

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'studentId requis (string).' },
        { status: 400 }
      );
    }

    // Ownership verification
    if (session.user.role === 'PARENT') {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: { userId: session.user.id },
        include: { children: { where: { userId: studentId } } },
      });
      if (!parentProfile || parentProfile.children.length === 0) {
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
      // Check if coach has any session with this student
      const hasSession = await prisma.sessionBooking.findFirst({
        where: {
          studentId: studentId,
          coachId: session.user.id,
        },
      });
      if (!hasSession) {
        return NextResponse.json(
          { success: false, error: 'Aucune séance avec cet élève.' },
          { status: 403 }
        );
      }
    }

    const hours = typeof weeklyHours === 'number' ? weeklyHours : 3;
    const methScore = typeof methodologyScore === 'number' ? methodologyScore : undefined;

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
    console.error('[predict] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
