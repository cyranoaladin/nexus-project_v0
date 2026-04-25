export const dynamic = 'force-dynamic';

/**
 * RAG endpoint — Maths Première
 *
 * POST /api/programme/maths-1ere-stmg/rag
 * Body: { chapId: string, chapTitre: string, query?: string }
 *
 * Builds a semantically rich query from chapter context + user query,
 * then searches via ChromaDB (ragSearch) with premiere+maths filters.
 * F26: pgvector fallback removed — ChromaDB is the canonical RAG source.
 *
 * Returns: { hits: RAGHit[], source: 'chroma' | 'none' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ragSearchByTrack, buildRAGContext } from '@/lib/rag-client';
import { z } from 'zod';

const bodySchema = z.object({
  chapId: z.string().min(1),
  chapTitre: z.string().min(1),
  query: z.string().optional(),
});

/**
 * Build a semantically rich query string for better RAG recall.
 * Combines chapter title + optional user query with pedagogical context terms.
 */
function buildSemanticQuery(chapTitre: string, chapId: string, userQuery?: string): string {
  // Domain keywords mapped to chapter IDs for query enrichment
  const domainKeywords: Record<string, string> = {
    'suites': 'suites arithmétiques géométriques applications financières capitalisation première STMG',
    'fonctions': 'fonctions second degré inverse coût recette bénéfice lecture graphique première STMG',
    'evolutions': 'pourcentages taux évolution taux moyen indices base 100 première STMG',
    'statistiques': 'statistiques deux variables ajustement affine droite de Mayer première STMG',
    'probabilites': 'probabilités loi binomiale fluctuation arbre pondéré première STMG',
    'algorithmique-tableur': 'tableur formule référence absolue algorithme seuil gestion première STMG',
  };

  const enrichment = domainKeywords[chapId] ?? `${chapTitre} mathématiques première STMG gestion programme`;
  const base = userQuery
    ? `${userQuery} — ${chapTitre} — ${enrichment}`
    : `${chapTitre} cours méthode exercice — ${enrichment}`;

  return base;
}

export async function POST(req: NextRequest) {
  // Auth guard — must be logged in
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { chapId, chapTitre, query } = parsed.data;
  const semanticQuery = buildSemanticQuery(chapTitre, chapId, query);

  // ── Circuit A: Nexus RAG API (external) ────────────────────────────────────
  try {
    const hits = await ragSearchByTrack('STMG', 'maths', semanticQuery, 'premiere', 5);

    if (hits.length > 0) {
      // Filter to score > 0.50 as requested
      const relevant = hits.filter((h) => {
        const score = h.score ?? (1 - h.distance);
        return score >= 0.50;
      });

      if (relevant.length > 0) {
        return NextResponse.json({
          hits: relevant.map((h) => ({
            id: h.id,
            document: h.document,
            score: Math.round((h.score ?? (1 - h.distance)) * 100),
            metadata: h.metadata,
          })),
          context: buildRAGContext(relevant),
          source: 'chroma' as const, // Legacy key used for UI consistency
          query: semanticQuery,
        });
      }
    }
  } catch (err) {
    console.warn('[RAG maths-1ere-stmg] Nexus RAG API unavailable:', err);
  }

  // ── No results ─────────────────────────────────────────────────────────────-
  return NextResponse.json({
    hits: [],
    context: '',
    source: 'none' as const,
    query: semanticQuery,
  });
}
