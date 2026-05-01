export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PARENT_EMAIL } from '@/lib/constants';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { GradeLevel, AcademicTrack } from '@prisma/client';
import { normalizeGradeLevel, getDefaultTrackForLevel, normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string; reservationId: string }> }
) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const { reservationId } = await params;

  try {
    const reservation = await prisma.stageReservation.findUnique({
      where: { id: reservationId },
      include: { stage: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }
    if (reservation.richStatus === 'CONFIRMED') {
      return NextResponse.json({ error: 'Déjà confirmée' }, { status: 409 });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    let user = await prisma.user.findUnique({ 
      where: { email: reservation.email },
      include: { student: true }
    });

    if (!user) {
      const tempPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const gTrack = normalizeStudentLevelAndTrack(reservation.classe) || { level: GradeLevel.AUTRE, track: AcademicTrack.EDS_GENERALE };

      // Ensure we have a parent profile. We assume the reservation contact (email) IS the parent.
      // If we are creating an ELEVE with this email, we still need a parentId.
      // We'll look for a parent with the same email or create a technical parent profile if needed.
      // Better: Create a separate PARENT profile if the reservation is for a child.
      
      // For this flow, we'll try to find a parent with the same email.
      let parentUser = await prisma.user.findFirst({
        where: { email: reservation.email, role: 'PARENT' },
        include: { parentProfile: true }
      });

      if (!parentUser) {
        // If no parent user found, we might need to create one, but that would duplicate the email.
        // If the email is used for the student, we can't use it for the parent.
        // COMPLEXITY: Stage reservations often use one email for both.
        // Nexus model: 1 User = 1 Role.
        // If we create an ELEVE user, we need a separate PARENT user.
        
        // WORKAROUND: Find any parent or create a dummy parent if missing? No.
        // Better: Use a parent email if provided. But it's the SAME email.
        
        // RE-EVALUATION: If parentId is mandatory, we MUST have a ParentProfile.
        // Let's create a technical parent profile linked to the same user? No, Prisma doesn't allow multiple roles per user.
        
        // Actually, in Nexus, a Parent can have multiple children.
        // If this is the first time, we should create a PARENT account and the student is a child of it.
        // But the code above creates an ELEVE account (line 52).
        
        // CHANGE: Create a PARENT account instead, or find a parent.
        // If we MUST create an ELEVE account, we'll look for the first available parent or return error.
        // But wait! Assistant/Admin confirms this. They should know.
        
        // LOGIC: Check if reservation.email belongs to an existing parent.
        // If not, we'll create a parent profile for the student's email as a "Self-Parent" if needed? No.
        
        // Let's find the "System Parent" or create one if not found.
        parentUser = await prisma.user.findFirst({
          where: { email: SYSTEM_PARENT_EMAIL }, // Use dedicated tech parent for orphaned registrations
          include: { parentProfile: true }
        });
      }

      const parentId = parentUser?.parentProfile?.id;
      if (!parentId) {
        return NextResponse.json({ error: 'Aucun profil parent disponible pour rattacher cet élève' }, { status: 500 });
      }

      user = await prisma.user.create({
        data: {
          email: reservation.email,
          firstName: reservation.studentName?.split(' ')[0] ?? reservation.parentName.split(' ')[0],
          lastName: reservation.studentName?.split(' ')[1] ?? reservation.parentName.split(' ')[1] ?? '',
          role: 'ELEVE',
          password: tempPass,
          student: {
            create: {
              gradeLevel: gTrack.level,
              academicTrack: gTrack.track,
              grade: reservation.classe,
              parentId: parentId
            }
          }
        },
        include: { student: true }
      });
    } else if (!user.student && user.role === 'ELEVE') {
      // If user exists but has no student profile (shouldn't happen with new logic but for safety)
      const gTrack = normalizeStudentLevelAndTrack(reservation.classe) || { level: GradeLevel.AUTRE, track: AcademicTrack.EDS_GENERALE };
      
      let parentUser = await prisma.user.findFirst({
        where: { email: SYSTEM_PARENT_EMAIL },
        include: { parentProfile: true }
      });
      const parentId = parentUser?.parentProfile?.id;
      if (!parentId) {
        return NextResponse.json({ error: 'Aucun profil parent disponible pour rattacher cet élève' }, { status: 500 });
      }

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          grade: reservation.classe,
          parentId: parentId
        }
      });
      // We just log that the student was created since we can't inject it dynamically
      console.log('Student created for reservation', reservation.id, 'with ID:', student.id);
    }

    await prisma.stageReservation.update({
      where: { id: reservation.id },
      data: {
        richStatus: 'CONFIRMED',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        activationToken: hashedToken,
        activationTokenExpiresAt: expiresAt,
        paymentStatus: 'COMPLETED',
      },
    });

    const stageTitle = reservation.stage?.title ?? 'Stage Nexus';
    const firstName = reservation.studentName?.split(' ')[0] ?? reservation.parentName.split(' ')[0];
    const activationUrl = `${process.env.NEXTAUTH_URL}/auth/activate?token=${rawToken}&source=stage`;

    await sendMail({
      to: reservation.email,
      subject: `✅ Inscription confirmée — ${stageTitle}`,
      html: `<p>Bonjour ${firstName},</p>
             <p>Votre inscription au <strong>${stageTitle}</strong> est <strong>confirmée</strong>.</p>
             <p>Créez votre compte Nexus Réussite pour accéder à votre emploi du temps,
             vos ressources et votre bilan :</p>
             <p><a href="${activationUrl}" style="background:#4f46e5;color:white;padding:12px 24px;
             border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">
             Activer mon compte</a></p>
             <p style="color:#6b7280;font-size:14px;">Ce lien est valable 72 heures.</p>`,
    });

    return NextResponse.json({
      success: true,
      message: "Réservation confirmée et email d'activation envoyé.",
    });
  } catch (error) {
    console.error('[POST confirm reservation]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
