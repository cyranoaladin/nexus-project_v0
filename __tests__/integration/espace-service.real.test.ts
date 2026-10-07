/**
 * Espace pédagogique Terminale — couche service contre un vrai Postgres jetable.
 *
 * Pas de mock Prisma : l'autosave à révision optimiste, l'isolation entre
 * élèves, le verrouillage après remise et les courses concurrentes se prouvent
 * sur la base, pas sur des doubles.
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { addAnnotation, listAnnotations, deleteAnnotation, addSnippet, listSnippets } from '@/lib/espace/annotations';
import { MATHS_SUITES_ACTIVITY_SLUG, POO_ACTIVITY_SLUG, getPooContent } from '@/lib/espace/catalog';
import { EspaceError } from '@/lib/espace/errors';
import type { EspaceActor } from '@/lib/espace/guards';
import { applyProvisioning, disableAccount, parseRoster, planProvisioning, resetStudentPin, syncActivities } from '@/lib/espace/provisioning';
import { closeSession, createSession, listPublishedSessionsForStudent, publishSession } from '@/lib/espace/sessions';
import { openWork, reviewWork, saveWork, submitWork } from '@/lib/espace/works';
import { loadWorkForActor } from '@/lib/espace/access';
import { verifyPin } from '@/lib/espace/pin';

const run = randomUUID().slice(0, 8);
const u = (name: string) => `${name}.${run}`.slice(0, 32); // identifiants uniques par exécution
const g = (slug: string) => `${slug}-${run}`;

const planLink2 = (r: ReturnType<typeof parseRoster>) => planProvisioning(prisma, r, { adopt: true });

const roster = parseRoster({
  groups: [
    { slug: g('principal'), name: `Principal ${run}` },
    { slug: g('racine'), name: `Racine ${run}` },
  ],
  teachers: [
    { username: u('prof'), firstName: 'Prof', lastName: `Test${run}`, teaches: [{ group: g('principal'), subjects: ['NSI', 'MATHS'] }, { group: g('racine'), subjects: ['MATHS'] }] },
    { username: u('autre'), firstName: 'Autre', lastName: `Prof${run}`, teaches: [{ group: g('racine'), subjects: ['MATHS'] }] },
  ],
  students: [
    { username: u('ada'), firstName: 'Ada', lastName: `Alpha${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS', 'NSI'] }] },
    { username: u('bob'), firstName: 'Bob', lastName: `Beta${run}`, enrollments: [{ group: g('principal'), subjects: ['NSI'] }] },
    { username: u('cyd'), firstName: 'Cyd', lastName: `Gamma${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] },
    { username: u('dan'), firstName: 'Dan', lastName: `Racine${run}`, enrollments: [{ group: g('racine'), subjects: ['MATHS'] }] },
  ],
});

let teacher: EspaceActor;
let otherTeacher: EspaceActor;
let ada: EspaceActor;
let bob: EspaceActor;
let cyd: EspaceActor;
let dan: EspaceActor;
let pins: Record<string, string> = {};
const createdUserIds: string[] = [];
const createdGroupIds: string[] = [];

const poo = getPooContent();
const step0 = poo.steps[0];

function fullStep(extraCode = '# fait') {
  return {
    code: `${step0.starter}\n${extraCode}`,
    fields: Object.fromEntries(step0.fields.map((f) => [f.id, 'réponse'])),
    choices: Object.fromEntries(step0.questions.map((q) => [q.id, q.correct])),
  };
}

async function actorOf(username: string): Promise<EspaceActor> {
  const row = await prisma.user.findUniqueOrThrow({ where: { username } });
  createdUserIds.push(row.id);
  return { id: row.id, role: row.role as EspaceActor['role'], firstName: row.firstName, lastName: row.lastName };
}

async function expectCode<T>(p: Promise<T>, code: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(EspaceError);
    expect((e as EspaceError).code).toBe(code);
    return e as EspaceError;
  }
  throw new Error(`attendu : EspaceError ${code}, obtenu : succès`);
}

async function freshWork(actor: EspaceActor) {
  return openWork(actor, { activitySlug: POO_ACTIVITY_SLUG });
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  const result = await applyProvisioning(prisma, roster, { adopt: false });
  pins = Object.fromEntries(result.credentials.filter((c) => c.kind === 'ELEVE').map((c) => [c.username, c.secret]));
  teacher = await actorOf(u('prof'));
  otherTeacher = await actorOf(u('autre'));
  ada = await actorOf(u('ada'));
  bob = await actorOf(u('bob'));
  cyd = await actorOf(u('cyd'));
  dan = await actorOf(u('dan'));
  const groups = await prisma.espaceGroup.findMany({ where: { slug: { in: roster.groups.map((x) => x.slug) } }, select: { id: true } });
  createdGroupIds.push(...groups.map((x) => x.id));
}, 120_000);

afterAll(async () => {
  const works = { studentId: { in: createdUserIds } };
  await prisma.espaceAnnotation.deleteMany({ where: { OR: [{ authorId: { in: createdUserIds } }, { work: works }] } });
  await prisma.espaceWorkAttachment.deleteMany({ where: { work: works } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: works } });
  await prisma.espaceLegacyLink.deleteMany({ where: { studentId: { in: createdUserIds } } });
  await prisma.espaceWork.deleteMany({ where: works });
  await prisma.espaceSession.deleteMany({ where: { groupId: { in: createdGroupIds } } });
  await prisma.espaceCommentSnippet.deleteMany({ where: { teacherId: { in: createdUserIds } } });
  await prisma.espaceEnrollment.deleteMany({ where: { groupId: { in: createdGroupIds } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { groupId: { in: createdGroupIds } } });
  await prisma.espaceGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
}, 60_000);

// ─── Provisioning ───────────────────────────────────────────────────────────

describe('provisioning', () => {
  it('crée comptes, groupes, inscriptions et affectations, sans jamais stocker un code en clair', async () => {
    const enrollments = await prisma.espaceEnrollment.count({ where: { groupId: { in: createdGroupIds } } });
    expect(enrollments).toBe(2 + 1 + 1 + 1);
    const row = await prisma.user.findUniqueOrThrow({ where: { username: u('ada') } });
    expect(row.role).toBe('ELEVE');
    expect(row.email).toBeNull();
    expect(row.pinHash).toMatch(/^\$2[aby]\$/);
    expect(row.pinHash).not.toContain(pins[u('ada')]);
    expect(await verifyPin(pins[u('ada')], row.pinHash!)).toBe(true);
    // Pas de ligne Student (parentId obligatoire) : l'espace repose sur User seul.
    expect(await prisma.student.count({ where: { userId: row.id } })).toBe(0);
  });

  it('répond aux questions de la mission : qui suit quoi, qui enseigne quoi', async () => {
    const nsi = await prisma.espaceEnrollment.findMany({ where: { subject: 'NSI', groupId: { in: createdGroupIds } }, select: { user: { select: { username: true } } } });
    expect(nsi.map((e) => e.user.username).sort()).toEqual([u('ada'), u('bob')].sort());
    const racine = await prisma.espaceEnrollment.findMany({ where: { group: { slug: g('racine') } }, select: { user: { select: { username: true } } } });
    expect(racine.map((e) => e.user.username)).toEqual([u('dan')]);
    const teaches = await prisma.espaceTeacherAssignment.findMany({ where: { teacherId: teacher.id }, select: { subject: true, group: { select: { slug: true } } } });
    expect(teaches).toHaveLength(3);
  });

  it('est idempotent : une seconde exécution ne crée rien et n’émet aucun code', async () => {
    const before = await prisma.user.count({ where: { id: { in: createdUserIds } } });
    const again = await applyProvisioning(prisma, roster, { adopt: false });
    expect(again.credentials).toHaveLength(0);
    expect(await prisma.user.count({ where: { id: { in: createdUserIds } } })).toBe(before);
    expect(await prisma.espaceEnrollment.count({ where: { groupId: { in: createdGroupIds } } })).toBe(5);
  }, 60_000);

  it('le plan (dry-run) n’écrit rien', async () => {
    const roster2 = parseRoster({
      groups: [{ slug: g('seche'), name: 'Sèche' }],
      students: [{ username: u('eve'), firstName: 'Eve', lastName: `Zeta${run}`, enrollments: [{ group: g('seche'), subjects: ['NSI'] }] }],
    });
    const usersBefore = await prisma.user.count();
    const plan = await planProvisioning(prisma, roster2, { adopt: false });
    expect(plan.users[0].action).toBe('CREATE');
    expect(plan.groupsToCreate).toEqual([g('seche')]);
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.espaceGroup.count({ where: { slug: g('seche') } })).toBe(0);
  });

  it('refuse un identifiant déjà porté par une autre personne, sans rien écrire', async () => {
    const clash = parseRoster({
      groups: [{ slug: g('principal'), name: 'x' }],
      students: [{ username: u('ada'), firstName: 'Quelqu’un', lastName: 'Dautre', enrollments: [{ group: g('principal'), subjects: ['NSI'] }] }],
    });
    const plan = await planProvisioning(prisma, clash, { adopt: true });
    expect(plan.conflicts).toHaveLength(1);
    await expect(applyProvisioning(prisma, clash, { adopt: true })).rejects.toThrow(/Conflits/);
  });

  it('ne confond pas deux élèves aux noms proches (Adam / Adem)', async () => {
    const r = parseRoster({
      groups: [{ slug: g('principal'), name: 'x' }],
      students: [
        { username: u('adam'), firstName: 'Adam', lastName: `Charpentier${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] },
        { username: u('adem'), firstName: 'Adem', lastName: `Keller${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] },
      ],
    });
    const res = await applyProvisioning(prisma, r, { adopt: false });
    expect(res.credentials).toHaveLength(2);
    const adam = await prisma.user.findUniqueOrThrow({ where: { username: u('adam') } });
    const adem = await prisma.user.findUniqueOrThrow({ where: { username: u('adem') } });
    createdUserIds.push(adam.id, adem.id);
    expect(adam.id).not.toBe(adem.id);
    expect(adam.firstName).toBe('Adam');
    expect(adem.firstName).toBe('Adem');
  }, 60_000);

  it('un compte existant homonyme sans identifiant n’est adopté que sur demande, et reste intact', async () => {
    const existing = await prisma.user.create({
      data: { role: 'ELEVE', firstName: 'Zoé', lastName: `Existante${run}`, email: `zoe-${run}@test.example`, password: 'hash-existant', activatedAt: new Date() },
    });
    createdUserIds.push(existing.id);
    const r = parseRoster({
      groups: [{ slug: g('principal'), name: 'x' }],
      students: [{ username: u('zoe'), firstName: 'Zoe', lastName: `Existante${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] }],
    });
    const plan = await planProvisioning(prisma, r, { adopt: false });
    expect(plan.users[0].action).toBe('NEEDS_ADOPT_FLAG'); // accents ignorés : Zoe = Zoé
    await expect(applyProvisioning(prisma, r, { adopt: false })).rejects.toThrow(/adopter/);
    expect(await prisma.user.count({ where: { username: u('zoe') } })).toBe(0);

    await applyProvisioning(prisma, r, { adopt: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.username).toBe(u('zoe'));
    expect(after.email).toBe(`zoe-${run}@test.example`);
    expect(after.password).toBe('hash-existant'); // jamais touché
    expect(after.activatedAt?.getTime()).toBe(existing.activatedAt?.getTime()); // la date d'activation d'origine est conservée
    expect(await prisma.user.count({ where: { firstName: 'Zoé', lastName: `Existante${run}` } })).toBe(1); // pas de doublon
  }, 60_000);

  it('un homonyme déjà identifié autrement est un conflit, pas un doublon', async () => {
    const r = parseRoster({
      groups: [{ slug: g('principal'), name: 'x' }],
      students: [{ username: u('ada2'), firstName: 'Ada', lastName: `Alpha${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] }],
    });
    const plan = await planProvisioning(prisma, r, { adopt: true });
    expect(plan.users[0].action).toBe('CONFLICT');
    await expect(applyProvisioning(prisma, r, { adopt: true })).rejects.toThrow(/Conflits/);
  });

  it('deux comptes homonymes : conflit qui les liste ; matchUserId désigne le bon, l’autre reste intact', async () => {
    const mk = (email: string) => prisma.user.create({ data: { role: 'ELEVE', firstName: 'Dora', lastName: `Double${run}`, email, activatedAt: new Date() } });
    const first = await mk(`dora1-${run}@test.example`);
    const second = await mk(`dora2-${run}@test.example`);
    createdUserIds.push(first.id, second.id);
    const base = { groups: [{ slug: g('principal'), name: 'x' }] };
    const student = (extra: Record<string, unknown> = {}) => ({
      username: u('dora'), firstName: 'Dora', lastName: `Double${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }], ...extra,
    });

    const ambiguous = await planLink2(parseRoster({ ...base, students: [student()] }));
    expect(ambiguous.users[0].action).toBe('CONFLICT');
    expect(ambiguous.users[0].reason).toContain(first.id.slice(-6));
    expect(ambiguous.users[0].reason).toContain(second.id.slice(-6));
    expect(ambiguous.users[0].reason).toContain('matchUserId');

    const chosen = parseRoster({ ...base, students: [student({ matchUserId: second.id })] });
    expect((await planProvisioning(prisma, chosen, { adopt: false })).users[0].action).toBe('NEEDS_ADOPT_FLAG');
    await applyProvisioning(prisma, chosen, { adopt: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).username).toBe(u('dora'));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).username).toBeNull(); // l'autre homonyme n'est pas touché
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).email).toBe(`dora2-${run}@test.example`);
  }, 60_000);

  it('un élève en attente d’activation familiale reçoit un code d’espace SANS que son activation soit consommée', async () => {
    const pending = await prisma.user.create({ data: { role: 'ELEVE', firstName: 'Pia', lastName: `Attente${run}`, email: `pia-${run}@test.example` } }); // activatedAt = null
    createdUserIds.push(pending.id);
    const r = (extra: Record<string, unknown> = {}) =>
      parseRoster({
        groups: [{ slug: g('principal'), name: 'x' }],
        students: [{ username: u('pia'), firstName: 'Pia', lastName: `Attente${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }], ...extra }],
      });

    const plan = await planProvisioning(prisma, r(), { adopt: true });
    expect(plan.users[0]).toMatchObject({ action: 'ADOPT', willActivate: false });
    const { credentials } = await applyProvisioning(prisma, r(), { adopt: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: pending.id } });
    expect(after.activatedAt).toBeNull(); // le lien d'activation de la famille reste valable
    expect(after.username).toBe(u('pia'));
    expect(after.pinHash).toMatch(/^\$2[aby]\$/);
    expect(after.email).toBe(`pia-${run}@test.example`);
    expect(credentials[0]).toMatchObject({ username: u('pia'), displayName: `Pia Attente${run}` });
  }, 60_000);

  it('activatePending reste possible, sur décision écrite : il marque aussi le compte activé', async () => {
    const pending = await prisma.user.create({ data: { role: 'ELEVE', firstName: 'Quentin', lastName: `Attente${run}`, email: `quentin-${run}@test.example` } });
    createdUserIds.push(pending.id);
    const roster2 = parseRoster({
      groups: [{ slug: g('principal'), name: 'x' }],
      students: [{ username: u('quen'), firstName: 'Quentin', lastName: `Attente${run}`, activatePending: true, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] }],
    });
    expect((await planProvisioning(prisma, roster2, { adopt: true })).users[0]).toMatchObject({ action: 'ADOPT', willActivate: true });
    await applyProvisioning(prisma, roster2, { adopt: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pending.id } })).activatedAt).not.toBeNull();
  }, 60_000);

  it('matchUserId inconnu ou d’un autre rôle est un conflit, jamais une création', async () => {
    const base = { groups: [{ slug: g('principal'), name: 'x' }] };
    const student = (matchUserId: string) => ({
      username: u('erwan'), firstName: 'Erwan', lastName: `Inconnu${run}`, matchUserId, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }],
    });
    expect((await planLink2(parseRoster({ ...base, students: [student('cl-n-existe-pas')] }))).users[0].action).toBe('CONFLICT');
    // L'id d'un enseignant ne peut pas désigner un élève.
    expect((await planLink2(parseRoster({ ...base, students: [student(teacher.id)] }))).users[0].action).toBe('CONFLICT');
  });

  it('réinitialiser un code révoque les sessions et invalide l’ancien code ; désactiver aussi', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: cyd.id } });
    const issued = await resetStudentPin(prisma, u('cyd'));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: cyd.id } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await verifyPin(pins[u('cyd')], after.pinHash!)).toBe(false);
    expect(await verifyPin(issued.secret, after.pinHash!)).toBe(true);

    await disableAccount(prisma, u('cyd'));
    const off = await prisma.user.findUniqueOrThrow({ where: { id: cyd.id } });
    expect(off.disabledAt).not.toBeNull();
    expect(off.sessionVersion).toBe(after.sessionVersion + 1);
    await prisma.user.update({ where: { id: cyd.id }, data: { disabledAt: null } }); // remise en état pour la suite
  }, 60_000);
});

// ─── Ouverture et isolation ─────────────────────────────────────────────────

describe('ouverture et accès', () => {
  it('synchronise le catalogue en base', async () => {
    await syncActivities(prisma);
    const slugs = (await prisma.espaceActivity.findMany({ select: { slug: true } })).map((a) => a.slug);
    expect(slugs).toEqual(expect.arrayContaining([POO_ACTIVITY_SLUG, MATHS_SUITES_ACTIVITY_SLUG]));
  });

  it('un élève non inscrit à la matière ne peut pas ouvrir l’activité', async () => {
    await expectCode(openWork(cyd, { activitySlug: POO_ACTIVITY_SLUG }), 'NOT_ENROLLED'); // cyd = MATHS seulement
  });

  it('un enseignant ne peut pas ouvrir un travail à la place d’un élève', async () => {
    await expectCode(openWork(teacher, { activitySlug: POO_ACTIVITY_SLUG }), 'FORBIDDEN');
  });

  it('ouvre un travail vide, et douze ouvertures simultanées donnent le même travail', async () => {
    const opened = await Promise.all(Array.from({ length: 12 }, () => freshWork(ada)));
    expect(new Set(opened.map((w) => w.id)).size).toBe(1);
    const a = opened[0];
    expect(a.status).toBe('DRAFT');
    expect(a.revision).toBe(0);
    expect(a.editable).toBe(true);
    expect(await prisma.espaceWork.count({ where: { studentId: ada.id } })).toBe(1);
  });

  it('un élève ne lit pas le travail d’un autre (404, indiscernable d’un identifiant inexistant)', async () => {
    const w = await freshWork(ada);
    await freshWork(bob);
    const forbidden = await expectCode(loadWorkForActor(bob, w.id), 'NOT_FOUND');
    const missing = await expectCode(loadWorkForActor(bob, 'cl-inexistant-0000'), 'NOT_FOUND');
    expect(forbidden.message).toBe(missing.message);
  });

  it('un élève ne peut pas écrire sur le travail d’un autre', async () => {
    const w = await freshWork(ada);
    await expectCode(saveWork(bob, w.id, { baseRevision: 0, patch: { stepId: step0.id, step: fullStep() } }), 'NOT_FOUND');
    expect((await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision).toBe(0);
  });

  it('un enseignant non affecté à ce groupe/matière ne voit pas le travail', async () => {
    const w = await freshWork(ada);
    await expectCode(loadWorkForActor(otherTeacher, w.id), 'NOT_FOUND'); // autre = MATHS à Racine seulement
    expect((await loadWorkForActor(teacher, w.id)).mode).toBe('teacher');
  });

  it('un enseignant affecté à la matière dans un AUTRE groupe ne voit pas l’élève de ce groupe', async () => {
    // « autre » enseigne MATHS au groupe Racine, pas au groupe Principal où est Cyd.
    const w = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: MATHS_SUITES_ACTIVITY_SLUG } });
    const cydWork = await openWork(cyd, { activitySlug: w.slug });
    await expectCode(loadWorkForActor(otherTeacher, cydWork.id), 'NOT_FOUND');
    const danWork = await openWork(dan, { activitySlug: w.slug });
    expect((await loadWorkForActor(otherTeacher, danWork.id)).mode).toBe('teacher');
    // `prof` enseigne aussi MATHS au groupe Racine : il voit lui aussi le travail de Dan.
    expect((await loadWorkForActor(teacher, danWork.id)).mode).toBe('teacher');
  });

  it('un élève ne peut pas utiliser la vue enseignant sur son propre travail', async () => {
    const w = await freshWork(ada);
    await expectCode(reviewWork(ada, w.id, 'MARK_CORRECTED'), 'FORBIDDEN');
    await expectCode(addAnnotation(ada, w.id, { kind: 'GENERAL', body: 'je me corrige' }), 'FORBIDDEN');
  });
});

// ─── Autosave et révision optimiste ─────────────────────────────────────────

describe('autosave', () => {
  it('enregistre, incrémente la révision, passe en cours et calcule la progression', async () => {
    const w = await freshWork(bob);
    const r = await saveWork(bob, w.id, { baseRevision: 0, patch: { stepId: step0.id, step: fullStep() } });
    expect(r).toMatchObject({ revision: 1, status: 'IN_PROGRESS', progressSteps: 1, replayed: false });
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } });
    expect(row.revision).toBe(1);
    expect((row.content as { steps: Record<string, { code: string }> }).steps[step0.id].code).toContain('# fait');
    expect(row.lastSavedAt.getTime()).toBeGreaterThanOrEqual(row.startedAt.getTime());
  });

  it('reprise : le contenu relu en base est exactement celui enregistré', async () => {
    const w = await freshWork(bob);
    const reopened = await openWork(bob, { activitySlug: POO_ACTIVITY_SLUG });
    expect(reopened.id).toBe(w.id);
    expect(reopened.content.steps[step0.id]).toEqual(fullStep());
    expect(reopened.revision).toBe(1);
  });

  it('une écriture obsolète est refusée avec la version courante, sans rien écraser', async () => {
    const w = await freshWork(bob);
    await saveWork(bob, w.id, { baseRevision: 1, patch: { stepId: poo.steps[1].id, step: { code: 'x = 2' } } }); // rév 2
    const e = await expectCode(saveWork(bob, w.id, { baseRevision: 1, patch: { stepId: poo.steps[1].id, step: { code: 'ANCIEN' } } }), 'REVISION_CONFLICT');
    expect((e.details as { current: { revision: number } }).current.revision).toBe(2);
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } });
    expect((row.content as { steps: Record<string, { code: string }> }).steps[poo.steps[1].id].code).toBe('x = 2');
  });

  it('rejouer une sauvegarde déjà appliquée réussit sans écrire (coupure réseau)', async () => {
    const w = await freshWork(bob);
    const base = (await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision;
    const patch = { stepId: poo.steps[2].id, step: { code: 'rejeu' } };
    const applied = await saveWork(bob, w.id, { baseRevision: base, patch });
    expect(applied.replayed).toBe(false);
    // Le client n'a pas reçu la réponse : il renvoie la même requête, même base.
    const replay = await saveWork(bob, w.id, { baseRevision: base, patch });
    expect(replay.replayed).toBe(true);
    expect(replay.revision).toBe(applied.revision);
    expect((await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision).toBe(applied.revision);
  });

  it('deux sauvegardes simultanées sur la même révision : une seule gagne, l’autre est un conflit', async () => {
    const w = await freshWork(ada);
    const base = (await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision;
    const results = await Promise.allSettled([
      saveWork(ada, w.id, { baseRevision: base, patch: { stepId: poo.steps[3].id, step: { code: 'onglet A' } } }),
      saveWork(ada, w.id, { baseRevision: base, patch: { stepId: poo.steps[3].id, step: { code: 'onglet B' } } }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const ko = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect((ko[0].reason as EspaceError).code).toBe('REVISION_CONFLICT');
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } });
    expect(row.revision).toBe(base + 1);
  });

  it('refuse une étape inconnue, un contenu hors schéma et un code démesuré', async () => {
    const w = await freshWork(ada);
    const base = (await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision;
    await expectCode(saveWork(ada, w.id, { baseRevision: base, patch: { stepId: 'inconnue', step: {} } }), 'INVALID_INPUT');
    await expectCode(saveWork(ada, w.id, { baseRevision: base, patch: { stepId: step0.id, step: { evil: '<script>' } } }), 'INVALID_INPUT');
    await expectCode(saveWork(ada, w.id, { baseRevision: base, patch: { stepId: step0.id, step: { code: 'x'.repeat(20_001) } } }), 'INVALID_INPUT');
    await expectCode(saveWork(ada, w.id, { baseRevision: -1, patch: { stepId: step0.id, step: {} } }), 'INVALID_INPUT');
  });

  it('stocke le code tel quel comme texte : une charge HTML n’est jamais interprétée', async () => {
    const w = await freshWork(ada);
    const base = (await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision;
    const payload = '<img src=x onerror=alert(1)>';
    await saveWork(ada, w.id, { baseRevision: base, patch: { stepId: poo.steps[4].id, step: { code: payload } } });
    const back = await openWork(ada, { activitySlug: POO_ACTIVITY_SLUG });
    expect(back.content.steps[poo.steps[4].id].code).toBe(payload); // aucune transformation côté serveur
  });
});

// ─── Instantanés ────────────────────────────────────────────────────────────

describe('instantanés (versionnage)', () => {
  it('un changement d’étape crée un instantané ; la frappe courante n’en crée pas à chaque fois', async () => {
    const w = await openWork(dan, { activitySlug: MATHS_SUITES_ACTIVITY_SLUG });
    expect(w.stepsTotal).toBe(0); // activité sans étapes : saveWork refusé
    await expectCode(saveWork(dan, w.id, { baseRevision: 0, patch: { stepId: 'x', step: {} } }), 'INVALID_INPUT');
  });

  it('STEP_CHANGE toujours, RUN espacé, intervalle seulement si assez ancien', async () => {
    const student = bob;
    const w = await freshWork(student);
    let rev = (await prisma.espaceWork.findUniqueOrThrow({ where: { id: w.id } })).revision;
    const before = await prisma.espaceWorkVersion.count({ where: { workId: w.id } });

    const a = await saveWork(student, w.id, { baseRevision: rev, patch: { stepId: poo.steps[5].id, step: { code: 'a = 1' } }, snapshot: 'STEP_CHANGE' });
    rev = a.revision;
    expect(await prisma.espaceWorkVersion.count({ where: { workId: w.id } })).toBe(before + 1);

    // Frappes ordinaires juste après : pas d'instantané supplémentaire.
    for (const code of ['a = 1\n', 'a = 1\nb', 'a = 1\nb = 2']) {
      rev = (await saveWork(student, w.id, { baseRevision: rev, patch: { stepId: poo.steps[5].id, step: { code } } })).revision;
    }
    expect(await prisma.espaceWorkVersion.count({ where: { workId: w.id } })).toBe(before + 1);

    // RUN dans la fenêtre minimale : ignoré.
    rev = (await saveWork(student, w.id, { baseRevision: rev, patch: { stepId: poo.steps[5].id, step: { code: 'a = 1\nb = 2\nc' } }, snapshot: 'RUN' })).revision;
    expect(await prisma.espaceWorkVersion.count({ where: { workId: w.id } })).toBe(before + 1);

    const versions = await prisma.espaceWorkVersion.findMany({ where: { workId: w.id }, orderBy: { revision: 'asc' } });
    expect(versions.at(-1)!.reason).toBe('STEP_CHANGE');
    expect(versions.map((v) => v.revision)).toEqual([...new Set(versions.map((v) => v.revision))].sort((x, y) => x - y));
  });
});

// ─── Remise, lecture seule, reprise ─────────────────────────────────────────

describe('remise et correction', () => {
  let work: { id: string };

  beforeAll(async () => {
    work = await freshWork(ada);
  });

  it('on ne remet pas un travail pas commencé', async () => {
    const empty = await openWork(dan, { activitySlug: MATHS_SUITES_ACTIVITY_SLUG });
    await expectCode(submitWork(dan, empty.id, 0), 'WORK_EMPTY');
  });

  it('on ne remet pas sur une révision obsolète', async () => {
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    await expectCode(submitWork(ada, work.id, row.revision + 5), 'REVISION_CONFLICT');
  });

  it('remise : statut, date, version, puis lecture seule — même pour une requête déjà en vol', async () => {
    let row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    const submitted = await submitWork(ada, work.id, row.revision);
    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.submittedAt).not.toBeNull();
    expect(submitted.editable).toBe(false);
    expect(await prisma.espaceWorkVersion.count({ where: { workId: work.id, reason: 'SUBMIT' } })).toBe(1);

    row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    await expectCode(saveWork(ada, work.id, { baseRevision: row.revision, patch: { stepId: step0.id, step: { code: 'trop tard' } } }), 'WORK_LOCKED');
    const unchanged = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    expect(unchanged.revision).toBe(row.revision);
  });

  it('rejouer la remise réussit sans effet', async () => {
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    const again = await submitWork(ada, work.id, row.revision - 1);
    expect(again.status).toBe('SUBMITTED');
    expect((await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } })).revision).toBe(row.revision);
  });

  it('l’enseignant corrige, puis rouvre : l’élève peut de nouveau modifier sans conflit', async () => {
    const corrected = await reviewWork(teacher, work.id, 'MARK_CORRECTED');
    expect(corrected.status).toBe('CORRECTED');
    expect(corrected.correctedAt).not.toBeNull();
    await expectCode(reviewWork(teacher, work.id, 'MARK_CORRECTED'), 'INVALID_TRANSITION'); // déjà corrigé

    const reopened = await reviewWork(teacher, work.id, 'REOPEN');
    expect(reopened.status).toBe('REOPENED');
    expect(reopened.editable).toBe(true);

    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    const saved = await saveWork(ada, work.id, { baseRevision: row.revision, patch: { stepId: step0.id, step: { code: 'reprise' } } });
    expect(saved.status).toBe('REOPENED'); // une reprise reste une reprise
    const resubmitted = await submitWork(ada, work.id, saved.revision);
    expect(resubmitted.status).toBe('SUBMITTED');
  });

  it('l’enseignant ne modifie jamais le contenu : la révision ne bouge pas sur ses actions', async () => {
    const before = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    await reviewWork(teacher, work.id, 'MARK_CORRECTED');
    await reviewWork(teacher, work.id, 'MARK_DONE');
    const after = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    expect(after.status).toBe('DONE');
    expect(after.revision).toBe(before.revision);
    expect(JSON.stringify(after.content)).toBe(JSON.stringify(before.content));
  });

  it('transitions interdites : terminé → remettre, brouillon → corriger', async () => {
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    await expectCode(submitWork(ada, work.id, row.revision), 'INVALID_TRANSITION');
    const fresh = await freshWork(bob);
    const bobRow = await prisma.espaceWork.findUniqueOrThrow({ where: { id: fresh.id } });
    await prisma.espaceWork.update({ where: { id: bobRow.id }, data: { status: 'DRAFT' } });
    await expectCode(reviewWork(teacher, bobRow.id, 'MARK_CORRECTED'), 'INVALID_TRANSITION');
  });
});

// ─── Annotations ────────────────────────────────────────────────────────────

describe('annotations', () => {
  let target: { id: string };

  beforeAll(async () => {
    target = await freshWork(bob);
  });

  it('valide la cible selon le type', async () => {
    await expectCode(addAnnotation(teacher, target.id, { kind: 'GENERAL', body: 'x', stepId: step0.id }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'STEP', body: 'x' }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'QUESTION', body: 'x', stepId: step0.id }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'CODE', body: 'x', stepId: step0.id }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'CODE', body: 'x', stepId: step0.id, lineStart: 5, lineEnd: 2 }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'STEP', body: 'x', stepId: 'nope' }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'GENERAL', body: '   ' }), 'INVALID_INPUT');
    await expectCode(addAnnotation(teacher, target.id, { kind: 'GENERAL', body: 'a'.repeat(4001) }), 'INVALID_INPUT');
  });

  it('crée global, étape, question et code ; rattache à la révision courante', async () => {
    const q = step0.questions[0];
    const rows = await Promise.all([
      addAnnotation(teacher, target.id, { kind: 'GENERAL', body: 'Bonne compréhension des instances.' }),
      addAnnotation(teacher, target.id, { kind: 'STEP', body: 'Revois cette étape.', stepId: step0.id }),
      addAnnotation(teacher, target.id, { kind: 'QUESTION', body: 'Relis la question.', stepId: step0.id, questionId: q.id }),
      addAnnotation(teacher, target.id, { kind: 'CODE', body: 'Ici tu modifies l’état.', stepId: step0.id, lineStart: 3, lineEnd: 4 }),
    ]);
    expect(rows.map((r) => r.kind).sort()).toEqual(['CODE', 'GENERAL', 'QUESTION', 'STEP']);
    const current = await prisma.espaceWork.findUniqueOrThrow({ where: { id: target.id } });
    expect(rows.every((r) => r.workRevision === current.revision)).toBe(true);
    const code = rows.find((r) => r.kind === 'CODE')!;
    expect([code.lineStart, code.lineEnd]).toEqual([3, 4]);
  });

  it('reste invisible pour l’élève tant que le travail n’a pas été rendu', async () => {
    expect(await listAnnotations(bob, target.id)).toHaveLength(0);
    expect((await listAnnotations(teacher, target.id)).length).toBeGreaterThanOrEqual(4);
  });

  it('devient visible après une relecture, et reste isolé entre élèves', async () => {
    await prisma.espaceWork.update({ where: { id: target.id }, data: { status: 'SUBMITTED' } });
    await reviewWork(teacher, target.id, 'MARK_CORRECTED');
    const seen = await listAnnotations(bob, target.id);
    expect(seen.length).toBeGreaterThanOrEqual(4);
    expect(seen[0].authorName).toContain('Prof');
    await expectCode(listAnnotations(ada, target.id), 'NOT_FOUND'); // Ada ne lit pas les retours de Bob
  });

  it('seul l’auteur (ou un admin) supprime une annotation', async () => {
    const ann = await addAnnotation(teacher, target.id, { kind: 'GENERAL', body: 'à supprimer' });
    // Pour atteindre FORBIDDEN (et non NOT_FOUND) l'autre enseignant doit pouvoir voir le travail.
    const temp = await prisma.espaceTeacherAssignment.create({ data: { teacherId: otherTeacher.id, groupId: createdGroupIds[0], subject: 'NSI' } });
    try {
      await expectCode(deleteAnnotation(otherTeacher, target.id, ann.id), 'FORBIDDEN');
    } finally {
      await prisma.espaceTeacherAssignment.delete({ where: { id: temp.id } });
    }
    await deleteAnnotation(teacher, target.id, ann.id);
    expect(await prisma.espaceAnnotation.count({ where: { id: ann.id } })).toBe(0);
  });

  it('bibliothèque de commentaires : privée à chaque enseignant', async () => {
    const s = await addSnippet(teacher, { body: 'Attention à la différence entre return et print.' });
    expect((await listSnippets(teacher)).map((x) => x.id)).toContain(s.id);
    expect((await listSnippets(otherTeacher)).map((x) => x.id)).not.toContain(s.id);
    await expectCode(listSnippets(ada), 'FORBIDDEN');
  });
});

// ─── Séances ────────────────────────────────────────────────────────────────

describe('séances', () => {
  it('un enseignant ne crée une séance que pour un groupe et une matière qu’il enseigne', async () => {
    // `autre` enseigne MATHS à Racine, pas NSI à Principal.
    await expectCode(createSession(otherTeacher, { groupId: createdGroupIds[0], subject: 'NSI', activitySlug: POO_ACTIVITY_SLUG }), 'FORBIDDEN');
    await expectCode(createSession(ada, { groupId: createdGroupIds[0], subject: 'NSI', activitySlug: POO_ACTIVITY_SLUG }), 'FORBIDDEN');
  });

  it('refuse une activité qui n’appartient pas à la matière', async () => {
    const principal = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: g('principal') } });
    await expectCode(createSession(teacher, { groupId: principal.id, subject: 'MATHEMATIQUES', activitySlug: POO_ACTIVITY_SLUG }), 'INVALID_INPUT'); // `prof` enseigne MATHS ici, mais le TP POO est du NSI
  });

  it('publiée, la séance apparaît seulement chez les inscrits à la matière dans ce groupe', async () => {
    const principal = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: g('principal') } });
    const s = await createSession(teacher, { groupId: principal.id, subject: 'NSI', activitySlug: POO_ACTIVITY_SLUG, title: 'TP POO' });
    expect(await listPublishedSessionsForStudent(ada.id)).toHaveLength(0); // brouillon : invisible
    const published = await publishSession(teacher, s.id);
    expect(published.participants).toBe(2); // ada + bob (NSI) ; cyd est MATHS seulement
    expect((await listPublishedSessionsForStudent(ada.id)).map((x) => x.id)).toContain(s.id);
    expect((await listPublishedSessionsForStudent(bob.id)).map((x) => x.id)).toContain(s.id);
    expect((await listPublishedSessionsForStudent(cyd.id)).map((x) => x.id)).not.toContain(s.id);
    expect((await listPublishedSessionsForStudent(dan.id)).map((x) => x.id)).not.toContain(s.id);

    const opened = await openWork(ada, { activitySlug: POO_ACTIVITY_SLUG, sessionId: s.id });
    expect(opened.id).toBeTruthy();
    await expectCode(openWork(cyd, { activitySlug: POO_ACTIVITY_SLUG, sessionId: s.id }), 'NOT_ENROLLED');

    await closeSession(teacher, s.id);
    expect((await listPublishedSessionsForStudent(ada.id)).map((x) => x.id)).not.toContain(s.id);
    await expectCode(publishSession(teacher, s.id), 'INVALID_TRANSITION');
  });

  it('un autre enseignant ne publie pas la séance d’autrui', async () => {
    const principal = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: g('principal') } });
    const s = await createSession(teacher, { groupId: principal.id, subject: 'NSI', activitySlug: POO_ACTIVITY_SLUG });
    await expectCode(publishSession(otherTeacher, s.id), 'NOT_FOUND');
  });
});
