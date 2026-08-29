/**
 * Correspondance historique `Student.specialties` → inscriptions.
 *
 * SOURCE UNIQUE. Le SQL de migration comme le script de pré-vol en dérivent :
 * il ne doit exister aucune seconde table de correspondance, ni en SQL, ni en
 * TypeScript.
 *
 * Cette correspondance n'est PAS déductible de `legacySubject` dans le
 * catalogue : un même `legacySubject` peut désigner plusieurs cours (en
 * terminale, `MATHEMATIQUES` correspond aussi bien à la spécialité qu'à
 * l'option Mathématiques complémentaires ou au module technologique). Seule la
 * sémantique historique de l'ancien champ tranche.
 */

import rawMapping from '@/data/curriculum/v1/legacy-specialties-migration.json';

export type LegacyClassification =
  | 'MIGRATED_CHOICE'
  | 'REDUNDANT_LEGACY_CORE'
  | 'UNRESOLVED';

export interface LegacyMappingEntry {
  readonly gradeLevel: string;
  readonly legacySubject: string;
  readonly classification: Exclude<LegacyClassification, 'UNRESOLVED'>;
  readonly courseKey?: string;
  readonly kind?: 'SPECIALTY' | 'OPTION';
  readonly note?: string;
}

interface LegacyMappingFile {
  version: string;
  description: string;
  rationale: string;
  defaultClassification: 'UNRESOLVED';
  defaultRationale: string;
  entries: LegacyMappingEntry[];
}

const mapping = rawMapping as unknown as LegacyMappingFile;

// Invariants vérifiés au chargement : une correspondance incohérente ici
// produirait une migration destructive incohérente.
const seen = new Set<string>();
for (const entry of mapping.entries) {
  const key = `${entry.gradeLevel}|${entry.legacySubject}`;
  if (seen.has(key)) {
    throw new Error(`Correspondance héritée dupliquée : ${key}`);
  }
  seen.add(key);

  if (entry.classification === 'MIGRATED_CHOICE') {
    if (!entry.courseKey || !entry.kind) {
      throw new Error(`Correspondance héritée incomplète pour ${key}`);
    }
  } else if (entry.courseKey || entry.kind) {
    throw new Error(`Correspondance héritée non-choix portant un cours : ${key}`);
  }
}

export const LEGACY_MAPPING_VERSION = mapping.version;

export function listLegacyMappingEntries(): readonly LegacyMappingEntry[] {
  return mapping.entries;
}

/** Entrées produisant réellement une inscription, dans un ordre stable. */
export function listMigratedChoices(): readonly Required<
  Pick<LegacyMappingEntry, 'gradeLevel' | 'legacySubject' | 'courseKey' | 'kind'>
>[] {
  return mapping.entries
    .filter((entry) => entry.classification === 'MIGRATED_CHOICE')
    .map((entry) => ({
      gradeLevel: entry.gradeLevel,
      legacySubject: entry.legacySubject,
      courseKey: entry.courseKey!,
      kind: entry.kind!,
    }))
    .sort((a, b) =>
      `${a.gradeLevel}|${a.legacySubject}`.localeCompare(`${b.gradeLevel}|${b.legacySubject}`),
    );
}

/** Entrées reproduites par dérivation, dans un ordre stable. */
export function listRedundantLegacyCore(): readonly {
  gradeLevel: string;
  legacySubject: string;
}[] {
  return mapping.entries
    .filter((entry) => entry.classification === 'REDUNDANT_LEGACY_CORE')
    .map((entry) => ({ gradeLevel: entry.gradeLevel, legacySubject: entry.legacySubject }))
    .sort((a, b) =>
      `${a.gradeLevel}|${a.legacySubject}`.localeCompare(`${b.gradeLevel}|${b.legacySubject}`),
    );
}

/**
 * Classe une valeur historique. Toute combinaison absente de la source
 * canonique est `UNRESOLVED` : fail-closed.
 */
export function classifyLegacySpecialty(
  legacySubject: string,
  gradeLevel: string,
): LegacyClassification {
  const entry = mapping.entries.find(
    (candidate) =>
      candidate.gradeLevel === gradeLevel && candidate.legacySubject === legacySubject,
  );
  return entry ? entry.classification : 'UNRESOLVED';
}

/** Cours et nature d'une valeur historique reprise, ou `null`. */
export function resolveLegacyChoice(
  legacySubject: string,
  gradeLevel: string,
): { courseKey: string; kind: 'SPECIALTY' | 'OPTION' } | null {
  const entry = mapping.entries.find(
    (candidate) =>
      candidate.gradeLevel === gradeLevel &&
      candidate.legacySubject === legacySubject &&
      candidate.classification === 'MIGRATED_CHOICE',
  );
  return entry ? { courseKey: entry.courseKey!, kind: entry.kind! } : null;
}
