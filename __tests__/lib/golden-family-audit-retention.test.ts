import type { GoldenFamilyIds } from '@/e2e/helpers/golden-family';
const mockDatabase = {
  sessionBookingCancellationAudit: { count: jest.fn() },
  sessionBooking: { deleteMany: jest.fn() },
  user: { updateMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockDatabase) }));
jest.mock('@/e2e/helpers/auth', () => ({ gotoSignInForm: jest.fn(), resetBrowserSession: jest.fn() }));
jest.mock('@/e2e/helpers/rate-limit', () => ({ resetDisposableE2ERateLimits: jest.fn() }));
let cleanup!: typeof import('@/e2e/helpers/golden-family').cleanupGoldenFamily;
const savedUrl = process.env.DATABASE_URL;
const savedTestUrl = process.env.TEST_DATABASE_URL;
const savedMarker = process.env.E2E_DISPOSABLE_STACK;
beforeAll(async () => {
  process.env.DATABASE_URL = ['postgresql:', '//localhost/', 'nexus_e2e'].join('');
  delete process.env.TEST_DATABASE_URL;
  process.env.E2E_DISPOSABLE_STACK = '1';
  await jest.isolateModulesAsync(async () => { cleanup = (await import('@/e2e/helpers/golden-family')).cleanupGoldenFamily; });
});
afterAll(() => {
  for (const [key, value] of [['DATABASE_URL', savedUrl], ['TEST_DATABASE_URL', savedTestUrl], ['E2E_DISPOSABLE_STACK', savedMarker]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
beforeEach(() => {
  jest.clearAllMocks(); process.env.E2E_DISPOSABLE_STACK = '1';
  mockDatabase.sessionBookingCancellationAudit.count.mockResolvedValue(1);
  mockDatabase.sessionBooking.deleteMany.mockRejectedValue(new Error('SYNTHETIC_IMMUTABLE_AUDIT'));
  mockDatabase.user.updateMany.mockResolvedValue({ count: 2 });
  mockDatabase.user.count.mockResolvedValue(2);
  mockDatabase.$transaction.mockImplementation((operation: (tx: typeof mockDatabase) => Promise<unknown>) => operation(mockDatabase));
});
const ids: GoldenFamilyIds = { childAUserId: 'synthetic-child', coach1UserId: 'synthetic-coach' };
test('audited fixtures revoke credentials while retaining their immutable graph', async () => {
  await expect(cleanup(ids)).resolves.toBe('AUDIT_RETAINED');
  expect(mockDatabase.sessionBooking.deleteMany).not.toHaveBeenCalled();
  expect(mockDatabase.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ id: { in: ['synthetic-child', 'synthetic-coach'] } }),
    data: expect.objectContaining({ password: null, activatedAt: null, activationToken: null, sessionVersion: { increment: 1 } }),
  }));
});
test('removing the explicit disposable-stack marker prevents every cleanup write', async () => {
  process.env.E2E_DISPOSABLE_STACK = '0';
  await expect(cleanup(ids)).rejects.toThrow('E2E_DATABASE_NOT_DISPOSABLE');
  expect(mockDatabase.user.updateMany).not.toHaveBeenCalled();
  expect(mockDatabase.sessionBooking.deleteMany).not.toHaveBeenCalled();
});
