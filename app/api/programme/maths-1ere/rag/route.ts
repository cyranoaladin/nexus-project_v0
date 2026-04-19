export const dynamic = 'force-dynamic';

/**
 * RAG endpoint — Maths Première
 *
 * POST /api/programme/maths-1ere/rag
 * Body: { chapId: string, chapTitre: string, query?: string }
 *
 * Builds a semantically rich query from chapter context + user query,
 * then searches via ChromaDB (ragSearchBySubject) with premiere+maths filters,
 * falling back to pgvector (lib/aria.ts) if the ingestor is unavailable.
 *
 * Returns: { hits: RAGHit[], source: 'chroma' | 'pgvector' | 'none' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import { generateEmbedding } from '@/lib/aria';
import { prisma } from '@/lib/prisma';
import { Subject } from '@prisma/client';
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
    'second-degre':          'équation du second degré discriminant racines factorisation trinôme première',
    'logique-raisonnement':  'logique raisonnement démonstration contraposée absurde quantificateurs première',
    'suites':                'suites numériques arithmétique géométrique récurrence convergence limite première',
    'derivation':            'dérivation fonction dérivée tangente extremum variations tableau première',
    'variations-courbes':    'variations courbes représentation graphique sens croissance décroissance première',
    'exponentielle':         'fonction exponentielle e^x croissance propriétés dérivée limite première',
    'fonctions-trigo':       'fonctions trigonométriques cosinus sinus cercle trigonométrique radians première',
    'produit-scalaire':      'produit scalaire vecteurs orthogonalité norme angle géométrie première',
    'equations-droites':     'équations droites vecteur directeur normal coordonnées géométrie première',
    'cercles-trigo':         'cercle trigonométrique angles orientés cosinus sinus valeurs remarquables première',
    'probabilites-cond':     'probabilités conditionnelles indépendance Bayes arbre issues première',
    'variables-aleatoires':  'variables aléatoires espérance variance loi binomiale probabilités première',
    'algorithmique-python':  'algorithmique Python boucles fonctions listes algorithme programmation première',
    'algo-fibonacci-syracuse': 'suites Fibonacci Syracuse algorithme itératif récursif Python première',
    'algo-newton-euler':     'méthode Newton Euler résolution numérique équations Python algorithme première',
  };

  const enrichment = domainKeywords[chapId] ?? `${chapTitre} mathématiques première lycée programme`;
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
    const hits = await ragSearch({
      query: semanticQuery,
      section: 'maths_premiere',
      k: 5,
      score_threshold: 0.5,
    });

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
    console.warn('[RAG maths-1ere] Nexus RAG API unavailable, falling back to pgvector:', err);
  }

  // ── Circuit B: pgvector fallback ────────────────────────────────────────────
  try {
    const embedding = await generateEmbedding(semanticQuery);

    if (embedding.length > 0) {
      const vectorQuery = `[${embedding.join(',')}]`;
      const rows = await prisma.$queryRaw<
        Array<{ id: string; title: string; content: string; similarity: number }>
      >`
        SELECT id, title, content,
               1 - (embedding_vector <=> ${vectorQuery}::vector) AS similarity
        FROM "pedagogical_contents"
        WHERE subject = ${Subject.MATHEMATIQUES}::"Subject"
          AND 1 - (embedding_vector <=> ${vectorQuery}::vector) > 0.35
        ORDER BY embedding_vector <=> ${vectorQuery}::vector ASC
        LIMIT 5;
      `;

      if (rows.length > 0) {
        return NextResponse.json({
          hits: rows.map((r) => ({
            id: r.id,
            document: r.content,
            score: Math.round(r.similarity * 100),
            metadata: { title: r.title, subject: 'maths', level: 'premiere' },
          })),
          context: rows.map((r, i) =>
            `[${i + 1}] ${r.title} (Pertinence: ${Math.round(r.similarity * 100)}%)\n${r.content}`
          ).join('\n\n'),
          source: 'pgvector' as const,
          query: semanticQuery,
        });
      }
    }
  } catch (err) {
    console.warn('[RAG maths-1ere] pgvector fallback failed:', err);
  }

  // ── No results ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    hits: [],
    context: '',
    source: 'none' as const,
    query: semanticQuery,
  });
}
