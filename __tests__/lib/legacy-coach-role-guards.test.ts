import { auth } from '@/auth';
import { requireAuth, requireRole, requireAnyRole, isErrorResponse } from '@/lib/guards';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
const session = (authority: string | undefined, role = 'COACH') => ({ user: { id: 'actor', email: 'fixture@example.test', role, authority }, expires: '2099-01-01' });
beforeEach(() => jest.clearAllMocks());
it.each(['CORE_V2', undefined].flatMap(authority => ['one', 'many'].map(kind => ({ authority, kind }))))('refuses unqualified legacy coach $authority / $kind', async ({ authority, kind }) => {
  jest.mocked(auth).mockResolvedValue(session(authority) as never);
  const result = await (kind === 'one' ? requireRole('COACH') : requireAnyRole(['COACH', 'ADMIN']));
  expect(isErrorResponse(result)).toBe(true);
  if (!isErrorResponse(result)) throw new Error('authorization incorrectly granted');
  expect(result.status).toBe(403);
  expect(result.headers.get('Cache-Control')).toBe('private, no-store');
});
it('preserves Core authentication for Core route authorizers', async () => {
  const value = session('CORE_V2'); jest.mocked(auth).mockResolvedValue(value as never);
  expect(await requireAuth()).toEqual(value);
});
it.each(['V1', 'CORE_V2'])('preserves staff role authorization %s', async authority => {
  const value = session(authority, 'ADMIN'); jest.mocked(auth).mockResolvedValue(value as never);
  expect(await requireAnyRole(['COACH', 'ADMIN'])).toEqual(value);
});
it('preserves an explicit V1 coach', async () => {
  const value = session('V1'); jest.mocked(auth).mockResolvedValue(value as never);
  expect(await requireRole('COACH')).toEqual(value);
  expect(await requireAnyRole(['COACH', 'ADMIN'])).toEqual(value);
});
