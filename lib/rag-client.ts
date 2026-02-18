/**
 * RAG Client — Connects to the Ingestor API (FastAPI) for semantic search.
 * Server: infra-ingestor-1 on infra_rag_net (port 8001)
 * Endpoints: POST /search, POST /ingest, GET /health
 */

interface RAGSearchHit {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  distance: number;
}

interface RAGSearchResponse {
  hits: RAGSearchHit[];
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
  /** Optional metadata filters */
  filters?: Record<string, unknown>;
}

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
 * Build a RAG context string from search results for LLM prompting.
 */
export function buildRAGContext(hits: RAGSearchHit[]): string {
  if (hits.length === 0) return '';

  let context = '\n\n--- CONTEXTE PÉDAGOGIQUE (base de connaissances Nexus Réussite) ---\n';
  hits.forEach((hit, index) => {
    const source = (hit.metadata?.source as string) || 'Document pédagogique';
    context += `\n[${index + 1}] ${source}\n${hit.document}\n`;
  });
  context += '\n--- FIN DU CONTEXTE ---\n';

  return context;
}
