import { NextResponse } from 'next/server';

import { createParentStudentConsentContext } from '@/lib/bilans/parent-student-consent';
import { prisma } from '@/lib/prisma';

/**
 * Consentement parental bloquant du diagnostic candidat libre.
 *
 * Le dossier porte sur un mineur : aucune collecte — création de dossier,
 * réponse à un module, dépôt de document, questionnaire parent — ne doit
 * commencer avant que le consentement parental soit enregistré et vérifié.
 *
 * Ce module se branche sur le mécanisme canonique déjà en production pour le
 * bilan gratuit (`canonical_parent_student_links`, états
 * `PENDING_PARENT_CONSENT | VERIFIED | REVOKED | EXPIRED`) plutôt que d'en
 * introduire un second. Il ne crée ni ne modifie aucun lien : il lit l'état.
 * La création du lien et sa vérification restent la responsabilité du parcours
 * de consentement parent existant.
 *
 * Ne pas confondre avec la question `parent-22` du questionnaire parent, qui
 * autorise l'exploitation des réponses **du parent lui-même** et ne vaut en
 * aucun cas autorisation de traiter les données de l'enfant.
 */

export const PARENTAL_CONSENT_REQUIRED_CODE = 'PARENTAL_CONSENT_REQUIRED' as const;

export type CandidateDiagnosticConsentState =
  | 'VERIFIED'
  | 'PENDING_PARENT_CONSENT'
  | 'REVOKED'
  | 'EXPIRED'
  | 'MISSING'
  /** L'élève n'a aucun compte parent rattaché : personne ne peut consentir. */
  | 'NO_PARENT';

/**
 * Lit l'état du consentement parental canonique pour un élève.
 *
 * Toute anomalie (élève inconnu, parent absent) est rendue explicite plutôt que
 * silencieuse, afin que l'appelant refuse la collecte au lieu de la laisser
 * passer par défaut.
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

  return prisma.$transaction(async (transaction) => {
    const consent = createParentStudentConsentContext(transaction);
    const { state } = await consent.getStatus({
      parentUserId,
      studentId,
      now: new Date(),
    });
    return state;
  });
}

/**
 * Refuse la collecte tant que le consentement parental n'est pas `VERIFIED`.
 *
 * Retourne `null` quand la collecte est autorisée, sinon la réponse 403 à
 * renvoyer telle quelle. Le refus est **fail-closed** : une erreur de lecture
 * bloque au lieu de laisser passer, et la réponse ne divulgue jamais
 * l'identité du parent.
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

  if (state === 'VERIFIED') return null;

  return NextResponse.json(
    {
      error: 'Forbidden',
      code: PARENTAL_CONSENT_REQUIRED_CODE,
      consentState: state,
      message:
        "Le consentement parental doit être recueilli et vérifié avant toute collecte de données pour ce dossier.",
    },
    { status: 403 },
  );
}
