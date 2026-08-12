import { NextRequest } from 'next/server';

import { createGetAttemptReportHandler } from '@/lib/bilans/api/get-report';
import { audienceArtifactChecksum } from '@/lib/bilans/core/report-materialization';

/**
 * Accès des familles aux bilans publiés depuis les dashboards :
 * - le parent lit le compte rendu parents ET le document remis à l'enfant ;
 * - l'élève lit le sien, et rien d'autre ;
 * - le document interne NEXUS n'est JAMAIS servi à une famille ;
 * - aucun accès croisé entre familles (isolation).
 */

const NOW = new Date('2026-08-12T10:00:00Z');

const ATTEMPT = {
  id: 'attempt-1',
  studentId: 'student-1',
  status: 'PUBLISHED',
  assessmentPackId: 'entree-seconde-maths-v1',
  assessmentPackVersion: '1',
};

function artifactRow(audience: 'ELEVE' | 'PARENTS') {
  const html = `<html>${audience.toLowerCase()}</html>`;
  return {
    publishedAt: NOW,
    currentPublishedRevision: {
      id: 'revision-1',
      status: 'COACH_VALIDATED',
      validationFailures: [],
      materialization: {
        audienceArtifacts: [{
          audience,
          html,
          pdf: null,
          pdfStatus: 'UNAVAILABLE',
          checksum: audienceArtifactChecksum({ audience, html, pdfStatus: 'UNAVAILABLE', pdf: null }),
        }],
      },
    },
  };
}

function dependenciesFor(session: { user: { id: string; role: string } }, capture: { audienceWhere?: unknown } = {}) {
  return {
    authenticate: async () => session,
    now: () => NOW,
    resolvePack: () => ({ pack: {}, validatedPack: {}, checksum: 'x', path: 'p' }),
    prisma: {
      canonicalAssessmentAttempt: { findUnique: jest.fn(async () => ATTEMPT) },
      student: {
        findUnique: jest.fn(async ({ where }: { where: { userId: string } }) => (
          where.userId === 'user-eleve-1' ? { id: 'student-1' } : { id: 'student-autre' }
        )),
        findFirst: jest.fn(async ({ where }: { where: { parent: { userId: string } } }) => (
          where.parent.userId === 'user-parent-1' ? { id: 'student-1' } : null
        )),
      },
      parentStudentLink: {
        findFirst: jest.fn(async () => ({ id: 'l', state: 'VERIFIED', verifiedAt: NOW, revokedAt: null, expiresAt: null })),
      },
      reportArtifact: {
        findFirst: jest.fn(async (args: { select: { currentPublishedRevision: { select: { materialization: { select: { audienceArtifacts: { where: { audience: 'ELEVE' | 'PARENTS' } } } } } } } }) => {
          const where = args.select.currentPublishedRevision.select.materialization.select.audienceArtifacts.where;
          capture.audienceWhere = where;
          return artifactRow(where.audience);
        }),
      },
      coachProfile: { findUnique: jest.fn(async () => null) },
    },
  } as never;
}

function request(url: string): NextRequest {
  return new NextRequest(`https://nexus.test${url}`);
}

const context = { params: Promise.resolve({ id: 'attempt-1' }) };

describe('Accès famille aux bilans publiés', () => {
  it('parent : compte rendu parents par défaut', async () => {
    const capture: { audienceWhere?: { audience?: string } } = {};
    const handler = createGetAttemptReportHandler(dependenciesFor({ user: { id: 'user-parent-1', role: 'PARENT' } }, capture));
    const response = await handler(request('/api/bilans/attempts/attempt-1/report?format=html'), context);
    expect(response.status).toBe(200);
    expect(capture.audienceWhere?.audience).toBe('PARENTS');
  });

  it('parent : peut demander le document remis à son enfant (audience=ELEVE)', async () => {
    const capture: { audienceWhere?: { audience?: string } } = {};
    const handler = createGetAttemptReportHandler(dependenciesFor({ user: { id: 'user-parent-1', role: 'PARENT' } }, capture));
    const response = await handler(request('/api/bilans/attempts/attempt-1/report?format=html&audience=ELEVE'), context);
    expect(response.status).toBe(200);
    expect(capture.audienceWhere?.audience).toBe('ELEVE');
  });

  it('GARDE : le document NEXUS n’est jamais servi à un parent ni à un élève', async () => {
    for (const user of [{ id: 'user-parent-1', role: 'PARENT' }, { id: 'user-eleve-1', role: 'ELEVE' }]) {
      const handler = createGetAttemptReportHandler(dependenciesFor({ user }));
      const response = await handler(request('/api/bilans/attempts/attempt-1/report?audience=NEXUS'), context);
      expect(response.status).toBe(404);
    }
  });

  it('GARDE : un élève ne peut pas demander l’audience parents', async () => {
    const handler = createGetAttemptReportHandler(dependenciesFor({ user: { id: 'user-eleve-1', role: 'ELEVE' } }));
    const response = await handler(request('/api/bilans/attempts/attempt-1/report?audience=PARENTS'), context);
    expect(response.status).toBe(404);
  });

  it('ISOLATION : le parent d’une autre famille reçoit introuvable, même en demandant ELEVE', async () => {
    for (const url of ['/api/bilans/attempts/attempt-1/report', '/api/bilans/attempts/attempt-1/report?audience=ELEVE']) {
      const handler = createGetAttemptReportHandler(dependenciesFor({ user: { id: 'user-parent-autre', role: 'PARENT' } }));
      const response = await handler(request(url), context);
      expect(response.status).toBe(404);
    }
  });

  it('ISOLATION : un autre élève reçoit introuvable', async () => {
    const handler = createGetAttemptReportHandler(dependenciesFor({ user: { id: 'user-eleve-autre', role: 'ELEVE' } }));
    const response = await handler(request('/api/bilans/attempts/attempt-1/report'), context);
    expect(response.status).toBe(404);
  });
});
