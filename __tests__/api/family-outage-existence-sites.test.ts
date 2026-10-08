/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('server-only', () => ({}));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/video-mode', () => ({ getVideoMode: jest.fn().mockReturnValue('ENABLED') }));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'),
  resolveParentStudentAccess: jest.fn(), familyAuthorityAvailable: jest.fn(),
}));

import { DocumentVisibilityScope } from '@prisma/client';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { familyAuthorityAvailable, resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';
import { GET as sessionRead } from '@/app/api/sessions/[sessionId]/route';
import { GET as sessionReport } from '@/app/api/coach/sessions/[sessionId]/report/route';

const parent = { id: 'synthetic-parent', role: 'PARENT' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: parent } as never);
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'AUTHORITY_UNAVAILABLE' });
  jest.mocked(familyAuthorityAvailable).mockResolvedValue(false);
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: 'synthetic-student' } as never);
});

async function statusOf(decision: Awaited<ReturnType<typeof readAuthorizedDocument>>): Promise<number> {
  return decision.status === 'DENIED' ? decision.response.status : 200;
}

describe('during a family authority outage a parent cannot learn whether an ID exists', () => {
  const familyDocument = { id: 'synthetic-document', userId: 'synthetic-student-user',
    visibilityScope: DocumentVisibilityScope.STUDENT_AND_PARENT,
    user: { id: 'synthetic-student-user', student: { id: 'synthetic-student' } } };

  test.each([
    ['an unknown document', null],
    ['an administrative document', { ...familyDocument, visibilityScope: DocumentVisibilityScope.ADMIN_ONLY }],
    ['a document of a user without student profile', { ...familyDocument, user: { id: 'synthetic-user', student: null } }],
  ])('document download: %s answers like a family document', async (_label, scope) => {
    jest.mocked(prisma.userDocument.findUnique).mockResolvedValue(familyDocument as never);
    const existing = await statusOf(await readAuthorizedDocument('synthetic-document', parent));
    jest.mocked(prisma.userDocument.findUnique).mockResolvedValue(scope as never);
    const other = await statusOf(await readAuthorizedDocument('synthetic-document', parent));
    expect(existing).toBe(503);
    expect(other).toBe(existing);
  });

  test.each([
    ['session room', () => sessionRead(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session'),
      { params: Promise.resolve({ sessionId: 'synthetic-session' }) }), () => jest.mocked(prisma.sessionBooking.findFirst)],
    ['session report', () => sessionReport(new NextRequest('https://nexusreussite.academy/api/coach/sessions/synthetic-session/report'),
      { params: Promise.resolve({ sessionId: 'synthetic-session' }) }), () => jest.mocked(prisma.sessionBooking.findUnique)],
  ] as const)('%s: an unknown session answers like an existing one', async (_label, invoke, lookup) => {
    lookup().mockResolvedValue({ id: 'synthetic-session', studentId: 'synthetic-student-user', coachId: 'synthetic-coach' } as never);
    const existing = await invoke();
    lookup().mockResolvedValue(null);
    const unknown = await invoke();
    expect(existing.status).toBe(503);
    expect(unknown.status).toBe(existing.status);
    expect(await unknown.json()).toEqual(await existing.json());
    expect(unknown.headers.get('cache-control')).toContain('no-store');
  });

  test('session room: a booking whose student profile vanished answers like an existing one', async () => {
    jest.mocked(prisma.sessionBooking.findFirst).mockResolvedValue({ studentId: 'synthetic-student-user' } as never);
    jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
    const response = await sessionRead(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session'),
      { params: Promise.resolve({ sessionId: 'synthetic-session' }) });
    expect(response.status).toBe(503);
  });
});

describe('with family authority available the historical answers are unchanged', () => {
  beforeEach(() => jest.mocked(familyAuthorityAvailable).mockResolvedValue(true));

  test('an unknown document stays 404', async () => {
    jest.mocked(prisma.userDocument.findUnique).mockResolvedValue(null);
    expect(await statusOf(await readAuthorizedDocument('synthetic-document', parent))).toBe(404);
  });

  test('an unknown session stays 404 for the room and the report', async () => {
    jest.mocked(prisma.sessionBooking.findFirst).mockResolvedValue(null);
    jest.mocked(prisma.sessionBooking.findUnique).mockResolvedValue(null);
    const params = { params: Promise.resolve({ sessionId: 'synthetic-session' }) };
    expect((await sessionRead(new NextRequest('https://nexusreussite.academy/api/sessions/synthetic-session'), params)).status).toBe(404);
    expect((await sessionReport(new NextRequest('https://nexusreussite.academy/api/coach/sessions/synthetic-session/report'), params)).status).toBe(404);
  });
});
