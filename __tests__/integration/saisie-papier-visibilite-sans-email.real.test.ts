jest.unmock('@/lib/prisma');

/**
 * Visibilité d'un foyer SANS e-mail sur l'écran de saisie papier — PostgreSQL réel.
 *
 * Défaut attrapé par le parcours E2E, invisible aux tests unitaires : le filtre
 * `paperEntryVisibleStudentWhere` reposait sur `NOT { parent: { is: { user: {
 * is: … } } } }`, dont la logique SQL à trois valeurs écarte une ligne dont le
 * parent a `email = NULL`. Un foyer créé par la saisie papier sans e-mail
 * (flux différé) devenait donc introuvable pour l'assistante juste après
 * création — le parcours se bloquait.
 *
 * Ce test crée exactement ce foyer (parent sans e-mail) et exige qu'il soit
 * résolu par le filtre, tout en vérifiant que les comptes de test restent bien
 * masqués.
 */

import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
import { paperEntryVisibleStudentWhere } from '@/lib/bilans/saisie-papier/test-account-filter';

const PREFIX = `visi-${Date.now()}-`;
const fixtureUserIds = new Set<string>();

async function seedHousehold(input: Readonly<{ studentEmail: string; parentEmail: string | null }>): Promise<string> {
  const parentUser = await prisma.user.create({
    data: { email: input.parentEmail, role: 'PARENT', firstName: 'Foyer', lastName: 'Test', phone: '55000000' },
  });
  fixtureUserIds.add(parentUser.id);
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  const studentUser = await prisma.user.create({ data: { email: input.studentEmail, role: 'ELEVE' } });
  fixtureUserIds.add(studentUser.id);
  const student = await prisma.student.create({
    data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'SECONDE' },
  });
  return student.id;
}

function resolvable(studentId: string) {
  return prisma.student.findFirst({ where: { AND: [{ id: studentId }, paperEntryVisibleStudentWhere()] }, select: { id: true } });
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  try {
    if (fixtureUserIds.size > 0) {
      await cleanupDisposableTestFixture(prisma, { userIds: [...fixtureUserIds] });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('paperEntryVisibleStudentWhere — foyer sans e-mail (PostgreSQL réel)', () => {
  it('résout un foyer dont le PARENT n’a pas d’e-mail (le défaut historique)', async () => {
    const id = await seedHousehold({ studentEmail: `${PREFIX}eleve@nexus-student.local`, parentEmail: null });
    expect((await resolvable(id))?.id).toBe(id);
  });

  it('résout un foyer avec e-mail parent ordinaire', async () => {
    const id = await seedHousehold({ studentEmail: `${PREFIX}eleve2@nexus-student.local`, parentEmail: `${PREFIX}parent@gmail.com` });
    expect((await resolvable(id))?.id).toBe(id);
  });

  it('masque toujours un compte de test (e-mail @example.test)', async () => {
    const id = await seedHousehold({ studentEmail: `${PREFIX}eleve3@nexus-student.local`, parentEmail: `${PREFIX}parent@example.test` });
    expect(await resolvable(id)).toBeNull();
  });

  it('masque toujours un compte de test même si le PARENT est propre mais l’ÉLÈVE est un compte résiduel', async () => {
    const id = await seedHousehold({ studentEmail: `${PREFIX}smoke-residual@example.test`, parentEmail: null });
    expect(await resolvable(id)).toBeNull();
  });
});
