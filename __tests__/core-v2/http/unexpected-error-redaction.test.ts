/** @jest-environment node */
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { logger } from '@/lib/logger';
import { failFromError } from '@/lib/core-v2/http/respond';

beforeEach(() => jest.clearAllMocks());

test.each([
  new Error('synthetic-private-provider-body'),
  Object.assign(new TypeError('synthetic-private-query'), { name: 'synthetic-private-name', code: 'synthetic-private-code' }),
  { message: 'synthetic-private-object', nested: { body: 'synthetic-private-request' } },
  'synthetic-private-thrown-string',
])('unknown route failures never log the raw exception or its private data', async error => {
  const response = failFromError(error, 'synthetic-request-correlation');
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected error.' }, correlationId: 'synthetic-request-correlation' });
  expect(logger.error).toHaveBeenCalledTimes(1);
  expect(jest.mocked(logger.error).mock.calls[0]?.[0]).not.toHaveProperty('err');
  const serialized = JSON.stringify(jest.mocked(logger.error).mock.calls);
  expect(serialized).not.toContain('synthetic-private');
  expect(serialized).toContain('synthetic-request-correlation');
  expect(serialized).toContain('CORE_V2_ROUTE_UNEXPECTED_ERROR');
});

test('a recognized database failure retains its non-sensitive operational code', () => {
  failFromError(Object.assign(new Error('synthetic-private-database-details'), { code: 'P2002' }), 'synthetic-request-correlation');
  expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'P2002' }), expect.any(String));
  expect(JSON.stringify(jest.mocked(logger.error).mock.calls)).not.toContain('synthetic-private');
});
