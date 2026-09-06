import bcrypt from 'bcryptjs';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { requireAuth, isErrorResponse } from '@/lib/guards';
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
const parent = { id: 'parent', email: null, role: 'PARENT', password: 'hash', activatedAt: new Date(), phoneNormalized: '99192829', parentPhoneState: 'VERIFIED', phoneVerifiedAt: new Date(), mergedIntoUserId: null, sessionVersion: 3 };
beforeEach(() => { jest.clearAllMocks(); (bcrypt.compare as jest.Mock).mockResolvedValue(true); });
it.each(['99 19 28 29', '+21699192829', '0021699192829'])('authenticates verified phone parent without email: %s', async identifier => {
  (prisma.user.findMany as jest.Mock).mockResolvedValue([parent]);
  expect(await authorizeCredentials({ identifier, password: 'correct' })).toEqual(expect.objectContaining({ id: 'parent', email: null }));
  expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ phoneNormalized: '99192829', parentPhoneState: 'VERIFIED', mergedIntoUserId: null }) }));
});
it('refuses ambiguous telephone records', async () => {
  (prisma.user.findMany as jest.Mock).mockResolvedValue([parent, { ...parent, id: 'other' }]);
  expect(await authorizeCredentials({ identifier: '99192829', password: 'correct' })).toBeNull();
});
it.each([{ ...parent, role: 'COACH' }, { ...parent, parentPhoneState: 'RESERVED' }, { ...parent, phoneVerifiedAt: null }, { ...parent, mergedIntoUserId: 'other' }])('refuses unverified, foreign-role or merged phone identity', async record => {
  (prisma.user.findMany as jest.Mock).mockResolvedValue([record]);
  expect(await authorizeCredentials({ identifier: '99192829', password: 'correct' })).toBeNull();
});
it('preserves email login and refuses merged email accounts', async () => {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...parent, email: 'parent@example.test', mergedIntoUserId: 'other' });
  expect(await authorizeCredentials({ email: 'parent@example.test', password: 'correct' })).toBeNull();
});
it('accepts authenticated parent session with stable id and no email', async () => {
  const session = { user: { id: 'parent', role: 'PARENT', email: null } };
  (auth as jest.Mock).mockResolvedValue(session);
  expect(await requireAuth()).toEqual(session);
});
it('does not accept a missing user id merely because role is parent', async () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  (auth as jest.Mock).mockResolvedValue({ user: { role: 'PARENT', email: null } });
  expect(isErrorResponse(await requireAuth())).toBe(true);
  errorSpy.mockRestore();
});
