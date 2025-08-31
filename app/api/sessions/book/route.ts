import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Subject } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bookSessionSchema = z.object({
  coachId: z.string().min(1),
  studentId: z.string().min(1),
  subject: z.nativeEnum(Subject),
  scheduledDate: z.string().min(1),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  duration: z.number().min(30),
  creditsToUse: z.number().min(1),
  title: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

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
    const validatedData = bookSessionSchema.parse(body);
    const scheduledAt = new Date(`${validatedData.scheduledDate}T${validatedData.startTime}:00`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check student's credit balance
      const creditBalanceResult = await tx.creditTransaction.aggregate({
        where: { studentId: validatedData.studentId },
        _sum: { amount: true },
      });
      const currentCredits = creditBalanceResult._sum.amount || 0;

      if (currentCredits < validatedData.creditsToUse) {
        throw new Error('Crédits insuffisants.');
      }

      // 2. Check for conflicting sessions for the coach
      const conflictingCoachSession = await tx.session.findFirst({
        where: {
          coachId: validatedData.coachId,
          scheduledAt: scheduledAt,
          status: { notIn: ['CANCELLED'] }
        },
      });

      if (conflictingCoachSession) {
        throw new Error('Ce créneau n\'est plus disponible pour ce coach.');
      }

      // 3. Create the session
      const newSession = await tx.session.create({
        data: {
          studentId: validatedData.studentId,
          coachId: validatedData.coachId,
          subject: validatedData.subject,
          title: validatedData.title,
          scheduledAt: scheduledAt,
          duration: validatedData.duration,
          creditCost: validatedData.creditsToUse,
          status: 'SCHEDULED',
          type: 'COURS_ONLINE',
        },
      });

      // 4. Debit the credits
      await tx.creditTransaction.create({
        data: {
          studentId: validatedData.studentId,
          type: 'USAGE',
          amount: -validatedData.creditsToUse,
          description: `Réservation de session: ${validatedData.title}`,
          sessionId: newSession.id,
        },
      });

      return newSession;
    });

    return NextResponse.json({ success: true, sessionId: result.id });

  } catch (error) {
    console.error('Session booking error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to book session';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}
