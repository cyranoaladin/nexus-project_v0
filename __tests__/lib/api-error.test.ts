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
    error: jest.fn(),
  },
}));

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateRequiredFields,
  ErrorCodes,
} from '@/lib/api-error';

describe('api-error helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createErrorResponse formats standard error', async () => {
    const res = createErrorResponse(ErrorCodes.NOT_FOUND, 'Not found', 404) as any;
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCodes.NOT_FOUND);
  });

  it('createSuccessResponse formats standard success', async () => {
    const res = createSuccessResponse({ ok: true }, 201) as any;
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ ok: true });
  });

  it('handleApiError handles Prisma unique constraint', async () => {
    const err = { code: 'P2002', meta: { target: ['email'] } };
    const res = handleApiError(err) as any;
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('handleApiError handles Prisma not found', async () => {
    const err = { code: 'P2025' };
    const res = handleApiError(err) as any;
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ErrorCodes.NOT_FOUND);
  });

  it('handleApiError exposes message in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = handleApiError(new Error('boom')) as any;
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('boom');
    process.env.NODE_ENV = originalEnv;
  });

  it('handleApiError hides message in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = handleApiError(new Error('boom')) as any;
    expect(res.status).toBe(500);
    expect(res.body.error.message).not.toBe('boom');
    process.env.NODE_ENV = originalEnv;
  });

  it('validateRequiredFields returns missing fields', () => {
    const res = validateRequiredFields({ a: 1 }, ['a', 'b']);
    expect(res.valid).toBe(false);
    expect(res.missing).toEqual(['b']);
  });
});
