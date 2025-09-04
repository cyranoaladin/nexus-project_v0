import { openai } from "@/server/openai/client";

// Default model selection based on desired vector dim
function selectDefaultOpenAIModel(targetDim: number): string {
  const envModel = process.env.EMBEDDING_MODEL || process.env.OPENAI_EMBEDDINGS_MODEL;
  if (envModel) return envModel;
  // Use 3-large for 3072, 3-small for <=1536
  return targetDim >= 2000 ? "text-embedding-3-large" : "text-embedding-3-small";
}

function coerceDim(vec: number[], targetDim: number): number[] {
  if (vec.length === targetDim) return vec;
  if (vec.length > targetDim) return vec.slice(0, targetDim);
  // If smaller, repeat then slice to target length
  const out: number[] = [];
  while (out.length < targetDim) {
    const need = targetDim - out.length;
    if (need >= vec.length) out.push(...vec);
    else out.push(...vec.slice(0, need));
  }
  return out;
}

async function getHFEmbeddings(texts: string[], targetDim: number): Promise<number[][]> {
  // Lazy-load HF only when needed
  const transformers = await import('@xenova/transformers').catch(() => null as any);
  if (!transformers) throw new Error("Hugging Face transformers indisponible");
  (transformers as any).env.allowQuantized = false as any;
  const { pipeline } = transformers as any;
  const modelName = process.env.HF_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
  const pipe = await pipeline('feature-extraction', modelName);
  const output = await pipe(texts, { pooling: 'mean', normalize: true });
  const arrays: number[][] = (output as any).tolist();
  return arrays.map(v => coerceDim(v, targetDim));
}

export async function embedTexts(texts: string[], model?: string): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const targetDim = Number(process.env.VECTOR_DIM || 3072);
  const isNonProd = (process.env.NODE_ENV || 'development') !== 'production';

  const prefer = (process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase();
  console.log(`[EMBEDDINGS] provider=${prefer} VECTOR_DIM=${targetDim}`);

  const tryOpenAI = async (): Promise<number[][]> => {
    const client = openai();
    if (!client.apiKey) throw new Error('OPENAI_API_KEY manquante');
    const modelName = (process.env.OPENAI_EMBEDDINGS_MODEL || model || selectDefaultOpenAIModel(targetDim));
    console.log(`[EMBEDDINGS] provider=openai model=${modelName} targetDim=${targetDim}`);
    const res = await client.embeddings.create({ model: modelName as any, input: texts, dimensions: targetDim as any } as any);
    return (res.data as any[]).map((d: any) => (d.embedding as number[]));
  };

  const tryHF = async (): Promise<number[][]> => {
    const set = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
    const hfDim = Number(process.env.HF_EMBEDDING_DIM || 384);
    console.log(`[EMBEDDINGS] fallback=huggingface model=${set} targetDim=${targetDim} hfDim=${hfDim}`);
    const out = await getHFEmbeddings(texts, hfDim);
    // padding to targetDim
    const pad = (vec: number[]) => (vec.length < targetDim ? [...vec, ...new Array(targetDim - vec.length).fill(0)] : vec.slice(0, targetDim));
    return out.map(pad);
  };

  if (prefer === 'huggingface') {
    return tryHF();
  }

  try {
    return await tryOpenAI();
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const code = (e as any)?.code || (e as any)?.status || '';
    console.warn('[EMBEDDINGS][OpenAI] échec, bascule vers HF:', { code, msg });
    // En production, on tente tout de même HF pour résilience
    if (isNonProd || true) return tryHF();
    throw e;
  }
}
