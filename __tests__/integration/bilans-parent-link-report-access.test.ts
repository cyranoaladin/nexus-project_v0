import { NextRequest } from 'next/server';

import { audienceArtifactChecksum } from '@/lib/bilans/core/report-artifact-integrity';
import { createGetAttemptReportHandler } from '@/lib/bilans/api/get-report';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const HTML = '<html><body>Bilan parents</body></html>';
const PACK = { slug: 'fixture-non-publiable-v0', version: 1 } as const;

function request(): NextRequest {
  return new NextRequest('http://localhost/api/bilans/attempts/attempt-1/report');
}

function context() {
  return { params: Promise.resolve({ id: 'attempt-1' }) };
}

function parentSession() {
  return {
    user: { id: 'parent-user-1', role: 'PARENT', email: 'parent@example.test' },
  } as never;
}

function reportArtifact() {
  const pdfStatus = 'UNAVAILABLE' as const;
  return {
    publishedAt: NOW,
    currentPublishedRevision: {
      id: 'revision-1',
      status: 'COACH_VALIDATED',
      validationFailures: [],
      materialization: {
        audienceArtifacts: [{
          audience: 'PARENTS',
          html: HTML,
          pdf: null,
          pdfStatus,
          checksum: audienceArtifactChecksum({ audience: 'PARENTS', html: HTML, pdf: null, pdfStatus }),
        }],
      },
    },
  };
}

type LinkState = 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';

function database(legacyOwnershipIsCurrent: boolean, linkState: LinkState | null = 'VERIFIED') {
  return {
    canonicalAssessmentAttempt: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'attempt-1',
        studentId: 'student-1',
        status: 'PUBLISHED',
        assessmentPackId: PACK.slug,
        assessmentPackVersion: String(PACK.version),
      }),
    },
    student: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(legacyOwnershipIsCurrent ? { id: 'student-1' } : null),
    },
    parentStudentLink: {
      findFirst: jest.fn().mockResolvedValue(linkState === null ? null : {
        id: `link-${linkState.toLowerCase()}`,
        state: linkState,
        verifiedAt: linkState === 'VERIFIED' ? NOW : null,
        revokedAt: linkState === 'REVOKED' ? NOW : null,
        expiresAt: linkState === 'EXPIRED' ? new Date('2026-08-02T12:00:00.000Z') : null,
      }),
    },
    coachProfile: { findUnique: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn() },
    reportArtifact: { findFirst: jest.fn().mockResolvedValue(reportArtifact()) },
  };
}

describe('GET /api/bilans/attempts/[id]/report — double garde parentale', () => {
  test('sert le bilan au parent qui détient à la fois ownership legacy et lien Canonical courant VERIFIED', async () => {
    const prisma = database(true);
    const handler = createGetAttemptReportHandler({
      prisma: prisma as never,
      authenticate: async () => parentSession(),
      resolvePack: () => ({ pack: PACK }) as never,
      now: () => NOW,
    });

    const response = await handler(request(), context());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(HTML);
    expect(prisma.parentStudentLink.findFirst).toHaveBeenCalledWith({
      where: {
        parentUserId: 'parent-user-1',
        studentId: 'student-1',
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: { id: true, state: true, verifiedAt: true, revokedAt: true, expiresAt: true },
    });
  });

  test('refuse un ancien parent dont le lien Canonical reste VERIFIED après réassignation legacy', async () => {
    const prisma = database(false);
    const handler = createGetAttemptReportHandler({
      prisma: prisma as never,
      authenticate: async () => parentSession(),
      resolvePack: () => ({ pack: PACK }) as never,
      now: () => NOW,
    });

    const response = await handler(request(), context());

    expect(response.status).toBe(404);
    expect(prisma.reportArtifact.findFirst).not.toHaveBeenCalled();
  });

  test.each<LinkState>([
    'PENDING_PARENT_CONSENT',
    'REVOKED',
    'EXPIRED',
  ])('refuse en 404 un lien Canonical %s malgré ownership legacy courant', async (state) => {
    const prisma = database(true, state);
    const handler = createGetAttemptReportHandler({
      prisma: prisma as never,
      authenticate: async () => parentSession(),
      resolvePack: () => ({ pack: PACK }) as never,
      now: () => NOW,
    });

    const response = await handler(request(), context());

    expect(response.status).toBe(404);
    expect(prisma.reportArtifact.findFirst).not.toHaveBeenCalled();
  });

  test('refuse un lien VERIFIED expiré même si son enum n\'a pas encore été synchronisé', async () => {
    const prisma = database(true, 'VERIFIED');
    prisma.parentStudentLink.findFirst.mockResolvedValueOnce({
      id: 'verified-but-expired',
      state: 'VERIFIED',
      verifiedAt: NOW,
      revokedAt: null,
      expiresAt: new Date('2026-08-02T12:00:00.000Z'),
    });
    const handler = createGetAttemptReportHandler({
      prisma: prisma as never,
      authenticate: async () => parentSession(),
      resolvePack: () => ({ pack: PACK }) as never,
      now: () => NOW,
    });

    const response = await handler(request(), context());

    expect(response.status).toBe(404);
    expect(prisma.reportArtifact.findFirst).not.toHaveBeenCalled();
  });

  test('refuse en 404 un parent sans ownership legacy et sans lien Canonical', async () => {
    const prisma = database(false, null);
    const handler = createGetAttemptReportHandler({
      prisma: prisma as never,
      authenticate: async () => parentSession(),
      resolvePack: () => ({ pack: PACK }) as never,
      now: () => NOW,
    });

    const response = await handler(request(), context());

    expect(response.status).toBe(404);
    expect(prisma.parentStudentLink.findFirst).not.toHaveBeenCalled();
    expect(prisma.reportArtifact.findFirst).not.toHaveBeenCalled();
  });
});
