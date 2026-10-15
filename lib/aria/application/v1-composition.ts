/**
 * Racine de composition ARIA pour les routes V1 : câble l'infrastructure (dépôts Prisma,
 * verrou du sujet V1, flux du modèle) sur la transaction de session V1 fournie par la route.
 * Les routes n'importent que ce module de la couche application, jamais l'infrastructure
 * (frontière H001, __tests__/architecture/aria-application-boundary.test.ts).
 */
import type { Prisma } from '@prisma/client';
import { lockV1AriaSubject } from '../infrastructure/prisma/actor-authority';
import { makePrismaActivityRepository } from '../infrastructure/prisma/activity-repository';
import { makePrismaAriaFeedbackRepository } from '../infrastructure/prisma/feedback-repository';
import { makePrismaAriaProfileRepository } from '../infrastructure/prisma/profile-repository';
import { makePrismaLearningEvidenceRepository } from '../infrastructure/prisma/learning-evidence-repository';
import { makeRecordLearningEvidence } from './evidence/record';
import { streamChatCompletion } from '../gateway';

type Tx = Prisma.TransactionClient;

/** Verrouille (FOR SHARE) l'élève V1 et, si `commercial`, ses droits ARIA, pour la durée de la transaction. */
export function lockAriaV1Subject(tx: Tx, userId: string, commercial: boolean): Promise<void> {
  return lockV1AriaSubject(tx, userId, commercial);
}

export const ariaActivityRepository = (tx: Tx) => makePrismaActivityRepository(tx);
export const ariaFeedbackRepository = (tx: Tx) => makePrismaAriaFeedbackRepository(tx);
export const ariaProfileRepository = (tx: Tx) => makePrismaAriaProfileRepository(tx);
export const ariaLearningEvidenceRecorder = (tx: Tx) => makeRecordLearningEvidence(makePrismaLearningEvidenceRepository(tx));

/** Flux du modèle de correction, injecté dans le cas d'usage de correction. */
export const ariaModelCompletionStream = streamChatCompletion;
