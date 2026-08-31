export type CandidateStaffRole = 'ADMIN' | 'ASSISTANTE';
export type StaffStudentsIntent = 'candidat-individuel';

const SIMULATOR_PATHS: Record<CandidateStaffRole, string> = {
  ADMIN: '/dashboard/admin/candidat-individuel',
  ASSISTANTE: '/dashboard/assistante/candidat-individuel',
};

const STUDENTS_PATHS: Record<CandidateStaffRole, string> = {
  ADMIN: '/dashboard/admin/students',
  ASSISTANTE: '/dashboard/assistante/students',
};

const SAFE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,190}$/;
export const CANDIDATE_STUDENT_HANDOFF_KEY = 'nexus:candidat-individuel:selected-student';
export const CANDIDATE_STUDENT_HANDOFF_TTL_MS = 2 * 60 * 1000;
export const CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS = 1_500;

export type CandidateStudentHandoffStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type CandidateStudentHandoffStorageResult<T> =
  | { ok: true; value: T }
  | { ok: false };

interface CandidateStudentHandoff {
  version: 1;
  studentId: string;
  role: CandidateStaffRole;
  createdAt: number;
}

interface CandidateStudentActivation {
  button: number;
  detail: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface SameTabLocation {
  assign(url: string): void;
}

export function parseStaffStudentsIntent(value: unknown): StaffStudentsIntent | undefined {
  return value === 'candidat-individuel' ? value : undefined;
}

export function getCandidateSimulatorPath(role: CandidateStaffRole): string {
  return SIMULATOR_PATHS[role];
}

export function getContextualStudentsPath(role: CandidateStaffRole): string {
  return `${STUDENTS_PATHS[role]}?intent=candidat-individuel`;
}

export function isUnmodifiedCandidateStudentActivation(event: CandidateStudentActivation): boolean {
  return event.button === 0
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
    && !event.altKey;
}

export function navigateCandidateSimulatorSameTab(location: SameTabLocation, role: CandidateStaffRole): void {
  location.assign(getCandidateSimulatorPath(role));
}

export function tryCandidateStudentHandoffStorage<T>(
  acquire: () => CandidateStudentHandoffStorage,
  operation: (storage: CandidateStudentHandoffStorage) => T,
): CandidateStudentHandoffStorageResult<T> {
  try {
    return { ok: true, value: operation(acquire()) };
  } catch {
    return { ok: false };
  }
}

export function isValidCandidateStudentId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_OPAQUE_ID.test(value);
}

export function stageCandidateStudentHandoff(
  storage: CandidateStudentHandoffStorage,
  role: CandidateStaffRole,
  studentId: string,
  now = Date.now(),
): void {
  if (!isValidCandidateStudentId(studentId)) throw new Error('invalid_student_id');
  const handoff: CandidateStudentHandoff = { version: 1, studentId, role, createdAt: now };
  storage.setItem(CANDIDATE_STUDENT_HANDOFF_KEY, JSON.stringify(handoff));
}

export function clearCandidateStudentHandoff(storage: CandidateStudentHandoffStorage): void {
  storage.removeItem(CANDIDATE_STUDENT_HANDOFF_KEY);
}

export function consumeCandidateStudentHandoff(
  storage: CandidateStudentHandoffStorage,
  role: CandidateStaffRole,
  now = Date.now(),
): string | null {
  const serialized = storage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY);
  storage.removeItem(CANDIDATE_STUDENT_HANDOFF_KEY);
  if (serialized == null) return null;
  try {
    const handoff = JSON.parse(serialized) as Partial<CandidateStudentHandoff>;
    const age = now - Number(handoff.createdAt);
    if (
      handoff.version !== 1
      || handoff.role !== role
      || !isValidCandidateStudentId(handoff.studentId)
      || !Number.isFinite(age)
      || age < 0
      || age > CANDIDATE_STUDENT_HANDOFF_TTL_MS
    ) throw new Error('invalid_student_handoff');
    return handoff.studentId;
  } catch {
    throw new Error('invalid_student_handoff');
  }
}
