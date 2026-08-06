import { NextRequest, NextResponse } from 'next/server';

import {
  createGetParentChildReportsHandler,
  createGetParentReportHandler,
} from '@/lib/bilans/api/parent-reports';

const NOW = new Date('2026-08-04T08:00:00.000Z');
const parentSession = { user: { id: 'parent-a', role: 'PARENT' } } as never;
const enabledPack = {
  pack: {
    slug: 'fixture-pack',
    version: 1,
    subject: 'MATHS',
    level: 'SECONDE',
  },
} as never;

function publishedAttempt() {
  return {
    id: 'attempt-a1',
    status: 'PUBLISHED',
    assessmentPackId: 'fixture-pack',
    assessmentPackVersion: '1',
    subject: 'MATHEMATIQUES',
    gradeLevel: 'SECONDE',
    updatedAt: NOW,
    reportArtifacts: [{
      currentPublishedRevision: {
        status: 'COACH_VALIDATED',
        validationFailures: [],
        materialization: { audienceArtifacts: [{ id: 'parents-artifact' }] },
      },
    }],
  };
}

function database(input: Readonly<{
  owned?: boolean;
  linkState?: 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED' | null;
  attempts?: readonly ReturnType<typeof publishedAttempt>[];
  reportAttempt?: object | null;
}> = {}) {
  const findMany = jest.fn(async () => input.attempts ?? []);
  const findAttempt = jest.fn(async () => input.reportAttempt === undefined
    ? publishedAttempt()
    : input.reportAttempt);
  const state = input.linkState === undefined ? 'VERIFIED' : input.linkState;
  const findLink = jest.fn(async () => state === null ? null : ({
    id: `link-${state.toLowerCase()}`,
    state,
    verifiedAt: state === 'VERIFIED' ? NOW : null,
    revokedAt: state === 'REVOKED' ? NOW : null,
    expiresAt: state === 'EXPIRED' ? new Date('2026-08-03T08:00:00.000Z') : null,
  }));
  return {
    student: { findFirst: jest.fn(async () => input.owned === false ? null : { id: 'student-a1' }) },
    parentStudentLink: { findFirst: findLink },
    canonicalAssessmentAttempt: { findMany, findFirst: findAttempt },
    findMany,
    findAttempt,
    findLink,
  };
}

const listRequest = new NextRequest('http://localhost/api/parent/children/student-a1/bilans');
const listContext = { params: Promise.resolve({ studentId: 'student-a1' }) };
const reportRequest = (format = 'html') => new NextRequest(
  `http://localhost/api/parent/children/student-a1/bilans/attempt-a1/report?format=${format}`,
);
const reportContext = {
  params: Promise.resolve({ studentId: 'student-a1', attemptId: 'attempt-a1' }),
};

function expectPrivateNoStore(response: Response): void {
  expect(response.headers.get('cache-control')).toEqual(expect.stringContaining('private'));
  expect(response.headers.get('cache-control')).toEqual(expect.stringContaining('no-store'));
  expect(response.headers.get('cache-control')).toEqual(expect.stringContaining('max-age=0'));
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('expires')).toBe('0');
}

describe('GET /api/parent/children/[studentId]/bilans', () => {
  test('returns only minimal Canonical metadata for the owning Parent', async () => {
    const db = database({ attempts: [publishedAttempt()] });
    const response = await createGetParentChildReportsHandler({
      prisma: db as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
    })(listRequest, listContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expectPrivateNoStore(response);
    expect(body).toEqual({
      studentId: 'student-a1',
      bilans: [{
        attemptId: 'attempt-a1',
        level: 'SECONDE',
        subject: 'MATHS',
        title: 'Mathématiques · Seconde',
        status: 'PUBLISHED',
        updatedAt: NOW.toISOString(),
        reportAvailable: true,
      }],
    });
    expect(JSON.stringify(body)).not.toMatch(/score|answer|prompt|content|worker|outbox|assessmentPackId/i);
  });

  test.each([
    ['anonymous', null],
    ['student', { user: { id: 'student-user', role: 'ELEVE' } }],
    ['assistant', { user: { id: 'assistant-user', role: 'ASSISTANTE' } }],
    ['administrator', { user: { id: 'admin-user', role: 'ADMIN' } }],
  ])('refuses an %s caller through the Parent-only route', async (_label, session) => {
    const db = database();
    const response = await createGetParentChildReportsHandler({
      prisma: db as never,
      authenticate: async () => session as never,
      resolvePack: () => enabledPack,
      now: () => NOW,
    })(listRequest, listContext);

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  test('makes another family indistinguishable from an unknown child', async () => {
    const db = database({ owned: false });
    const response = await createGetParentChildReportsHandler({
      prisma: db as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
    })(listRequest, listContext);

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  test.each(['PENDING_PARENT_CONSENT', 'REVOKED', 'EXPIRED'] as const)(
    'refuses a current %s link despite matching legacy ownership',
    async (linkState) => {
      const db = database({ linkState });
      const response = await createGetParentChildReportsHandler({
        prisma: db as never,
        authenticate: async () => parentSession,
        resolvePack: () => enabledPack,
        now: () => NOW,
      })(listRequest, listContext);

      expect(response.status).toBe(404);
      expectPrivateNoStore(response);
      expect(db.findMany).not.toHaveBeenCalled();
    },
  );

  test('refuses legacy ownership when no Canonical link exists', async () => {
    const db = database({ linkState: null });
    const response = await createGetParentChildReportsHandler({
      prisma: db as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
    })(listRequest, listContext);

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  test('uses the latest Canonical link as authority', async () => {
    const db = database();
    const response = await createGetParentChildReportsHandler({
      prisma: db as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
    })(listRequest, listContext);

    expect(response.status).toBe(200);
    expect(db.findLink).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    }));
  });

  test('hides attempts whose pack is not currently enabled', async () => {
    const response = await createGetParentChildReportsHandler({
      prisma: database({ attempts: [publishedAttempt()] }) as never,
      authenticate: async () => parentSession,
      resolvePack: () => null,
      now: () => NOW,
    })(listRequest, listContext);

    expect(await response.json()).toEqual({ studentId: 'student-a1', bilans: [] });
    expectPrivateNoStore(response);
  });
});

describe('GET /api/parent/children/[studentId]/bilans/[attemptId]/report', () => {
  test('serves only the delegated Parents projection with private no-store headers', async () => {
    const serveReport = jest.fn(async () => new NextResponse('<html>__PARENT_CHANNEL__</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    const response = await createGetParentReportHandler({
      prisma: database() as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
      serveReport,
    })(reportRequest(), reportContext);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('__PARENT_CHANNEL__');
    expect(body).not.toMatch(/__STUDENT_CHANNEL__|__NEXUS_CHANNEL__|__VERIFIER_CHANNEL__|__INTERNAL_CHANNEL__/);
    expectPrivateNoStore(response);
    expect(serveReport).toHaveBeenCalledTimes(1);
  });

  test('refuses a substituted attempt before reading a report', async () => {
    const db = database({ reportAttempt: null });
    const serveReport = jest.fn();
    const response = await createGetParentReportHandler({
      prisma: db as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
      serveReport,
    })(reportRequest(), reportContext);

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(serveReport).not.toHaveBeenCalled();
  });

  test('preserves PDF metadata while preventing authenticated response caching', async () => {
    const response = await createGetParentReportHandler({
      prisma: database() as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
      serveReport: async () => new NextResponse(new Uint8Array(Buffer.from('%PDF-fixture')), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'inline; filename="bilan.pdf"',
        },
      }),
    })(reportRequest('pdf'), reportContext);

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="bilan.pdf"');
    expectPrivateNoStore(response);
  });

  test('does not turn a non-published report failure into public content', async () => {
    const response = await createGetParentReportHandler({
      prisma: database() as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
      serveReport: async () => NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }),
    })(reportRequest(), reportContext);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'NOT_FOUND' } });
    expectPrivateNoStore(response);
  });

  test.each([
    ['malformed child', '../student', 'attempt-a1'],
    ['malformed attempt', 'student-a1', '../attempt'],
  ])('returns a private fail-closed response for a %s identifier', async (_label, studentId, attemptId) => {
    const response = await createGetParentReportHandler({
      prisma: database() as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
      serveReport: jest.fn(),
    })(
      new NextRequest(`http://localhost/api/parent/children/${studentId}/bilans/${attemptId}/report`),
      { params: Promise.resolve({ studentId, attemptId }) },
    );

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
  });

  test('reduces an internal failure without stack and forbids caching the error', async () => {
    const db = database();
    db.student.findFirst.mockRejectedValueOnce(new Error('private-stack-marker'));
    const response = await createGetParentReportHandler({
      prisma: db as never,
      authenticate: async () => parentSession,
      resolvePack: () => enabledPack,
      now: () => NOW,
      serveReport: jest.fn(),
    })(reportRequest(), reportContext);
    const body = await response.text();

    expect(response.status).toBe(500);
    expectPrivateNoStore(response);
    expect(body).not.toContain('private-stack-marker');
    expect(body).not.toMatch(/stack/i);
  });
});
