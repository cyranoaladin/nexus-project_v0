/**
 * ARIA Exam Context — adapter READ-ONLY vers le catalogue d'examen.
 *
 * ARIA ne recrée AUCUNE réglementation du baccalauréat. Ce module se contente
 * de projeter, sans la réinterpréter, la politique d'examen déjà validée par
 * `lib/exams/catalog.ts` (elle-même adossée à `data/exams/*.json` et à son
 * schéma Zod).
 *
 * Si aucune donnée d'examen ne s'applique à l'élève, ce module retourne `null`
 * et le cockpit n'affiche rien — plutôt qu'un contenu réglementaire inventé.
 */

import 'server-only';

import type { AriaExamContextDTO } from '@/lib/aria/contracts';
import { getExamPolicy, getSupportedSessions } from '@/lib/exams/catalog';

/** Sessions d'examen réellement couvertes par le catalogue. */
export function listSupportedExamSessions(): readonly number[] {
  return getSupportedSessions();
}

/** `true` si le catalogue couvre réellement cette session. */
export function isSupportedExamSession(session: number): boolean {
  return getSupportedSessions().includes(session);
}

/**
 * Contexte d'examen d'un élève, ou `null` si aucune session cible n'est
 * définie. Une session cible non couverte par le catalogue est signalée
 * (`supported: false`) sans épreuves : on n'invente pas un programme d'examen.
 */
export function buildAriaExamContext(targetSession: number | null): AriaExamContextDTO | null {
  if (targetSession === null) return null;

  const policy = getExamPolicy(targetSession);
  if (!policy) {
    return { targetSession, supported: false, epreuves: [] };
  }

  return {
    targetSession,
    supported: true,
    epreuves: policy.epreuves.map((epreuve) => ({
      id: epreuve.id,
      label: epreuve.label,
      type: epreuve.type,
      coefficient: epreuve.coefficient ?? null,
    })),
  };
}
