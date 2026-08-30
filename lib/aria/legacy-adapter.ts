/**
 * ARIA Legacy Subject Adapter.
 *
 * Adaptateur rétro-compatible très borné, extérieur au cœur ARIA.
 *
 * RÈGLES STRICTES :
 * - Mapping strictement explicite.
 * - AUCUN default vers Mathématiques Terminale.
 * - AUCUN default vers un niveau scolaire (gradeLevel est obligatoire).
 * - Si la combinaison (subject, gradeLevel) n'est pas connue ou supportée : lève une erreur explicite.
 */

import { Subject, GradeLevel } from '@/types/enums';
import { AriaError } from './errors';

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
  gradeLevel: GradeLevel | string
): string {
  if (!gradeLevel) {
    throw new AriaError(
      'BAD_REQUEST',
      400,
      'Le niveau scolaire (gradeLevel) est obligatoire pour résoudre une matière historique.'
    );
  }

  const key = `${subject}:${gradeLevel}`;
  const courseKey = EXPLICIT_SUBJECT_GRADE_MAP[key];

  if (!courseKey) {
    throw new AriaError(
      'UNSUPPORTED',
      400,
      `Combinaison matière (${subject}) et niveau (${gradeLevel}) non supportée dans ARIA. Aucun fallback silencieux autorisé.`
    );
  }

  return courseKey;
}
