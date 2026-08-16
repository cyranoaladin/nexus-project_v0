import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Met en file UNE tentative de génération de brief enseignant (§10 de
 * l'incident P0) — jamais d'appel LLM synchrone dans une requête HTTP.
 *
 * Idempotence par construction : `idempotencyKey` est dérivé de
 * (reportArtifactId, scoreSnapshotId courant) et porte une contrainte UNIQUE
 * en base (`canonical_job_outbox_idempotencyKey_key`) — un double clic, deux
 * onglets, ou un rappel après un bilan déjà en file produisent tous
 * `ON CONFLICT DO NOTHING` : aucun second job, aucun effet de bord.
 */

type EnqueueDatabase = Pick<PrismaClient, '$executeRaw'>;

export async function enqueueTeacherBriefGeneration(
  reportArtifactId: string,
  expectedScoreSnapshotId: string,
  actorId: string,
  database: EnqueueDatabase = prisma,
): Promise<void> {
  const idempotencyKey = `teacher-brief:${reportArtifactId}:${expectedScoreSnapshotId}`;
  // `actorId` voyage dans le payload : le worker n'a pas de session, mais
  // "l'acteur demandeur" (§7) reste l'assistante qui a cliqué "Générer" —
  // jamais un identifiant système inventé (FK réelle vers `users`).
  const payload = JSON.stringify({ reportArtifactId, expectedScoreSnapshotId, actorId });
  await database.$executeRaw(Prisma.sql`
    INSERT INTO "canonical_job_outbox" (
      "id", "jobType", "aggregateType", "aggregateId", "sourceEventKey", "idempotencyKey", "payload", "updatedAt"
    ) VALUES (
      ${randomUUID()},
      'GENERATE_TEACHER_BRIEF'::"CanonicalJobType",
      'TeacherBrief', ${reportArtifactId}, ${idempotencyKey}, ${idempotencyKey}, ${payload}::jsonb, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("idempotencyKey") DO NOTHING
  `);
}
