/**
 * Les comptes de VALIDATION technique (groupe `validation-technique`) ne polluent ni les effectifs, ni la file
 * « À corriger », ni l'activité récente, ni les séances d'un ADMIN ; un enseignant réel ne les voit jamais ;
 * l'enseignant technique qui leur est affecté les voit ; l'accès explicite et `includeValidation` restent possibles.
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { POO2_ACTIVITY_SLUG, RECURSIVITE_ACTIVITY_SLUG } from '@/lib/espace/catalog';
import type { EspaceActor } from '@/lib/espace/guards';
import { getTeacherOverview, latestActiveActivitySlug, listTeacherStudents, listWorksToCorrect } from '@/lib/espace/overview';
import { applyProvisioning, parseRoster, syncActivities } from '@/lib/espace/provisioning';
import { buildExport } from '@/lib/espace/export';
import { createSession, listSessionsForTeacher } from '@/lib/espace/sessions';
import { VALIDATION_GROUP_SLUG } from '@/lib/espace/validation';
import { openWork, saveWork, submitWork } from '@/lib/espace/works';
import { getLessonSteps } from '@/lib/espace/catalog';

const run = randomUUID().slice(0, 6);
const u = (n: string) => `${n}.${run}`.slice(0, 32);
const real = `reel-${run}`;
const ids: string[] = [];
let groupIds: string[] = [];
let admin: EspaceActor;
let realTeacher: EspaceActor;
let techTeacher: EspaceActor;
let realStudent: EspaceActor;
let techStudent: EspaceActor;

async function actorOf(username: string, role?: EspaceActor['role']): Promise<EspaceActor> {
  const row = await prisma.user.findUniqueOrThrow({ where: { username } });
  ids.push(row.id);
  return { id: row.id, role: role ?? (row.role as EspaceActor['role']), firstName: row.firstName, lastName: row.lastName };
}

async function submitOne(actor: EspaceActor) {
  const w = await openWork(actor, { activitySlug: RECURSIVITE_ACTIVITY_SLUG });
  const step = getLessonSteps(RECURSIVITE_ACTIVITY_SLUG)[0]!;
  const saved = await saveWork(actor, w.id, { baseRevision: w.revision, patch: { stepId: step.id, step: { fields: Object.fromEntries(step.fields.map((f) => [f.id, 'x'])), choices: Object.fromEntries(step.questions.map((q) => [q.id, q.correct])) } } });
  return submitWork(actor, w.id, saved.revision);
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await syncActivities(prisma);
  const roster = parseRoster({
    groups: [{ slug: real, name: `Réel ${run}` }, { slug: VALIDATION_GROUP_SLUG, name: 'Validation technique' }],
    teachers: [
      { username: u('prof'), firstName: 'Prof', lastName: `Reel${run}`, teaches: [{ group: real, subjects: ['NSI'] }] },
      { username: u('valprof'), firstName: 'TECHNIQUE', lastName: `PROF${run}`, teaches: [{ group: VALIDATION_GROUP_SLUG, subjects: ['NSI'] }] },
    ],
    students: [
      { username: u('eleve'), firstName: 'Eleve', lastName: `Reel${run}`, enrollments: [{ group: real, subjects: ['NSI'] }] },
      { username: u('valeleve'), firstName: 'TECHNIQUE', lastName: `ELEVE${run}`, enrollments: [{ group: VALIDATION_GROUP_SLUG, subjects: ['NSI'] }] },
    ],
  });
  await applyProvisioning(prisma, roster, { adopt: false });
  realTeacher = await actorOf(u('prof'));
  techTeacher = await actorOf(u('valprof'));
  realStudent = await actorOf(u('eleve'));
  techStudent = await actorOf(u('valeleve'));
  const adminRow = await prisma.user.create({ data: { role: 'ADMIN', firstName: 'Admin', lastName: run, email: `admin-${run}@test.example`, activatedAt: new Date() } });
  ids.push(adminRow.id);
  admin = { id: adminRow.id, role: 'ADMIN', firstName: 'Admin', lastName: run };
  groupIds = (await prisma.espaceGroup.findMany({ where: { slug: { in: [real, VALIDATION_GROUP_SLUG] } }, select: { id: true } })).map((g) => g.id);
  await submitOne(realStudent);
  await submitOne(techStudent);
  await new Promise((r) => setTimeout(r, 20));
  await openWork(techStudent, { activitySlug: POO2_ACTIVITY_SLUG }); // le travail le PLUS récent de tous est technique, sur une autre activité
  const tech = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: VALIDATION_GROUP_SLUG } });
  const activity = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: RECURSIVITE_ACTIVITY_SLUG } });
  await prisma.espaceSession.create({ data: { groupId: tech.id, subject: 'NSI', activityId: activity.id, teacherId: techTeacher.id, title: `SESSION-VALIDATION-${run}`, status: 'PUBLISHED', publishedAt: new Date() } });
  await createSession(realTeacher, { groupId: (await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: real } })).id, subject: 'NSI', activitySlug: RECURSIVITE_ACTIVITY_SLUG, title: `SESSION-REELLE-${run}` }).catch(() => undefined);
}, 120_000);

afterAll(async () => {
  const works = { studentId: { in: ids } };
  await prisma.espaceAnnotation.deleteMany({ where: { work: works } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: works } });
  await prisma.espaceWork.deleteMany({ where: works });
  await prisma.espaceSession.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: { in: ids } } });
  await prisma.espaceGroup.deleteMany({ where: { id: { in: groupIds }, slug: real } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}, 60_000);

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('ADMIN : vues d’ensemble sans les comptes de validation (par défaut)', () => {
  it('effectifs et statistiques de l’activité : seul l’élève réel compte', async () => {
    const o = await getTeacherOverview(admin, RECURSIVITE_ACTIVITY_SLUG);
    const mine = o.rows.filter((r) => /Reel|ELEVE/.test(r.name) && r.name.includes(run));
    expect(names(mine)).toEqual([`Eleve Reel${run}`]);
    expect(o.rows.some((r) => r.name.includes('TECHNIQUE'))).toBe(false);
    expect(o.counts.students).toBe(o.rows.length);
    expect(o.counts.submitted).toBe(o.rows.filter((r) => r.status === 'SUBMITTED').length);
  });

  it('liste des élèves', async () => {
    const list = await listTeacherStudents(admin);
    expect(list.map((s) => s.name)).toContain(`Eleve Reel${run}`);
    expect(list.map((s) => s.name).some((n) => n.includes('TECHNIQUE'))).toBe(false);
  });

  it('file « À corriger » : le travail remis technique n’y figure pas', async () => {
    const queue = await listWorksToCorrect(admin);
    expect(queue.map((q) => q.studentName)).toContain(`Eleve Reel${run}`);
    expect(queue.some((q) => q.studentName.includes('TECHNIQUE'))).toBe(false);
  });

  it('activité récente : le travail technique, pourtant le plus récent, ne la détermine pas', async () => {
    const newest = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: { in: [realStudent.id, techStudent.id] } }, orderBy: { lastSavedAt: 'desc' }, select: { studentId: true, activity: { select: { slug: true } } } });
    expect(newest.studentId).toBe(techStudent.id);
    expect(newest.activity.slug).toBe(POO2_ACTIVITY_SLUG);
    // L'accueil d'un ADMIN s'ouvre sur l'activité des élèves réels, pas sur celle du compte technique.
    const reals = await prisma.espaceWork.findMany({ where: { studentId: realStudent.id }, select: { activity: { select: { slug: true } } } });
    expect(reals.map((w) => w.activity.slug)).toEqual([RECURSIVITE_ACTIVITY_SLUG]);
    expect(await latestActiveActivitySlug(admin)).toBe(RECURSIVITE_ACTIVITY_SLUG);
    expect(await latestActiveActivitySlug(admin, { includeValidation: true })).toBe(POO2_ACTIVITY_SLUG);
  });

  it('séances', async () => {
    const titles = (await listSessionsForTeacher(admin)).map((s) => s.title);
    expect(titles).not.toContain(`SESSION-VALIDATION-${run}`);
  });
});

describe('includeValidation : audit administratif explicite', () => {
  it('réintègre les comptes de validation dans chaque vue', async () => {
    const o = await getTeacherOverview(admin, RECURSIVITE_ACTIVITY_SLUG, { includeValidation: true });
    expect(o.rows.some((r) => r.name === `TECHNIQUE ELEVE${run}`)).toBe(true);
    expect((await listTeacherStudents(admin, { includeValidation: true })).some((s) => s.name === `TECHNIQUE ELEVE${run}`)).toBe(true);
    expect((await listWorksToCorrect(admin, undefined, { includeValidation: true })).some((q) => q.studentName === `TECHNIQUE ELEVE${run}`)).toBe(true);
    expect((await listSessionsForTeacher(admin, { includeValidation: true })).map((s) => s.title)).toContain(`SESSION-VALIDATION-${run}`);
  });

  it('l’accès explicite par identifiant (export d’un élève de validation) n’est pas bloqué', async () => {
    const env = await buildExport(admin, { kind: 'student', id: techStudent.id });
    expect(env.works).toHaveLength(2); // Récursivité remis + TP POO 2 ouvert
  });
});

describe('enseignants', () => {
  it('un enseignant RÉEL ne voit jamais les comptes de validation', async () => {
    const o = await getTeacherOverview(realTeacher, RECURSIVITE_ACTIVITY_SLUG);
    expect(names(o.rows)).toEqual([`Eleve Reel${run}`]);
    expect(names(await listTeacherStudents(realTeacher))).toEqual([`Eleve Reel${run}`]);
    expect((await listWorksToCorrect(realTeacher)).map((q) => q.studentName)).toEqual([`Eleve Reel${run}`]);
  });

  it('l’enseignant technique, affecté au groupe de validation, voit ses élèves techniques (la fumée de production en dépend)', async () => {
    const o = await getTeacherOverview(techTeacher, RECURSIVITE_ACTIVITY_SLUG);
    expect(names(o.rows)).toEqual([`TECHNIQUE ELEVE${run}`]);
    expect((await listWorksToCorrect(techTeacher)).map((q) => q.studentName)).toEqual([`TECHNIQUE ELEVE${run}`]);
  });
});
