/**
 * Parcours « Récursivité et programmation récursive » — couche service contre un vrai Postgres jetable.
 *
 * Même moteur que les autres leçons (aucune infrastructure parallèle) : miroir d'activité, ouverture du travail,
 * autosave par étape, progression, remise, lecture seule, lecture enseignant, annotation de compétence, « À reprendre »,
 * isolation entre matières et entre élèves.
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { addAnnotation, listAnnotations } from '@/lib/espace/annotations';
import { ACTIVITIES, getLessonRequiredSteps, getLessonSteps, RECURSIVITE_ACTIVITY_SLUG } from '@/lib/espace/catalog';
import { EspaceError } from '@/lib/espace/errors';
import type { EspaceActor } from '@/lib/espace/guards';
import { getStudentDashboard, getTeacherOverview, groupActivitiesByTheme } from '@/lib/espace/overview';
import { applyProvisioning, parseRoster, syncActivities } from '@/lib/espace/provisioning';
import { loadWorkForActor } from '@/lib/espace/access';
import { openWork, reviewWork, saveWork, submitWork } from '@/lib/espace/works';

const run = randomUUID().slice(0, 8);
const u = (name: string) => `${name}.${run}`.slice(0, 32);
const group = `rec-${run}`;

const roster = parseRoster({
  groups: [{ slug: group, name: `Récursivité ${run}` }],
  teachers: [
    { username: u('prof'), firstName: 'Prof', lastName: `Rec${run}`, teaches: [{ group, subjects: ['NSI'] }] },
    { username: u('maths'), firstName: 'Maths', lastName: `Seul${run}`, teaches: [{ group, subjects: ['MATHS'] }] },
  ],
  students: [
    { username: u('lea'), firstName: 'Lea', lastName: `Alpha${run}`, enrollments: [{ group, subjects: ['NSI', 'MATHS'] }] },
    { username: u('max'), firstName: 'Max', lastName: `Beta${run}`, enrollments: [{ group, subjects: ['MATHS'] }] },
    { username: u('ned'), firstName: 'Ned', lastName: `Gamma${run}`, enrollments: [{ group, subjects: ['NSI'] }] },
  ],
});

const ids: string[] = [];
let prof: EspaceActor;
let mathsTeacher: EspaceActor;
let lea: EspaceActor;
let max: EspaceActor;
let ned: EspaceActor;

async function actorOf(username: string): Promise<EspaceActor> {
  const row = await prisma.user.findUniqueOrThrow({ where: { username } });
  ids.push(row.id);
  return { id: row.id, role: row.role as EspaceActor['role'], firstName: row.firstName, lastName: row.lastName };
}

async function expectCode<T>(p: Promise<T>, code: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(EspaceError);
    expect((e as EspaceError).code).toBe(code);
    return;
  }
  throw new Error(`attendu : EspaceError ${code}, obtenu : succès`);
}

/** Contenu complet d'une étape : toutes les questions répondues, tous les champs remplis, code modifié. */
function completeStep(stepId: string) {
  const step = getLessonSteps(RECURSIVITE_ACTIVITY_SLUG).find((s) => s.id === stepId)!;
  return {
    ...(step.starter ? { code: `${step.starter}\n# fait ${run}` } : {}),
    fields: Object.fromEntries(step.fields.map((f) => [f.id, 'réponse'])),
    choices: Object.fromEntries(step.questions.map((q) => [q.id, q.correct])),
  };
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await syncActivities(prisma);
  await applyProvisioning(prisma, roster, { adopt: false });
  prof = await actorOf(u('prof'));
  mathsTeacher = await actorOf(u('maths'));
  lea = await actorOf(u('lea'));
  max = await actorOf(u('max'));
  ned = await actorOf(u('ned'));
}, 120_000);

afterAll(async () => {
  const works = { studentId: { in: ids } };
  await prisma.espaceAnnotation.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { work: works }] } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: works } });
  await prisma.espaceWork.deleteMany({ where: works });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: { in: ids } } });
  await prisma.espaceGroup.deleteMany({ where: { slug: group } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}, 60_000);

describe('miroir d’activité et catalogue', () => {
  it('synchroniser le catalogue crée la ligne du parcours (idempotent), sans toucher aux autres', async () => {
    const before = await prisma.espaceActivity.count();
    await syncActivities(prisma);
    expect(await prisma.espaceActivity.count()).toBe(before);
    const row = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: RECURSIVITE_ACTIVITY_SLUG } });
    expect(row).toMatchObject({ subject: 'NSI', moduleSlug: 'recursivite', title: 'Récursivité et programmation récursive', kind: 'PYTHON_TP', stepsTotal: 9 });
    expect(await prisma.espaceActivity.count({ where: { slug: { in: ACTIVITIES.map((a) => a.slug) } } })).toBe(ACTIVITIES.length);
  });

  it('le tableau de bord NSI regroupe POO d’un côté, Algorithmique de l’autre ; Maths sans thème', async () => {
    const dash = await getStudentDashboard(lea);
    const nsi = dash.subjects.find((s) => s.subject === 'NSI')!;
    expect(groupActivitiesByTheme(nsi.activities).map((g) => [g.theme, g.activities.map((a) => a.title)])).toEqual([
      ['Programmation orientée objet', ['TP POO 1 — Des objets qui agissent', 'TP POO 2 — Listes, piles et files']],
      ['Algorithmique et programmation', ['Récursivité et programmation récursive']],
    ]);
    const maths = dash.subjects.find((s) => s.subject === 'MATHEMATIQUES')!;
    expect(groupActivitiesByTheme(maths.activities)).toHaveLength(1);
    expect(groupActivitiesByTheme(maths.activities)[0].theme).toBeNull();
  });
});

describe('travail de l’élève', () => {
  it('un élève de Maths seul n’y accède pas', async () => {
    await expectCode(openWork(max, { activitySlug: RECURSIVITE_ACTIVITY_SLUG }), 'NOT_ENROLLED');
  });

  it('autosave par étape, progression honnête, remise, puis lecture seule', async () => {
    const required = getLessonRequiredSteps(RECURSIVITE_ACTIVITY_SLUG);
    expect(required).toHaveLength(9);
    let work = await openWork(lea, { activitySlug: RECURSIVITE_ACTIVITY_SLUG });
    expect(work.status).toBe('DRAFT');
    expect(work.progressSteps).toBe(0);

    let revision = work.revision;
    for (const [i, step] of required.entries()) {
      const saved = await saveWork(lea, work.id, { baseRevision: revision, patch: { stepId: step.id, step: completeStep(step.id) }, currentStep: i });
      revision = saved.revision;
      expect(saved.progressSteps).toBe(i + 1);
    }
    work = await openWork(lea, { activitySlug: RECURSIVITE_ACTIVITY_SLUG });
    expect(work.progressSteps).toBe(9);
    expect(work.currentStep).toBe(8);
    expect((work.content.steps.ecrire as { code: string }).code).toContain(`# fait ${run}`);

    // Le bonus facultatif ne compte pas dans la progression.
    const bonus = await saveWork(lea, work.id, { baseRevision: revision, patch: { stepId: 'bonus', step: completeStep('bonus') } });
    expect(bonus.progressSteps).toBe(9);

    const submitted = await submitWork(lea, work.id, bonus.revision);
    expect(submitted.status).toBe('SUBMITTED');
    await expectCode(saveWork(lea, work.id, { baseRevision: submitted.revision, patch: { stepId: 'ecrire', step: completeStep('ecrire') } }), 'WORK_LOCKED');
  }, 60_000);

  it('un autre élève NSI ne voit pas ce travail (404 indiscernable)', async () => {
    const own = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: lea.id, activity: { slug: RECURSIVITE_ACTIVITY_SLUG } } });
    await expectCode(loadWorkForActor(ned, own.id, 'student'), 'NOT_FOUND');
    await expectCode(saveWork(ned, own.id, { baseRevision: 0, patch: { stepId: 'diagnostic', step: completeStep('diagnostic') } }), 'NOT_FOUND');
  });
});

describe('enseignant', () => {
  it('voit le travail remis dans l’aperçu NSI, mais pas un enseignant de Maths seul', async () => {
    const overview = await getTeacherOverview(prof, RECURSIVITE_ACTIVITY_SLUG);
    const row = overview.rows.find((r) => r.studentId === lea.id)!;
    expect(row).toMatchObject({ status: 'SUBMITTED', progressSteps: 9 });
    expect(overview.rows.find((r) => r.studentId === ned.id)).toMatchObject({ status: 'NOT_STARTED' });
    expect(overview.rows.find((r) => r.studentId === max.id)).toBeUndefined(); // Max n'étudie pas la NSI
    expect((await getTeacherOverview(mathsTeacher, RECURSIVITE_ACTIVITY_SLUG)).rows).toEqual([]); // aucune affectation NSI : aucun élève visible
  });

  it('annote une compétence, puis demande de reprendre ; le contenu de l’élève reste intact', async () => {
    const work = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: lea.id, activity: { slug: RECURSIVITE_ACTIVITY_SLUG } } });
    const before = JSON.stringify(work.content);
    await addAnnotation(prof, work.id, { kind: 'STEP', stepId: 'ecrire', body: 'Compétence « Écrire une fonction récursive » : acquise.' });
    const list = await listAnnotations(prof, work.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'STEP', stepId: 'ecrire' });

    const reopened = await reviewWork(prof, work.id, 'REOPEN');
    expect(reopened.status).toBe('REOPENED');
    const after = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    expect(JSON.stringify(after.content)).toBe(before);

    // L'élève retrouve le retour et peut à nouveau modifier.
    const again = await openWork(lea, { activitySlug: RECURSIVITE_ACTIVITY_SLUG });
    expect(again.status).toBe('REOPENED');
    const saved = await saveWork(lea, again.id, { baseRevision: again.revision, patch: { stepId: 'ecrire', step: { ...completeStep('ecrire'), code: 'def somme(n):\n    return 0\n' } } });
    expect(saved.revision).toBeGreaterThan(again.revision);
  });
});
