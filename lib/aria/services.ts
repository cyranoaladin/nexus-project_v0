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
      const errText = typeof (response as any).text === 'function'
        ? await (response as any).text().catch(() => '')
        : '';
      console.error(`Erreur HTTP ${response.status} de ${url}: ${errText}`);
      throw new Error(`Le service a répondu avec une erreur: ${response.status}`);
    }

    // Essayer d'abord JSON si disponible
    if (typeof (response as any).json === 'function') {
      try {
        return await (response as any).json();
      } catch {}
    }
    // Sinon, essayer text -> JSON.parse
    if (typeof (response as any).text === 'function') {
      try {
        const text = await (response as any).text();
        if (!text) return {} as T;
        try {
          return JSON.parse(text) as T;
        } catch {
          console.warn(`Réponse non-JSON depuis ${url}, corps tronqué: ${text.slice(0, 120)}...`);
          return {} as T;
        }
      } catch {}
    }

    // Dernier recours
    return {} as T;
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
    // Mode DEV direct: bypass microservice et utilise OpenAI côté Node si demandé
    if (process.env.DIRECT_OPENAI_DEV === '1' && (process.env.OPENAI_API_KEY || '').trim().length > 0 && process.env.USE_LLM_SERVICE !== '1') {
      return (async () => {
        try {
          const { default: OpenAI } = await import('openai');
          const { selectModel, getFallbackModel } = await import('./openai');
          const { getGenerationParams, getSystemPrefix } = await import('./policy');
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const system = data.system_prompt || getSystemPrefix();
          const messages: any[] = [
            { role: 'system', content: system },
            { role: 'user', content: data.requete_actuelle },
          ];
          const primaryModel = selectModel();
          const fallbackModel = getFallbackModel();
          const gen = getGenerationParams('tutor');
          try {
            const resp = await client.chat.completions.create({
              model: primaryModel,
              temperature: gen.temperature,
              top_p: gen.top_p,
              presence_penalty: gen.presence_penalty,
              max_tokens: gen.max_tokens,
              messages,
            });
            const text = (resp as any).choices?.[0]?.message?.content || '';
            return { response: text } as LLMResponse;
          } catch (errPrimary) {
            if (fallbackModel) {
              console.warn(`[ARIA][OpenAI] Primary model failed (${primaryModel}). Retrying with fallback: ${fallbackModel}`);
              const resp2 = await client.chat.completions.create({
                model: fallbackModel,
                temperature: gen.temperature,
                top_p: gen.top_p,
                presence_penalty: gen.presence_penalty,
                max_tokens: gen.max_tokens,
                messages,
              });
              const text2 = (resp2 as any).choices?.[0]?.message?.content || '';
              return { response: text2 } as LLMResponse;
            }
            throw errPrimary;
          }
        } catch (error) {
          console.error('[DIRECT_OPENAI_DEV_ERROR]', error);
          // Fallback HTTP microservice
          return await postRequest<LLMResponse>(`${LLM_SERVICE_URL}/chat`, data);
        }
      })();
    }
    // Comportement normal: passer par le microservice Python
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
  ingest: (data: RAGIngestRequest): Promise<{ success: boolean; }> => {
    return postRequest<{ success: boolean; }>(`${RAG_SERVICE_URL}/ingest`, data);
  },
};
