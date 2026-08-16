/**
 * Génère un exemple RÉEL de brief enseignant sur un attempt publié, pour
 * jugement du responsable — et mesure le coût avec puis sans cache (deux
 * appels successifs, le second bénéficiant du cache prompt).
 *
 * Usage (la clé n'est JAMAIS passée en argument ni affichée) :
 *   OPENROUTER_API_KEY=... DATABASE_URL=... npx tsx \
 *     scripts/bilans/generate-teacher-brief-example.ts <reportArtifactId>
 *
 * Sans clé : sort en mode PLANCHER avec le code de repli, sans erreur.
 * N'écrit RIEN en base : sortie sur stdout uniquement (dry-run).
 */
import { prisma } from '@/lib/prisma';
import {
  buildStudentFactsPayload,
  callTeacherBriefModel,
  resolveTeacherBriefConfig,
} from '@/lib/bilans/llm/teacher-brief-service';
import { resolveEnabledPack } from '@/lib/bilans/api/pack-access';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import { assertTeacherBriefOperationsEnabled } from '@/lib/bilans/staff/teacher-brief-operations';

async function main(): Promise<number> {
  assertTeacherBriefOperationsEnabled();
  const artifactId = process.argv[2];
  if (!artifactId) {
    process.stderr.write('Usage: generate-teacher-brief-example.ts <reportArtifactId>\n');
    return 2;
  }
  let config;
  try {
    config = resolveTeacherBriefConfig();
  } catch (error) {
    process.stdout.write(`PLANCHER:${(error as { code?: string }).code ?? 'CONFIG'}\n`);
    return 0;
  }

  const artifact = await prisma.reportArtifact.findUnique({
    where: { id: artifactId },
    select: {
      assessmentAttempt: {
        select: { answers: true, assessmentPackId: true, assessmentPackVersion: true, assessmentPackChecksum: true },
      },
      revisions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { scoreSnapshot: { select: { result: true } } },
      },
    },
  });
  if (artifact === null || artifact.revisions.length === 0) throw new Error('ARTIFACT_NOT_FOUND');
  const resolved = resolveEnabledPack(
    artifact.assessmentAttempt.assessmentPackId,
    Number(artifact.assessmentAttempt.assessmentPackVersion),
  );
  if (resolved === null) throw new Error('PACK_UNAVAILABLE');
  if (artifact.assessmentAttempt.assessmentPackChecksum !== resolved.checksum) throw new Error('PACK_CHECKSUM_MISMATCH');

  const factSheet = artifact.revisions[0].scoreSnapshot.result as unknown as FactSheet;
  const facts = buildStudentFactsPayload(
    factSheet,
    resolved.pack,
    artifact.assessmentAttempt.answers,
    resolved.pack.subject,
  );

  const first = await callTeacherBriefModel(config, facts);
  const second = await callTeacherBriefModel(config, facts);

  process.stdout.write(JSON.stringify({
    model: first.model,
    promptVersion: first.promptVersion,
    appel1: {
      promptTokens: first.promptTokens,
      cachedPromptTokens: first.cachedPromptTokens,
      completionTokens: first.completionTokens,
      estimatedCostUsd: first.estimatedCostUsd,
      generationMs: first.generationMs,
    },
    appel2_cache: {
      promptTokens: second.promptTokens,
      cachedPromptTokens: second.cachedPromptTokens,
      completionTokens: second.completionTokens,
      estimatedCostUsd: second.estimatedCostUsd,
      generationMs: second.generationMs,
    },
    contenu: first.content,
  }, null, 2));
  process.stdout.write('\n');
  return 0;
}

main().then((code) => { process.exitCode = code; }).finally(() => prisma.$disconnect());
