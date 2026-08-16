import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { computeNodeProfile } from '../facts/compute-facts';
import { ENGINE_VERSION } from '../facts/constants';
import { SEVERITY_RANK } from '../facts/constants';
import { buildFactSheet, type FactSheet } from '../facts/fact-sheet';
import type { ItemProfile, NodeProfile, NodeResult, ScoringOutput } from '../facts/types';
import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { advanceAttemptLifecycle } from '../core/report-service';
import { sha256Canonical } from '../local-first/hash';
import { buildDeterministicReports } from '../render/report';
import { buildPreRentreeStageLabel } from '../render/stage-label';
import { prepareReportPassationPresentation } from '../render/passation-presentation';
import type { RenderIdentity } from '../render/render-identity';
import { generateTeacherBrief, type GenerateBriefResult } from '../llm/teacher-brief-service';
import { requestTeacherBriefCorrection } from './teacher-brief-review-service';

/**
 * Régénération d'un bilan — décision responsable du 13/08/2026.
 *
 * Quand une règle d'agrégation ou un rendu évolue, l'assistante régénère
 * elle-même le bilan, sans intervention technique. La SOURCE est l'évidence
 * par item (append-only) — jamais le snapshot, qui porte les profils calculés
 * sous la règle de son époque. Le score n'est JAMAIS recalculé : le service
 * re-dérive les scores depuis l'évidence et STOPPE si le moindre écart
 * apparaît avec le snapshot (REGENERATION_SCORE_MISMATCH) — c'est le contrôle
 * qui garantit qu'on ne change que les profils et le rendu.
 *
 * Historique intégral conservé : l'ancienne révision et sa matérialisation
 * restent ; la nouvelle génération (colonne `generation`) arrive à côté, en
 * PENDING_REVIEW — validation humaine obligatoire avant toute re-diffusion.
 * Chaque régénération est tracée (canonical_report_regenerations, append-only).
 */

export const REGENERATION_SERVICE_VERSION = 'report-regeneration.v1' as const;

export class ReportRegenerationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ReportRegenerationError';
  }
}

const STAFF_ROLES = new Set(['ASSISTANTE', 'ADMIN']);

type RegenDatabase = Pick<
  PrismaClient,
  '$transaction' | 'reportRevision' | 'reportArtifact' | 'reportRegeneration'
  | 'evidenceItem' | 'canonicalAssessmentAttempt' | 'user' | 'notification'
  | 'reportReview' | 'teacherBrief' | 'scoreSnapshot'
>;

export type ProfileChange = Readonly<{
  kind: 'NODE' | 'DOMAIN';
  id: string;
  before: NodeProfile;
  after: NodeProfile;
}>;

export type RegenerationPreview = Readonly<{
  revisionId: string;
  reportArtifactId: string;
  generation: number;
  nextGeneration: number;
  engineVersionBefore: string;
  engineVersionAfter: string;
  artifactStatus: string;
  /** Date de dernière transmission WhatsApp confirmée — null si jamais transmis. */
  transmittedAt: Date | null;
  publishedAt: Date | null;
  changes: readonly ProfileChange[];
  profilesChanged: boolean;
  /** Un brief enseignant actif existe et sera régénéré (1 appel LLM). */
  briefWillRegenerate: boolean;
}>;

type EvidenceRow = Readonly<{
  itemId: string;
  nodeCpsId: string;
  weight: number;
  rawSuccess: number;
  isSuccess: boolean;
  isConfident: boolean;
  profile: ItemProfile;
  answered: boolean;
  elapsedMs: number;
}>;

function parseEvidence(payloads: readonly Prisma.JsonValue[]): readonly EvidenceRow[] {
  return payloads.map((payload) => {
    const row = payload as Record<string, unknown>;
    if (
      typeof row?.itemId !== 'string' || typeof row?.nodeCpsId !== 'string'
      || typeof row?.weight !== 'number' || typeof row?.rawSuccess !== 'number'
      || typeof row?.profile !== 'string'
    ) throw new ReportRegenerationError('REGENERATION_EVIDENCE_MALFORMED');
    return Object.freeze({
      itemId: row.itemId,
      nodeCpsId: row.nodeCpsId,
      weight: row.weight,
      rawSuccess: row.rawSuccess,
      isSuccess: row.isSuccess === true,
      isConfident: row.isConfident === true,
      profile: row.profile as ItemProfile,
      answered: row.answered === true,
      elapsedMs: typeof row.elapsedMs === 'number' ? row.elapsedMs : 0,
    });
  });
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Reconstruit les nœuds sous la règle COURANTE depuis l'évidence, en
 * re-dérivant les scores pour les confronter au snapshot (non-régression).
 */
function rebuildNodes(
  evidence: readonly EvidenceRow[],
  storedNodes: readonly NodeResult[],
): readonly NodeResult[] {
  const byNode = new Map<string, EvidenceRow[]>();
  for (const row of evidence) {
    const bucket = byNode.get(row.nodeCpsId) ?? [];
    bucket.push(row);
    byNode.set(row.nodeCpsId, bucket);
  }

  const rebuilt = storedNodes.map((stored) => {
    const rows = byNode.get(stored.nodeCpsId);
    if (rows === undefined) throw new ReportRegenerationError('REGENERATION_EVIDENCE_MISSING_NODE');
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const weighted = rows.reduce((sum, row) => sum + row.rawSuccess * row.weight, 0);
    const nodeScore = totalWeight === 0 ? 0 : round1((100 * weighted) / totalWeight);
    // LE contrôle : le score re-dérivé doit être identique au snapshot.
    // Tout écart signifierait qu'on ne régénère pas le même diagnostic → STOP.
    if (nodeScore !== stored.nodeScore) {
      throw new ReportRegenerationError('REGENERATION_SCORE_MISMATCH');
    }
    const mass: Record<ItemProfile, number> = {
      MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 0, NON_TRAITE: 0,
    };
    for (const row of rows) mass[row.profile] += row.weight;
    return {
      ...stored,
      profile: computeNodeProfile(mass),
    };
  });

  // Priorisation — spec §9, à l'identique du moteur (échelle unique).
  return rebuilt
    .slice()
    .sort((a, b) => {
      const sev = SEVERITY_RANK[b.profile] - SEVERITY_RANK[a.profile];
      if (sev !== 0) return sev;
      const crit = b.criticality - a.criticality;
      if (crit !== 0) return crit;
      const sc = a.nodeScore - b.nodeScore;
      if (sc !== 0) return sc;
      return a.nodeCpsId.localeCompare(b.nodeCpsId);
    })
    .map((node, index) => ({ ...node, priorityRank: index }));
}

function computeChanges(before: FactSheet, after: FactSheet): readonly ProfileChange[] {
  const changes: ProfileChange[] = [];
  const beforeNodes = new Map(before.nodes.map((node) => [node.nodeCpsId, node.profile]));
  for (const node of after.nodes) {
    const previous = beforeNodes.get(node.nodeCpsId);
    if (previous !== undefined && previous !== node.profile) {
      changes.push(Object.freeze({ kind: 'NODE' as const, id: node.nodeCpsId, before: previous, after: node.profile }));
    }
  }
  const beforeDomains = new Map(before.domains.map((domain) => [domain.id, domain.profile]));
  for (const domain of after.domains) {
    const previous = beforeDomains.get(domain.id);
    if (previous !== undefined && previous !== domain.profile) {
      changes.push(Object.freeze({ kind: 'DOMAIN' as const, id: domain.id, before: previous, after: domain.profile }));
    }
  }
  return Object.freeze(changes);
}

const revisionSelect = {
  id: true,
  status: true,
  generation: true,
  scoreSnapshotId: true,
  reportPackId: true,
  reportPackVersion: true,
  content: true,
  reportArtifact: {
    select: {
      id: true,
      status: true,
      publishedAt: true,
      studentId: true,
      assessmentAttemptId: true,
      assessmentAttempt: { select: { id: true, status: true, provenance: true, submittedAt: true } },
      transmissions: {
        select: { confirmedAt: true },
        where: { channel: 'WHATSAPP' },
        orderBy: { confirmedAt: 'desc' as const },
        take: 1,
      },
    },
  },
  scoreSnapshot: { select: { id: true, result: true } },
} as const;

type LoadedRevision = Prisma.ReportRevisionGetPayload<{ select: typeof revisionSelect }>;

async function loadForRegeneration(
  database: RegenDatabase,
  revisionId: string,
): Promise<Readonly<{
  revision: LoadedRevision;
  storedFactSheet: FactSheet;
  correctedFactSheet: FactSheet;
  changes: readonly ProfileChange[];
  enabled: NonNullable<ReturnType<PackResolver>>;
  maxGeneration: number;
}>> {
  const revision = await database.reportRevision.findUnique({
    where: { id: revisionId },
    select: revisionSelect,
  });
  if (revision === null) throw new ReportRegenerationError('REGENERATION_NOT_FOUND');
  // Une révision validée mais PAS ENCORE PUBLIÉE est en main de l'assistante :
  // publier ou rejeter d'abord — on ne régénère pas sous une validation en
  // vol. (Une révision publiée reste COACH_VALIDATED : c'est l'artefact qui
  // porte PUBLISHED — ce cas-là se régénère, avec confirmation délibérée.)
  if (revision.status === 'COACH_VALIDATED' && revision.reportArtifact.status !== 'PUBLISHED') {
    throw new ReportRegenerationError('REGENERATION_REVISION_LOCKED');
  }

  const enabled = resolveEnabledPack(revision.reportPackId, Number(revision.reportPackVersion));
  if (enabled === null) throw new ReportRegenerationError('REGENERATION_PACK_UNAVAILABLE');

  const storedFactSheet = revision.scoreSnapshot.result as unknown as FactSheet;

  const evidencePayloads = await database.evidenceItem.findMany({
    where: { scoreSnapshotId: revision.scoreSnapshotId, kind: 'ANSWER' },
    select: { payload: true },
    orderBy: { id: 'asc' },
  });
  if (evidencePayloads.length === 0) throw new ReportRegenerationError('REGENERATION_EVIDENCE_MISSING');
  const evidence = parseEvidence(evidencePayloads.map((row: { payload: Prisma.JsonValue }) => row.payload));

  const nodes = rebuildNodes(evidence, storedFactSheet.nodes);

  // FactSheet corrigée par l'UNIQUE chemin d'agrégation du moteur :
  // buildFactSheet re-dérive domaines (scores + pire nœud) depuis items+nodes.
  const scoringResult: ScoringOutput = Object.freeze({
    engineVersion: ENGINE_VERSION,
    globalScore: storedFactSheet.globalScore,
    coverage: storedFactSheet.coverage,
    calibrationIndex: storedFactSheet.calibrationIndex,
    flags: storedFactSheet.flags,
    groupBand: storedFactSheet.groupBand,
    items: evidence,
    nodes,
  }) as unknown as ScoringOutput;

  const correctedFactSheet = buildFactSheet(
    {
      slug: enabled.pack.slug,
      version: enabled.pack.version,
      scoring: enabled.pack.scoring,
      questionnaire: enabled.pack.questionnaire,
    } as never,
    { result: scoringResult, student: storedFactSheet.student },
  );

  // Non-régression sur les scores de domaines aussi : mêmes items, mêmes
  // poids → les scores re-dérivés doivent être identiques au snapshot.
  const storedDomainScores = new Map(storedFactSheet.domains.map((domain) => [domain.id, domain.score]));
  for (const domain of correctedFactSheet.domains) {
    if (storedDomainScores.get(domain.id) !== domain.score) {
      throw new ReportRegenerationError('REGENERATION_SCORE_MISMATCH');
    }
  }

  const aggregate = await database.reportRevision.aggregate({
    _max: { generation: true },
    where: { scoreSnapshotId: revision.scoreSnapshotId },
  });

  return Object.freeze({
    revision,
    storedFactSheet,
    correctedFactSheet,
    changes: computeChanges(storedFactSheet, correctedFactSheet),
    enabled,
    maxGeneration: aggregate._max.generation ?? 1,
  });
}

function assertStaff(actor: Readonly<{ userId: string; role: string }>): void {
  if (!STAFF_ROLES.has(actor.role) || !actor.userId.trim()) {
    throw new ReportRegenerationError('REGENERATION_FORBIDDEN');
  }
}

import {
  teacherBriefOperationsAreSuspended,
  TEACHER_BRIEF_SUSPENSION_CODE,
} from './teacher-brief-operations';

/** Aperçu lecture seule : ce qui changerait, et ce que la régénération coûte. */
export async function prepareReportRegeneration(input: Readonly<{
  prisma?: RegenDatabase;
  actor: Readonly<{ userId: string; role: string }>;
  revisionId: string;
}>): Promise<RegenerationPreview> {
  assertStaff(input.actor);
  const database: RegenDatabase = input.prisma ?? (prisma as unknown as RegenDatabase);
  const loaded = await loadForRegeneration(database, input.revisionId);

  const activeBrief = await database.teacherBrief.findFirst({
    where: {
      reportArtifactId: loaded.revision.reportArtifact.id,
      status: { in: ['PENDING_REVIEW', 'APPROVED'] },
    },
    orderBy: { version: 'desc' },
    select: { id: true },
  });

  const profilesChanged = loaded.changes.length > 0;
  const suspended = teacherBriefOperationsAreSuspended();
  return Object.freeze({
    revisionId: loaded.revision.id,
    reportArtifactId: loaded.revision.reportArtifact.id,
    generation: loaded.revision.generation,
    nextGeneration: loaded.maxGeneration + 1,
    engineVersionBefore: loaded.storedFactSheet.engineVersion,
    engineVersionAfter: ENGINE_VERSION,
    artifactStatus: loaded.revision.reportArtifact.status,
    transmittedAt: loaded.revision.reportArtifact.transmissions[0]?.confirmedAt ?? null,
    publishedAt: loaded.revision.reportArtifact.publishedAt,
    changes: loaded.changes,
    profilesChanged,
    briefWillRegenerate: !suspended && profilesChanged && activeBrief !== null,
  });
}

export type RegenerationResult = Readonly<{
  newRevisionId: string;
  generation: number;
  changes: readonly ProfileChange[];
  brief: Readonly<{ regenerated: boolean; reason: string | null }>;
}>;

/**
 * Exécute la régénération : nouvelle révision (génération N+1) en
 * PENDING_REVIEW, ancienne révision retirée de la file par un rejet TRACÉ
 * (ses annotations restent), trace append-only, brief LLM régénéré si les
 * profils ont changé (repli PLANCHER : jamais bloquant).
 */
export async function executeReportRegeneration(input: Readonly<{
  prisma?: RegenDatabase;
  actor: Readonly<{ userId: string; role: string }>;
  revisionId: string;
  motif: string;
  /** Obligatoire quand le bilan a déjà été diffusé : décision consciente. */
  confirmAlreadyPublished?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): Promise<RegenerationResult> {
  assertStaff(input.actor);
  const database: RegenDatabase = input.prisma ?? (prisma as unknown as RegenDatabase);
  const now = (input.now ?? (() => new Date()))();
  const motif = input.motif.trim();
  if (motif.length < 5) throw new ReportRegenerationError('REGENERATION_MOTIF_REQUIRED');

  const loaded = await loadForRegeneration(database, input.revisionId);
  const artifact = loaded.revision.reportArtifact;
  const wasPublished = artifact.status === 'PUBLISHED';
  if (wasPublished && input.confirmAlreadyPublished !== true) {
    // Ce bilan a été transmis à une famille : jamais de nouvelle version
    // sans décision consciente de l'assistante.
    throw new ReportRegenerationError('REGENERATION_CONFIRMATION_REQUIRED');
  }

  const attempt = artifact.assessmentAttempt;
  if (attempt.submittedAt === null) throw new ReportRegenerationError('REGENERATION_ATTEMPT_NOT_SUBMITTED');

  // Rendu PLANCHER déterministe — même recette que la génération d'origine.
  const presentation = prepareReportPassationPresentation(loaded.correctedFactSheet, attempt.provenance);
  const identity: RenderIdentity = Object.freeze({
    displayName: loaded.correctedFactSheet.student.alias,
    level: loaded.enabled.pack.level,
    subject: loaded.enabled.pack.subject,
    date: attempt.submittedAt.toISOString().slice(0, 10),
    stageLabel: buildPreRentreeStageLabel(loaded.enabled.pack.level, loaded.enabled.pack.subject),
    ...(presentation.durationMeasurement === undefined
      ? {}
      : { durationMeasurement: presentation.durationMeasurement }),
  });
  const content = buildDeterministicReports(presentation.factSheet, identity);

  const created = await database.$transaction(async (transaction) => {
    // 1. L'ancienne révision quitte la file de revue par un rejet TRACÉ.
    //    (Une révision CORRECTION_REQUESTED repasse d'abord par PENDING_REVIEW
    //    — transitions autorisées par le garde SQL ; ses annotations restent.)
    if (loaded.revision.status === 'CORRECTION_REQUESTED') {
      await transaction.reportRevision.update({
        where: { id: loaded.revision.id },
        data: { status: 'PENDING_REVIEW' },
      });
    }
    if (loaded.revision.status === 'PENDING_REVIEW' || loaded.revision.status === 'CORRECTION_REQUESTED') {
      await transaction.reportReview.create({
        data: {
          reportRevisionId: loaded.revision.id,
          reviewerId: input.actor.userId,
          decision: 'REJECTED',
          motif: `Remplacée par la génération ${loaded.maxGeneration + 1} — ${motif}`,
          reviewedAt: now,
        },
      });
      await transaction.reportRevision.update({
        where: { id: loaded.revision.id },
        data: { status: 'REJECTED' },
      });
    }

    // 2. Cycle de vie de l'attempt : un bilan publié repasse en revue par le
    //    chemin prévu de la machine à états (PUBLISHED → SCORED →
    //    REPORT_PENDING_REVIEW). L'artefact, lui, reste PUBLISHED : la famille
    //    garde l'ancienne version par son lien jusqu'à re-publication.
    if (attempt.status === 'PUBLISHED') {
      await advanceAttemptLifecycle(transaction, {
        attemptId: attempt.id,
        from: 'PUBLISHED',
        action: 'REQUEST_REGENERATION',
        actor: 'ASSISTANTE',
      });
      await advanceAttemptLifecycle(transaction, {
        attemptId: attempt.id,
        from: 'SCORED',
        action: 'REGENERATE_REPORT',
        actor: 'WORKER',
      });
    } else if (attempt.status !== 'REPORT_PENDING_REVIEW') {
      throw new ReportRegenerationError('REGENERATION_ATTEMPT_STATE');
    }

    // 3. Nouvelle génération, en revue.
    const revision = await transaction.reportRevision.create({
      data: {
        reportArtifactId: artifact.id,
        scoreSnapshotId: loaded.revision.scoreSnapshotId,
        status: 'PENDING_REVIEW',
        generation: loaded.maxGeneration + 1,
        reportPackId: loaded.revision.reportPackId,
        reportPackVersion: loaded.revision.reportPackVersion,
        corpusManifestId: 'disabled',
        corpusManifestVersion: '1',
        promptRevision: 'deterministic-no-agent-v1',
        contextChecksum: sha256Canonical(content),
        content: content as unknown as Prisma.InputJsonValue,
        validationFailures: [],
      },
      select: { id: true, generation: true },
    });
    return revision;
  });

  // 4. Brief enseignant : régénéré si les profils ont changé — un brief ancré
  //    sur un diagnostic obsolète ferait préparer la mauvaise séance. Repli
  //    PLANCHER : indisponible → le bilan est régénéré sans brief, jamais bloqué.
  let briefOutcome: Readonly<{ regenerated: boolean; reason: string | null; promptVersion: string | null; model: string | null }> =
    Object.freeze({ regenerated: false, reason: 'PROFILS_INCHANGES', promptVersion: null, model: null });
  if (loaded.changes.length > 0) {
    if (teacherBriefOperationsAreSuspended()) {
      briefOutcome = Object.freeze({
        regenerated: false,
        reason: TEACHER_BRIEF_SUSPENSION_CODE,
        promptVersion: null,
        model: null,
      });
    } else {
      const activeBrief = await database.teacherBrief.findFirst({
      where: { reportArtifactId: artifact.id, status: { in: ['PENDING_REVIEW', 'APPROVED'] } },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (activeBrief === null) {
      briefOutcome = Object.freeze({ regenerated: false, reason: 'AUCUN_BRIEF_ACTIF', promptVersion: null, model: null });
    } else {
      try {
        await requestTeacherBriefCorrection({
          actor: { userId: input.actor.userId, role: 'ASSISTANTE' },
          briefId: activeBrief.id,
          motif: `Profils régénérés (génération ${created.generation}) — ${motif}`,
          annotation: {
            section: 'autre',
            remark: 'Brief obsolète : les profils du bilan ont été régénérés sous la règle courante.',
          },
        });
        const result: GenerateBriefResult = await generateTeacherBrief({
          actor: { userId: input.actor.userId, role: 'ASSISTANTE' },
          reportArtifactId: artifact.id,
          environment: input.environment,
          fetchImpl: input.fetchImpl,
          now: input.now,
        });
        if (result.mode === 'GENERATED') {
          const generated = await database.teacherBrief.findUnique({
            where: { id: result.briefId },
            select: { promptVersion: true, model: true },
          });
          briefOutcome = Object.freeze({
            regenerated: true,
            reason: null,
            promptVersion: generated?.promptVersion ?? null,
            model: generated?.model ?? null,
          });
        } else {
          briefOutcome = Object.freeze({
            regenerated: false,
            reason: result.mode === 'PLANCHER' ? result.reason : result.mode,
            promptVersion: null,
            model: null,
          });
        }
      } catch {
        briefOutcome = Object.freeze({ regenerated: false, reason: 'BRIEF_REGENERATION_FAILED', promptVersion: null, model: null });
      }
    }
  }
  }

  // 5. Trace append-only — l'issue réelle du brief y figure.
  await database.reportRegeneration.create({
    data: {
      fromRevisionId: loaded.revision.id,
      toRevisionId: created.id,
      requestedById: input.actor.userId,
      motif,
      engineVersionBefore: loaded.storedFactSheet.engineVersion,
      engineVersionAfter: ENGINE_VERSION,
      briefRegenerated: briefOutcome.regenerated,
      briefPromptVersion: briefOutcome.promptVersion,
      briefModel: briefOutcome.model,
      profileDiff: loaded.changes as unknown as Prisma.InputJsonValue,
      wasPublished,
    },
  });

  return Object.freeze({
    newRevisionId: created.id,
    generation: created.generation,
    changes: loaded.changes,
    brief: Object.freeze({ regenerated: briefOutcome.regenerated, reason: briefOutcome.reason }),
  });
}
