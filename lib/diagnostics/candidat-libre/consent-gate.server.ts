import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from './privacy-notice';

/**
 * Consentement parental bloquant du diagnostic candidat libre.
 *
 * Le dossier porte sur un mineur : aucune collecte — création de dossier,
 * réponse à un module, dépôt de document, enregistrement audio, soumission —
 * ne commence avant que le consentement parental soit recueilli et courant.
 *
 * Ce consentement est **spécifique au candidat libre**. Il ne réutilise pas
 * délibérément le rattachement parent-élève du bilan gratuit
 * (`canonical_parent_student_links`) : la notice décrit le diagnostic, le dépôt
 * de documents officiels et un enregistrement audio, trois traitements absents
 * du bilan gratuit. S'appuyer sur l'autre rattachement reviendrait à traiter
 * les données d'un mineur sur la foi d'un consentement donné pour autre chose.
 *
 * Le consentement porte sur une **version de notice** précise : publier une
 * nouvelle version le périme et impose de le recueillir à nouveau. Il est
 * **retirable** à tout moment, et un retrait bloque immédiatement le
 * traitement.
 */

export const PARENTAL_CONSENT_REQUIRED_CODE = 'PARENTAL_CONSENT_REQUIRED' as const;

export type CandidateDiagnosticConsentState =
  /** Consentement parental courant, assentiment élève recueilli. Seul état permissif. */
  | 'GRANTED'
  /** Aucun consentement enregistré pour cet élève, ou pas par le parent rattaché. */
  | 'MISSING'
  /** Le parent a retiré son consentement : traitement bloqué, effacement à déclencher. */
  | 'WITHDRAWN'
  /** Consentement donné sur une version antérieure de la notice : à renouveler. */
  | 'OUTDATED_NOTICE'
  /** Le parent a consenti, l'élève n'a pas encore donné son assentiment. */
  | 'STUDENT_ASSENT_MISSING'
  /** L'élève n'a aucun compte parent rattaché : personne ne peut consentir. */
  | 'NO_PARENT';

/**
 * Lit l'état du consentement candidat libre pour un élève.
 *
 * Toute anomalie est rendue explicite plutôt que silencieuse, afin que
 * l'appelant refuse la collecte au lieu de la laisser passer par défaut.
 */
export async function getCandidateDiagnosticConsentState(
  studentId: string,
): Promise<CandidateDiagnosticConsentState> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, parent: { select: { userId: true } } },
  });

  const parentUserId = student?.parent?.userId;
  if (!parentUserId) return 'NO_PARENT';

  const consent = await prisma.candidateDiagnosticConsent.findFirst({
    where: { studentId },
    orderBy: [{ parentConsentedAt: 'desc' }, { id: 'asc' }],
    select: {
      parentUserId: true,
      noticeVersion: true,
      studentAssentedAt: true,
      withdrawnAt: true,
    },
  });

  if (!consent) return 'MISSING';

  // Un consentement enregistré par quelqu'un d'autre que le parent actuellement
  // rattaché ne vaut pas autorisation : le titulaire de l'autorité parentale
  // peut avoir changé depuis.
  if (consent.parentUserId !== parentUserId) return 'MISSING';

  if (consent.withdrawnAt !== null) return 'WITHDRAWN';
  if (consent.noticeVersion !== CANDIDATE_DIAGNOSTIC_NOTICE_VERSION) return 'OUTDATED_NOTICE';
  if (consent.studentAssentedAt === null) return 'STUDENT_ASSENT_MISSING';

  return 'GRANTED';
}

/**
 * Refuse la collecte tant que le consentement n'est pas `GRANTED`.
 *
 * Retourne `null` quand la collecte est autorisée, sinon la réponse 403 à
 * renvoyer telle quelle. Le refus est **fail-closed** : une erreur de lecture
 * bloque au lieu de laisser passer, et la réponse ne divulgue jamais
 * l'identité du parent. Elle indique en revanche la version de notice courante,
 * pour que l'interface sache laquelle présenter.
 */
export async function requireVerifiedParentalConsent(
  studentId: string,
): Promise<NextResponse | null> {
  let state: CandidateDiagnosticConsentState;
  try {
    state = await getCandidateDiagnosticConsentState(studentId);
  } catch {
    state = 'MISSING';
  }

  if (state === 'GRANTED') return null;

  return NextResponse.json(
    {
      error: 'Forbidden',
      code: PARENTAL_CONSENT_REQUIRED_CODE,
      consentState: state,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
      message:
        "Le consentement parental, spécifique à ce diagnostic, doit être recueilli avant toute collecte de données.",
    },
    { status: 403 },
  );
}
