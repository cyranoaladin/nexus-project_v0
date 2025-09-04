import { prisma } from "@/lib/prisma";

export async function semanticSearch(params: { queryEmbedding: number[]; subject?: string; level?: string; k?: number; }): Promise<any[]> {
  const { queryEmbedding, subject, level, k = 6 } = params;
  const whereClauses: string[] = [];
  if (subject) whereClauses.push(`subject = '${subject.replace(/'/g, "''")}'`);
  if (level) whereClauses.push(`level = '${level.replace(/'/g, "''")}'`);
  const whereCondition = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  // pgvector cosine distance (<#>) lower is closer; we also return cosine similarity
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "docId", subject, level, source, chunk, meta,
            1 - (embedding <#> $1::vector) AS cosine
     FROM "knowledge_assets"
     ${whereCondition}
     ORDER BY embedding <#> $1::vector ASC
     LIMIT $2`,
    queryEmbedding, k
  );
  return rows;
}
