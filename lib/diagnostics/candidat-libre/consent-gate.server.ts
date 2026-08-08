import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from './privacy-notice';

/**
 * Consentement bloquant du diagnostic candidat libre.
 *
 * L'étudiant est majeur : **c'est son consentement** qui autorise le
 * traitement de ses données. Aucune collecte — création de dossier, réponse à
 * un module, dépôt de document, enregistrement audio, soumission — ne commence
 * avant qu'il soit recueilli et courant.
 *
 * Le lien parental subsiste pour la structure et le provisionnement, mais
 * n'autorise rien : le parent ne consent plus à la place de l'étudiant, et ne
 * voit ses résultats que si l'étudiant l'a explicitement autorisé.
 *
 * Ce consentement est **spécifique au candidat libre**. Il ne réutilise pas
 * délibérément le rattachement parent-élève du bilan gratuit
 * (`canonical_parent_student_links`) : la notice décrit le diagnostic, le dépôt
 * de documents officiels et un enregistrement audio, trois traitements absents
 * du bilan gratuit. S'appuyer sur l'autre rattachement reviendrait à traiter
 * ces données sur la foi d'un consentement donné pour autre chose.
 *
 * Le consentement porte sur une **version de notice** précise : publier une
 * nouvelle version le périme et impose de le recueillir à nouveau. Il est
 * **retirable** à tout moment, et un retrait bloque immédiatement le
 * traitement.
 */

export const CONSENT_REQUIRED_CODE = 'CONSENT_REQUIRED' as const;

/** @deprecated Ancien nom, conservé le temps que les appelants migrent. */
export const PARENTAL_CONSENT_REQUIRED_CODE = CONSENT_REQUIRED_CODE;

export type CandidateDiagnosticConsentState =
  /** Consentement de l'étudiant courant. Seul état permissif. */
  | 'GRANTED'
  /** Aucun consentement enregistré pour cet étudiant. */
  | 'MISSING'
  /** L'étudiant a retiré son consentement : traitement bloqué, effacement à déclencher. */
  | 'WITHDRAWN'
  /** Consentement donné sur une version antérieure de la notice : à renouveler. */
  | 'OUTDATED_NOTICE';

/**
 * Lit l'état du consentement candidat libre pour un élève.
 *
 * Toute anomalie est rendue explicite plutôt que silencieuse, afin que
 * l'appelant refuse la collecte au lieu de la laisser passer par défaut.
 */
export async function getCandidateDiagnosticConsentState(
  studentId: string,
): Promise<CandidateDiagnosticConsentState> {
  const consent = await prisma.candidateDiagnosticConsent.findFirst({
    where: { studentId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: {
      noticeVersion: true,
      studentConsentedAt: true,
      withdrawnAt: true,
    },
  });

  // Seul le consentement de l'étudiant compte : il est majeur. Le lien parental
  // n'est plus consulté ici — il ne conditionne rien.
  if (!consent || consent.studentConsentedAt === null) return 'MISSING';
  if (consent.withdrawnAt !== null) return 'WITHDRAWN';
  if (consent.noticeVersion !== CANDIDATE_DIAGNOSTIC_NOTICE_VERSION) return 'OUTDATED_NOTICE';

  return 'GRANTED';
}

/**
 * Refuse la collecte tant que le consentement n'est pas `GRANTED`.
 *
 * Retourne `null` quand la collecte est autorisée, sinon la réponse 403 à
 * renvoyer telle quelle. Le refus est **fail-closed** : une erreur de lecture
 * bloque au lieu de laisser passer. Elle indique la version de notice
 * courante, pour que l'interface sache laquelle présenter.
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
      code: CONSENT_REQUIRED_CODE,
      consentState: state,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
      message:
        "Votre consentement, spécifique à ce diagnostic, doit être recueilli avant toute collecte de données.",
    },
    { status: 403 },
  );
}
