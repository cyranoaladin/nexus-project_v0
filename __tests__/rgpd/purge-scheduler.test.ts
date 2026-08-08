import { buildProposal } from '@/lib/rgpd/anonymisation';
import {
  planRetentionPurge,
  withdrawalInitiatesErasure,
  type PurgeCandidate,
} from '@/lib/rgpd/purge-scheduler';
import { recordStudentActivity, type ActivityRecorder } from '@/lib/rgpd/last-activity';

/**
 * Purge à échéance et retrait de consentement.
 *
 * Ce que ces tests protègent : qu'une tâche planifiée **n'efface jamais seule**
 * ce qu'un humain devrait trancher, et qu'un doute se règle toujours en
 * conservant. Conserver à tort se corrige ; effacer à tort, non.
 */

const FK_ROW = { table: 'users', rowId: 'u1', kind: 'FOREIGN_KEY' as const, heuristic: false };
const ORPHAN_ROW = {
  table: 'contact_leads', rowId: 'c1', kind: 'ORPHAN_MATCH' as const,
  heuristic: true, matchedOn: 'e-mail',
};

const NOW = new Date('2027-08-08T00:00:00Z');
const autoProposal = async () => buildProposal({ subjectRef: 's', rows: [FK_ROW], files: [] });
const orphanProposal = async () => buildProposal({ subjectRef: 's', rows: [FK_ROW, ORPHAN_ROW], files: [] });
const emptyProposal = async () => buildProposal({ subjectRef: 's', rows: [], files: [] });

function candidate(over: Partial<PurgeCandidate> = {}): PurgeCandidate {
  return {
    diagnosticId: 'd1',
    subjectRef: 's1',
    lastActivityAt: new Date('2026-08-08T00:00:00Z'),
    ...over,
  };
}

describe('planRetentionPurge', () => {
  it('retient un dossier dont l’échéance de douze mois est atteinte', async () => {
    const plan = await planRetentionPurge([candidate()], autoProposal, NOW);
    expect(plan.due).toHaveLength(1);
    expect(plan.due[0].route).toBe('AUTO');
  });

  it('écarte un dossier dont l’échéance n’est pas atteinte', async () => {
    const plan = await planRetentionPurge(
      [candidate({ lastActivityAt: new Date('2027-01-01T00:00:00Z') })], autoProposal, NOW,
    );
    expect(plan.due).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('ECHEANCE_NON_ATTEINTE');
  });

  /** Sans point de départ, la conservation ne se calcule pas : on ne devine pas. */
  it('écarte un dossier sans date d’activité', async () => {
    const plan = await planRetentionPurge([candidate({ lastActivityAt: null })], autoProposal, NOW);
    expect(plan.due).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('ACTIVITE_INCONNUE');
  });

  /** Le cœur : une tâche planifiée n'efface pas un homonyme toute seule. */
  it('route vers une revue humaine dès qu’un orphelin est en jeu', async () => {
    const plan = await planRetentionPurge([candidate()], orphanProposal, NOW);
    expect(plan.due[0].route).toBe('REVUE');
  });

  it('écarte un périmètre vide plutôt que de compter une purge fictive', async () => {
    const plan = await planRetentionPurge([candidate()], emptyProposal, NOW);
    expect(plan.due).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('PERIMETRE_VIDE');
  });

  it('explique chaque dossier écarté', async () => {
    const plan = await planRetentionPurge(
      [
        candidate({ diagnosticId: 'a', lastActivityAt: null }),
        candidate({ diagnosticId: 'b', lastActivityAt: new Date('2027-06-01T00:00:00Z') }),
      ],
      autoProposal, NOW,
    );
    expect(plan.skipped.map((s) => s.diagnosticId)).toEqual(['a', 'b']);
    expect(plan.skipped.every((s) => s.reason.length > 0)).toBe(true);
  });

  it('n’écrit rien : le plan est une décision, pas une action', async () => {
    const plan = await planRetentionPurge([candidate()], autoProposal, NOW);
    expect(Object.isFrozen(plan)).toBe(true);
  });
});

describe('retrait de consentement', () => {
  it('part en automatique quand tout est relié par clé étrangère', async () => {
    expect(withdrawalInitiatesErasure(await autoProposal())).toBe('AUTO');
  });

  /** Un retrait ne doit pas emporter les données d'un homonyme. */
  it('passe par une revue humaine dès qu’un orphelin est en jeu', async () => {
    expect(withdrawalInitiatesErasure(await orphanProposal())).toBe('REVUE');
  });
});

describe('enregistrement de l’activité', () => {
  it('horodate l’activité sur le dossier', async () => {
    const touched: { diagnosticId: string; at: Date }[] = [];
    const recorder: ActivityRecorder = { touch: async (i) => { touched.push(i); } };

    await recordStudentActivity(recorder, { diagnosticId: 'd1', activity: 'MODULE_RENSEIGNE' });
    expect(touched).toHaveLength(1);
    expect(touched[0].at).toBeInstanceOf(Date);
  });

  /**
   * Perdre un horodatage retarde une purge ; interrompre l'interaction
   * pénaliserait l'étudiant. Le sens sûr de l'erreur est de continuer.
   */
  it('n’interrompt jamais l’interaction si l’horodatage échoue', async () => {
    const recorder: ActivityRecorder = { touch: async () => { throw new Error('db down'); } };
    await expect(
      recordStudentActivity(recorder, { diagnosticId: 'd1', activity: 'DOSSIER_CONSULTE' }),
    ).resolves.toBeUndefined();
  });
});
