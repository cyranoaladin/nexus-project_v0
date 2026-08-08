import { RETENTION_MONTHS_AFTER_LAST_ACTIVITY } from '@/lib/diagnostics/candidat-libre/privacy-notice';

import { isRetentionExpired, type AnonymisationProposal } from './anonymisation';

/**
 * Purge à échéance : douze mois après la dernière activité de l'étudiant.
 *
 * La notice promet une suppression ou une anonymisation automatique à ce terme.
 * Cette tâche l'applique — mais elle n'anonymise pas tout elle-même : ce qui est
 * relié au sujet par une clé étrangère part automatiquement, tandis que les
 * porteurs **orphelins**, retrouvés par correspondance de nom ou d'adresse,
 * rejoignent une file de revue. Un homonyme effacé par une tâche planifiée
 * serait une faute qu'aucune promesse de purge ne justifie.
 *
 * Elle **échoue fermé** de bout en bout : dossier sans date d'activité, échéance
 * non atteinte, proposition vide — dans le doute, on ne purge pas. Conserver à
 * tort se corrige ; effacer à tort, non.
 */

export type PurgeCandidate = Readonly<{
  diagnosticId: string;
  subjectRef: string;
  lastActivityAt: Date | null;
}>;

export type PurgeDecision = Readonly<{
  diagnosticId: string;
  subjectRef: string;
  /** `AUTO` : tout est relié par clé étrangère. `REVUE` : un orphelin exige un humain. */
  route: 'AUTO' | 'REVUE';
}>;

export type PurgePlan = Readonly<{
  due: readonly PurgeDecision[];
  /** Dossiers écartés, avec le motif — pour qu'une purge qui ne part pas s'explique. */
  skipped: readonly Readonly<{ diagnosticId: string; reason: string }>[];
}>;

/**
 * Établit le plan de purge. N'écrit rien : c'est une décision, pas une action.
 *
 * @param buildProposalFor Calcule le périmètre d'un sujet, pour savoir si un
 *   rapprochement heuristique impose une revue humaine.
 */
export async function planRetentionPurge(
  candidates: readonly PurgeCandidate[],
  buildProposalFor: (subjectRef: string) => Promise<AnonymisationProposal>,
  now: Date = new Date(),
  months: number = RETENTION_MONTHS_AFTER_LAST_ACTIVITY,
): Promise<PurgePlan> {
  const due: PurgeDecision[] = [];
  const skipped: { diagnosticId: string; reason: string }[] = [];

  for (const candidate of candidates) {
    if (!candidate.lastActivityAt) {
      // Sans date, la conservation n'a pas de point de départ : on ne devine pas.
      skipped.push({ diagnosticId: candidate.diagnosticId, reason: 'ACTIVITE_INCONNUE' });
      continue;
    }
    if (!isRetentionExpired(candidate.lastActivityAt, months, now)) {
      skipped.push({ diagnosticId: candidate.diagnosticId, reason: 'ECHEANCE_NON_ATTEINTE' });
      continue;
    }

    const proposal = await buildProposalFor(candidate.subjectRef);
    if (proposal.rows.length === 0 && proposal.files.length === 0) {
      // Rien à anonymiser : le signaler plutôt que de compter une purge fictive.
      skipped.push({ diagnosticId: candidate.diagnosticId, reason: 'PERIMETRE_VIDE' });
      continue;
    }

    due.push({
      diagnosticId: candidate.diagnosticId,
      subjectRef: candidate.subjectRef,
      route: proposal.requiresHumanConfirmation ? 'REVUE' : 'AUTO',
    });
  }

  return Object.freeze({ due: Object.freeze(due), skipped: Object.freeze(skipped) });
}

/**
 * Effet d'un retrait de consentement.
 *
 * Le blocage du traitement est immédiat — il est porté par le garde-fou, qui
 * refuse dès que l'état passe à `WITHDRAWN`. L'effacement, lui, **n'est pas
 * immédiat** : il entre dans le même circuit que la purge, avec revue humaine
 * si des orphelins sont en jeu. C'est ce que la notice promet, et ce qui évite
 * qu'un retrait emporte les données d'un homonyme.
 */
export function withdrawalInitiatesErasure(
  proposal: AnonymisationProposal,
): PurgeDecision['route'] {
  return proposal.requiresHumanConfirmation ? 'REVUE' : 'AUTO';
}
