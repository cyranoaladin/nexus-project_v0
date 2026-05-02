export const CORRECTION_DOCUMENT_TYPES = [
  'STUDENT_COPY',
  'SUBJECT',
  'OFFICIAL_CORRECTION',
  'GRADING_RUBRIC',
  'GRADING_INSTRUCTIONS',
  'SUPPORTING_DOCUMENT',
] as const;

export type CorrectionDocumentTypeValue = (typeof CORRECTION_DOCUMENT_TYPES)[number];

export const CORRECTION_DOCUMENT_TYPE_LABELS: Record<CorrectionDocumentTypeValue, string> = {
  STUDENT_COPY: 'Copie élève',
  SUBJECT: 'Sujet / énoncé',
  OFFICIAL_CORRECTION: 'Corrigé officiel',
  GRADING_RUBRIC: 'Barème détaillé',
  GRADING_INSTRUCTIONS: 'Consignes de correction',
  SUPPORTING_DOCUMENT: 'Document complémentaire',
};

export function isCorrectionDocumentType(
  value: unknown
): value is CorrectionDocumentTypeValue {
  return (
    typeof value === 'string' &&
    CORRECTION_DOCUMENT_TYPES.includes(value as CorrectionDocumentTypeValue)
  );
}
