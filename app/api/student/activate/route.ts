/**
 * POST /api/student/activate
 *
 * Completes student account activation by setting password.
 * Called when student clicks the activation link and submits the form.
 *
 * Body: { token: string, password: string }
 * Returns: { success, redirectUrl?, error? }
 *
 * GET /api/student/activate?token=xxx
 * Verifies the token without consuming it (for showing the form).
 * Returns: { valid, studentName?, email? }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  completeStudentActivation,
  verifyActivationToken,
} from '@/lib/services/student-activation.service';
import { z } from 'zod';

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token manquant' },
        { status: 400 }
      );
    }

    const result = await verifyActivationToken(token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] verify activation token error:', error);
    return NextResponse.json(
      { valid: false, error: 'Erreur interne' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = setPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await completeStudentActivation(
      parsed.data.token,
      parsed.data.password
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      message: 'Compte activé avec succès ! Vous pouvez maintenant vous connecter.',
    });
  } catch (error) {
    console.error('[API] complete activation error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
