const STUDENT_LOGIN_DOMAIN = 'nexus-student.local';
const ASCII_EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function normalizeSegment(value: string, maxLength: number): string {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, maxLength)
    .replace(/\.+$/g, '');

  return normalized || 'eleve';
}

export function buildStudentLoginIdentifier(input: {
  firstName: string;
  lastName: string;
  uniqueSuffix?: string;
}): string {
  const segments = [
    normalizeSegment(input.firstName, 24),
    normalizeSegment(input.lastName, 24),
  ];

  if (input.uniqueSuffix) {
    segments.push(normalizeSegment(input.uniqueSuffix, 12));
  }

  return `${segments.join('.')}@${STUDENT_LOGIN_DOMAIN}`;
}

export function isStudentLoginIdentifierCompatible(identifier: string): boolean {
  if (identifier.length > 254) return false;
  const [localPart] = identifier.split('@');
  return localPart.length <= 64 && ASCII_EMAIL_PATTERN.test(identifier);
}

export function isStudentLoginIdentifierConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  if ((error as { code?: unknown }).code !== 'P2002') return false;

  const meta = (error as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || !('target' in meta)) return false;
  const target = (meta as { target?: unknown }).target;
  return Array.isArray(target)
    ? target.some((field) => field === 'email')
    : typeof target === 'string' && target.includes('email');
}
