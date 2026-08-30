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

export type CandidatIndividuelConfigKey = {
  namespace: 'pricing.candidatIndividuelPipeline' | 'quotes.costPolicy';
  key: 'state' | 'default';
};

export interface RawBusinessConfigSnapshot extends CandidatIndividuelConfigKey {
  row: {
    id: string;
    value: unknown;
    schemaVersion: string;
    version: number;
    previousValue: unknown;
    updatedBy: string;
    updatedAt: Date;
    createdAt: Date;
  } | null;
  audits: Array<{
    id: string;
    oldValue: unknown;
    newValue: unknown;
    version: number;
    changedBy: string;
    changedAt: Date;
  }>;
}

export interface BusinessConfigMutationRef extends CandidatIndividuelConfigKey {
  rowId: string;
  version: number;
}

export async function getCandidatIndividuelBusinessConfigMutation(
  namespace: CandidatIndividuelConfigKey['namespace'],
  key: CandidatIndividuelConfigKey['key'],
) {
  const row = await getPrisma().businessConfig.findUnique({
    where: { namespace_key: { namespace, key } },
    select: { id: true, namespace: true, key: true, value: true, version: true },
  });
  if (!row) throw new Error(`[E2E] Missing committed config mutation for ${namespace}/${key}`);
  return {
    mutation: { rowId: row.id, namespace, key, version: row.version } satisfies BusinessConfigMutationRef,
    value: row.value,
  };
}

const CANDIDAT_INDIVIDUEL_CONFIG_KEYS: CandidatIndividuelConfigKey[] = [
  { namespace: 'pricing.candidatIndividuelPipeline', key: 'state' },
  { namespace: 'quotes.costPolicy', key: 'default' },
];

export async function snapshotCandidatIndividuelBusinessConfig(): Promise<RawBusinessConfigSnapshot[]> {
  return getPrisma().$transaction(async (tx) => Promise.all(
    CANDIDAT_INDIVIDUEL_CONFIG_KEYS.map(async ({ namespace, key }) => {
      const [row, audits] = await Promise.all([
        tx.businessConfig.findUnique({ where: { namespace_key: { namespace, key } } }),
        tx.businessConfigAudit.findMany({
          where: { namespace, key },
          orderBy: { version: 'asc' },
        }),
      ]);
      return { namespace, key, row, audits };
    }),
  ));
}

export async function removeBusinessConfigRowsCreatedByE2e(
  initial: RawBusinessConfigSnapshot[],
  mutations: BusinessConfigMutationRef[],
) {
  await getPrisma().$transaction(async (tx) => {
    for (const snapshot of initial) {
      if (snapshot.row !== null) continue;
      if (snapshot.audits.length !== 0) {
        throw new Error(`[E2E] Refusing ambiguous config cleanup for ${snapshot.namespace}/${snapshot.key}: row absent but pre-existing audits found`);
      }

      const ownedMutations = mutations.filter((mutation) =>
        mutation.namespace === snapshot.namespace && mutation.key === snapshot.key);
      const latest = ownedMutations.at(-1);
      if (!latest) continue;

      const deletedRow = await tx.businessConfig.deleteMany({
        where: {
          id: latest.rowId,
          namespace: snapshot.namespace,
          key: snapshot.key,
          version: latest.version,
        },
      });
      if (deletedRow.count !== 1) {
        throw new Error(`[E2E] Config cleanup ownership check failed for ${snapshot.namespace}/${snapshot.key}`);
      }

      const versions = ownedMutations.map((mutation) => mutation.version);
      const deletedAudits = await tx.businessConfigAudit.deleteMany({
        where: { namespace: snapshot.namespace, key: snapshot.key, version: { in: versions } },
      });
      if (deletedAudits.count !== new Set(versions).size) {
        throw new Error(`[E2E] Config audit cleanup mismatch for ${snapshot.namespace}/${snapshot.key}`);
      }
    }
  });
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
  const parentEmail = `${parentFirstName.toLowerCase()}.parent.${uid}@nexus-e2e-test.com`;
  return client.$transaction(async (tx) => {
    const contactLead = await tx.contactLead.create({
      data: {
        name: `${parentFirstName} ${parentLastName}`,
        email: parentEmail,
        phone: '+216 99 000 000',
      },
    });
    const parentUser = await tx.user.create({
      data: {
        email: parentEmail,
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

export async function getSyntheticFamilyFixtureFromStaffCreation(
  contactLeadId: string,
  studentId: string,
): Promise<SyntheticFamilyFixture> {
  const [contactLead, student] = await Promise.all([
    getPrisma().contactLead.findUnique({ where: { id: contactLeadId }, select: { id: true } }),
    getPrisma().student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        parent: { select: { id: true, userId: true } },
      },
    }),
  ]);
  if (!contactLead || !student) {
    throw new Error('[E2E] Staff-created parent/student fixture cannot be resolved for cleanup');
  }
  return {
    contactLeadId: contactLead.id,
    parentUserId: student.parent.userId,
    parentProfileId: student.parent.id,
    studentId: student.id,
    studentUserId: student.userId,
  };
}

export async function cleanupSyntheticFamilies(fixtures: SyntheticFamilyFixture[]) {
  if (fixtures.length === 0) return;

  const contactLeadIds = fixtures.map((fixture) => fixture.contactLeadId);
  const studentIds = fixtures.map((fixture) => fixture.studentId);
  const parentProfileIds = fixtures.map((fixture) => fixture.parentProfileId);
  const userIds = fixtures.flatMap((fixture) => [fixture.studentUserId, fixture.parentUserId]);

  await getPrisma().$transaction(async (tx) => {
    await tx.jobOutbox.deleteMany({
      where: { aggregateType: 'CONTACT_LEAD', aggregateId: { in: contactLeadIds } },
    });
    await tx.jobOutbox.deleteMany({
      where: { aggregateType: 'USER', aggregateId: { in: userIds } },
    });
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

  const remainingContactLeadJobs = await getPrisma().jobOutbox.count({
    where: { aggregateType: 'CONTACT_LEAD', aggregateId: { in: contactLeadIds } },
  });
  if (remainingContactLeadJobs !== 0) {
    throw new Error(`[E2E] Synthetic family cleanup left ${remainingContactLeadJobs} CONTACT_LEAD outbox job(s)`);
  }
}

export async function disconnectCandidatIndividuelDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
