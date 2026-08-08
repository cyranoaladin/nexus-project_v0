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
  studentConsentedAt: Date | null;
  parentAccessAuthorizedAt: Date | null;
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
export async function grantStudentConsent(input: Readonly<{
  studentId: string;
  noticeVersion: string;
  diagnosticId?: string;
}>): Promise<{ id: string }> {
  if (input.noticeVersion !== CANDIDATE_DIAGNOSTIC_NOTICE_VERSION) {
    throw new ConsentRecordingError('NOTICE_VERSION_MISMATCH');
  }

  // Le parent rattaché est enregistré pour la structure, mais il n'autorise
  // rien : c'est l'étudiant, majeur, qui consent pour lui-même.
  const linkedParent = await requireLinkedParent(input.studentId);

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
      parentUserId: linkedParent,
      noticeVersion: input.noticeVersion,
      studentConsentedAt: now,
    },
    // Re-consentir après un retrait doit relever le blocage, sans effacer la
    // trace : `withdrawnAt` est remis à nul et l'horodatage rafraîchi.
    update: {
      studentConsentedAt: now,
      withdrawnAt: null,
      withdrawnReason: null,
    },
  });

  if (input.diagnosticId) {
    await prisma.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId: input.diagnosticId,
        actorRole: 'ELEVE',
        action: 'STUDENT_CONSENT_GRANTED',
        entityType: 'CandidateDiagnosticConsent',
        entityId: consent.id,
        details: { noticeVersion: input.noticeVersion },
      },
    });
  }

  return { id: consent.id };
}

/**
 * Autorise, ou révoque, la consultation des résultats par le parent rattaché.
 *
 * **Rien n'est partagé par défaut.** L'étudiant est majeur : ses documents
 * d'identité, son enregistrement audio et le jugement de faisabilité qui le
 * concerne ne regardent que lui. Le lien parental existe pour la structure du
 * dossier, pas pour donner à voir. C'est donc un geste explicite de l'étudiant
 * qui ouvre l'accès — et le même geste, inversé, qui le referme.
 */
export async function setParentAccessAuthorization(input: Readonly<{
  studentId: string;
  authorized: boolean;
  diagnosticId?: string;
}>): Promise<{ id: string; parentAccessAuthorizedAt: Date | null }> {
  const consent = await currentConsent(input.studentId);
  if (!consent) throw new ConsentRecordingError('CONSENT_REQUIRED');
  if (consent.withdrawnAt !== null) throw new ConsentRecordingError('CONSENT_WITHDRAWN');

  const parentAccessAuthorizedAt = input.authorized ? new Date() : null;
  await prisma.candidateDiagnosticConsent.update({
    where: { id: consent.id },
    data: { parentAccessAuthorizedAt },
  });

  if (input.diagnosticId) {
    await prisma.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId: input.diagnosticId,
        actorRole: 'ELEVE',
        action: input.authorized ? 'PARENT_ACCESS_AUTHORIZED' : 'PARENT_ACCESS_REVOKED',
        entityType: 'CandidateDiagnosticConsent',
        entityId: consent.id,
      },
    });
  }

  return { id: consent.id, parentAccessAuthorizedAt };
}

/**
 * Le parent rattaché est-il autorisé à consulter les résultats ?
 *
 * Fermé par défaut : sans autorisation explicite et courante de l'étudiant, la
 * réponse est non.
 */
export async function isParentAccessAuthorized(studentId: string): Promise<boolean> {
  const consent = await currentConsent(studentId);
  return Boolean(consent && consent.withdrawnAt === null && consent.parentAccessAuthorizedAt);
}

/**
 * Retire le consentement de l'étudiant. Bloque immédiatement tout traitement.
 *
 * Idempotent : retirer un consentement déjà retiré ne réécrit pas la date, pour
 * que la trace du retrait initial reste exacte.
 */
export async function withdrawStudentConsent(input: Readonly<{
  studentId: string;
  reason?: string;
  diagnosticId?: string;
}>): Promise<{ id: string; withdrawnAt: Date }> {
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
        actorRole: 'ELEVE',
        action: 'STUDENT_CONSENT_WITHDRAWN',
        entityType: 'CandidateDiagnosticConsent',
        entityId: consent.id,
      },
    });
  }

  return { id: consent.id, withdrawnAt: now };
}
