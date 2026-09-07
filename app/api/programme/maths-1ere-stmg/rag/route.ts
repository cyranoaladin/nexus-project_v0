export const dynamic = 'force-dynamic';

/**
 * RAG endpoint — Maths Première
 *
 * POST /api/programme/maths-1ere-stmg/rag
 * Body: { chapId: string, chapTitre: string, query?: string }
 *
 * Builds a semantically rich query from chapter context + user query,
 * then delegates to the governed external RAG v2 adapter.
 *
 * Returns: { hits: RAGHit[], source: 'rag-v2' | 'none' }
 */

import { handleProgrammeRagV2Request } from '@/lib/programme/rag-v2-route';
import { NextRequest } from 'next/server';

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
  return handleProgrammeRagV2Request(req, {
    courseKey: 'stmg-maths-premiere',
    enrichQuery: buildSemanticQuery,
  });
}
