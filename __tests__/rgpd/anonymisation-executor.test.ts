import {
  AnonymisationRefused,
  executeAnonymisation,
  tombstoneValues,
  type AnonymisationClient,
} from '@/lib/rgpd/anonymisation-executor';
import { ANONYMISATION_SCOPE, TOMBSTONE, buildProposal } from '@/lib/rgpd/anonymisation';

/**
 * Exécuteur de l'anonymisation — la partie qui écrit.
 *
 * Ce que ces tests protègent : qu'on **n'écrive pas** quand il ne faut pas.
 * L'opération est irréversible, porte sur une personne réelle, et une erreur
 * de périmètre ne se rattrape pas après coup.
 */

function makeClient() {
  const updates: { table: string; rowId: string; values: Record<string, string | null> }[] = [];
  const deleted: string[] = [];
  const journal: unknown[] = [];
  const client: AnonymisationClient = {
    updateRow: async (input) => { updates.push(input as never); },
    deleteFile: async (p) => { deleted.push(p); },
    recordJournalEntry: async (e) => { journal.push(e); },
  };
  return { client, updates, deleted, journal };
}

const fkRow = { table: 'users', rowId: 'u1', kind: 'FOREIGN_KEY' as const, heuristic: false };
const orphanRow = {
  table: 'contact_leads', rowId: 'c1', kind: 'ORPHAN_MATCH' as const,
  heuristic: true, matchedOn: 'e-mail',
};

describe('refus avant écriture', () => {
  it('refuse une proposition heuristique non confirmée, sans rien écrire', async () => {
    const { client, updates, journal } = makeClient();
    const proposal = buildProposal({ subjectRef: 's1', rows: [fkRow, orphanRow], files: [] });

    await expect(executeAnonymisation(proposal, { confirmedBy: null }, client))
      .rejects.toThrow(/CONFIRMATION_HUMAINE_REQUISE/);
    expect(updates).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('accepte la même proposition une fois confirmée', async () => {
    const { client, updates } = makeClient();
    const proposal = buildProposal({ subjectRef: 's1', rows: [fkRow, orphanRow], files: [] });

    await executeAnonymisation(proposal, { confirmedBy: 'responsable' }, client);
    expect(updates).toHaveLength(2);
  });

  /** Elle est déjà pseudonyme, et ses triggers refuseraient de toute façon. */
  it('refuse toute cible appartenant à la chaîne append-only', async () => {
    const { client, updates } = makeClient();
    const proposal = buildProposal({
      subjectRef: 's1',
      rows: [{ table: 'canonical_report_revisions', rowId: 'r1', kind: 'FOREIGN_KEY', heuristic: false }],
      files: [],
    });

    await expect(executeAnonymisation(proposal, { confirmedBy: 'x' }, client))
      .rejects.toThrow(/APPEND_ONLY_INTOUCHABLE/);
    expect(updates).toEqual([]);
  });

  it('refuse une table hors périmètre', async () => {
    const { client, updates } = makeClient();
    const proposal = buildProposal({
      subjectRef: 's1',
      rows: [{ table: 'table_inconnue', rowId: 'x', kind: 'FOREIGN_KEY', heuristic: false }],
      files: [],
    });

    await expect(executeAnonymisation(proposal, { confirmedBy: 'x' }, client))
      .rejects.toThrow(/TABLE_HORS_PERIMETRE/);
    expect(updates).toEqual([]);
  });

  /** Un périmètre vide signale un calcul raté, pas un sujet sans données. */
  it('refuse une proposition vide', async () => {
    const { client } = makeClient();
    const proposal = buildProposal({ subjectRef: 's1', rows: [], files: [] });
    await expect(executeAnonymisation(proposal, { confirmedBy: 'x' }, client))
      .rejects.toThrow(/PROPOSITION_VIDE/);
  });

  /** Refuser après avoir écrit la moitié serait pire que refuser tout de suite. */
  it('n’écrit rien quand une seule ligne du lot est invalide', async () => {
    const { client, updates } = makeClient();
    const proposal = buildProposal({
      subjectRef: 's1',
      rows: [fkRow, { table: 'canonical_score_snapshots', rowId: 'z', kind: 'FOREIGN_KEY', heuristic: false }],
      files: [],
    });

    await expect(executeAnonymisation(proposal, { confirmedBy: 'x' }, client)).rejects.toThrow();
    expect(updates).toEqual([]);
  });
});

describe('valeurs de remplacement', () => {
  const users = ANONYMISATION_SCOPE.find((c) => c.table === 'users')!;

  it('tombstone les identités', () => {
    const values = tombstoneValues(users, 'sub_1');
    expect(values.firstName).toBe(TOMBSTONE);
    expect(values.lastName).toBe(TOMBSTONE);
  });

  /** Deux sujets anonymisés ne peuvent pas partager la même adresse. */
  it('donne une adresse unique et invalide par sujet', () => {
    expect(tombstoneValues(users, 'a').email).not.toBe(tombstoneValues(users, 'b').email);
    expect(String(tombstoneValues(users, 'a').email)).toMatch(/@invalid\.local$/);
  });

  it('annule les jetons plutôt que de les tombstoner', () => {
    const values = tombstoneValues(users, 'sub_1');
    expect(values.activationToken).toBeNull();
    expect(values.totpSecret).toBeNull();
    expect(values.password).toBeNull();
  });

  it('traite l’IP et l’empreinte de navigateur comme identifiantes', () => {
    const assessments = ANONYMISATION_SCOPE.find((c) => c.table === 'assessments')!;
    const values = tombstoneValues(assessments, 'sub_1');
    expect(values.ipAddress).toBe(TOMBSTONE);
    expect(values.userAgent).toBe(TOMBSTONE);
  });
});

describe('exécution', () => {
  it('anonymise, supprime les fichiers, et journalise', async () => {
    const { client, updates, deleted, journal } = makeClient();
    const proposal = buildProposal({
      subjectRef: 'sub_1',
      rows: [fkRow, { table: 'user_documents', rowId: 'd1', kind: 'FOREIGN_KEY', heuristic: false }],
      files: ['/var/www/nexus-shared/documents/a.pdf'],
    });

    const outcome = await executeAnonymisation(proposal, { confirmedBy: 'responsable' }, client);

    expect(outcome.rowsAnonymised).toBe(2);
    expect(outcome.filesDeleted).toBe(1);
    expect(updates.map((u) => u.table).sort()).toEqual(['user_documents', 'users']);
    expect(deleted).toEqual(['/var/www/nexus-shared/documents/a.pdf']);
    expect(journal).toHaveLength(1);
  });

  /** Le journal consigne un fait, pas une personne. */
  it('journalise sans rien d’identifiant', async () => {
    const { client, journal } = makeClient();
    const proposal = buildProposal({ subjectRef: 'sub_1', rows: [fkRow], files: [] });

    await executeAnonymisation(proposal, { confirmedBy: 'responsable' }, client);

    const entry = JSON.stringify(journal[0]);
    expect(entry).toContain('sub_1');
    expect(entry).toContain('responsable');
    expect(entry).not.toMatch(/@[a-z]+\.[a-z]{2,}/i);
  });

  it('note l’origine automatique quand aucune confirmation n’était requise', async () => {
    const { client, journal } = makeClient();
    const proposal = buildProposal({ subjectRef: 'sub_1', rows: [fkRow], files: [] });

    await executeAnonymisation(proposal, { confirmedBy: null }, client);
    expect((journal[0] as { confirmedBy: string }).confirmedBy).toBe('AUTOMATIQUE');
  });
});
