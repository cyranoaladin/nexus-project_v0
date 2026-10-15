/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/infrastructure/resources/secure-open-linux', () => {
  const real = jest.requireActual('@/lib/aria/infrastructure/resources/secure-open-linux');
  return { ...real, openVerifiedAriaResourceFile: jest.fn(real.openVerifiedAriaResourceFile) };
});
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { openVerifiedAriaResourceFile } from '@/lib/aria/infrastructure/resources/secure-open-linux';
import { listResourcesForCourse } from '@/lib/aria/resources';
import { GET } from '@/app/api/aria/resources/[resourceId]/versions/[resourceVersionId]/content/route';
import { ariaHttpCookie } from '../core-v2/helpers/aria-http-cookie';
import { seedAriaRealDbFixture, cleanupAriaRealDbFixture, type AriaRealDbFixtureIds } from '../helpers/aria-real-db';
import { delayFinalV1Verification } from '../helpers/delay-v1-final-authority';

process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.AUTH_SECRET ??= randomBytes(32).toString('base64url');
const courseKey = 'eds-maths-terminale';
const resource = listResourcesForCourse(courseKey)[0]!;
const params = { params: Promise.resolve({ resourceId: resource.id, resourceVersionId: resource.resourceVersionId }) };
describe('V1 resource delivery revalidates the original cookie and current course before every chunk', () => {
  let pool: Pool; let child: AriaRealDbFixtureIds; let close: jest.Mock;
  beforeAll(() => { pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL }); });
  beforeEach(async () => {
    child = await seedAriaRealDbFixture(pool, courseKey);
    await prisma.student.update({ where: { id: child.student }, data: { gradeLevel: 'TERMINALE' } });
    await prisma.user.update({ where: { id: child.studentUser }, data: { activatedAt: new Date() } });
    jest.mocked(auth).mockResolvedValue({ user: { id: child.studentUser, role: 'ELEVE', email: `student-${child.studentUser}@invalid.test`, authority: 'V1' }, expires: '2099-01-01' } as Awaited<ReturnType<typeof auth>>);
    const real = jest.requireActual<typeof import('@/lib/aria/infrastructure/resources/secure-open-linux')>('@/lib/aria/infrastructure/resources/secure-open-linux');
    jest.mocked(openVerifiedAriaResourceFile).mockClear().mockImplementation(async input => {
      const opened = await real.openVerifiedAriaResourceFile(input);
      close = jest.fn(() => opened.close());
      return { ...opened, close, createReadStream: () => Readable.from((async function* () {
        for await (const buffer of opened.createReadStream()) {
          for (let offset = 0; offset < buffer.length; offset += 64 * 1024) yield buffer.subarray(offset, offset + 64 * 1024);
        }
      })()) };
    });
  });
  afterEach(async () => { await cleanupAriaRealDbFixture(pool, child); });
  afterAll(async () => { await pool.end(); });
  async function request() { return new NextRequest('http://localhost:3000/api/aria/resources/content', { headers: await ariaHttpCookie(child.studentUser) }); }
  test('delivers a verified real PDF to a V1-only pupil and forbids caching', async () => {
    const response = await GET(await request(), params);
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBe(resource.sizeBytes);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(close).toHaveBeenCalledTimes(1);
  });
  test.each(['revoke', 'suspend', 'role', 'pin', 'curriculum', 'entitlement'] as const)('%s after the first chunk prevents the next byte and closes the real descriptor once', async change => {
    const response = await GET(await request(), params);
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    try {
      const first = await reader.read(); expect(first.done).toBe(false); expect(first.value!.byteLength).toBe(64 * 1024);
      if (change === 'curriculum') await prisma.studentAcademicEnrollment.deleteMany({ where: { studentId: child.student } });
      else if (change === 'entitlement') await prisma.entitlement.update({ where: { id: child.entitlement }, data: { status: 'REVOKED' } });
      else await prisma.user.update({ where: { id: child.studentUser }, data: change === 'revoke' ? { sessionVersion: { increment: 1 } }
        : change === 'suspend' ? { disabledAt: new Date() } : change === 'role' ? { role: 'PARENT' } : { pinHash: 'synthetic-replaced-code' } });
      await expect(reader.read()).rejects.toThrow();
      expect(close).toHaveBeenCalledTimes(1);
    } finally { await reader.cancel().catch(() => undefined); }
  });
  test('an absent original cookie refuses before opening a descriptor', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/aria/resources/content'), params);
    expect(response.status).toBe(403); expect(openVerifiedAriaResourceFile).not.toHaveBeenCalled();
  });
  test('revocation during parameter resolution refuses before opening a descriptor', async () => {
    let release!: (value: { resourceId: string; resourceVersionId: string }) => void;
    const delayed = new Promise<{ resourceId: string; resourceVersionId: string }>(resolve => { release = resolve; });
    const pending = GET(await request(), { params: delayed });
    // An awaited auth/cookie reader must finish before params are released.
    await new Promise(resolve => setImmediate(resolve));
    await prisma.user.update({ where: { id: child.studentUser }, data: { sessionVersion: { increment: 1 } } });
    release(await params.params);
    expect((await pending).status).toBe(403); expect(openVerifiedAriaResourceFile).not.toHaveBeenCalled();
  });
  test('client cancellation closes the real descriptor exactly once', async () => {
    const response = await GET(await request(), params); const reader = response.body!.getReader();
    await reader.read(); await reader.cancel(); expect(close).toHaveBeenCalledTimes(1);
  });
  test('commercial expiry during the final identity await prevents publication of the first byte', async () => {
    const response = await GET(await request(), params); expect(response.status).toBe(200);
    const expires = new Date(Date.now() + 1000);
    await prisma.entitlement.update({ where: { id: child.entitlement }, data: { endsAt: expires } });
    const intercepted = delayFinalV1Verification(prisma, expires);
    const reader = response.body!.getReader();
    try { await expect(reader.read()).rejects.toThrow(); expect(intercepted.didWait()).toBe(true); expect(close).toHaveBeenCalledTimes(1); }
    finally { intercepted.restore(); await reader.cancel().catch(() => undefined); }
  });
});
