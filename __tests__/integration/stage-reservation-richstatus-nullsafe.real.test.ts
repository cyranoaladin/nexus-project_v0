jest.unmock('@/lib/prisma');

/**
 * Deuxième instance de la classe « NOT sur champ nullable » (PostgreSQL réel).
 *
 * `StageReservation.richStatus` est nullable (compat legacy). Le planning
 * assistante filtrait les réservations annulées avec
 * `NOT: [{ richStatus: 'CANCELLED' }, …]` : en logique SQL à trois valeurs,
 * `NOT (richStatus = 'CANCELLED')` vaut NULL quand `richStatus` est NULL, et
 * la réservation legacy disparaissait du filtre — même mécanique que le foyer
 * sans e-mail invisible en saisie papier.
 *
 * Ce test matérialise la classe : la ligne à richStatus NULL est écartée par
 * l'ANCIEN prédicat et trouvée par le NOUVEAU (null-safe).
 */

import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';

const PREFIX = `richnull-${Date.now()}`;
let stageId = '';

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await prisma.$queryRaw`SELECT 1`;
  const stage = await prisma.stage.create({
    data: {
      slug: `${PREFIX}-stage`,
      title: 'Stage test classe NOT-nullable',
      startDate: new Date('2026-08-17'),
      endDate: new Date('2026-08-21'),
      priceAmount: 0,
    },
    select: { id: true },
  });
  stageId = stage.id;
  await prisma.stageReservation.create({
    data: {
      stageId,
      parentName: `Test ${PREFIX}`,
      email: `${PREFIX}@nexus-internal.local`,
      phone: '55000001',
      classe: 'Seconde',
      academyId: `${PREFIX}-academy`,
      academyTitle: 'Stage test',
      price: 0,
      status: 'CONFIRMED',
      richStatus: null,
    },
  });
});

afterAll(async () => {
  try {
    if (stageId) {
      await prisma.stageReservation.deleteMany({ where: { stageId } });
      await prisma.stage.deleteMany({ where: { id: stageId } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('richStatus nullable — prédicat null-safe (PostgreSQL réel)', () => {
  it('l’ancien prédicat écarte la réservation legacy, le nouveau la trouve', async () => {

    const oldPredicate = await prisma.stageReservation.findFirst({
      where: {
        stageId,
        NOT: [{ richStatus: 'CANCELLED' }, { status: 'CANCELLED' }],
      },
      select: { id: true },
    });
    const newPredicate = await prisma.stageReservation.findFirst({
      where: {
        stageId,
        AND: [
          { OR: [{ richStatus: null }, { NOT: { richStatus: 'CANCELLED' } }] },
          { NOT: { status: 'CANCELLED' } },
        ],
      },
      select: { id: true },
    });

    // La classe de bug, matérialisée : NULL fait disparaître la ligne de
    // l'ancien prédicat…
    expect(oldPredicate).toBeNull();
    // …le prédicat null-safe la retrouve.
    expect(newPredicate).not.toBeNull();
  });

  it('une réservation réellement annulée (richStatus CANCELLED) reste exclue par le nouveau prédicat', async () => {
    await prisma.stageReservation.create({
      data: {
        stageId,
        parentName: `Test ${PREFIX}`,
        email: `${PREFIX}-cancel@nexus-internal.local`,
        phone: '55000002',
        classe: 'Seconde',
        academyId: `${PREFIX}-academy`,
        academyTitle: 'Stage test',
        price: 0,
        status: 'CONFIRMED',
        richStatus: 'CANCELLED',
      },
    });
    const found = await prisma.stageReservation.findMany({
      where: {
        stageId,
        AND: [
          { OR: [{ richStatus: null }, { NOT: { richStatus: 'CANCELLED' } }] },
          { NOT: { status: 'CANCELLED' } },
        ],
      },
      select: { richStatus: true },
    });
    expect(found).toHaveLength(1);
    expect(found[0].richStatus).toBeNull();
  });
});
