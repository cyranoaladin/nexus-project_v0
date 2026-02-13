import { z } from 'zod';
import {
  ApiError,
  ErrorCode,
  handleApiError,
  handleZodError,
  HttpStatus,
} from '@/lib/api/errors';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status,
      body,
    }),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('api errors', () => {
  it('ApiError.toResponse formats payload', () => {
    const err = ApiError.badRequest('Invalid');
    const res = err.toResponse() as any;
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body).toEqual({
      error: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid',
    });
  });

  it('handleZodError formats validation errors', () => {
    const schema = z.object({ email: z.string().email() });
    const error = schema.safeParse({ email: 'nope' }).error!;
    const res = handleZodError(error) as any;
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.details.errors.length).toBe(1);
  });

  it('handleApiError handles ApiError', async () => {
    const err = ApiError.forbidden('Denied');
    const res = await handleApiError(err, 'context');
    expect((res as any).status).toBe(HttpStatus.FORBIDDEN);
  });

  it('handleApiError handles ZodError', async () => {
    const schema = z.object({ age: z.number().min(18) });
    const error = schema.safeParse({ age: 1 }).error!;
    const res = await handleApiError(error);
    expect((res as any).status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('handleApiError handles unexpected errors', async () => {
    const res = await handleApiError(new Error('boom'));
    expect((res as any).status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('handleApiError uses provided request logger', async () => {
    const requestLogger = { warn: jest.fn(), error: jest.fn() } as any;
    await handleApiError(new Error('boom'), 'context', requestLogger);
    expect(requestLogger.error).toHaveBeenCalled();
  });
});
