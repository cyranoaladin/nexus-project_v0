/**
 * ARIA Legacy Subject Adapter.
 *
 * Adaptateur rétro-compatible très borné, extérieur au cœur ARIA.
 *
 * RÈGLES STRICTES :
 * - Mapping strictement explicite.
 * - AUCUN default vers Mathématiques Terminale.
 * - Si la combinaison (subject, gradeLevel) n'est pas connue ou supportée : lève une erreur explicite.
 */

import { Subject } from '@/types/enums';

const EXPLICIT_SUBJECT_GRADE_MAP: Record<string, string> = {
  'MATHEMATIQUES:TERMINALE': 'eds-maths-terminale',
  'MATHEMATIQUES:PREMIERE': 'eds-maths-premiere',
  'NSI:TERMINALE': 'eds-nsi-terminale',
  'NSI:PREMIERE': 'eds-nsi-premiere',
  'FRANCAIS:PREMIERE': 'tc-francais-premiere',
  'PHILOSOPHIE:TERMINALE': 'tc-philosophie-terminale',
};

export function mapLegacySubjectToCourseKey(
  subject: Subject | string,
  gradeLevel: string = 'TERMINALE'
): string {
  const key = `${subject}:${gradeLevel}`;
  const courseKey = EXPLICIT_SUBJECT_GRADE_MAP[key];

  if (!courseKey) {
    throw new Error(
      `Combinaison matière (${subject}) et niveau (${gradeLevel}) non supportée dans ARIA. Aucun fallback silencieux autorisé.`
    );
  }

  return courseKey;
}
