import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/server/vector/embeddings";
import { semanticSearch } from "@/server/vector/search";

export type BuiltContext = {
  recentMessages: Array<{ role: string; content: string; ts: string; }>;
  episodicMemories: Array<{ content: string; createdAt: string; }>;
  semanticMemories: Array<{ chunk: string; source: string; score: number; meta: any; }>;
  planMemory?: { content: string; createdAt: string; } | null;
  dashboardSummary?: any;
  pedagoProfile?: any;
};

export async function buildContext(studentId: string, currentQuery: string, subject?: string, level?: string): Promise<BuiltContext> {
  console.log('[CTX_BUILD] start', { studentId, subject, level, hasQuery: !!currentQuery });
  const recentMessages = await prisma.message.findMany({
    where: { receiverId: studentId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { content: true, createdAt: true },
  }).catch(() => []);

  // Memories model may differ; fallback to notifications/messages if absent
  const episodicMemories: Array<{ content: string; createdAt: string; }> = [];
  const planMemory = null;

  console.log('[CTX_BUILD] calling embedTexts');
  const [queryEmbedding] = await embedTexts([currentQuery || "Synthèse"]);
  console.log('[CTX_BUILD] got embedding', { dim: Array.isArray(queryEmbedding)? queryEmbedding.length : null });
  const sem = await semanticSearch({ queryEmbedding, subject, level, k: 6 }).catch(() => []);
  const semanticMemories = sem.map((r: any) => ({ chunk: r.chunk, source: r.source, score: Number(r.cosine || 0), meta: r.meta }));

  const dashboardSummary = undefined;

  // Inclure le profil pédagogique Volet 2 (si disponible)
  let pedagoProfile: any = undefined;
  try {
    const mem = await prisma.memory.findFirst({ where: { studentId, content: 'PEDAGO_PROFILE_BASE' } });
    pedagoProfile = mem?.meta || undefined;
  } catch {}

  return {
    recentMessages: (recentMessages || []).reverse().map((m: any) => ({ role: "assistant", content: m.content, ts: m.createdAt?.toISOString?.() || String(m.createdAt) })),
    episodicMemories,
    semanticMemories,
    planMemory,
    dashboardSummary,
    pedagoProfile,
  };
}
