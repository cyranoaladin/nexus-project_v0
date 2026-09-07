import { executeIdempotently, canonicalPayloadHash, type IdempotencyDatabase } from '@/lib/bilans/api/idempotency';

const now = new Date('2026-09-06T12:00:00Z');
type Stored = Awaited<ReturnType<IdempotencyDatabase['canonicalApiIdempotencyKey']['findUnique']>>;
function database(stored: Stored = null) {
  const delegate = { findUnique: jest.fn(async () => stored), deleteMany: jest.fn(), create: jest.fn(), update: jest.fn() };
  return { canonicalApiIdempotencyKey: delegate, $transaction: jest.fn(async (action) => action({ canonicalApiIdempotencyKey: delegate })) };
}
const base = { userId: 'staff', route: 'family', key: 'family-123', now };
const stored = { response: { id: 'family' }, responseStatus: 201, expiresAt: new Date(now.getTime()+10000), payloadHash: 'hash-a' };
test('canonical digest sorts object keys recursively, preserves array order and omits undefined', () => {
  expect(canonicalPayloadHash({ b: [{ y: 2, x: 1 }], a: undefined })).toBe(canonicalPayloadHash({ b: [{ x: 1, y: 2 }] }));
  expect(canonicalPayloadHash([1, 2])).not.toBe(canonicalPayloadHash([2, 1]));
  expect(canonicalPayloadHash({ a: 'secret' })).toMatch(/^[a-f0-9]{64}$/);
});
test('persists payload hash with the reservation', async () => {
  const db = database();
  await executeIdempotently({ ...base, prisma: db, payloadHash: 'hash-a', action: async () => ({ status: 201, body: {} }) });
  expect(db.canonicalApiIdempotencyKey.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payloadHash: 'hash-a' }) });
});
test.each([['hash-a', true], ['hash-b', false], [null, true]])('replay checks stored digest %s', async (hash, succeeds) => {
  const action = jest.fn();
  const result = executeIdempotently({ ...base, prisma: database({ ...stored, payloadHash: hash }), payloadHash: 'hash-a', action });
  if (succeeds) await expect(result).resolves.toMatchObject({ replayed: true });
  else await expect(result).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  expect(action).not.toHaveBeenCalled();
});
test.each(['hash-a', 'hash-b'])('unique-race winner digest is compared: %s', async hash => {
  const db = database();
  db.canonicalApiIdempotencyKey.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...stored, payloadHash: hash });
  db.$transaction.mockRejectedValueOnce({ code: 'P2002' });
  const result = executeIdempotently({ ...base, prisma: db, payloadHash: 'hash-a', action: jest.fn() });
  if (hash === 'hash-a') await expect(result).resolves.toMatchObject({ replayed: true });
  else await expect(result).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
});

test('replays the exact completed pre-deployment response without executing or rewriting', async () => {
  const oldResponse = { parentUserId: 'old-parent', children: [{ studentId: 'old-child' }] };
  const db = database({ ...stored, payloadHash: null, response: oldResponse });
  const action = jest.fn();
  await expect(executeIdempotently({ ...base, prisma: db, payloadHash: 'new-hash', action }))
    .resolves.toEqual({ status: 201, body: oldResponse, replayed: true });
  expect(action).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
});
test('replaces an expired legacy reservation with the current digest and result', async () => {
  const db = database({ ...stored, payloadHash: null, expiresAt: now });
  const action = jest.fn(async () => ({ status: 201, body: { id: 'new-family' } }));
  await expect(executeIdempotently({ ...base, prisma: db, payloadHash: 'current-hash', action }))
    .resolves.toEqual({ status: 201, body: { id: 'new-family' }, replayed: false });
  expect(db.canonicalApiIdempotencyKey.deleteMany).toHaveBeenCalledWith({ where: { userId: base.userId, route: base.route, key: base.key, expiresAt: { lte: now } } });
  expect(db.canonicalApiIdempotencyKey.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payloadHash: 'current-hash' }) });
  expect(action).toHaveBeenCalledTimes(1);
});
test('dates hash their JSON ISO representation, including nested dates', () => {
  expect(canonicalPayloadHash(now)).toBe(canonicalPayloadHash(now.toISOString()));
  expect(canonicalPayloadHash({ nested: [now] })).toBe(canonicalPayloadHash({ nested: [now.toISOString()] }));
  expect(canonicalPayloadHash(now)).not.toBe(canonicalPayloadHash({}));
});
test.each([undefined, () => true, Symbol('not-json'), BigInt(1)])('rejects non-JSON top-level input with a stable error: %s', value => {
  expect(() => canonicalPayloadHash(value)).toThrow(new TypeError('IDEMPOTENCY_PAYLOAD_NOT_JSON'));
});
