import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { assertDisposableE2eDatabase } from './disposable-database';

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[E2E] E2E_DATABASE_URL, TEST_DATABASE_URL, or DATABASE_URL must be set — no hardcoded fallback.');
}

assertDisposableE2eDatabase(DATABASE_URL);

let prisma: PrismaClient | null = null;
function getPrisma() {
  if (!prisma) prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  return prisma;
}

export async function getProfilCandidatById(id: string) {
  return getPrisma().profilCandidat.findUnique({ where: { id } });
}

export async function countProfilsCandidatsByStudentOrDefault() {
  return getPrisma().profilCandidat.count();
}

export async function getQuoteWithLines(id: string) {
  return getPrisma().quote.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function countQuotesByProfilId(profilId: string) {
  return getPrisma().quote.count({ where: { profilId } });
}

export interface SyntheticFamilyFixture {
  contactLeadId: string;
  parentUserId: string;
  parentProfileId: string;
  studentId: string;
  studentUserId: string;
}

/**
 * T5R5 §FINDING_11 — creates a real, synthetic ContactLead ("Responsable")
 * + real User/ParentProfile/Student ("Élève") chain, so E2E tests can pass
 * their real ids through the real UI/API flow (createProfilCandidat's own
 * contactLeadId/studentId params, or the staff workspace's own search
 * widgets) — never a direct write of Quote.contactLeadId/studentId
 * themselves, which stays exactly the forbidden pattern this lot
 * replaces. Mirrors __tests__/setup/test-database.ts's own
 * createTestParent/createTestStudent shape.
 */
export async function createSyntheticFamily(
  parentFirstName: string,
  parentLastName: string,
  studentFirstName: string,
  studentLastName: string,
): Promise<SyntheticFamilyFixture> {
  const client = getPrisma();
  const uid = randomUUID().slice(0, 8);
  return client.$transaction(async (tx) => {
    const contactLead = await tx.contactLead.create({
      data: {
        name: `${parentFirstName} ${parentLastName}`,
        email: `${parentFirstName.toLowerCase()}.${parentLastName.toLowerCase()}.${uid}@nexus-e2e-test.com`,
        phone: '+216 99 000 000',
      },
    });
    const parentUser = await tx.user.create({
      data: {
        email: `${parentFirstName.toLowerCase()}.parent.${uid}@nexus-e2e-test.com`,
        role: 'PARENT',
        firstName: parentFirstName,
        lastName: parentLastName,
      },
    });
    const parentProfile = await tx.parentProfile.create({
      data: { userId: parentUser.id, city: 'Tunis', country: 'Tunisie' },
    });
    const studentUser = await tx.user.create({
      data: {
        email: `${studentFirstName.toLowerCase()}.eleve.${uid}@nexus-e2e-test.com`,
        role: 'ELEVE',
        firstName: studentFirstName,
        lastName: studentLastName,
      },
    });
    const student = await tx.student.create({
      data: {
        parentId: parentProfile.id,
        userId: studentUser.id,
        grade: 'Terminale',
        gradeLevel: 'TERMINALE',
        school: 'Lycée E2E Test',
      },
    });
    return {
      contactLeadId: contactLead.id,
      parentUserId: parentUser.id,
      parentProfileId: parentProfile.id,
      studentId: student.id,
      studentUserId: studentUser.id,
    };
  });
}

export async function cleanupSyntheticFamilies(fixtures: SyntheticFamilyFixture[]) {
  if (fixtures.length === 0) return;

  const contactLeadIds = fixtures.map((fixture) => fixture.contactLeadId);
  const studentIds = fixtures.map((fixture) => fixture.studentId);
  const parentProfileIds = fixtures.map((fixture) => fixture.parentProfileId);
  const userIds = fixtures.flatMap((fixture) => [fixture.studentUserId, fixture.parentUserId]);

  await getPrisma().$transaction(async (tx) => {
    const profils = await tx.profilCandidat.findMany({
      where: {
        OR: [
          { contactLeadId: { in: contactLeadIds } },
          { studentId: { in: studentIds } },
        ],
      },
      select: { id: true },
    });
    const profilIds = profils.map((profil) => profil.id);

    await tx.quote.deleteMany({
      where: {
        OR: [
          { profilId: { in: profilIds } },
          { contactLeadId: { in: contactLeadIds } },
          { studentId: { in: studentIds } },
        ],
      },
    });
    await tx.profilCandidat.deleteMany({ where: { id: { in: profilIds } } });
    await tx.student.deleteMany({ where: { id: { in: studentIds } } });
    await tx.parentProfile.deleteMany({ where: { id: { in: parentProfileIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.contactLead.deleteMany({ where: { id: { in: contactLeadIds } } });
  });
}

export async function disconnectCandidatIndividuelDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
