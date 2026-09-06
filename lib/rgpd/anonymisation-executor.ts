import { anonymiseParentPhoneCarriers, type PhonePrivacyDatabase } from './parent-phone-anonymisation';
import {
  ANONYMISATION_SCOPE,
  APPEND_ONLY_TABLES,
  TOMBSTONE,
  tombstoneEmail,
  validatePhoneChallengeProposal,
  type AnonymisationProposal,
  type CarrierTarget,
} from './anonymisation';

/**
 * Exécuteur de l'anonymisation. C'est la partie qui **écrit**.
 *
 * Trois refus, avant toute écriture. Une proposition qui contient un
 * rapprochement heuristique et n'a pas été confirmée par un humain est
 * rejetée : les orphelins se retrouvent par correspondance de nom ou d'adresse,
 * et l'opération est irréversible. Une cible appartenant à la chaîne
 * append-only est rejetée : elle est déjà pseudonyme, et l'écriture y serait de
 * toute façon refusée par ses triggers. Une proposition vide est rejetée : elle
 * signale un périmètre mal calculé, pas un sujet sans données.
 *
 * L'anonymisation est un `UPDATE` en place. Les lignes restent, ce qui préserve
 * l'intégrité référentielle et le squelette d'audit ; seules les valeurs
 * identifiantes sont remplacées, et les jetons mis à nul. Rien n'est supprimé
 * en base — seuls les fichiers le sont, au chemin canonique.
 */

export class AnonymisationRefused extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'AnonymisationRefused';
  }
}

export type AnonymisationClient = Readonly<{
  /** Mandatory for user/phone-challenge proposals; missing adapters fail before writes. */
  phonePrivacyDatabase?: PhonePrivacyDatabase;
  updateRow(input: Readonly<{
    table: string;
    rowId: string;
    values: Readonly<Record<string, string | null>>;
  }>): Promise<void>;
  deleteFile(absolutePath: string): Promise<void>;
  recordJournalEntry(entry: Readonly<{
    subjectRef: string;
    tables: readonly string[];
    rowCount: number;
    fileCount: number;
    confirmedBy: string;
    at: Date;
  }>): Promise<void>;
}>;

export type AnonymisationOutcome = Readonly<{
  rowsAnonymised: number;
  filesDeleted: number;
  tables: readonly string[];
}>;

function targetFor(table: string): CarrierTarget {
  const target = ANONYMISATION_SCOPE.find((carrier) => carrier.table === table);
  if (!target) throw new AnonymisationRefused(`TABLE_HORS_PERIMETRE:${table}`);
  return target;
}

/** Valeurs de remplacement d'une ligne : identités tombstonées, jetons annulés. */
export function tombstoneValues(
  target: CarrierTarget,
  subjectRef: string,
): Readonly<Record<string, string | null>> {
  const values: Record<string, string | null> = {};
  for (const column of target.identityColumns) {
    // Une adresse doit rester unique et syntaxiquement valide : deux sujets
    // anonymisés ne peuvent pas partager la même, sous peine de violer une
    // contrainte d'unicité au second effacement.
    values[column] = target.table === 'users' && column === 'phoneNormalized'
      ? null : /mail/i.test(column) ? tombstoneEmail(subjectRef) : TOMBSTONE;
  }
  for (const column of target.secretColumns ?? []) {
    values[column] = null;
  }
  return Object.freeze(values);
}

export async function executeAnonymisation(
  proposal: AnonymisationProposal,
  confirmation: Readonly<{ confirmedBy: string | null }>,
  client: AnonymisationClient,
  now: Date = new Date(),
): Promise<AnonymisationOutcome> {
  if (proposal.rows.length === 0 && proposal.files.length === 0) {
    throw new AnonymisationRefused('PROPOSITION_VIDE');
  }
  if (proposal.requiresHumanConfirmation && !confirmation.confirmedBy) {
    throw new AnonymisationRefused('CONFIRMATION_HUMAINE_REQUISE');
  }
  for (const row of proposal.rows) {
    if (APPEND_ONLY_TABLES.includes(row.table)) {
      throw new AnonymisationRefused(`APPEND_ONLY_INTOUCHABLE:${row.table}`);
    }
    // Valide le périmètre avant d'écrire quoi que ce soit : mieux vaut ne rien
    // faire que d'anonymiser à moitié.
    targetFor(row.table);
  }

  validatePhoneChallengeProposal(proposal.rows);
  const userIds = [...new Set(proposal.rows.filter(row => row.table === 'users').map(row => row.rowId))];
  const challengeIds = proposal.rows.filter(row => row.table === 'parent_phone_challenges').map(row => row.rowId);
  if ((userIds.length || challengeIds.length) && !client.phonePrivacyDatabase) {
    throw new AnonymisationRefused('PHONE_PRIVACY_ADAPTER_REQUIRED');
  }
  const phone = client.phonePrivacyDatabase && (userIds.length || challengeIds.length)
    ? await anonymiseParentPhoneCarriers(client.phonePrivacyDatabase, { userIds, challengeIds, now })
    : { challengesAnonymised: 0, outboxAnonymised: 0 };
  for (const row of proposal.rows) {
    // All challenges of the proposed users were erased atomically above,
    // including rows omitted from older proposals. Never erase their provenance.
    if (row.table === 'parent_phone_challenges') continue;
    await client.updateRow({
      table: row.table,
      rowId: row.rowId,
      values: tombstoneValues(targetFor(row.table), proposal.subjectRef),
    });
  }

  let filesDeleted = 0;
  for (const file of proposal.files) {
    await client.deleteFile(file);
    filesDeleted += 1;
  }

  const tables = [...new Set([...proposal.rows.map(row => row.table),
    ...(phone.challengesAnonymised ? ['parent_phone_challenges'] : []),
    ...(phone.outboxAnonymised ? ['canonical_job_outbox'] : []),
  ])].sort();
  const rowsAnonymised = proposal.rows.filter(row => row.table !== 'parent_phone_challenges').length
    + phone.challengesAnonymised + phone.outboxAnonymised;
  // Le journal consigne un fait, pas une personne : référence pseudonyme,
  // périmètre, et qui a confirmé.
  await client.recordJournalEntry({
    subjectRef: proposal.subjectRef,
    tables,
    rowCount: rowsAnonymised,
    fileCount: filesDeleted,
    confirmedBy: confirmation.confirmedBy ?? 'AUTOMATIQUE',
    at: now,
  });

  return Object.freeze({ rowsAnonymised, filesDeleted, tables });
}
