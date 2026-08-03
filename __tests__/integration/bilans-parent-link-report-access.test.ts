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

function database(legacyOwnershipIsCurrent: boolean, verifiedLinkIsCurrent = true) {
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
      findFirst: jest.fn().mockResolvedValue(verifiedLinkIsCurrent ? { id: 'verified-link-1' } : null),
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
        state: 'VERIFIED',
        verifiedAt: { not: null },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      },
      select: { id: true },
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

  test.each([
    ['PENDING'],
    ['REVOKED'],
  ])('refuse en 404 un lien Canonical %s malgré ownership legacy courant', async () => {
    const prisma = database(true, false);
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
    const prisma = database(false, false);
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
