import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    const body = await request.json();
    const { status, notes } = body as { status?: string; notes?: string };

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    const allowed = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existing = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: status as any,
        report: typeof notes === 'string' && notes.length > 0 ? notes : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/sessions/[id]/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

