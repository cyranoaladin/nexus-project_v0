import {
  ANONYMISATION_SCOPE,
  APPEND_ONLY_TABLES,
  TOMBSTONE,
  buildProposal,
  isRetentionExpired,
  retentionDueDate,
  tombstoneEmail,
} from '@/lib/rgpd/anonymisation';
import { RETENTION_MONTHS_AFTER_LAST_ACTIVITY } from '@/lib/diagnostics/candidat-libre/privacy-notice';

/**
 * Effacement RGPD.
 *
 * Trois propriétés que le reste du mécanisme suppose acquises :
 *
 * - la chaîne append-only n'est **jamais** touchée — elle est déjà pseudonyme,
 *   et la moindre écriture y serait de toute façon rejetée par ses triggers ;
 * - les porteurs **orphelins**, sans clé étrangère vers le sujet, figurent bien
 *   au périmètre : une routine indexée sur l'identifiant les manquerait tous ;
 * - un rapprochement **heuristique** n'est jamais appliqué sans confirmation.
 */

describe('périmètre d’anonymisation', () => {
  it('ne contient aucune table append-only', () => {
    const scoped = ANONYMISATION_SCOPE.map((c) => c.table);
    for (const table of APPEND_ONLY_TABLES) {
      expect(scoped).not.toContain(table);
    }
  });

  it('couvre les porteurs reliés par clé étrangère', () => {
    const fk = ANONYMISATION_SCOPE.filter((c) => c.kind === 'FOREIGN_KEY').map((c) => c.table);
    expect(fk).toEqual(expect.arrayContaining(['users', 'students', 'parent_profiles', 'user_documents']));
  });

  /** Ceux-là sont invisibles à un parcours de clés étrangères : les manquer, c'est manquer l'effacement. */
  it('couvre les porteurs orphelins établis par l’audit', () => {
    const orphans = ANONYMISATION_SCOPE.filter((c) => c.kind === 'ORPHAN_MATCH').map((c) => c.table);
    expect(orphans).toEqual(expect.arrayContaining([
      'assessments', 'bilans', 'contact_leads', 'stage_reservations', 'invoices',
    ]));
  });

  it('purge les jetons, pas seulement les identités', () => {
    const withSecrets = ANONYMISATION_SCOPE.filter((c) => c.secretColumns?.length);
    expect(withSecrets.map((c) => c.table)).toEqual(
      expect.arrayContaining(['users', 'stage_reservations']),
    );
    const users = ANONYMISATION_SCOPE.find((c) => c.table === 'users');
    expect(users?.secretColumns).toEqual(expect.arrayContaining(['activationToken', 'totpSecret']));
  });

  it('vise l’adresse IP et l’empreinte de navigateur, qui identifient aussi', () => {
    const assessments = ANONYMISATION_SCOPE.find((c) => c.table === 'assessments');
    expect(assessments?.identityColumns).toEqual(expect.arrayContaining(['ipAddress', 'userAgent']));
  });
});

describe('tombstone', () => {
  it('remplace par une valeur reconnaissable', () => {
    expect(TOMBSTONE).toBe('[anonymisé]');
  });

  /** Une adresse unique par sujet : sinon la seconde anonymisation violerait l'unicité. */
  it('produit une adresse unique et invalide par sujet', () => {
    const a = tombstoneEmail('sub_a');
    const b = tombstoneEmail('sub_b');
    expect(a).not.toBe(b);
    expect(a).toMatch(/@invalid\.local$/);
  });
});

describe('proposition', () => {
  const fkRow = { table: 'users', rowId: 'u1', kind: 'FOREIGN_KEY' as const, heuristic: false };
  const orphanRow = {
    table: 'contact_leads', rowId: 'c1', kind: 'ORPHAN_MATCH' as const,
    heuristic: true, matchedOn: 'e-mail',
  };

  it('n’exige pas de confirmation quand tout est relié par clé étrangère', () => {
    const proposal = buildProposal({ subjectRef: 's1', rows: [fkRow], files: [] });
    expect(proposal.requiresHumanConfirmation).toBe(false);
  });

  /** Homonymes, adresse familiale partagée : un humain doit trancher. */
  it('exige une confirmation dès qu’un rapprochement est heuristique', () => {
    const proposal = buildProposal({ subjectRef: 's1', rows: [fkRow, orphanRow], files: [] });
    expect(proposal.requiresHumanConfirmation).toBe(true);
  });

  it('expose ce qui a permis le rapprochement, pour que l’humain juge', () => {
    const proposal = buildProposal({ subjectRef: 's1', rows: [orphanRow], files: [] });
    expect(proposal.rows[0].matchedOn).toBe('e-mail');
  });

  it('n’écrit rien : la proposition est un document, pas une action', () => {
    const proposal = buildProposal({ subjectRef: 's1', rows: [fkRow], files: ['/x/y.pdf'] });
    expect(proposal.rows).toHaveLength(1);
    expect(proposal.files).toEqual(['/x/y.pdf']);
    expect(Object.isFrozen(proposal)).toBe(true);
  });
});

describe('conservation — douze mois après la dernière activité', () => {
  const MONTHS = RETENTION_MONTHS_AFTER_LAST_ACTIVITY;

  it('reprend la durée fixée par la notice', () => {
    expect(MONTHS).toBe(12);
  });

  it('calcule l’échéance à douze mois', () => {
    expect(retentionDueDate(new Date('2026-08-08T00:00:00Z'), MONTHS).toISOString())
      .toBe('2027-08-08T00:00:00.000Z');
  });

  it('n’est pas échue la veille', () => {
    expect(isRetentionExpired(
      new Date('2026-08-08T00:00:00Z'), MONTHS, new Date('2027-08-07T00:00:00Z'),
    )).toBe(false);
  });

  it('est échue le jour même', () => {
    expect(isRetentionExpired(
      new Date('2026-08-08T00:00:00Z'), MONTHS, new Date('2027-08-08T00:00:00Z'),
    )).toBe(true);
  });

  it('repousse l’échéance à chaque nouvelle activité', () => {
    const now = new Date('2027-08-08T00:00:00Z');
    expect(isRetentionExpired(new Date('2026-08-08T00:00:00Z'), MONTHS, now)).toBe(true);
    expect(isRetentionExpired(new Date('2027-01-01T00:00:00Z'), MONTHS, now)).toBe(false);
  });

  /** Sans date connue, conserver à tort vaut mieux qu'effacer à tort. */
  it('ne purge pas quand la dernière activité est inconnue', () => {
    expect(isRetentionExpired(null, MONTHS, new Date('2099-01-01T00:00:00Z'))).toBe(false);
  });
});
