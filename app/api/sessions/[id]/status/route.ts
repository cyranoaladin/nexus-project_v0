import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: { id: string; }; }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sessionId = params.id;
    const body = await request.json();
    const { status, notes } = body as { status: string; notes?: string; };

    const allowed = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.sessionBooking.update({
      where: { id: sessionId },
      data: {
        status: status as any,
        coachNotes: notes ?? undefined,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
      }
    });

    return NextResponse.json({ success: true, session: { id: updated.id, status: updated.status } });

  } catch (error) {
    console.error('Update session status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

