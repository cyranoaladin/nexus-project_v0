/**
 * ARIA RAG Retrieval Contract & Execution Engine.
 *
 * Principes invariants :
 * - Plan explicite obligatoire (AriaRetrievalPlan).
 * - Aucun repli silencieux vers "ressources_pedagogiques_terminale".
 * - Aucune approximation RAG pour les matières STMG (SGN, Management, Droit-Éco != SES).
 * - États typés explicites au lieu de renvoyer silencieusement [].
 */

import { ragSearch } from '@/lib/rag-client';
import type {
  AriaCitationHit,
  AriaCourseKey,
  AriaRagState,
  AriaRetrievalPlan,
} from './contracts';

interface RAGHit {
  id?: string;
  document?: string;
  metadata?: Record<string, unknown>;
  distance?: number;
  score?: number;
}

// ─── Plans canoniques déclarés ───────────────────────────────────────────────

const CANONICAL_PLANS: Readonly<Record<string, Omit<AriaRetrievalPlan, 'courseKey'>>> = Object.freeze({
  'eds-maths-premiere': {
    subject: 'MATHEMATIQUES',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    collection: 'rag_nexus_maths_premiere_generale_production',
    filters: { niveau: 'premiere', voie: 'generale', matiere: 'maths' },
    corpusVersion: 'v1',
  },
  'eds-maths-terminale': {
    subject: 'MATHEMATIQUES',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    collection: 'rag_nexus_maths_terminale_generale_production',
    filters: { niveau: 'terminale', voie: 'generale', matiere: 'maths' },
    corpusVersion: 'v1',
  },
  'eds-nsi-premiere': {
    subject: 'NSI',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    collection: 'rag_nexus_nsi_premiere_generale_production',
    filters: { niveau: 'premiere', voie: 'generale', matiere: 'nsi' },
    corpusVersion: 'v1',
  },
  'eds-nsi-terminale': {
    subject: 'NSI',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    collection: 'rag_nexus_nsi_terminale_generale_production',
    filters: { niveau: 'terminale', voie: 'generale', matiere: 'nsi' },
    corpusVersion: 'v1',
  },
  'tc-francais-premiere': {
    subject: 'FRANCAIS',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    collection: 'rag_nexus_francais_premiere_generale_production',
    filters: { niveau: 'premiere', voie: 'generale', matiere: 'francais' },
    corpusVersion: 'v1',
  },
  'tc-philosophie-terminale': {
    subject: 'PHILOSOPHIE',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    collection: 'rag_nexus_philosophie_terminale_generale_production',
    filters: { niveau: 'terminale', voie: 'generale', matiere: 'philosophie' },
    corpusVersion: 'v1',
  },
});

/**
 * Construit un plan de recherche RAG explicite pour un cours donné.
 * Si le cours est inconnu ou non couvert par un corpus réel -> null (fail closed).
 */
export function buildAriaRetrievalPlan(courseKey: AriaCourseKey): AriaRetrievalPlan | null {
  const planData = CANONICAL_PLANS[courseKey];
  if (!planData) {
    // Les enseignements technologiques STMG (SGN, Management, Droit-Eco)
    // ne disposent pas d'un corpus ChromaDB dédié et ne sont JAMAIS mappés à SES.
    return null;
  }

  return {
    courseKey,
    ...planData,
  };
}

/**
 * Exécute la recherche RAG dans le respect du contrat typé ARIA.
 */
export async function executeAriaRetrieval(
  plan: AriaRetrievalPlan | null,
  query: string,
  options?: { k?: number; scoreThreshold?: number }
): Promise<AriaRagState> {
  if (!plan) {
    return {
      status: 'NOT_CONFIGURED',
      reason: "L'assistant documentaire n'est pas encore configuré pour ce cours.",
    };
  }

  if (!query || query.trim().length === 0) {
    return {
      status: 'NO_RESULTS',
      plan,
    };
  }

  try {
    const hits = await ragSearch({
      query: query.trim(),
      collection: plan.collection,
      filters: { ...plan.filters, subject: plan.subject.toLowerCase() },
      k: options?.k ?? 4,
      score_threshold: options?.scoreThreshold,
    });

    if (!hits || hits.length === 0) {
      return {
        status: 'NO_RESULTS',
        plan,
      };
    }

    const citationHits: AriaCitationHit[] = hits.map((hit: RAGHit, index: number) => {
      const meta = (hit.metadata ?? {}) as Record<string, unknown>;
      return {
        id: hit.id || `${plan.courseKey}-hit-${index}`,
        sourceTitle: String(meta.title || meta.chapitre || meta.source || `Document ${plan.courseKey}`),
        sourceDocument: String(meta.document || meta.filename || meta.source || `${plan.collection}`),
        sourceLocation: meta.section ? String(meta.section) : meta.page ? `Page ${meta.page}` : undefined,
        courseKey: plan.courseKey,
        provenance: meta.provenance ? String(meta.provenance) : 'UNVERIFIED',
        url: meta.url ? String(meta.url) : undefined,
        snippet: hit.document || '',
        score: hit.score ?? (1 - (hit.distance ?? 0)),
      };
    });

    return {
      status: 'SUCCESS',
      hits: citationHits,
      plan,
    };
  } catch (error) {
    return {
      status: 'RUNTIME_UNAVAILABLE',
      error: error instanceof Error ? error.message : 'Erreur inconnue de recherche RAG',
      plan,
    };
  }
}
