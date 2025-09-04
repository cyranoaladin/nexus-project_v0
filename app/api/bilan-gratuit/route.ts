import { sendMail } from '@/lib/email';
import { createStudentInviteToken } from '@/lib/invite';
import { prisma } from '@/lib/prisma';
import { bilanGratuitSchema } from '@/lib/validations';
import { UserRole } from '@/types/enums';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse JSON de manière fiable
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
    }

    // Validation des données avec Zod
    const validatedData = bilanGratuitSchema.parse(body);

    // Vérifier si l'email parent existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.parentEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(validatedData.parentPassword, 12);

    // Email élève: utiliser celui saisi, fallback sur un email généré si absent (sécurité)
    const uniqueStudentEmail = (validatedData as any).studentEmail?.trim() || `${validatedData.studentFirstName.toLowerCase()}.${validatedData.studentLastName.toLowerCase()}.${Date.now()}@nexus-student.local`;

    // Transaction pour créer parent et élève
    const result = await prisma.$transaction(async (tx) => {
      // Créer le compte parent
      const parentUser = await tx.user.create({
        data: {
          email: validatedData.parentEmail,
          password: hashedPassword,
          role: UserRole.PARENT,
          firstName: validatedData.parentFirstName,
          lastName: validatedData.parentLastName,
          phone: validatedData.parentPhone,
        }
      });

      // Créer le profil parent
      const parentProfile = await tx.parentProfile.create({
        data: {
          userId: parentUser.id
        }
      });

      // Créer le compte élève
      const studentUser = await tx.user.create({
        data: {
          email: uniqueStudentEmail,
          role: UserRole.ELEVE,
          firstName: validatedData.studentFirstName,
          lastName: validatedData.studentLastName,
          password: hashedPassword, // L'élève utilise le même mot de passe que le parent initialement
        }
      });

      // Créer l'entité Student liée au parent
      const student = await tx.student.create({
        data: {
          parentId: parentProfile.id,
          userId: studentUser.id,
          grade: validatedData.studentGrade,
          school: validatedData.studentSchool,
          birthDate: validatedData.studentBirthDate ? new Date(validatedData.studentBirthDate) : null,
        }
      });

      // Le StudentProfile n'est plus nécessaire car les infos sont dans Student.
      // Si le modèle l'exige toujours, il faudrait le créer ici.
      // Pour la simplification, nous considérons que Student est suffisant.

      return { parentUser, studentUser, student };
    });

    // TODO: Implémenter un système de notification fiable pour l'assistante.
    // TODO: Mettre en place un vrai service d'emailing (ex: Resend, Postmark).

    // Envoyer l'invitation élève avec lien d'activation
    try {
      const token = createStudentInviteToken({
        kind: 'student_invite',
        studentUserId: result.studentUser.id,
        parentUserId: result.parentUser.id,
        studentEmail: (validatedData as any).studentEmail || result.studentUser.email,
      });
      const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const startUrl = `${base}/bilan/inviter/${encodeURIComponent(token)}`;
      await sendMail({
        to: result.studentUser.email,
        subject: 'Invitation à démarrer le Bilan — Nexus Réussite',
        html: `<p>Bonjour ${validatedData.studentFirstName},</p>
               <p>Vous avez été invité(e) à démarrer votre Bilan Stratégique Gratuit.</p>
               <p><a href="${startUrl}">Commencer le bilan</a></p>
               <p>Ce lien est valable 48h.</p>`
      });
    } catch (e) {
      console.error('[INVITE_EMAIL_ERROR]', e);
    }

    // Option: persister un profil pédagogique initial si fourni (volet 2)
    try {
      const bodyAny = (validatedData as any);
      if (bodyAny.pedagoAnswers) {
        await prisma.memory.create({
          data: {
            studentId: result.student.id,
            kind: 'SEMANTIC',
            content: 'PEDAGO_PROFILE_BASE',
            meta: { pedagoAnswers: bodyAny.pedagoAnswers },
          } as any,
        });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Inscription au bilan gratuit réussie.',
      user: { id: result.parentUser.id, email: result.parentUser.email },
    }, { status: 201 });

  } catch (error) {
    console.error('[BILAN_GRATUIT_ERROR]', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Données invalides.',
        details: (error as any).issues,
      }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return NextResponse.json({
        success: false,
        error: 'Un utilisateur avec cet email existe déjà.',
      }, { status: 409 });
    }

    return NextResponse.json({
      success: false,
      error: 'Une erreur interne est survenue.',
    }, { status: 500 });
  }
}
