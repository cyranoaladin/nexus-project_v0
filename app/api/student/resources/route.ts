export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject'); // e.g. MATHEMATIQUES | NSI | ... | all
    const q = searchParams.get('q'); // optional search text
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 12)));

    const where: any = {};
    if (subject && subject !== 'all') where.subject = subject;
    if (q && q.trim().length > 0) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, contents] = await Promise.all([
      prisma.pedagogicalContent.count({ where }),
      prisma.pedagogicalContent.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
    ]);

    const items = contents.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: (c.content || '').slice(0, 300),
      subject: c.subject,
      type: (() => {
        try {
          const tags: string[] = JSON.parse(c.tags || '[]');
          if (tags.find(t => /fiche/i.test(t))) return 'Fiche';
          if (tags.find(t => /exercice/i.test(t))) return 'Exercices';
          if (tags.find(t => /quiz/i.test(t))) return 'Quiz';
          return 'Document';
        } catch { return 'Document'; }
      })(),
      lastUpdated: c.updatedAt,
    }));

    return NextResponse.json({ items, total, page, pageSize });

  } catch (error) {
    console.error('Error fetching student resources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
