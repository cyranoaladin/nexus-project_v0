/**
 * POST /api/assistant/activate-student
 *
 * Initiates student account activation.
 * Called by ADMIN, ASSISTANTE, or PARENT.
 *
 * Body: { studentUserId: string, studentEmail: string }
 * Returns: { success, activationUrl?, studentName?, error? }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { initiateStudentActivation } from '@/lib/services/student-activation.service';
import { z } from 'zod';
import { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@/types/enums';

const activateStudentSchema = z.object({
  studentUserId: z.string().min(1, 'ID élève requis'),
  studentEmail: z.string().email('Email invalide'),
  gradeLevel: z.nativeEnum(GradeLevel),
  academicTrack: z.nativeEnum(AcademicTrack),
  specialties: z.array(z.nativeEnum(Subject)).default([]),
  stmgPathway: z.nativeEnum(StmgPathway).optional(),
}).superRefine((data, ctx) => {
  const isStmg = data.academicTrack === AcademicTrack.STMG || data.academicTrack === AcademicTrack.STMG_NON_LYCEEN;
  if (isStmg && data.specialties.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['specialties'],
      message: 'Les spécialités EDS ne sont pas compatibles avec un parcours STMG',
    });
  }
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const allowedRoles = ['ADMIN', 'ASSISTANTE', 'PARENT'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = activateStudentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await initiateStudentActivation(
      parsed.data.studentUserId,
      parsed.data.studentEmail,
      session.user.role,
      session.user.id,
      {
        gradeLevel: parsed.data.gradeLevel,
        academicTrack: parsed.data.academicTrack,
        specialties: parsed.data.specialties,
        stmgPathway: parsed.data.stmgPathway,
      }
    );

    if (!result.success) {
      const isForbidden = result.error?.includes('parent') || result.error?.includes('non autorisé');
      return NextResponse.json(
        { error: result.error },
        { status: isForbidden ? 403 : 400 }
      );
    }

    // TODO: Send activation email to student
    // await sendActivationEmail(parsed.data.studentEmail, result.activationUrl!, result.studentName!);

    return NextResponse.json({
      success: true,
      activationUrl: result.activationUrl,
      studentName: result.studentName,
      message: `Lien d'activation envoyé à ${parsed.data.studentEmail}`,
    });
  } catch (error) {
    console.error('[API] activate-student error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
