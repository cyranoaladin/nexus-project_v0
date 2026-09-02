/**
 * RAG Client — Canonical RAG retrieval via ChromaDB.
 *
 * Connects to the Ingestor API (FastAPI) for semantic search.
 * Server: infra-ingestor-1 on infra_rag_net (port 8001)
 * Endpoints: POST /search, POST /ingest, GET /health, GET /collections, GET /collections/{name}/stats
 *
 * Architecture:
 * - ChromaDB = canonical RAG backend (nomic-embed-text, 768d)
 * - pgvector = disabled for RAG product — see docs/RAG_ARCHITECTURE.md
 * - Ingestion = out-of-repo — operated by external FastAPI service
 */

export interface RAGSearchHit {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  distance: number;
  score?: number;
}

export interface RAGSearchResponse {
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
  /** ChromaDB collection name (internal ingestor) */
  collection?: string;
  /** RAG section (external Nexus RAG API) */
  section?: string;
  /** Minimum similarity score threshold */
  score_threshold?: number;
  /** Optional metadata filters (subject, level, type, domain) */
  filters?: Record<string, unknown>;
  /** ARIA canonical callers require observable failures instead of legacy empty results. */
  failureMode?: 'empty' | 'throw';
  /** Canonical callers provide their technical timeout explicitly. */
  timeoutMs?: number;
  /** Canonical callers bound response parsing before JSON allocation. */
  maxResponseBytes?: number;
}

/** Supported subjects for filtering */
export type RAGSubject = 'maths' | 'nsi' | 'physique_chimie' | 'francais' | 'svt' | 'ses';

/** Supported levels for filtering */
export type RAGLevel = 'seconde' | 'premiere' | 'terminale' | 'superieur';

export type RAGAcademicTrack = 'EDS_GENERALE' | 'STMG' | 'STI2D' | 'ST2S' | 'STL' | 'STD2A' | 'STMG_NON_LYCEEN';

/**
 * Get the RAG Ingestor base URL.
 * Priority: env var > Docker service name > localhost fallback
 */
function getIngestorUrl(requireExplicitConfiguration = false): string | null {
  if (process.env.RAG_INGESTOR_URL !== undefined) {
    return process.env.RAG_INGESTOR_URL.trim() || null;
  }
  if (requireExplicitConfiguration) return null;
  // Inside Docker on infra_rag_net, the ingestor is reachable via service name
  if (process.env.NODE_ENV === 'production') {
    return 'http://ingestor:8001';
  }
  // Fallback to the public Nexus RAG API for Maths 1ère if needed
  return 'https://rag-api.nexusreussite.academy';
}

/**
 * Search the RAG knowledge base for relevant pedagogical content.
 */
export async function ragSearch(options: RAGSearchOptions): Promise<RAGSearchHit[]> {
  const baseUrl = getIngestorUrl(options.failureMode === 'throw');
  if (!baseUrl) {
    if (options.failureMode === 'throw') throw new Error('RAG_NOT_CONFIGURED');
    return [];
  }
  const token = process.env.RAG_API_TOKEN;
  const timeout = options.timeoutMs
    ?? parseInt(process.env.RAG_SEARCH_TIMEOUT_MS || process.env.RAG_SEARCH_TIMEOUT || '12000', 10);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new Error('RAG_TIMEOUT_CONFIGURATION_INVALID');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Adapt payload between internal ingestor and external Nexus RAG API
  const body: Record<string, unknown> = {
    q: options.query,
    k: options.k ?? 4,
    include_documents: options.includeDocuments ?? true,
  };

  if (options.section) {
    body.section = options.section;
    if (options.score_threshold) body.score_threshold = options.score_threshold;
  } else {
    body.collection = options.collection ?? 'ressources_pedagogiques_terminale';
    body.filters = options.filters ?? null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`RAG search failed: ${response.status} ${response.statusText}`);
      }
      if (options.failureMode === 'throw') {
        throw new Error('RAG_PROVIDER_UNAVAILABLE');
      }
      return [];
    }

    let data: RAGSearchResponse;
    if (options.maxResponseBytes !== undefined) {
      if (!Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes <= 0) {
        throw new Error('RAG_RESPONSE_LIMIT_INVALID');
      }
      const declaredLength = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > options.maxResponseBytes) {
        throw new Error('RAG_RESPONSE_TOO_LARGE');
      }
      const raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > options.maxResponseBytes) {
        throw new Error('RAG_RESPONSE_TOO_LARGE');
      }
      try {
        data = JSON.parse(raw) as RAGSearchResponse;
      } catch {
        throw new Error('RAG_RESPONSE_INVALID');
      }
    } else {
      data = (await response.json()) as RAGSearchResponse;
    }
    return data.hits || [];
  } catch (error) {
    const stableReason = controller.signal.aborted
      ? 'RAG_TIMEOUT'
      : error instanceof Error && /^RAG_[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : 'RAG_RUNTIME_UNAVAILABLE';
    if (options.failureMode === 'throw') throw new Error(stableReason);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('RAG search unavailable', { reasonCode: 'TIMEOUT' });
    } else {
      console.error('RAG search unavailable', { reasonCode: 'RUNTIME_UNAVAILABLE' });
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
 * Search with academic track metadata filters.
 */
export async function ragSearchByTrack(
  track: RAGAcademicTrack,
  subject: RAGSubject,
  query: string,
  level?: RAGLevel,
  k = 4,
): Promise<RAGSearchHit[]> {
  const filters: Record<string, string> = {
    track,
    academicTrack: track,
    subject,
  };
  if (level) filters.level = level;
  return ragSearch({ query, k, filters });
}

/**
 * Check if the RAG service is healthy.
 * Returns a boolean for backward compatibility.
 */
export async function ragHealthCheck(): Promise<boolean> {
  const result = await ragHealthCheckDetailed();
  return result.healthy;
}

/**
 * Detailed RAG health check with error info (for admin diagnostic pages).
 */
export async function ragHealthCheckDetailed(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  const baseUrl = getIngestorUrl();
  if (!baseUrl) return { healthy: false, error: 'RAG_INGESTOR_URL is disabled' };
  const HEALTH_TIMEOUT_MS = 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { status: string };
    return { healthy: data.status === 'healthy' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { healthy: false, error: message };
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
  if (!baseUrl) return null;
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
