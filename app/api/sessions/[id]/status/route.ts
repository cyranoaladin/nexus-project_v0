import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { mapSessionToResponse, sessionResponseInclude, sessionStatusUpdateSchema } from '../../contracts';

export async function PATCH(request: NextRequest, { params }: { params: { id: string; }; }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessionId = params.id;
    const payload = await request.json();
    const parsed = sessionStatusUpdateSchema.parse(payload);
    const { status, notes } = parsed;
    const sanitizedNotes = notes && notes.length > 0 ? notes : undefined;

    const updated = await prisma.sessionBooking.update({
      where: { id: sessionId },
      data: {
        status: status as SessionStatus,
        coachNotes: sanitizedNotes,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
      },
      include: sessionResponseInclude,
    });

    return NextResponse.json({ success: true, session: mapSessionToResponse(updated) });

  } catch (error) {
    console.error('Update session status error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.format() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

