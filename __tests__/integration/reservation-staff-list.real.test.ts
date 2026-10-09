/** Disposable PostgreSQL: filters and pagination precede private metadata retrieval. */
jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/reservation/route';
const academyId = `synthetic-list-${randomUUID()}`;
const invoke = (page: number) => GET(new NextRequest(`http://localhost:3000/api/reservation?academyId=${academyId}&status=PENDING&page=${page}&limit=2`));
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.DATABASE_URL || '');
  await prisma.stageReservation.createMany({ data: ['a', 'b', 'c', 'd'].map(suffix => ({
    id: `${academyId}-${suffix}`, academyId, academyTitle: 'Synthetic stage', parentName: 'Synthetic Parent',
    email: `${suffix}-${academyId}@example.test`, phone: '55000003', classe: 'Terminale', price: 350,
    status: suffix === 'd' ? 'CANCELLED' : 'PENDING', createdAt: new Date('2026-10-04T00:00:00Z'),
    scoringResult: { privateFixtureMarker: 'SYNTHETIC_DIAGNOSTIC_NOT_FOR_LISTING' },
  })) });
});
beforeEach(() => jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } } as never));
afterAll(async () => {
  await prisma.stageReservation.deleteMany({ where: { academyId } });
  await prisma.$disconnect();
});
test('filters before pagination, breaks timestamp ties and omits diagnostic JSON', async () => {
  const first = await invoke(1); const second = await invoke(2);
  expect([first.status, second.status]).toEqual([200, 200]);
  const firstPage = await first.json(); const secondPage = await second.json();
  expect(firstPage).toMatchObject({ count: 2, hasNext: true });
  expect(secondPage).toMatchObject({ count: 1, hasNext: false });
  expect(firstPage.reservations.map((row: { id: string }) => row.id)).toEqual([`${academyId}-c`, `${academyId}-b`]);
  expect(secondPage.reservations.map((row: { id: string }) => row.id)).toEqual([`${academyId}-a`]);
  expect(JSON.stringify([firstPage, secondPage]).includes('SYNTHETIC_DIAGNOSTIC_NOT_FOR_LISTING')).toBe(false);
  expect(first.headers.get('cache-control')).toContain('no-store');
});
test('an outsider cannot fetch the known private academy by guessed query parameters', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-outsider', role: 'PARENT' } } as never);
  const response = await invoke(1);
  expect(response.status).toBe(403);
  expect(JSON.stringify(await response.json()).includes(academyId)).toBe(false);
});
