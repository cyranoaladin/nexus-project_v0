import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const paramId = url.searchParams.get('studentId') || '';
    const session = await getServerSession(authOptions);

    let student: any | null = null;
    if (paramId) {
      student = await prisma.student.findUnique({ where: { id: paramId }, include: { subscriptions: true, bilans: { orderBy: { createdAt: 'desc' }, take: 3 } as any } as any });
    } else if (session?.user?.id) {
      student = await prisma.student.findFirst({ where: { userId: session.user.id }, include: { subscriptions: true, bilans: { orderBy: { createdAt: 'desc' }, take: 3 } as any } as any });
    }
    if (!student) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Suggest subjects: from subscriptions.ariaSubjects (JSON string) and recent bilans
    const subs = (student.subscriptions || []) as Array<{ ariaSubjects?: string; }>;
    const fromSubs = subs.flatMap(s => {
      try { const arr = JSON.parse(String(s.ariaSubjects || '[]')); return Array.isArray(arr) ? arr : []; } catch { return []; }
    });
    const fromBilans = ((student.bilans || []) as Array<{ subject?: string; }>).map(b => String(b.subject || '').toUpperCase()).filter(Boolean);
    const subjects = Array.from(new Set([...fromSubs, ...fromBilans])).filter(Boolean);

    const level = String(student.grade || '').toLowerCase().includes('prem') ? 'premiere' : (String(student.grade || '').toLowerCase().includes('term') ? 'terminale' : '');
    return NextResponse.json({ studentId: student.id, grade: student.grade || null, level, subjects });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
