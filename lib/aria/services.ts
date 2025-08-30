// lib/aria/services.ts

/**
 * Ce fichier sert de client HTTP pour communiquer avec les microservices Python d'ARIA.
 */

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8003';
const PDF_SERVICE_URL = process.env.PDF_GENERATOR_SERVICE_URL || 'http://localhost:8002';
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';

// Timeout par défaut pour l'appel LLM (ms). Peut être ajusté via env.
const LLM_HTTP_TIMEOUT_MS = Number(process.env.LLM_HTTP_TIMEOUT_MS || '60000');
// Timeout spécifique pour l'appel LLM lors des générations de PDF.
const LLM_PDF_TIMEOUT_MS = Number(process.env.LLM_PDF_TIMEOUT_MS || '120000');
// Timeout par défaut pour le microservice PDF (ms).
const PDF_HTTP_TIMEOUT_MS = Number(process.env.PDF_HTTP_TIMEOUT_MS || '90000');

type PostOpts = { timeoutMs?: number };

async function postRequest<T>(url: string, body: any, opts: PostOpts = {}): Promise<T> {
  const timeoutMs = Number(opts.timeoutMs || 0);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new Error('REQUEST_TIMEOUT')), timeoutMs);
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Erreur HTTP ${response.status} de ${url}: ${errorBody}`);
      throw new Error(`Le service a répondu avec une erreur: ${response.status}`);
    }
    return response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError' || String(error?.message || '').includes('REQUEST_TIMEOUT')) {
      const e: any = new Error('GENERIC_REQUEST_TIMEOUT');
      e.code = 'ETIMEDOUT';
      throw e;
    }
    console.error(`Impossible de contacter le service à ${url}:`, error);
    throw new Error(`Erreur de communication avec un service interne.`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// --- Client pour le LLM Service ---
interface LLMRequest {
  contexte_eleve: any;
  requete_actuelle: string;
  requete_type: string;
  system_prompt?: string;
}

interface LLMResponse {
  response: string;
  contenu_latex?: string;
  mock?: boolean;
}

export const llm_service = {
  generate_response: (data: LLMRequest, opts: PostOpts = {}): Promise<LLMResponse> => {
    const timeoutMs = Number(
      opts.timeoutMs || (data?.requete_type === 'PDF_GENERATION' ? LLM_PDF_TIMEOUT_MS : LLM_HTTP_TIMEOUT_MS)
    );
    return postRequest<LLMResponse>(`${LLM_SERVICE_URL}/chat`, data, { timeoutMs });
  },
};

// --- Client pour le PDF Generator Service ---
interface PDFRequest {
  contenu: string;
  type_document: string;
  matiere: string;
  nom_fichier: string;
  nom_eleve: string;
  // Champs optionnels de personnalisation (schéma étendu)
  footer_brand?: string;
  footer_coach?: string;
  footer_show_date?: boolean;
  footer_extra?: string;
  options?: Record<string, any>;
}

interface PDFResponse {
  message: string;
  url: string;
}

export const pdf_generator_service = {
  generate_pdf: async (data: PDFRequest): Promise<PDFResponse> => {
    try {
      return await postRequest<PDFResponse>(`${PDF_SERVICE_URL}/generate`, data, {
        timeoutMs: PDF_HTTP_TIMEOUT_MS,
      });
    } catch (err: any) {
      const msg = String(err?.message || '').toUpperCase();
      const code = String(err?.code || '').toUpperCase();
      if (code === 'ETIMEDOUT' || msg.includes('GENERIC_REQUEST_TIMEOUT')) {
        const e: any = new Error('PDF_REQUEST_TIMEOUT');
        e.code = 'ETIMEDOUT';
        throw e;
      }
      throw err;
    }
  },
};

// --- Client pour le RAG Service ---
interface RAGIngestRequest {
  contenu: string;
  metadata: Record<string, any>;
}

export const rag_service = {
  ingest: (data: RAGIngestRequest): Promise<{ success: boolean }> => {
    // En mode E2E, on ne fait pas de vrais appels au RAG pour éviter le bruit réseau
    // et les dépendances inutiles. On simule simplement un succès.
    if ((process.env.NEXT_PUBLIC_E2E === '1' || process.env.E2E_RUN === '1') && process.env.NODE_ENV !== 'test') {
      console.log('[ARIA_RAG_INGEST_SKIPPED]', { reason: 'E2E mode' });
      return Promise.resolve({ success: true });
    }
    const base = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
    return postRequest<{ success: boolean }>(`${base}/ingest`, data);
  },
};
