import { telegramSendMessage } from '@/lib/telegram/client';
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

export interface RAGSearchOptions {
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
}

/** Supported subjects for filtering */
export type RAGSubject = 'maths' | 'nsi' | 'physique_chimie' | 'francais' | 'svt' | 'ses';

/** Supported levels for filtering */
export type RAGLevel = 'seconde' | 'premiere' | 'terminale' | 'superieur';

export type RAGAcademicTrack = 'EDS_GENERALE' | 'STMG' | 'STI2D' | 'ST2S' | 'STL' | 'STD2A' | 'STMG_NON_LYCEEN';

export type RAGSearchErrorCode =
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export type RAGSearchResult =
  | { status: 'success'; hits: RAGSearchHit[]; durationMs: number }
  | { status: 'empty'; hits: []; durationMs: number }
  | {
      status: 'error';
      hits: [];
      durationMs: number;
      error: { code: RAGSearchErrorCode; httpStatus?: number };
    };

interface RAGSearchEvent {
  at: number;
  failed: boolean;
}

const recentSearches: RAGSearchEvent[] = [];
let lastAlertAt = 0;

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function recordSearchOutcome(failed: boolean, errorCode?: RAGSearchErrorCode): void {
  const now = Date.now();
  const windowMs = envNumber('RAG_FAILURE_ALERT_WINDOW_MS', 5 * 60_000);
  const minimumSamples = envNumber('RAG_FAILURE_ALERT_MIN_SAMPLES', 5);
  const rateThreshold = Math.min(1, envNumber('RAG_FAILURE_ALERT_RATE', 0.5));
  const cooldownMs = envNumber('RAG_FAILURE_ALERT_COOLDOWN_MS', 15 * 60_000);

  recentSearches.push({ at: now, failed });
  while (recentSearches[0] && recentSearches[0].at < now - windowMs) {
    recentSearches.shift();
  }

  const failureCount = recentSearches.filter((event) => event.failed).length;
  const failureRate = recentSearches.length === 0 ? 0 : failureCount / recentSearches.length;
  if (
    recentSearches.length < minimumSamples ||
    failureRate <= rateThreshold ||
    now - lastAlertAt < cooldownMs
  ) {
    return;
  }

  lastAlertAt = now;
  const message = [
    '[Nexus RAG] Seuil d’échec dépassé',
    `Échecs: ${failureCount}/${recentSearches.length}`,
    `Fenêtre: ${windowMs} ms`,
    `Dernier code: ${errorCode ?? 'UNKNOWN'}`,
  ].join('\n');
  void telegramSendMessage(undefined, message).catch(() => {
    console.error('[rag] alert failed', { code: 'TELEGRAM_NOTIFICATION_FAILED' });
  });
}

function technicalFailure(
  code: RAGSearchErrorCode,
  startedAt: number,
  httpStatus?: number,
): RAGSearchResult {
  const durationMs = Math.max(0, Date.now() - startedAt);
  const logDetails = httpStatus === undefined
    ? { code, durationMs }
    : { code, durationMs, httpStatus };
  console.error('[rag] search failed', logDetails);
  recordSearchOutcome(true, code);
  return {
    status: 'error',
    hits: [],
    durationMs,
    error: httpStatus === undefined ? { code } : { code, httpStatus },
  };
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
  // Fallback to the public Nexus RAG API for Maths 1ère if needed
  return 'https://rag-api.nexusreussite.academy';
}

/**
 * Search the RAG knowledge base for relevant pedagogical content.
 */
export async function ragSearch(options: RAGSearchOptions): Promise<RAGSearchResult> {
  const startedAt = Date.now();
  const baseUrl = getIngestorUrl();
  const token = process.env.RAG_API_TOKEN;
  const timeout = parseInt(process.env.RAG_SEARCH_TIMEOUT_MS || process.env.RAG_SEARCH_TIMEOUT || '12000', 10);
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
      return technicalFailure('HTTP_ERROR', startedAt, response.status);
    }

    let data: RAGSearchResponse;
    try {
      data = (await response.json()) as RAGSearchResponse;
    } catch {
      return technicalFailure('INVALID_RESPONSE', startedAt);
    }

    if (!Array.isArray(data.hits)) {
      return technicalFailure('INVALID_RESPONSE', startedAt);
    }

    const durationMs = Math.max(0, Date.now() - startedAt);
    recordSearchOutcome(false);
    return data.hits.length > 0
      ? { status: 'success', hits: data.hits, durationMs }
      : { status: 'empty', hits: [], durationMs };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return technicalFailure('TIMEOUT', startedAt);
    }
    return technicalFailure('NETWORK_ERROR', startedAt);
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
): Promise<RAGSearchResult> {
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
): Promise<RAGSearchResult> {
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
