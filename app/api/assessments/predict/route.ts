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

    const body = await request.json();
    const { studentId, weeklyHours, methodologyScore } = body;

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'studentId requis (string).' },
        { status: 400 }
      );
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
