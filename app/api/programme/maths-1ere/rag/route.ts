export const dynamic = 'force-dynamic';

/**
 * RAG endpoint — Maths Première
 *
 * POST /api/programme/maths-1ere/rag
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
  return handleProgrammeRagV2Request(req, {
    courseKey: 'eds-maths-premiere',
    enrichQuery: buildSemanticQuery,
  });
}
