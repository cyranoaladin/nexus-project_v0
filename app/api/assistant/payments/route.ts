import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: true },
    });

    const items = payments.map((p) => ({
      id: p.id,
      userEmail: p.user.email,
      amount: p.amount,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({ payments: items });
  } catch (e) {
    console.error('GET /api/assistant/payments error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body as { id?: string; action?: 'approve' | 'reject' };
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const existing = await prisma.payment.findUnique({ where: { id }, include: { user: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'COMPLETED' : 'FAILED';

    await prisma.payment.update({
      where: { id },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PATCH /api/assistant/payments error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


