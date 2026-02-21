/**
 * RAG Client — Connects to the Ingestor API (FastAPI) for semantic search.
 * Server: infra-ingestor-1 on infra_rag_net (port 8001)
 * Endpoints: POST /search, POST /ingest, GET /health, GET /collections, GET /collections/{name}/stats
 */

interface RAGSearchHit {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  distance: number;
  score?: number;
}

interface RAGSearchResponse {
  hits: RAGSearchHit[];
  total_candidates?: number;
  filters_applied?: Record<string, unknown> | null;
}

interface RAGCollectionStats {
  collection: string;
  count: number;
  subjects: Record<string, number>;
  levels: Record<string, number>;
  types: Record<string, number>;
  sources: Record<string, number>;
}

interface RAGSearchOptions {
  /** Search query */
  query: string;
  /** Number of results to return (default: 4) */
  k?: number;
  /** Include full document text (default: true) */
  includeDocuments?: boolean;
  /** ChromaDB collection name */
  collection?: string;
  /** Optional metadata filters (subject, level, type, domain) */
  filters?: Record<string, unknown>;
}

/** Supported subjects for filtering */
export type RAGSubject = 'maths' | 'nsi' | 'physique_chimie' | 'francais' | 'svt' | 'ses';

/** Supported levels for filtering */
export type RAGLevel = 'seconde' | 'premiere' | 'terminale' | 'superieur';

/**
 * Get the RAG Ingestor base URL.
 * Priority: env var > Docker service name > localhost fallback
 */
function getIngestorUrl(): string {
  if (process.env.RAG_INGESTOR_URL) {
    return process.env.RAG_INGESTOR_URL;
  }
  // Inside Docker on infra_rag_net, the ingestor is reachable via service name
  if (process.env.NODE_ENV === 'production') {
    return 'http://ingestor:8001';
  }
  // Local dev fallback
  return 'http://localhost:8001';
}

/**
 * Search the RAG knowledge base for relevant pedagogical content.
 */
export async function ragSearch(options: RAGSearchOptions): Promise<RAGSearchHit[]> {
  const baseUrl = getIngestorUrl();
  const timeout = parseInt(process.env.RAG_SEARCH_TIMEOUT_MS || process.env.RAG_SEARCH_TIMEOUT || '12000', 10);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: options.query,
        k: options.k ?? 4,
        include_documents: options.includeDocuments ?? true,
        collection: options.collection ?? 'ressources_pedagogiques_terminale',
        filters: options.filters ?? null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`RAG search failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as RAGSearchResponse;
    return data.hits || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`RAG search timeout after ${timeout}ms`);
    } else {
      console.error('RAG search error:', error);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Search with subject and level filters (convenience wrapper).
 */
export async function ragSearchBySubject(
  query: string,
  subject: RAGSubject,
  level?: RAGLevel,
  k = 4,
): Promise<RAGSearchHit[]> {
  const filters: Record<string, string> = { subject };
  if (level) filters.level = level;
  return ragSearch({ query, k, filters });
}

/**
 * Check if the RAG service is healthy.
 */
export async function ragHealthCheck(): Promise<boolean> {
  const baseUrl = getIngestorUrl();
  const HEALTH_TIMEOUT_MS = 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { status: string };
    return data.status === 'healthy';
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get collection statistics (subjects, levels, types breakdown).
 */
export async function ragCollectionStats(
  collectionName = 'ressources_pedagogiques_terminale',
): Promise<RAGCollectionStats | null> {
  const baseUrl = getIngestorUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${baseUrl}/collections/${collectionName}/stats`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as RAGCollectionStats;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build a RAG context string from search results for LLM prompting.
 */
export function buildRAGContext(hits: RAGSearchHit[]): string {
  if (hits.length === 0) return '';

  let context = '\n\n--- CONTEXTE PÉDAGOGIQUE (base de connaissances Nexus Réussite) ---\n';
  hits.forEach((hit, index) => {
    const source = (hit.metadata?.source as string) || 'Document pédagogique';
    const subject = (hit.metadata?.subject as string) || '';
    const level = (hit.metadata?.level as string) || '';
    const meta = [subject, level].filter(Boolean).join(' — ');
    const header = meta ? `${source} (${meta})` : source;
    context += `\n[${index + 1}] ${header}\n${hit.document}\n`;
  });
  context += '\n--- FIN DU CONTEXTE ---\n';

  return context;
}
