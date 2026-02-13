jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status,
      body,
    }),
  },
}));

import { z } from 'zod';
import {
  assertExists,
  assertOwnership,
  createPaginationMeta,
  generateRequestId,
  getIdParam,
  getPagination,
  logRequest,
  parseBody,
  parseSearchParams,
  safeJsonParse,
} from '@/lib/api/helpers';
import { ApiError } from '@/lib/api/errors';

jest.mock('@/lib/logger', () => ({
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
  })),
}));

describe('api helpers', () => {
  it('safeJsonParse returns parsed body', async () => {
    const request = { json: async () => ({ ok: true }) } as any;
    await expect(safeJsonParse(request)).resolves.toEqual({ ok: true });
  });

  it('safeJsonParse throws ApiError on invalid JSON', async () => {
    const request = { json: async () => { throw new Error('bad'); } } as any;
    await expect(safeJsonParse(request)).rejects.toBeInstanceOf(ApiError);
  });

  it('parseBody validates with schema', async () => {
    const schema = z.object({ name: z.string() });
    const request = { json: async () => ({ name: 'Nexus' }) } as any;
    await expect(parseBody(request, schema)).resolves.toEqual({ name: 'Nexus' });
  });

  it('parseSearchParams validates query params', () => {
    const schema = z.object({ page: z.string() });
    const request = { nextUrl: { searchParams: new URLSearchParams('page=2') } } as any;
    expect(parseSearchParams(request, schema)).toEqual({ page: '2' });
  });

  it('getPagination returns skip/take', () => {
    expect(getPagination(10, 20)).toEqual({ skip: 20, take: 10 });
  });

  it('createPaginationMeta computes pages and hasMore', () => {
    expect(createPaginationMeta(101, 20, 40)).toEqual({
      total: 101,
      limit: 20,
      offset: 40,
      hasMore: true,
      page: 3,
      totalPages: 6,
    });
  });

  it('getIdParam validates id', () => {
    expect(getIdParam({ id: 'abc' })).toBe('abc');
    expect(() => getIdParam({ id: '' })).toThrow(ApiError);
  });

  it('assertExists throws on missing resource', () => {
    expect(() => assertExists(null, 'User')).toThrow(ApiError);
  });

  it('assertOwnership throws when user does not own resource', () => {
    expect(() => assertOwnership('u1', 'u2')).toThrow(ApiError);
  });

  it('generateRequestId returns UUID', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => '11111111-1111-1111-1111-111111111111',
      },
      configurable: true,
    });
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  it('logRequest creates request-scoped logger', () => {
    const logger = logRequest('POST', '/api/test', 'req-1', 'user-1');
    expect(logger).toBeDefined();
  });
});
