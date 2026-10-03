/**
 * @jest-environment node
 *
 * Performance (mission §36) : le nombre de requêtes SQL des vues principales
 * ne dépend PAS du nombre d'élèves (pas de N+1), et aucune vue de liste ne
 * charge la colonne JSON `content` des travaux.
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const run = randomUUID().slice(0, 8);
const g = `perf-${run}`;
const queries: string[] = [];

// Client instrumenté, injecté à la place du singleton avant d'importer les services.
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
(prisma as unknown as { $on: (e: string, cb: (q: { query: string }) => void) => void }).$on('query', (q) => queries.push(q.query));
jest.doMock('@/lib/prisma', () => ({ prisma }));

// Les services sont importés APRÈS jest.doMock, pour qu'ils utilisent le client instrumenté.
type Provisioning = typeof import('@/lib/espace/provisioning');
type Overview = typeof import('@/lib/espace/overview');
let applyProvisioning: Provisioning['applyProvisioning'];
let parseRoster: Provisioning['parseRoster'];
let syncActivities: Provisioning['syncActivities'];
let overview: Overview;
let POO_ACTIVITY_SLUG: string;

const userIds: string[] = [];

async function populate(count: number, prefix: string) {
  const roster = parseRoster({
    groups: [{ slug: g, name: `Perf ${run}` }],
    teachers: [{ username: `t${prefix}.${run}`.slice(0, 32), firstName: 'T', lastName: `Perf${prefix}${run}`, teaches: [{ group: g, subjects: ['NSI'] }] }],
    students: Array.from({ length: count }, (_, i) => ({
      username: `s${prefix}${i}.${run}`.slice(0, 32),
      firstName: `S${i}`,
      lastName: `Perf${prefix}${run}`,
      enrollments: [{ group: g, subjects: ['NSI'] }],
    })),
  });
  await applyProvisioning(prisma, roster, { adopt: false });
  const users = await prisma.user.findMany({ where: { lastName: { endsWith: `${prefix}${run}`, startsWith: 'Perf' }, role: { in: ['ELEVE', 'COACH'] } } });
  userIds.push(...users.map((u) => u.id));
  const activity = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: POO_ACTIVITY_SLUG } });
  const students = users.filter((u) => u.role === 'ELEVE');
  await prisma.espaceWork.createMany({
    data: students.map((s, i) => ({
      studentId: s.id,
      activityId: activity.id,
      status: (['IN_PROGRESS', 'SUBMITTED', 'CORRECTED', 'DRAFT'] as const)[i % 4],
      content: { v: 1, steps: { reperes: { code: 'x'.repeat(5000) } } },
      progressSteps: i % 8,
      revision: 1,
      submittedAt: i % 4 === 1 ? new Date() : null,
    })),
  });
  return {
    teacher: { id: users.find((u) => u.role === 'COACH')!.id, role: 'COACH' as const, firstName: 'T', lastName: 'x' },
    student: { id: students[0]!.id, role: 'ELEVE' as const, firstName: 'S0', lastName: 'x' },
  };
}

async function measure<T>(fn: () => Promise<T>): Promise<{ count: number; selects: string[] }> {
  queries.length = 0;
  await fn();
  const selects = queries.filter((q) => /^\s*SELECT/i.test(q));
  return { count: selects.length, selects };
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  ({ applyProvisioning, parseRoster, syncActivities } = await import('@/lib/espace/provisioning'));
  overview = await import('@/lib/espace/overview');
  ({ POO_ACTIVITY_SLUG } = await import('@/lib/espace/catalog'));
  await syncActivities(prisma);
}, 120_000);

afterAll(async () => {
  await prisma.espaceWorkVersion.deleteMany({ where: { work: { studentId: { in: userIds } } } });
  await prisma.espaceWork.deleteMany({ where: { studentId: { in: userIds } } });
  await prisma.espaceEnrollment.deleteMany({ where: { user: { id: { in: userIds } } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: { in: userIds } } });
  await prisma.espaceGroup.deleteMany({ where: { slug: g } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}, 60_000);

describe('nombre de requêtes des vues principales', () => {
  it('est constant : 3 élèves ou 30 élèves, mêmes requêtes', async () => {
    const small = await populate(3, 'a');
    const smallCounts = {
      overview: (await measure(() => overview.getTeacherOverview(small.teacher, POO_ACTIVITY_SLUG))).count,
      students: (await measure(() => overview.listTeacherStudents(small.teacher))).count,
      queue: (await measure(() => overview.listWorksToCorrect(small.teacher))).count,
      dashboard: (await measure(() => overview.getStudentDashboard(small.student))).count,
    };

    const large = await populate(30, 'b');
    const largeCounts = {
      overview: (await measure(() => overview.getTeacherOverview(large.teacher, POO_ACTIVITY_SLUG))).count,
      students: (await measure(() => overview.listTeacherStudents(large.teacher))).count,
      queue: (await measure(() => overview.listWorksToCorrect(large.teacher))).count,
      dashboard: (await measure(() => overview.getStudentDashboard(large.student))).count,
    };

    expect(largeCounts).toEqual(smallCounts); // pas de N+1
    for (const [name, n] of Object.entries(largeCounts)) expect({ name, ok: n <= 8 }).toEqual({ name, ok: true });
  }, 120_000);

  it('les listes ne chargent jamais la colonne JSON content des travaux', async () => {
    const ctx = await populate(10, 'c');
    const views: (() => Promise<unknown>)[] = [
      () => overview.getTeacherOverview(ctx.teacher, POO_ACTIVITY_SLUG),
      () => overview.listTeacherStudents(ctx.teacher),
      () => overview.listWorksToCorrect(ctx.teacher),
      () => overview.getStudentDashboard(ctx.student),
    ];
    for (const fn of views) {
      const { selects } = await measure(fn);
      const touching = selects.filter((q) => /espace_works/.test(q));
      expect(touching.length).toBeGreaterThan(0);
      for (const q of touching) expect(q).not.toMatch(/"public"\."espace_works"\."content"/);
    }
  }, 60_000);
});

describe('accueil enseignant : activité par défaut', () => {
  it('ouvre l’activité sur laquelle les élèves ont travaillé le plus récemment', async () => {
    const ctx = await populate(2, 'd');
    // Tous les travaux créés par populate portent sur le TP POO 1 : c'est l'activité la plus récente.
    expect(await overview.latestActiveActivitySlug(ctx.teacher)).toBe(POO_ACTIVITY_SLUG);

    const other = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: 'nsi-poo-structures-lineaires' } }); // même matière (NSI) que l'enseignant du test
    const student = await prisma.user.findFirstOrThrow({ where: { id: { in: userIds }, role: 'ELEVE', lastName: { endsWith: `d${run}` } } });
    await prisma.espaceWork.create({
      data: {
        studentId: student.id, activityId: other.id, status: 'IN_PROGRESS', content: { v: 1, steps: {} },
        progressSteps: 0, revision: 1, lastSavedAt: new Date(Date.now() + 60_000),
      },
    });
    expect(await overview.latestActiveActivitySlug(ctx.teacher)).toBe(other.slug);
  }, 60_000);

  it('refuse un élève', async () => {
    const ctx = await populate(1, 'e');
    await expect(overview.latestActiveActivitySlug(ctx.student as never)).rejects.toThrow();
  }, 60_000);
});

