// lib/aria/services.ts

/**
 * Ce fichier sert de client HTTP pour communiquer avec les microservices Python d'ARIA.
 */

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8003';
const PDF_SERVICE_URL = process.env.PDF_GENERATOR_SERVICE_URL || 'http://localhost:8002';
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';

async function postRequest<T>(url: string, body: any): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Erreur HTTP ${response.status} de ${url}: ${errorBody}`);
      throw new Error(`Le service a répondu avec une erreur: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Impossible de contacter le service à ${url}:`, error);
    throw new Error(`Erreur de communication avec un service interne.`);
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
}

export const llm_service = {
  generate_response: (data: LLMRequest): Promise<LLMResponse> => {
    return postRequest<LLMResponse>(`${LLM_SERVICE_URL}/chat`, data);
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
  generate_pdf: (data: PDFRequest): Promise<PDFResponse> => {
    return postRequest<PDFResponse>(`${PDF_SERVICE_URL}/generate`, data);
  },
};

// --- Client pour le RAG Service ---
interface RAGIngestRequest {
  contenu: string;
  metadata: Record<string, any>;
}

export const rag_service = {
  ingest: (data: RAGIngestRequest): Promise<{ success: boolean }> => {
    return postRequest<{ success: boolean }>(`${RAG_SERVICE_URL}/ingest`, data);
  },
};
