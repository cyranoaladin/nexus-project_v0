import 'server-only';

import { prisma } from '@/lib/prisma';

import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from './privacy-notice';

/**
 * Recueil du consentement candidat libre.
 *
 * La Phase 1 a posé le garde-fou qui **lit** le consentement ; ce module est le
 * seul à l'**écrire**. Concentrer l'écriture ici évite qu'un chemin détourné
 * enregistre un consentement sans en vérifier les conditions — ce qui s'était
 * précisément produit avec la question `parent-22`, enregistrée comme
 * consentement parental alors qu'elle ne portait que sur les réponses du parent.
 *
 * Trois règles, qu'aucun stockage ne garantit à lui seul :
 *
 * - le consentement émane du parent **actuellement** rattaché à l'élève, le
 *   titulaire de l'autorité parentale pouvant changer ;
 * - il porte la **version de notice réellement présentée**, faute de quoi il ne
 *   serait pas éclairé ;
 * - il est **retirable**, et le retrait bloque immédiatement tout traitement.
 *
 * Le retrait ne déclenche pas encore l'effacement des données déjà collectées :
 * ce branchement viendra avec le mécanisme d'effacement. C'est sans conséquence
 * tant que la fonctionnalité reste dark, aucune donnée réelle n'étant collectée.
 */

export class ConsentRecordingError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'ConsentRecordingError';
  }
}

type ConsentRow = Readonly<{
  id: string;
  studentId: string;
  parentUserId: string;
  noticeVersion: string;
  withdrawnAt: Date | null;
  studentAssentedAt?: Date | null;
}>;

/** Résout le parent actuellement rattaché, ou refuse. */
async function requireLinkedParent(studentId: string): Promise<string> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, parent: { select: { userId: true } } },
  });
  const parentUserId = student?.parent?.userId;
  if (!parentUserId) throw new ConsentRecordingError('NO_PARENT');
  return parentUserId;
}

async function currentConsent(studentId: string): Promise<ConsentRow | null> {
  return prisma.candidateDiagnosticConsent.findFirst({
    where: { studentId },
    orderBy: [{ parentConsentedAt: 'desc' }, { id: 'asc' }],
  }) as unknown as Promise<ConsentRow | null>;
}

/**
 * Enregistre le consentement parental pour la version de notice présentée.
 *
 * `diagnosticId` n'est fourni que lorsqu'un dossier existe déjà ; le
 * consentement précédant normalement sa création, la journalisation est alors
 * simplement omise faute d'entité à rattacher.
 */
export async function grantParentalConsent(input: Readonly<{
  studentId: string;
  parentUserId: string;
  noticeVersion: string;
  diagnosticId?: string;
}>): Promise<{ id: string }> {
  if (input.noticeVersion !== CANDIDATE_DIAGNOSTIC_NOTICE_VERSION) {
    throw new ConsentRecordingError('NOTICE_VERSION_MISMATCH');
  }

  const linkedParent = await requireLinkedParent(input.studentId);
  if (linkedParent !== input.parentUserId) {
    throw new ConsentRecordingError('NOT_THE_LINKED_PARENT');
  }

  const now = new Date();
  const consent = await prisma.candidateDiagnosticConsent.upsert({
    where: {
      studentId_noticeVersion: {
        studentId: input.studentId,
        noticeVersion: input.noticeVersion,
      },
    },
    create: {
      studentId: input.studentId,
      parentUserId: input.parentUserId,
      noticeVersion: input.noticeVersion,
      parentConsentedAt: now,
    },
    // Re-consentir après un retrait doit relever le blocage, sans effacer la
    // trace : `withdrawnAt` est remis à nul et l'horodatage rafraîchi.
    update: {
      parentUserId: input.parentUserId,
      parentConsentedAt: now,
      withdrawnAt: null,
      withdrawnReason: null,
    },
  });

  if (input.diagnosticId) {
    await prisma.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId: input.diagnosticId,
        actorId: input.parentUserId,
        actorRole: 'PARENT',
        action: 'PARENTAL_CONSENT_GRANTED',
        entityType: 'CandidateDiagnosticConsent',
        entityId: consent.id,
        details: { noticeVersion: input.noticeVersion },
      },
    });
  }

  return { id: consent.id };
}

/**
 * Enregistre l'assentiment de l'élève.
 *
 * Distinct du consentement parental et exigé en plus de lui : un mineur
 * participe, il ne subit pas. Il ne peut être recueilli que sur un consentement
 * parental courant — sans quoi on demanderait son accord à un enfant pour un
 * traitement que personne n'a autorisé.
 */
export async function recordStudentAssent(input: Readonly<{
  studentId: string;
  diagnosticId?: string;
}>): Promise<{ id: string }> {
  const consent = await currentConsent(input.studentId);
  if (!consent) throw new ConsentRecordingError('PARENTAL_CONSENT_REQUIRED');
  if (consent.withdrawnAt !== null) throw new ConsentRecordingError('CONSENT_WITHDRAWN');
  if (consent.noticeVersion !== CANDIDATE_DIAGNOSTIC_NOTICE_VERSION) {
    throw new ConsentRecordingError('NOTICE_VERSION_MISMATCH');
  }

  await prisma.candidateDiagnosticConsent.update({
    where: { id: consent.id },
    data: { studentAssentedAt: new Date() },
  });

  if (input.diagnosticId) {
    await prisma.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId: input.diagnosticId,
        actorRole: 'ELEVE',
        action: 'STUDENT_ASSENT_RECORDED',
        entityType: 'CandidateDiagnosticConsent',
        entityId: consent.id,
      },
    });
  }

  return { id: consent.id };
}

/**
 * Retire le consentement parental. Bloque immédiatement tout traitement.
 *
 * Idempotent : retirer un consentement déjà retiré ne réécrit pas la date, pour
 * que la trace du retrait initial reste exacte.
 */
export async function withdrawParentalConsent(input: Readonly<{
  studentId: string;
  parentUserId: string;
  reason?: string;
  diagnosticId?: string;
}>): Promise<{ id: string; withdrawnAt: Date }> {
  const linkedParent = await requireLinkedParent(input.studentId);
  if (linkedParent !== input.parentUserId) {
    throw new ConsentRecordingError('NOT_THE_LINKED_PARENT');
  }

  const consent = await currentConsent(input.studentId);
  if (!consent) throw new ConsentRecordingError('NO_CONSENT_TO_WITHDRAW');
  if (consent.withdrawnAt !== null) {
    return { id: consent.id, withdrawnAt: consent.withdrawnAt };
  }

  const now = new Date();
  await prisma.candidateDiagnosticConsent.update({
    where: { id: consent.id },
    data: { withdrawnAt: now, withdrawnReason: input.reason ?? null },
  });

  if (input.diagnosticId) {
    await prisma.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId: input.diagnosticId,
        actorId: input.parentUserId,
        actorRole: 'PARENT',
        action: 'PARENTAL_CONSENT_WITHDRAWN',
        entityType: 'CandidateDiagnosticConsent',
        entityId: consent.id,
      },
    });
  }

  return { id: consent.id, withdrawnAt: now };
}
