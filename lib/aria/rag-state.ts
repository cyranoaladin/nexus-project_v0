import type { RAGSearchHit, RAGSearchResult } from '@/lib/rag-client';

export const ARIA_RAG_UNAVAILABLE_MESSAGE =
  'La base documentaire est momentanément indisponible. Je ne peux pas appuyer ma réponse sur les programmes pour le moment. Merci de réessayer dans quelques instants.';

export const ARIA_RAG_EMPTY_NOTICE =
  'Cette réponse ne s’appuie sur aucune source du corpus Nexus.';

export function getSuccessfulRagHits(result: RAGSearchResult): RAGSearchHit[] {
  return result.status === 'success' ? result.hits : [];
}
