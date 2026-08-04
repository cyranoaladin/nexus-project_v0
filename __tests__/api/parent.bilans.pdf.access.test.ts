import { NextRequest } from 'next/server';

import { createGetLegacyParentBilanPdfHandler } from '@/lib/bilans/api/legacy-parent-pdf';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const FUTURE = new Date('2027-08-04T10:00:00.000Z');
const parentSession = { user: { id: 'parent-user-1', role: 'PARENT' } } as never;

function request(id = 'bilan-1') {
  return new NextRequest(`http://localhost/api/parent/bilans/${id}/pdf`);
}

function params(id = 'bilan-1') {
  return { params: Promise.resolve({ id }) };
}

function publishedBilan() {
  return {
    id: 'bilan-1',
    studentId: 'student-1',
    subject: 'MATHEMATIQUES',
    studentName: 'Yasmine',
    globalScore: 16,
    parentsMarkdown: '__PARENT_CHANNEL__',
    studentMarkdown: '__STUDENT_CHANNEL__',
    nexusMarkdown: '__NEXUS_CHANNEL__',
    analysisJson: { marker: '__INTERNAL_CHANNEL__' },
    publishedAt: new Date('2026-05-01T10:00:00.000Z'),
    createdAt: new Date('2026-05-01T09:00:00.000Z'),
    stage: { title: 'Stage Printemps' },
    coach: { pseudonym: 'Coach A' },
    student: { user: { firstName: 'Yasmine', lastName: 'B.' } },
  };
}

type LinkState = 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';

function database(input: Readonly<{
  legacyOwner?: boolean;
  linkState?: LinkState | null;
  bilan?: ReturnType<typeof publishedBilan> | null;
}> = {}) {
  const bilan = input.bilan === undefined ? publishedBilan() : input.bilan;
  const findBilan = jest.fn(async () => bilan);
  const findStudent = jest.fn(async () => input.legacyOwner === false ? null : { id: 'student-1' });
  const state = input.linkState === undefined ? 'VERIFIED' : input.linkState;
  const findLink = jest.fn(async () => state === null ? null : {
    id: `link-${state.toLowerCase()}`,
    state,
    verifiedAt: state === 'VERIFIED' ? NOW : null,
    revokedAt: state === 'REVOKED' ? NOW : null,
    expiresAt: state === 'EXPIRED' ? new Date('2026-08-03T10:00:00.000Z') : FUTURE,
  });
  return {
    bilan: { findFirst: findBilan },
    student: { findFirst: findStudent },
    parentStudentLink: { findFirst: findLink },
    findBilan,
    findStudent,
    findLink,
  };
}

function expectPrivateNoStore(response: Response): void {
  expect(response.headers.get('cache-control')).toEqual(expect.stringContaining('private'));
  expect(response.headers.get('cache-control')).toEqual(expect.stringContaining('no-store'));
  expect(response.headers.get('cache-control')).toEqual(expect.stringContaining('max-age=0'));
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('expires')).toBe('0');
  expect(response.headers.get('etag')).toBeNull();
}

function handler(input: Readonly<{
  db?: ReturnType<typeof database>;
  session?: unknown;
  renderPdf?: jest.Mock;
}> = {}) {
  const db = input.db ?? database();
  const renderPdf = input.renderPdf ?? jest.fn(async () => Buffer.from('%PDF-safe'));
  return {
    db,
    renderPdf,
    GET: createGetLegacyParentBilanPdfHandler({
      prisma: db as never,
      authenticate: async () => input.session === undefined ? parentSession : input.session as never,
      renderPdf,
      now: () => NOW,
    }),
  };
}

describe('GET /api/parent/bilans/[id]/pdf — fermeture P0-C', () => {
  test('refuses an unauthenticated direct request without allowing it to be cached', async () => {
    const { GET, renderPdf } = handler({ session: null });
    const response = await GET(request(), params());

    expect(response.status).toBe(401);
    expectPrivateNoStore(response);
    expect(renderPdf).not.toHaveBeenCalled();
  });

  test('returns only a valid Parents PDF to the current verified owner', async () => {
    const { GET, db, renderPdf } = handler();
    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(4);
    expectPrivateNoStore(response);
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({
      parentsMarkdown: '__PARENT_CHANNEL__',
    }));
    expect(renderPdf).toHaveBeenCalledWith(expect.not.objectContaining({
      studentMarkdown: expect.anything(),
      nexusMarkdown: expect.anything(),
      analysisJson: expect.anything(),
    }));
    expect(db.findLink).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    }));
  });

  test.each<LinkState>(['PENDING_PARENT_CONSENT', 'REVOKED', 'EXPIRED'])(
    'refuses a current %s link even when legacy ownership still matches',
    async (linkState) => {
      const { GET, renderPdf } = handler({ db: database({ linkState }) });
      const response = await GET(request(), params());

      expect(response.status).toBe(404);
      expectPrivateNoStore(response);
      expect(renderPdf).not.toHaveBeenCalled();
    },
  );

  test('refuses missing Canonical linkage instead of falling back to legacy ownership', async () => {
    const { GET, renderPdf } = handler({ db: database({ linkState: null }) });
    const response = await GET(request(), params());

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(renderPdf).not.toHaveBeenCalled();
  });

  test('refuses a foreign family and a Student caller without disclosing the bilan', async () => {
    const foreign = handler({ db: database({ legacyOwner: false }) });
    const student = handler({ session: { user: { id: 'student-user', role: 'ELEVE' } } });

    const [foreignResponse, studentResponse] = await Promise.all([
      foreign.GET(request(), params()),
      student.GET(request(), params()),
    ]);

    expect(foreignResponse.status).toBe(404);
    expect(studentResponse.status).toBe(404);
    expectPrivateNoStore(foreignResponse);
    expectPrivateNoStore(studentResponse);
    expect(foreign.renderPdf).not.toHaveBeenCalled();
    expect(student.renderPdf).not.toHaveBeenCalled();
  });

  test.each([
    ['unknown', 'unknown-bilan', database({ bilan: null })],
    ['unpublished', 'draft-bilan', database({ bilan: null })],
    ['malformed', '../private', database()],
  ])('refuses an %s identifier without a cacheable disclosure', async (_label, id, db) => {
    const { GET, renderPdf } = handler({ db });
    const response = await GET(request(id), params(id));

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(renderPdf).not.toHaveBeenCalled();
  });

  test('returns a private generic error without stack, path or cross-audience marker', async () => {
    const renderPdf = jest.fn(async () => {
      throw new Error('localPath=/var/www/private/__NEXUS_CHANNEL__');
    });
    const { GET } = handler({ renderPdf });
    const response = await GET(request(), params());
    const body = await response.text();

    expect(response.status).toBe(500);
    expectPrivateNoStore(response);
    expect(body).not.toMatch(/\/var\/www|localPath|__NEXUS_CHANNEL__|stack/i);
  });
});
