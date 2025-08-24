import { prisma } from '@/lib/prisma';
import { bilanGratuitSchema } from '@/lib/validations';
import { UserRole } from '@/types/enums';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ success: false, error: 'Content-Type invalide. Utilisez application/json.' }, { status: 415 });
    }
    let raw = '';
    try { raw = await req.text(); } catch { raw = ''; }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Requête invalide: corps vide.' }, { status: 400 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
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

    // Générer un email unique pour l'élève
    const uniqueStudentEmail = `${validatedData.studentFirstName.toLowerCase()}.${validatedData.studentLastName.toLowerCase()}.${Date.now()}@nexus-student.local`;

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
