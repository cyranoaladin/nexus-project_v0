import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api/rbac';

export const dynamic = 'force-dynamic';

// GET /api/admin/rag/documents
export async function GET(req: Request) {
  const guard = await requireRole(req as any, ['ADMIN', 'ASSISTANTE', 'COACH']);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });
  const items = await (prisma as any).pedagogicalContent.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, title: true, content: true, subject: true, grade: true, tags: true },
  });
  const documents = items.map((x: any) => ({
    document_id: x.id,
    contenu: x.content,
    metadata: {
      titre: x.title,
      matiere: x.subject,
      niveau: x.grade ?? undefined,
      mots_cles: (() => { try { return JSON.parse(x.tags || '[]'); } catch { return []; } })(),
    },
  }));
  return NextResponse.json({ documents });
}
