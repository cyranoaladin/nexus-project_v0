/**
 * Backfill du journal des tentatives pour les briefs enseignant existants
 * (§15 de l'incident P0 du 2026-08-16).
 *
 * État constaté en production au moment de l'incident : 28 briefs, tous
 * PENDING_REVIEW, 0 APPROVED, 0 CORRECTION_REQUESTED, 0 SUPERSEDED.
 *
 * Ce script :
 *  - N'AUTO-APPROUVE rien ;
 *  - NE SUPPRIME rien ;
 *  - NE MODIFIE le contenu d'aucun brief existant ;
 *  - conserve les versions et coûts existants (déjà immuables par trigger) ;
 *  - crée, pour chaque TeacherBrief existant sans tentative correspondante,
 *    UNE ligne TeacherBriefAttempt source=LEGACY_BACKFILL portant les
 *    métadonnées déjà connues (modèle, promptVersion, tokens, coût déjà
 *    enregistrés sur le brief lui-même) — reconstituée, jamais inventée.
 *  - N'INVENTE PAS l'historique des tentatives tombées en PLANCHER avant ce
 *    correctif (61 échecs constatés dans les logs applicatifs, non
 *    corrélables à un bilan précis sans identifiant — limite documentée
 *    dans ops/ADR, jamais comblée par une supposition).
 *
 * Idempotent : une exécution répétée ne crée jamais de doublon
 * (`WHERE NOT EXISTS` sur jobId=NULL + reportArtifactId + source=LEGACY_BACKFILL).
 *
 * Usage (jamais exécuté automatiquement, jamais contre la production sans
 * décision humaine explicite et une nouvelle preuve de restauration) :
 *   DATABASE_URL=... npx tsx scripts/bilans/backfill-teacher-brief-attempts.ts [--dry-run]
 */

import { prisma } from '@/lib/prisma';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const briefs = await prisma.teacherBrief.findMany({
    select: {
      id: true,
      reportArtifactId: true,
      scoreSnapshotId: true,
      status: true,
      model: true,
      promptVersion: true,
      promptTokens: true,
      cachedPromptTokens: true,
      completionTokens: true,
      estimatedCostUsd: true,
      generationMs: true,
      createdById: true,
      createdAt: true,
      reportArtifact: { select: { assessmentAttempt: { select: { subject: true, gradeLevel: true } } } },
    },
  });

  const existingLegacy = await prisma.teacherBriefAttempt.findMany({
    where: { source: 'LEGACY_BACKFILL' },
    select: { reportArtifactId: true },
  });
  const alreadyBackfilled = new Set(existingLegacy.map((row) => row.reportArtifactId));

  const toCreate = briefs.filter((brief) => !alreadyBackfilled.has(brief.reportArtifactId));

  console.info(JSON.stringify({
    event: 'TEACHER_BRIEF_BACKFILL_PLAN',
    totalBriefs: briefs.length,
    alreadyBackfilled: alreadyBackfilled.size,
    toCreate: toCreate.length,
    dryRun: DRY_RUN,
  }));

  if (DRY_RUN) return;

  for (const brief of toCreate) {
    await prisma.teacherBriefAttempt.create({
      data: {
        reportArtifactId: brief.reportArtifactId,
        expectedScoreSnapshotId: brief.scoreSnapshotId,
        jobId: null,
        subject: brief.reportArtifact.assessmentAttempt.subject,
        gradeLevel: brief.reportArtifact.assessmentAttempt.gradeLevel,
        actorId: brief.createdById,
        model: brief.model,
        promptVersion: brief.promptVersion,
        startedAt: brief.createdAt,
        finishedAt: brief.createdAt,
        result: 'GENERATED',
        causeCode: null,
        retryCount: 0,
        promptTokens: brief.promptTokens,
        cachedPromptTokens: brief.cachedPromptTokens,
        completionTokens: brief.completionTokens,
        estimatedCostUsd: brief.estimatedCostUsd,
        costUnknown: false,
        durationMs: brief.generationMs,
        domainsRequested: 0, // inconnu rétroactivement — jamais inventé (voir note ADR)
        domainsProcessed: 0,
        domainOutcomes: [],
        source: 'LEGACY_BACKFILL',
      },
    });
  }

  console.info(JSON.stringify({ event: 'TEACHER_BRIEF_BACKFILL_COMPLETED', created: toCreate.length }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: 'TEACHER_BRIEF_BACKFILL_FAILED', message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
