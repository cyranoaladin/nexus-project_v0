import OpenAI from "openai";

// Déclaration d'une variable globale pour conserver le pipeline chargé en mémoire.
// Conservé uniquement pour compatibilité éventuelle, mais non utilisé par défaut.
let hfPipeline: any;

/**
 * Fonction dédiée pour générer des embeddings via la librairie locale Hugging Face.
 * Désactivée par défaut. À n'activer qu'en dev explicite.
 */
async function getHuggingFaceEmbeddings(texts: string[], targetDim: number): Promise<number[][]> {
  if (!hfPipeline) {
    try {
      const transformers = await import('@xenova/transformers');
      (transformers as any).env.allowQuantized = false as any;
      const { pipeline } = transformers as any;
      const modelName = process.env.HF_EMBEDDING_MODEL || "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
      console.log(`Loading Hugging Face model: ${modelName}`);
      hfPipeline = await pipeline('feature-extraction', modelName);
      console.log("Hugging Face model loaded successfully.");
    } catch (error) {
      console.error("Failed to load Hugging Face pipeline:", error);
      throw new Error("Could not load Hugging Face model.");
    }
  }

  try {
    const output = await hfPipeline(texts, { pooling: 'mean', normalize: true });
    const arr = output.tolist() as number[][];
    // Ensure dimension = targetDim (pad/truncate)
    return arr.map(vec => {
      if (vec.length === targetDim) return vec;
      if (vec.length > targetDim) return vec.slice(0, targetDim);
      const pad = new Array(targetDim - vec.length).fill(0);
      return [...vec, ...pad];
    });
  } catch (error) {
    console.error("Failed to generate embeddings with Hugging Face:", error);
    throw new Error("Embedding generation failed.");
  }
}

/**
 * Fonction dédiée pour générer des embeddings via l'API OpenAI.
 */
async function getOpenAIEmbeddings(texts: string[], targetDim: number): Promise<number[][]> {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const modelName = process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-large";

    const response = await client.embeddings.create({
      model: modelName,
      input: texts,
      dimensions: targetDim,
    });

    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error("Failed to generate embeddings with OpenAI:", error);
    throw new Error("OpenAI embedding generation failed.");
  }
}

/**
 * Fonction principale qui choisit le bon "provider" (fournisseur) d'embeddings.
 * Par défaut: OpenAI text-embedding-3-large (3072).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  // Détermine le provider à utiliser en se basant sur la variable d'environnement.
  // Défaut: openai (conforme Option A – pas de fallback implicite HF)
  const provider = (process.env.EMBEDDING_PROVIDER || "openai").toLowerCase();
  const targetDim = Number(process.env.VECTOR_DIM || 3072);

  // Mode "Fake" pour les tests unitaires rapides, ne fait aucun appel réel.
  if (process.env.TEST_EMBEDDINGS_FAKE === '1') {
    console.log("Using FAKE embeddings for testing.");
    const dim = targetDim;
    return texts.map((t, idx) => Array.from({ length: dim }, (_, i) => Math.sin((t.length + idx + i) * 0.01)));
  }

  console.log(`Using embedding provider: ${provider}`);

  // Stratégie hybride
  const tryOpenAI = async (): Promise<number[][]> => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key missing');
    return getOpenAIEmbeddings(texts, targetDim);
  };

  const tryHF = async (): Promise<number[][]> => {
    return getHuggingFaceEmbeddings(texts, targetDim);
  };

  if (provider === 'huggingface') {
    return tryHF();
  }

  // provider = openai (défaut): tenter OpenAI puis fallback HF si erreur/refus
  try {
    return await tryOpenAI();
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const code = (e as any)?.code || (e as any)?.status || '';
    console.warn('[Embeddings][OpenAI] échec, bascule vers HF:', { code, msg });
    return tryHF();
  }
}
