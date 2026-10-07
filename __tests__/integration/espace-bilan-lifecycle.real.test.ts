/** @jest-environment node */
// PostgreSQL réel. Seule la session HTTP est simulée ; aucune méthode Prisma n’est mockée.
jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import type { EspaceActor } from '@/lib/espace/guards';
import { applyProvisioning, parseRoster } from '@/lib/espace/provisioning';
import { createSession, publishSession, closeSession } from '@/lib/espace/sessions';
import { openWork, saveWork, submitWork, reviewWork } from '@/lib/espace/works';
import { loadWorkForActor } from '@/lib/espace/access';
import { addAnnotation, listAnnotations, deleteAnnotation } from '@/lib/espace/annotations';
import { buildExport, serializeExport } from '@/lib/espace/export';
import { bilanData } from '@/lib/espace/bilan-data';
import { parseWorkContent } from '@/lib/espace/work-content';
import { POST as openRoute } from '@/app/api/espace/works/route';
import { GET as readRoute, PUT as saveRoute } from '@/app/api/espace/works/[id]/route';
import { POST as submitRoute } from '@/app/api/espace/works/[id]/submit/route';
import { POST as reviewRoute } from '@/app/api/espace/works/[id]/review/route';
import { GET as versionsRoute } from '@/app/api/espace/works/[id]/versions/route';
import { GET as exportRoute } from '@/app/api/espace/teacher/export/route';

const run = randomUUID().slice(0, 8);
const username = (key: string) => `deep.${key}.${run}`;
const groupSlug = (key: string) => `bilan-deep-${key}-${run}`;
const activity = (level = '3e') => `maths-bilan-septembre-2026-${level}`;
type Who = 'student' | 'peer' | 'seconde' | 'coach' | 'outsider';
const actors = {} as Record<Who, EspaceActor>;
const ids: string[] = [];
const groups: string[] = [];
const sessions: Record<string, string> = {};
const roster = parseRoster({
  groups: ['3e', '2nde', 'other'].map(key => ({ slug: groupSlug(key), name: `Test ${key}` })),
  teachers: [
    { username: username('coach'), firstName: 'Coach', lastName: 'Test', teaches: ['3e', '2nde'].map(key => ({ group: groupSlug(key), subjects: ['MATHS'] })) },
    { username: username('outsider'), firstName: 'Autre', lastName: 'Test', teaches: [{ group: groupSlug('other'), subjects: ['MATHS'] }] },
  ],
  students: ['student', 'peer', 'seconde'].map(key => ({ username: username(key), firstName: 'Élève', lastName: key, enrollments: [{ group: groupSlug(key === 'seconde' ? '2nde' : '3e'), subjects: ['MATHS'] }] })),
});
const proof = (answer = '347 = 16 × 21 + 11', extra = {}) => JSON.stringify({ answer, retry: '', aid: 'Aucune aide', skipped: false, ...extra });
const as = (who: Who | null) => (auth as jest.Mock).mockResolvedValue(who ? { user: { id: actors[who].id } } : null);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function request(method: string, body?: unknown, headers: Record<string, string> = {}, query = '') {
  return new Request(`http://localhost/api/espace/test${query}`, { method, headers: { 'Content-Type': 'application/json', host: 'localhost', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function start(who: 'student' | 'peer' | 'seconde' = 'student') { return openWork(actors[who], { activitySlug: activity(who === 'seconde' ? '2nde' : '3e') }); }
async function save(id: string, revision: number, stepId: string, fields: Record<string, string>, who: Who = 'student') {
  return saveWork(actors[who], id, { baseRevision: revision, patch: { stepId, step: { fields } }, snapshot: 'STEP_CHANGE' });
}
async function submitted() {
  const work = await start();
  const saved = await save(work.id, work.revision, 'review', { confirmed: 'yes' });
  return submitWork(actors.student, work.id, saved.revision);
}
async function deleteWorks() {
  const where = { work: { studentId: { in: ids } } };
  await prisma.espaceAnnotation.deleteMany({ where });
  await prisma.espaceWorkAttachment.deleteMany({ where });
  await prisma.espaceWorkVersion.deleteMany({ where });
  await prisma.espaceWork.deleteMany({ where: { studentId: { in: ids } } });
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || '');
  assertDisposablePostgresUrl(process.env.DATABASE_URL || '');
  await applyProvisioning(prisma, roster, { adopt: false });
  for (const key of ['student', 'peer', 'seconde', 'coach', 'outsider'] as const) {
    const user = await prisma.user.findUniqueOrThrow({ where: { username: username(key) } });
    ids.push(user.id);
    actors[key] = { id: user.id, role: user.role as EspaceActor['role'], firstName: user.firstName, lastName: user.lastName };
  }
  for (const level of ['3e', '2nde', 'other']) {
    const group = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: groupSlug(level) } }); groups.push(group.id);
    if (level === 'other') continue;
    const session = await createSession(actors.coach, { groupId: group.id, subject: 'MATHEMATIQUES', activitySlug: activity(level) });
    sessions[level] = session.id;
    await publishSession(actors.coach, session.id);
  }
}, 120_000);
beforeEach(async () => {
  await deleteWorks();
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { disabledAt: null } });
  await prisma.espaceSession.updateMany({ where: { id: { in: Object.values(sessions) } }, data: { status: 'PUBLISHED' } });
  for (const level of ['3e', '2nde']) await publishSession(actors.coach, sessions[level]);
  as(null);
});
afterAll(async () => {
  await deleteWorks();
  await prisma.espaceSession.deleteMany({ where: { groupId: { in: groups } } });
  await prisma.espaceEnrollment.deleteMany({ where: { groupId: { in: groups } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { groupId: { in: groups } } });
  await prisma.espaceGroup.deleteMany({ where: { id: { in: groups } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}, 60_000);

describe('copies et réponses durables', () => {
  it('deux ouvertures concurrentes obtiennent une seule copie', async () => {
    const [a, b] = await Promise.all([start(), start()]);
    expect(a.id).toBe(b.id);
    expect(await prisma.espaceWork.count({ where: { studentId: actors.student.id } })).toBe(1);
  });

  it('retient un seul des deux patches concurrents et préserve ses données', async () => {
    const work = await start();
    const outcomes = await Promise.allSettled([save(work.id, 0, 'scope', { '3-arith': 'yes' }), save(work.id, 0, 'scope', { '3-arith': 'no' })]);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find(x => x.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'REVISION_CONFLICT' });
    const fresh = await loadWorkForActor(actors.student, work.id);
    expect(fresh.work.revision).toBe(1);
    expect(['yes', 'no']).toContain(parseWorkContent(fresh.work.content).steps.scope.fields?.['3-arith']);
  });

  it('une sauvegarde et une remise concurrentes ne peuvent pas toutes deux modifier la même révision', async () => {
    const work = await start();
    const saved = await save(work.id, 0, 'review', { confirmed: 'yes' });
    const outcomes = await Promise.allSettled([
      save(work.id, saved.revision, 'methods', { 'block-example': 'Réponse simultanée' }),
      submitWork(actors.student, work.id, saved.revision),
    ]);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const fresh = (await loadWorkForActor(actors.student, work.id)).work;
    expect(fresh.revision).toBe(saved.revision + 1);
    const content = parseWorkContent(fresh.content);
    if (fresh.status === 'SUBMITTED') {
      expect(content.steps.methods).toBeUndefined();
      expect(content.steps.review.fields?.confirmed).toBe('yes');
    } else {
      expect(fresh.status).toBe('IN_PROGRESS');
      expect(content.steps.methods.fields?.['block-example']).toBe('Réponse simultanée');
      expect(content.steps.review.fields?.confirmed).toBe('');
    }
  });

  it('le rejeu périmé ne restaure ni ancienne réponse ni ancienne confirmation', async () => {
    const work = await start();
    let saved = await save(work.id, 0, 'methods', { 'block-example': 'Avant' });
    saved = await save(work.id, saved.revision, 'review', { confirmed: 'yes' });
    saved = await save(work.id, saved.revision, 'methods', { 'block-example': 'Après' });
    await expect(save(work.id, 0, 'methods', { 'block-example': 'Avant' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(save(work.id, 1, 'review', { confirmed: 'yes' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    const replay = await save(work.id, 2, 'methods', { 'block-example': 'Après' });
    expect(replay).toMatchObject({ revision: saved.revision, replayed: true, content: { steps: { review: { fields: { confirmed: '' } } } } });
  });

  it('préserve les preuves de seconde avec leurs aides sans les attribuer à un autre élève', async () => {
    const work = await start('seconde');
    const modules = bilanData.modules['2nde'];
    const task = bilanData.tasks.find(t => t.module === modules[0].id)!;
    let saved = await save(work.id, 0, 'scope', Object.fromEntries(modules.map(m => [m.id, 'yes'])), 'seconde');
    const value = proof('Premier essai : √2', { aid: 'Un indice', retry: 'Après aide : justification conservée' });
    saved = await save(work.id, saved.revision, 'evidence', { [task.id]: value }, 'seconde');
    expect(saved.content?.steps.evidence.fields?.[task.id]).toBe(value);
    const text = serializeExport(await buildExport(actors.coach, { kind: 'work', id: work.id }));
    expect(text).toContain('justification conservée');
    await expect(loadWorkForActor(actors.student, work.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(save(work.id, saved.revision, 'evidence', { [task.id]: proof('intrusion') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('renvoie le contenu canonique et accepte le rejeu d’une preuve retirée du périmètre', async () => {
    const work = await start();
    const fields = { '3-div': proof() };
    const first = await save(work.id, 0, 'evidence', fields);
    const replay = await save(work.id, 0, 'evidence', fields);
    expect(first).toMatchObject({ content: { v: 1, steps: { evidence: { fields: {} } } } });
    expect(replay).toMatchObject({ revision: first.revision, replayed: true, content: { steps: { evidence: { fields: {} } } } });
    expect(await prisma.espaceWorkVersion.count({ where: { workId: work.id } })).toBe(1);
  });

  it('supprime la preuve hors périmètre et conserve son instantané antérieur', async () => {
    const work = await start();
    let result = await save(work.id, 0, 'scope', { '3-arith': 'yes' });
    result = await save(work.id, result.revision, 'evidence', { '3-div': proof('essai antérieur <script>inerte</script>') });
    result = await save(work.id, result.revision, 'scope', { '3-arith': 'no' });
    const stored = parseWorkContent((await loadWorkForActor(actors.student, work.id)).work.content);
    expect(stored.steps.evidence.fields).toEqual({});
    const exported = await buildExport(actors.coach, { kind: 'work', id: work.id });
    expect(exported.works[0].versions.some(v => JSON.stringify(v.content).includes('essai antérieur'))).toBe(true);
  });

  it('une nouvelle réponse invalide la relecture sans invalider une simple navigation', async () => {
    const work = await start();
    let result = await save(work.id, 0, 'methods', { 'block-example': 'Première réponse' });
    result = await save(work.id, result.revision, 'review', { confirmed: 'yes' });
    result = await save(work.id, result.revision, 'methods', { 'block-example': 'Première réponse' });
    expect(parseWorkContent((await loadWorkForActor(actors.student, work.id)).work.content).steps.review.fields?.confirmed).toBe('yes');
    result = await save(work.id, result.revision, 'methods', { 'block-example': 'Nouvelle réponse' });
    await expect(submitWork(actors.student, work.id, result.revision)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('consulter une rubrique encore vide ne retire pas la confirmation de relecture', async () => {
    const work = await start();
    let saved = await save(work.id, 0, 'review', { confirmed: 'yes' });
    saved = await save(work.id, saved.revision, 'methods', {});
    expect(saved.content?.steps.review.fields?.confirmed).toBe('yes');
    saved = await save(work.id, saved.revision, 'methods', { 'block-example': '' });
    expect(saved.content?.steps.review.fields?.confirmed).toBe('yes');
  });

  it('verrouille remise/correction, rouvre sans altérer les réponses et exige une nouvelle relecture', async () => {
    const draft = await start();
    let saved = await save(draft.id, 0, 'methods', { 'block-example': 'Réponse préservée après réouverture' });
    saved = await save(draft.id, saved.revision, 'review', { confirmed: 'yes' });
    const work = await submitWork(actors.student, draft.id, saved.revision);
    await expect(save(work.id, work.revision, 'methods', { 'block-example': 'Interdit' })).rejects.toMatchObject({ code: 'WORK_LOCKED' });
    await reviewWork(actors.coach, work.id, 'MARK_CORRECTED');
    await reviewWork(actors.coach, work.id, 'MARK_DONE');
    const reopened = await reviewWork(actors.coach, work.id, 'REOPEN');
    expect(reopened.status).toBe('REOPENED');
    expect(reopened.revision).toBe(work.revision + 1);
    expect(reopened.progressSteps).toBe(work.progressSteps - 1);
    expect(reopened.content.steps.methods).toEqual(work.content.steps.methods);
    const originalSubmission = await prisma.espaceWorkVersion.findFirstOrThrow({ where: { workId: work.id, reason: 'SUBMIT' } });
    expect(parseWorkContent(originalSubmission.content)).toEqual(work.content);
    await expect(save(work.id, work.revision, 'review', { confirmed: 'yes' })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(submitWork(actors.student, work.id, reopened.revision)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const confirmed = await save(work.id, reopened.revision, 'review', { confirmed: 'yes' });
    expect((await submitWork(actors.student, work.id, confirmed.revision)).status).toBe('SUBMITTED');
  });

  it('le rejeu de remise ne crée pas un deuxième instantané SUBMIT', async () => {
    const work = await start(); const saved = await save(work.id, 0, 'review', { confirmed: 'yes' });
    const first = await submitWork(actors.student, work.id, saved.revision);
    const replay = await submitWork(actors.student, work.id, saved.revision);
    expect(replay.revision).toBe(first.revision);
    expect(await prisma.espaceWorkVersion.count({ where: { workId: work.id, reason: 'SUBMIT' } })).toBe(1);
  });
});

describe('annotations, récupération et export enseignant', () => {
  it('les remarques restent privées avant le retour et deviennent lisibles après correction', async () => {
    const work = await submitted();
    const note = await addAnnotation(actors.coach, work.id, { kind: 'QUESTION', stepId: 'scope', questionId: '3-arith', body: 'Une observation <b>littérale</b>, pas une note.' });
    expect(await listAnnotations(actors.student, work.id)).toEqual([]);
    expect((await listAnnotations(actors.coach, work.id))[0].workRevision).toBe(work.revision);
    await reviewWork(actors.coach, work.id, 'MARK_CORRECTED');
    expect((await listAnnotations(actors.student, work.id)).map(x => x.body)).toEqual([note.body]);
    await expect(deleteAnnotation(actors.student, work.id, note.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(deleteAnnotation(actors.outsider, work.id, note.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('exporte réponses, historique et observations sans identifiants de connexion ni corrigés', async () => {
    const work = await start();
    let result = await save(work.id, 0, 'methods', { frequency: 'Je ne souhaite pas répondre', practice: JSON.stringify(['Je refais sans regarder le modèle']) });
    result = await save(work.id, result.revision, 'review', { confirmed: 'yes' });
    await submitWork(actors.student, work.id, result.revision);
    await addAnnotation(actors.coach, work.id, { kind: 'GENERAL', body: 'Observation humaine documentée.' });
    const envelope = await buildExport(actors.coach, { kind: 'work', id: work.id });
    const serialized = serializeExport(envelope);
    expect(serialized).toContain('Je ne souhaite pas répondre');
    expect(serialized).toContain('Observation humaine documentée.');
    for (const forbidden of ['pinHash', 'password', 'sessionVersion', username('student'), 'expected', '143 = 11 × 13']) expect(serialized).not.toContain(forbidden);
    const sessionExport = await buildExport(actors.coach, { kind: 'session', id: sessions['3e'] });
    expect(sessionExport.works.map(w => w.id)).toEqual([work.id]);
    await expect(buildExport(actors.peer, { kind: 'work', id: work.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(buildExport(actors.outsider, { kind: 'work', id: work.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(buildExport(actors.outsider, { kind: 'session', id: sessions['3e'] })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('une fermeture retire toutes les voies élève mais préserve le bilan enseignant', async () => {
    const work = await submitted(); await closeSession(actors.coach, sessions['3e']);
    for (const attempt of [() => loadWorkForActor(actors.student, work.id), () => listAnnotations(actors.student, work.id), () => submitWork(actors.student, work.id, work.revision - 1)]) await expect(attempt()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await buildExport(actors.coach, { kind: 'work', id: work.id })).works).toHaveLength(1);
  });
});

describe('routes API réelles — session simulée et stockage PostgreSQL réel', () => {
  it('refuse anonyme, autre élève, autre niveau et professeur hors périmètre', async () => {
    const work = await start();
    expect((await readRoute(request('GET'), ctx(work.id))).status).toBe(401);
    for (const who of ['peer', 'seconde', 'outsider'] as const) { as(who); expect((await readRoute(request('GET'), ctx(work.id))).status).toBe(404); }
    as('student');
    expect((await openRoute(request('POST', { activitySlug: activity('2nde') }))).status).toBe(404);
    expect((await reviewRoute(request('POST', { action: 'REOPEN' }), ctx(work.id))).status).toBe(403);
    as('coach'); expect((await saveRoute(request('PUT', { baseRevision: 0, patch: { stepId: 'review', step: { fields: { confirmed: 'yes' } } } }), ctx(work.id))).status).toBe(403);
  });

  it('ne modifie ni copie ni revision pour un payload invalide ou une origine étrangère', async () => {
    const work = await start(); as('student');
    const invalidPatches = [
      { stepId: 'scope', step: { fields: { '2-arith': 'yes' } } },
      { stepId: 'mastery', step: { fields: { '3-div-s': 'excellent' } } },
      { stepId: 'evidence', step: { fields: { '3-div': '{bad-json' } } },
      { stepId: 'methods', step: { choices: { frequency: 1 } } },
      { stepId: 'methods', step: { fields: { 'block-example': 'x'.repeat(5001) } } },
      { stepId: 'evidence', step: { fields: { '3-div': proof(), '3-prime-task': proof(), '3-lots': proof() } } },
    ];
    for (const patch of invalidPatches) expect((await saveRoute(request('PUT', { baseRevision: 0, patch }), ctx(work.id))).status).toBe(400);
    expect((await saveRoute(request('PUT', { baseRevision: 0, patch: { stepId: 'review', step: { fields: { confirmed: 'yes' } } } }, { origin: 'https://foreign.invalid' }), ctx(work.id))).status).toBe(403);
    expect((await loadWorkForActor(actors.student, work.id)).work.revision).toBe(0);
  });

  it('sauvegarde, reprend, transmet et récupère la même donnée sans perte de caractères', async () => {
    const work = await start(); as('student');
    const value = 'Méthode : √7 > 2,6 ; é, « guillemets », <script>inerte</script>\nLigne suivante';
    const saved = await saveRoute(request('PUT', { baseRevision: 0, patch: { stepId: 'methods', step: { fields: { 'block-example': value } } } }), ctx(work.id));
    expect(saved.status).toBe(200);
    const body = await (await readRoute(request('GET'), ctx(work.id))).json();
    expect(body.work.content.steps.methods.fields['block-example']).toBe(value);
    await save(work.id, body.work.revision, 'review', { confirmed: 'yes' });
    const submittedResponse = await submitRoute(request('POST', { baseRevision: body.work.revision + 1 }), ctx(work.id));
    expect(submittedResponse.status).toBe(200);
    as('coach');
    expect((await versionsRoute(request('GET'), ctx(work.id))).status).toBe(200);
    const exported = await exportRoute(request('GET', undefined, {}, `?workId=${work.id}`));
    expect(exported.status).toBe(200);
    expect(await exported.text()).toContain('Ligne suivante');
  });

  it('recontrôle le compte désactivé et le retrait du participant sur les routes de lecture et écriture', async () => {
    const work = await start(); as('student');
    await prisma.user.update({ where: { id: actors.student.id }, data: { disabledAt: new Date() } });
    expect((await readRoute(request('GET'), ctx(work.id))).status).toBe(401);
    await prisma.user.update({ where: { id: actors.student.id }, data: { disabledAt: null } });
    await prisma.espaceSessionParticipant.delete({ where: { sessionId_userId: { sessionId: sessions['3e'], userId: actors.student.id } } });
    expect((await readRoute(request('GET'), ctx(work.id))).status).toBe(404);
    expect((await saveRoute(request('PUT', { baseRevision: 0, patch: { stepId: 'review', step: { fields: { confirmed: 'yes' } } } }), ctx(work.id))).status).toBe(404);
    expect((await submitRoute(request('POST', { baseRevision: 0 }), ctx(work.id))).status).toBe(404);
  });
});

describe('compléments PDF conservés en base et récupérables',()=>{
 it('sauvegarde la maîtrise supplémentaire et les conditions puis transmet et exporte sans altérer la trace',async()=>{
  const work=await start();
  let r=(await save(work.id,work.revision,'scope',{'3-thales':'yes'})).revision;
  const extra=bilanData.modules['3e'].find(m=>m.id==='3-thales')!.skills[0].id;
  r=(await save(work.id,r,'mastery-extra',{[extra]:'difficulty'})).revision;
  const task=bilanData.tasks.find(t=>t.id==='3-pdf-thales')!;
  const value=proof('Rapports conservés et figure relue',{conditions:'Sans cours ni calculatrice',confidence:'Moyenne'});
  r=(await save(work.id,r,'evidence',{[task.id]:value})).revision;
  r=(await save(work.id,r,'review',{confirmed:'yes'})).revision;
  await submitWork(actors.student,work.id,r);
  const fresh=await loadWorkForActor(actors.coach,work.id,'teacher');
  expect(parseWorkContent(fresh.work.content).steps['mastery-extra'].fields?.[extra]).toBe('difficulty');
  expect(parseWorkContent(fresh.work.content).steps.evidence.fields?.[task.id]).toBe(value);
  const exported=serializeExport(await buildExport(actors.coach,{kind:'work',id:work.id}));
  expect(exported).toContain('Rapports conservés');expect(exported).toContain('Moyenne');expect(exported).toContain('Sans cours ni calculatrice');
  await expect(save(work.id,fresh.work.revision,'mastery-extra',{[extra]:'alone'})).rejects.toMatchObject({code:'WORK_LOCKED'});
 });
});
