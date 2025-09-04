/** @jest-environment node */
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
// Mock authOptions to avoid importing ESM adapter in Jest
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue(null) }));
// Mock Prisma to simulate no student found (404)
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) } } }));
let GET: any;
beforeAll(async () => {
  const mod = await import('@/app/api/student/profile/route');
  GET = mod.GET;
});

describe('GET /api/student/profile', () => {
  it('returns 404 when not found', async () => {
    const url = new URL('http://localhost/api/student/profile?studentId=unknown');
    // @ts-ignore
    const res = await GET({ url: url.toString(), headers: new Headers() } as any);
    expect(res.status).toBe(404);
  });
});
