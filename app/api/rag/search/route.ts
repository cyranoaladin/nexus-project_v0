export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// GET /api/rag/search?q=...&subject=...&level=...&k=8
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    if (process.env.E2E === '1' && process.env.NODE_ENV !== 'production') {
      console.log('[E2E-STUB] /api/rag/search active');
      const q = (url.searchParams.get('q') || '').trim();
      const docType = /image/i.test(q) ? 'ocr' : (/doc/i.test(q) ? 'docx' : 'pdf');
      if (!q) return NextResponse.json({ ok: true, provider: 'stub', hits: [] });
      return NextResponse.json({
        ok: true,
        provider: 'stub',
        hits: [{ id: 'stub-hit', docId: 'stub-doc', subject: 'NSI', level: 'terminale', chunk: `... ${q} ...`, meta: { docType } }]
      });
    }
    const q = (url.searchParams.get('q') || '').trim();
    const subject = (url.searchParams.get('subject') || '').trim();
    const level = (url.searchParams.get('level') || '').trim();
    const k = Math.min(Math.max(Number(url.searchParams.get('k') || 8), 1), 50);

    if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

    // Try vector search first
    try {
      const { embedTexts } = await import('@/apps/web/server/vector/embeddings');
      const vectors = await embedTexts([q]);
      const v = vectors[0];
      const vecLiteral = `[${v.join(',')}]`;

      const whereClauses: string[] = [];
      const params: any[] = [vecLiteral, k];
      if (subject) { whereClauses.push(`subject = $3`); params.push(subject); }
      if (level) { whereClauses.push(`level = $${params.length + 1}`); params.push(level); }
      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT id, "docId", subject, level, chunk, meta
        FROM "knowledge_assets"
        ${whereSql}
        ORDER BY embedding <-> $1::vector
        LIMIT $2
      `;
      // Using $queryRawUnsafe because of ::vector cast; all variables are parameterized.
      const { prisma } = await import('@/lib/prisma');
      const rows = await (prisma as any).$queryRawUnsafe(sql, ...params);
      return NextResponse.json({ ok: true, provider: 'vector', hits: rows });
    } catch (err) {
      // Fallback to text search if vector search fails (pgvector absent or provider error)
      const { prisma } = await import('@/lib/prisma');
      const rows = await (prisma as any).knowledgeAsset.findMany({
        where: {
          AND: [
            subject ? { subject } : {},
            level ? { level } : {},
            { chunk: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, docId: true, subject: true, level: true, chunk: true, meta: true },
        take: k,
      });
      return NextResponse.json({ ok: true, provider: 'text', hits: rows });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'search_failed', message: String(e?.message || e) }, { status: 500 });
  }
}

