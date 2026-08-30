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

export function parseStaffStudentsIntent(value: unknown): StaffStudentsIntent | undefined {
  return value === 'candidat-individuel' ? value : undefined;
}

export function getCandidateSimulatorPath(role: CandidateStaffRole): string {
  return SIMULATOR_PATHS[role];
}

export function getContextualStudentsPath(role: CandidateStaffRole): string {
  return `${STUDENTS_PATHS[role]}?intent=candidat-individuel`;
}

export function isValidCandidateStudentId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_OPAQUE_ID.test(value);
}

export function buildCandidateSimulatorStudentUrl(role: CandidateStaffRole, studentId: string): string {
  if (!isValidCandidateStudentId(studentId)) throw new Error('invalid_student_id');
  const params = new URLSearchParams({ studentId });
  return `${getCandidateSimulatorPath(role)}?${params.toString()}`;
}

export function removeStudentIdFromPath(pathname: string, searchParams: URLSearchParams): string {
  const next = new URLSearchParams();
  if (searchParams.get('view') === 'compact') next.set('view', 'compact');
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
