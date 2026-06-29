export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanGratuitSchema } from '@/lib/validations';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { UserRole } from '@/types/enums';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { serializeError } from '@/lib/utils/serialize-error';
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const isTestEnv = process.env.NODE_ENV === 'test';

    // CSRF protection — verify same-origin
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    // Body size limit — reject oversized payloads (1MB)
    const bodySizeResponse = checkBodySize(request);
    if (bodySizeResponse) return bodySizeResponse;

    // Rate limiting
    const blocked = await guardRateLimitAsync(request, { preset: 'api', keySuffix: 'bilan-gratuit' });
    if (blocked) return blocked;

    const body = await request.json();

    // Honeypot check — bots fill hidden fields, humans don't
    if (body.website || body.url || body.honeypot) {
      // Silently reject bot submissions with a fake success response
      return NextResponse.json({ success: true, message: 'Inscription réussie !' });
    }

    // Validation des données
    const validatedData = bilanGratuitSchema.parse(body);

    // Vérifier si l'email parent existe déjà
    let existingUser = null;
    try {
      existingUser = await prisma.user.findUnique({ where: { email: validatedData.parentEmail } });
    } catch (dbErr) {
      if (!isTestEnv) {
        console.error('DB check failed:', serializeError(dbErr));
      }
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email' },
        { status: 400 }
      );
    }

    const resolvedStudentLastName = validatedData.studentLastName ?? validatedData.parentLastName;
    const rawActivationToken = `act_${createId()}_${crypto.randomBytes(16).toString('hex')}`;
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Normaliser le niveau scolaire AVANT la transaction
    const gTrack = normalizeStudentLevelAndTrack(validatedData.studentGrade);
    
    if (!gTrack) {
      return NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${validatedData.studentGrade}` },
        { status: 400 }
      );
    }

    // Transaction pour créer parent et élève
    const result = await prisma.$transaction(async (tx) => {
      // Créer le compte parent
      const parentUser = await tx.user.create({
        data: {
          email: validatedData.parentEmail,
          password: null,
          role: UserRole.PARENT,
          firstName: validatedData.parentFirstName,
          lastName: validatedData.parentLastName,
          phone: validatedData.parentPhone,
          activatedAt: null,
          activationToken: hashedActivationToken,
          activationExpiry,
        }
      });

      // Créer le profil parent
      const parentProfile = await tx.parentProfile.create({
        data: {
          userId: parentUser.id
        }
      });

      // Créer le compte élève sans accès direct.
      // Email format: prenom.nom.random@nexus-student.local to ensure uniqueness
      const studentEmailSlug = `${validatedData.studentFirstName.toLowerCase()}.${resolvedStudentLastName.toLowerCase()}.${createId().slice(0, 4)}@nexus-student.local`;
      
      const studentUser = await tx.user.create({
        data: {
          email: studentEmailSlug,
          role: UserRole.ELEVE,
          firstName: validatedData.studentFirstName,
          lastName: resolvedStudentLastName,
          password: null,
          activatedAt: null,
        }
      });

      const student = await tx.student.create({
        data: {
          parentId: parentProfile.id,
          userId: studentUser.id,
          grade: validatedData.studentGrade,
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          school: validatedData.studentSchool,
          birthDate: validatedData.studentBirthDate ? new Date(validatedData.studentBirthDate) : null
        }
      });

      return { parentUser, studentUser, student };
    });

    // Envoyer email de bienvenue
    try {
      const { sendWelcomeParentEmail } = await import('@/lib/email');
      const activationUrl = `${process.env.NEXTAUTH_URL || 'https://nexusreussite.academy'}/auth/activate?token=${encodeURIComponent(rawActivationToken)}&source=bilan-gratuit`;
      await sendWelcomeParentEmail(
        result.parentUser.email,
        `${result.parentUser.firstName} ${result.parentUser.lastName}`,
        `${result.studentUser.firstName} ${result.studentUser.lastName}`,
        activationUrl
      );
    } catch (emailError) {
      if (!isTestEnv) {
        console.error('Erreur envoi email de bienvenue:', serializeError(emailError));
      }
      // Ne pas faire échouer l'inscription si l'email ne part pas
    }

    return NextResponse.json({
      success: true,
      message: 'Votre demande a bien été enregistrée. Un lien d’activation a été envoyé.',
      parentId: result.parentUser.id,
      studentId: result.student.id
    });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Erreur inscription bilan gratuit:', serializeError(error));
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
