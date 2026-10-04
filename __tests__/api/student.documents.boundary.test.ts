const mockAuth = jest.fn();
const mockDocuments = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/prisma', () => ({ prisma: { userDocument: { findMany: (...args: unknown[]) => mockDocuments(...args) } } }));
import { GET } from '@/app/api/student/documents/route';
import { STUDENT_DOCUMENT_SCOPES } from '@/lib/documents/student-visibility';
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'synthetic-student', role: 'ELEVE' } });
  mockDocuments.mockResolvedValue([]);
});
test('student listing filters visibility before reading private metadata and cannot be cached', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(mockDocuments).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId: 'synthetic-student', visibilityScope: { in: [...STUDENT_DOCUMENT_SCOPES] } },
  }));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
test.each(['PARENT', 'COACH', 'ADMIN', null])('non-student role %s cannot list documents', async role => {
  mockAuth.mockResolvedValue(role ? { user: { id: 'synthetic-user', role } } : null);
  const response = await GET();
  expect(response.status).toBe(401);
  expect(mockDocuments).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
test('private database exception does not enter logs or client errors', async () => {
  const canary = 'SYNTHETIC-PRIVATE-DOCUMENT-EXCEPTION';
  mockDocuments.mockRejectedValueOnce(new Error(canary));
  const logging = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Erreur interne' });
    expect(logging).toHaveBeenCalledWith('STUDENT_DOCUMENT_LIST_FAILED');
    expect(JSON.stringify(logging.mock.calls)).not.toContain(canary);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  } finally { logging.mockRestore(); }
});
