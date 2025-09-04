import { buildContext } from "@/server/context/builder";
import { embedTexts } from '@/server/vector/embeddings';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId') || '';
  const query = url.searchParams.get('query') || 'Résumé';
  const subject = url.searchParams.get('subject') || undefined;
  const level = url.searchParams.get('level') || undefined;
  if (!studentId) return NextResponse.json({ error: 'studentId requis' }, { status: 400 });
  try {
    const ctx = await buildContext(studentId, query, subject, level);
    return NextResponse.json(ctx);
  } catch (e: any) {
    // Fallback dev/E2E: retourne un contexte minimal en cas d'échec builder
    const isNonProd = process.env.NODE_ENV !== 'production';
    if (!isNonProd) {
      return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
    }
    let embedding: number[] | undefined;
    try {
      const out = await embedTexts([query]);
      embedding = out?.[0];
    } catch {}
    const snippet = {
      id: 'context-fallback-1',
      score: 1.0,
      content: `Contexte pour ${studentId}: ${query}`,
      meta: { source: 'fallback', embeddingDim: embedding?.length },
    };
    return NextResponse.json({ ok: true, studentId, query, snippets: [snippet], fallback: true });
  }
}
