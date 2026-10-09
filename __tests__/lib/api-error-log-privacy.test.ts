/** @jest-environment node */
import { ApiError, handleApiError } from '@/lib/api/errors';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
const logs = logger as unknown as { error: jest.Mock; warn: jest.Mock };
beforeEach(() => jest.clearAllMocks());
const marker = 'SYNTHETIC_PRIVATE_ERROR_FIELD';
test('unexpected error messages and stacks never enter API logs', async () => {
  const error = new Error(marker); error.stack = marker;
  const response = await handleApiError(error, 'POST /api/synthetic');
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain(marker);
  expect(JSON.stringify(logs.error.mock.calls)).not.toContain(marker);
  expect(logs.error).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'INTERNAL_ERROR', statusCode: 500, context: 'POST /api/synthetic' }), 'Unexpected error');
});
test('expected API error details stay out of server logs while preserving the response contract', async () => {
  const response = await handleApiError(ApiError.badRequest(marker, { input: marker }));
  expect(response.status).toBe(400);
  expect(JSON.stringify(logs.warn.mock.calls)).not.toContain(marker);
  expect((await response.json()).message).toBe(marker);
});
test('validation log records issue count instead of arbitrary messages and paths', async () => {
  const response = await handleApiError(new ZodError([{ code: 'custom', path: [marker], message: marker }]));
  expect(response.status).toBe(422);
  expect(JSON.stringify(logs.warn.mock.calls)).not.toContain(marker);
  expect(logs.warn).toHaveBeenCalledWith(expect.objectContaining({ validationIssueCount: 1 }), 'Validation error');
});
