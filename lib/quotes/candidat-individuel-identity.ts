import { normalizeUserEmail } from '@/lib/contact/user-email';

export interface StaffStudentSearchResult {
  studentId: string;
  userId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    mergedIntoUserId: string | null;
  };
  responsible: {
    parentProfileId: string;
    userId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    mergedIntoUserId: string | null;
  };
}

export type CandidateIdentityCode =
  | 'MISSING_RESPONSIBLE'
  | 'MISSING_STUDENT'
  | 'VALIDATING'
  | 'VALIDATION_ERROR'
  | 'RESPONSIBLE_UNAVAILABLE'
  | 'RESPONSIBLE_MISMATCH'
  | 'STUDENT_UNAVAILABLE'
  | 'COMPLETE';

export interface CandidateIdentityState {
  complete: boolean;
  code: CandidateIdentityCode;
  message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}

export function normalizeStaffStudentSearchResult(value: unknown): StaffStudentSearchResult | null {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.responsible)) return null;
  if (typeof value.studentId !== 'string' || value.studentId.trim().length === 0) return null;
  if (typeof value.userId !== 'string' || value.userId.trim().length === 0) return null;
  if (value.studentId === value.userId) return null;
  if (typeof value.responsible.parentProfileId !== 'string' || value.responsible.parentProfileId.trim().length === 0) return null;
  if (typeof value.responsible.userId !== 'string' || value.responsible.userId.trim().length === 0) return null;

  const userFirstName = nullableString(value.user.firstName);
  const userLastName = nullableString(value.user.lastName);
  const userEmail = nullableString(value.user.email);
  const studentMergedIntoUserId = nullableString(value.user.mergedIntoUserId);
  const parentFirstName = nullableString(value.responsible.firstName);
  const parentLastName = nullableString(value.responsible.lastName);
  const parentEmail = nullableString(value.responsible.email);
  const mergedIntoUserId = nullableString(value.responsible.mergedIntoUserId);
  if ([userFirstName, userLastName, userEmail, studentMergedIntoUserId, parentFirstName, parentLastName, parentEmail, mergedIntoUserId].includes(undefined)) return null;

  return {
    studentId: value.studentId,
    userId: value.userId,
    user: { firstName: userFirstName!, lastName: userLastName!, email: userEmail!, mergedIntoUserId: studentMergedIntoUserId! },
    responsible: {
      parentProfileId: value.responsible.parentProfileId,
      userId: value.responsible.userId,
      firstName: parentFirstName!,
      lastName: parentLastName!,
      email: parentEmail!,
      mergedIntoUserId: mergedIntoUserId!,
    },
  };
}

export function evaluateCandidateIdentity(input: {
  selectedLead: { id: string; email: string } | null;
  selectedStudent: StaffStudentSearchResult | null;
  validating?: boolean;
  validationError?: boolean;
}): CandidateIdentityState {
  if (!input.selectedLead) return { complete: false, code: 'MISSING_RESPONSIBLE', message: 'Sélectionnez un responsable.' };
  if (!input.selectedStudent) return { complete: false, code: 'MISSING_STUDENT', message: 'Sélectionnez un élève.' };
  if (input.validating) return { complete: false, code: 'VALIDATING', message: 'Vérification du rattachement en cours...' };
  if (input.validationError) return { complete: false, code: 'VALIDATION_ERROR', message: "Le rattachement n'a pas pu être vérifié. Réessayez." };

  if (input.selectedStudent.user.mergedIntoUserId) {
    return {
      complete: false,
      code: 'STUDENT_UNAVAILABLE',
      message: "Le compte élève doit être vérifié dans son dossier avant de continuer.",
    };
  }

  const parent = input.selectedStudent.responsible;
  if (!parent.email || parent.mergedIntoUserId) {
    return {
      complete: false,
      code: 'RESPONSIBLE_UNAVAILABLE',
      message: "Le rattachement responsable de cet élève doit être vérifié dans son dossier.",
    };
  }
  if (normalizeUserEmail(input.selectedLead.email) !== normalizeUserEmail(parent.email)) {
    return {
      complete: false,
      code: 'RESPONSIBLE_MISMATCH',
      message: 'Cet élève est rattaché à un autre responsable. Vérifiez le dossier avant de continuer.',
    };
  }
  return { complete: true, code: 'COMPLETE', message: null };
}

export function serializeStaffStudentSearchResult(student: {
  id: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string | null; mergedIntoUserId: string | null };
  parent: {
    id: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      mergedIntoUserId: string | null;
    };
  };
}): StaffStudentSearchResult {
  return {
    studentId: student.id,
    userId: student.user.id,
    user: {
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      mergedIntoUserId: student.user.mergedIntoUserId,
    },
    responsible: {
      parentProfileId: student.parent.id,
      userId: student.parent.user.id,
      firstName: student.parent.user.firstName,
      lastName: student.parent.user.lastName,
      email: student.parent.user.email,
      mergedIntoUserId: student.parent.user.mergedIntoUserId,
    },
  };
}
