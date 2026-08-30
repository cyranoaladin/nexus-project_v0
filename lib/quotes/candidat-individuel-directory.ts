import { isValidCandidateStudentId } from '@/lib/quotes/candidat-individuel-navigation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export interface CandidateStudentDirectoryItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  grade: string | null;
  school: string | null;
  creditBalance: null;
  selectable: boolean;
  unavailableReason: string | null;
}

export function normalizeCandidateStudentDirectoryItem(value: unknown): CandidateStudentDirectoryItem | null {
  if (!isRecord(value) || !isRecord(value.user)) return null;
  const studentId = nullableText(value.studentId);
  const userId = nullableText(value.userId);
  if (!studentId || !userId || !isValidCandidateStudentId(studentId) || studentId === userId) return null;
  if (isRecord(value.responsible)
    && (!nullableText(value.responsible.parentProfileId) || !nullableText(value.responsible.userId))) return null;

  let unavailableReason: string | null = null;
  if (nullableText(value.user.mergedIntoUserId)) {
    unavailableReason = 'Compte élève fusionné';
  } else if (!isRecord(value.responsible)) {
    unavailableReason = 'Responsable absent';
  } else if (nullableText(value.responsible.mergedIntoUserId)) {
    unavailableReason = 'Compte responsable fusionné';
  } else if (!nullableText(value.responsible.email)) {
    unavailableReason = 'Adresse email du responsable manquante';
  } else if (!nullableText(value.responsible.firstName) && !nullableText(value.responsible.lastName)) {
    unavailableReason = 'Nom du responsable manquant';
  }

  return {
    id: studentId,
    firstName: nullableText(value.user.firstName),
    lastName: nullableText(value.user.lastName),
    email: nullableText(value.user.email),
    grade: nullableText(value.grade),
    school: nullableText(value.school),
    creditBalance: null,
    selectable: unavailableReason == null,
    unavailableReason,
  };
}
