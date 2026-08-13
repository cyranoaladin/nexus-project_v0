import { PrismaClient, Subject } from '@prisma/client';
import { expect, test } from '@playwright/test';

import { assertDisposableE2eDatabase } from '../../helpers/disposable-database';

const LEGACY_STAGE_PATH = '/stages/printemps-2026';
const EXPIRED_STAGE_PREFIX = 'e2e-expired-stage-lifecycle';
const FUTURE_STAGE_PREFIX = 'e2e-future-stage-lifecycle';

function getDisposableDatabaseUrl(): string {
  const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL_REQUIRED');

  assertDisposableE2eDatabase(databaseUrl);
  return databaseUrl;
}

function createStageFixture(params: {
  id: string;
  slug: string;
  title: string;
  startDate: Date;
  endDate: Date;
}) {
  return {
    ...params,
    subject: [Subject.MATHEMATIQUES],
    level: ['Terminale'],
    capacity: 5,
    priceAmount: 350,
    priceCurrency: 'TND',
    location: 'Mutuelleville, Tunis',
    isVisible: true,
    isOpen: true,
  };
}

function extractSitemapPathnames(sitemapXml: string): string[] {
  return Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, value]) => (
    new URL(value).pathname
  ));
}

test.describe('REAL — cycle de vie public des stages expirés', () => {
  test('redirige uniquement la fiche legacy printemps-2026 en 301 vers /stages', async ({ request }) => {
    const response = await request.get(LEGACY_STAGE_PATH, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe('/stages');
  });

  test('masque et refuse un stage expiré tout en conservant un témoin futur', async ({ request }) => {
    const databaseUrl = getDisposableDatabaseUrl();
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    const runId = `${Date.now()}-${process.pid}`;
    const expiredStageId = `${EXPIRED_STAGE_PREFIX}-${runId}`;
    const expiredStageSlug = `${EXPIRED_STAGE_PREFIX}-${runId}`;
    const futureStageId = `${FUTURE_STAGE_PREFIX}-${runId}`;
    const futureStageSlug = `${FUTURE_STAGE_PREFIX}-${runId}`;
    const createdStageIds: string[] = [];

    try {
      const expiredStage = await prisma.stage.create({
        data: createStageFixture({
          id: expiredStageId,
          slug: expiredStageSlug,
          title: 'E2E — stage expiré invisible au public',
          startDate: new Date('2026-04-21T08:00:00.000Z'),
          endDate: new Date('2026-04-25T17:00:00.000Z'),
        }),
      });
      createdStageIds.push(expiredStage.id);

      const futureStage = await prisma.stage.create({
        data: createStageFixture({
          id: futureStageId,
          slug: futureStageSlug,
          title: 'E2E — stage futur témoin',
          startDate: new Date('2099-10-19T08:00:00.000Z'),
          endDate: new Date('2099-10-23T17:00:00.000Z'),
        }),
      });
      createdStageIds.push(futureStage.id);

      const listResponse = await request.get('/api/stages');
      expect(listResponse.status()).toBe(200);
      const listBody = await listResponse.json() as { stages: Array<{ slug: string }> };
      const publicSlugs = listBody.stages.map((stage) => stage.slug);
      expect(publicSlugs).not.toContain(expiredStageSlug);
      expect(publicSlugs).toContain(futureStageSlug);

      const detailApiResponse = await request.get(`/api/stages/${expiredStageSlug}`);
      expect(detailApiResponse.status()).toBe(404);

      const detailPageResponse = await request.get(`/stages/${expiredStageSlug}`);
      expect(detailPageResponse.status()).toBe(404);
      const detailPageHtml = await detailPageResponse.text();
      expect(detailPageHtml).toMatch(/<meta\s+name="robots"\s+content="noindex"\s*\/?>/i);

      const registrationPageResponse = await request.get(`/stages/${expiredStageSlug}/inscription`);
      expect(registrationPageResponse.status()).toBe(404);
      const registrationPageHtml = await registrationPageResponse.text();
      expect(registrationPageHtml).toMatch(/<meta\s+name="robots"\s+content="noindex"\s*\/?>/i);
      expect(registrationPageHtml).not.toMatch(/<form(?:\s|>)/i);

      const registrationResponse = await request.post(`/api/stages/${expiredStageSlug}/inscrire`, {
        data: {
          firstName: 'Eleve',
          lastName: 'Expire',
          email: `eleve-expire-${runId}@example.test`,
          phone: '99123456',
          level: 'Terminale',
          parentFirstName: 'Parent',
          parentLastName: 'Expire',
          parentEmail: `parent-expire-${runId}@example.test`,
          parentPhone: '99123457',
          notes: 'Donnée E2E jetable',
          stageTermsAccepted: true,
          dataProcessingAccepted: true,
        },
      });
      expect(registrationResponse.status()).toBe(404);
      await expect(prisma.stageReservation.count({
        where: { stageId: expiredStageId },
      })).resolves.toBe(0);

      const sitemapResponse = await request.get('/sitemap.xml');
      expect(sitemapResponse.status()).toBe(200);
      const sitemapXml = await sitemapResponse.text();
      const sitemapPathnames = extractSitemapPathnames(sitemapXml);
      expect(sitemapPathnames).not.toContain(`/stages/${expiredStageSlug}`);
      expect(sitemapPathnames).not.toContain(`/stages/${expiredStageSlug}/inscription`);
      expect(sitemapPathnames).toContain(`/stages/${futureStageSlug}`);
      expect(sitemapPathnames).toContain(`/stages/${futureStageSlug}/inscription`);
    } finally {
      try {
        if (createdStageIds.length > 0) {
          const reservations = await prisma.stageReservation.findMany({
            where: { stageId: { in: createdStageIds } },
            select: { id: true },
          });
          const reservationIds = reservations.map(({ id }) => id);
          if (reservationIds.length > 0) {
            await prisma.jobOutbox.deleteMany({
              where: {
                aggregateType: 'STAGE_RESERVATION',
                aggregateId: { in: reservationIds },
              },
            });
          }
          for (const reservation of reservations) {
            await prisma.stageReservation.delete({ where: { id: reservation.id } });
          }

          for (const stageId of [...createdStageIds].reverse()) {
            await prisma.stage.delete({ where: { id: stageId } });
          }
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  });
});
