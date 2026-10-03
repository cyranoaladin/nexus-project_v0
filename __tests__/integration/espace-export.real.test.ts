/**
 * @jest-environment node
 *
 * Export enseignant (travail / séance / élève) : accès identique à la lecture
 * normale, contenu fidèle à la base, aucune fuite d'identifiant de connexion.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { randomUUID } from 'node:crypto';

import { auth } from '@/auth';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { POO_ACTIVITY_SLUG, getPooContent } from '@/lib/espace/catalog';
import { addAnnotation } from '@/lib/espace/annotations';
import { MAX_EXPORT_WORKS, buildExport, serializeExport } from '@/lib/espace/export';
import { applyProvisioning, parseRoster, syncActivities } from '@/lib/espace/provisioning';
import { closeSession, createSession, publishSession } from '@/lib/espace/sessions';
import { openWork, saveWork, submitWork } from '@/lib/espace/works';
import { GET as exportRoute } from '@/app/api/espace/teacher/export/route';
import { GET as legacyRoute } from '@/app/api/espace/teacher/legacy/route';

const run = randomUUID().slice(0, 8);
const u = (n: string) => `${n}.${run}`.slice(0, 32);
const g = (n: string) => `${n}-${run}`;
const poo = getPooContent();
const step0 = poo.steps[0];

const roster = parseRoster({
  groups: [{ slug: g('p'), name: 'P' }, { slug: g('r'), name: 'R' }],
  teachers: [
    { username: u('prof'), firstName: 'Prof', lastName: `Exp${run}`, teaches: [{ group: g('p'), subjects: ['NSI'] }] },
    { username: u('hors'), firstName: 'Hors', lastName: `Gr${run}`, teaches: [{ group: g('r'), subjects: ['NSI'] }] },
  ],
  students: [
    { username: u('ada'), firstName: 'Ada', lastName: `A${run}`, enrollments: [{ group: g('p'), subjects: ['NSI'] }] },
    { username: u('bob'), firstName: 'Bob', lastName: `B${run}`, enrollments: [{ group: g('r'), subjects: ['NSI'] }] },
  ],
});

type Who = 'prof' | 'hors' | 'ada' | 'bob';
const ids = {} as Record<Who, string>;
const userIds: string[] = [];
const groupIds: string[] = [];
let adaWorkId = '';
let sessionId = '';

const as = (who: Who | null) => (auth as jest.Mock).mockResolvedValue(who ? { user: { id: ids[who] } } : null);
const actor = (who: Who, role: 'ELEVE' | 'COACH') => ({ id: ids[who], role, firstName: who, lastName: null });
const call = (query: string) => exportRoute(new Request(`http://localhost/api/espace/teacher/export?${query}`, { headers: { host: 'localhost' } }));

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await syncActivities(prisma);
  await applyProvisioning(prisma, roster, { adopt: false });
  for (const who of ['prof', 'hors', 'ada', 'bob'] as const) {
    const row = await prisma.user.findUniqueOrThrow({ where: { username: u(who) } });
    ids[who] = row.id;
    userIds.push(row.id);
  }
  groupIds.push(...(await prisma.espaceGroup.findMany({ where: { slug: { in: roster.groups.map((x) => x.slug) } }, select: { id: true } })).map((x) => x.id));

  const group = await prisma.espaceGroup.findUniqueOrThrow({ where: { slug: g('p') } });
  const session = await createSession(actor('prof', 'COACH'), { groupId: group.id, subject: 'NSI', activitySlug: POO_ACTIVITY_SLUG, title: 'Export' });
  sessionId = session.id;
  await publishSession(actor('prof', 'COACH'), sessionId);

  const work = await openWork(actor('ada', 'ELEVE'), { activitySlug: POO_ACTIVITY_SLUG, sessionId });
  adaWorkId = work.id;
  const saved = await saveWork(actor('ada', 'ELEVE'), work.id, {
    baseRevision: 0,
    patch: { stepId: step0.id, step: { code: `${step0.starter}\n# export`, fields: Object.fromEntries(step0.fields.map((f) => [f.id, 'réponse'])) } },
    snapshot: 'STEP_CHANGE',
  });
  await submitWork(actor('ada', 'ELEVE'), work.id, saved.revision);
  await addAnnotation(actor('prof', 'COACH'), work.id, { kind: 'GENERAL', body: 'Bien.' });
  await openWork(actor('bob', 'ELEVE'), { activitySlug: POO_ACTIVITY_SLUG });
}, 120_000);

afterAll(async () => {
  const works = { studentId: { in: userIds } };
  await prisma.espaceAnnotation.deleteMany({ where: { work: works } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: works } });
  await prisma.espaceWork.deleteMany({ where: works });
  await prisma.espaceSession.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceEnrollment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceGroup.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}, 60_000);

describe('GET /api/espace/teacher/export', () => {
  it('anonyme : 401', async () => {
    as(null);
    expect((await call(`workId=${adaWorkId}`)).status).toBe(401);
  });

  it('élève : 403, même sur son propre travail', async () => {
    as('ada');
    expect((await call(`workId=${adaWorkId}`)).status).toBe(403);
  });

  it('enseignant non affecté à ce groupe : 404 (travail, élève, séance)', async () => {
    as('hors');
    expect((await call(`workId=${adaWorkId}`)).status).toBe(404);
    expect((await call(`studentId=${ids.ada}`)).status).toBe(404);
    expect((await call(`sessionId=${sessionId}`)).status).toBe(404);
  });

  it('exige exactement un paramètre, bien formé', async () => {
    as('prof');
    expect((await call('')).status).toBe(400);
    expect((await call(`workId=${adaWorkId}&studentId=${ids.ada}`)).status).toBe(400);
    expect((await call('workId=../../etc/passwd')).status).toBe(400);
  });

  it('enseignant affecté : 200, en téléchargement non mis en cache', async () => {
    as('prof');
    const res = await call(`workId=${adaWorkId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="espace-export-work-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('le contenu exporté correspond à la base, sans fuite d’identifiants', async () => {
    as('prof');
    const text = await (await call(`workId=${adaWorkId}`)).text();
    const body = JSON.parse(text);
    const row = await prisma.espaceWork.findUniqueOrThrow({
      where: { id: adaWorkId },
      include: { versions: true, annotations: true },
    });

    expect(body.exportVersion).toBe(1);
    expect(body.scope).toEqual({ kind: 'work', id: adaWorkId });
    expect(body.works).toHaveLength(1);
    const w = body.works[0];
    expect(w.status).toBe('SUBMITTED');
    expect(w.revision).toBe(row.revision);
    expect(w.content).toEqual(JSON.parse(JSON.stringify(row.content)));
    expect(w.versions.map((v: { reason: string }) => v.reason).sort()).toEqual(row.versions.map((v) => v.reason).sort());
    expect(w.annotations).toHaveLength(1);
    expect(w.annotations[0]).toMatchObject({ kind: 'GENERAL', body: 'Bien.' });
    expect(w.timeline.map((e: { event: string }) => e.event)).toEqual(expect.arrayContaining(['STARTED', 'SUBMITTED', 'SNAPSHOT_STEP_CHANGE']));

    const pin = (await prisma.user.findUniqueOrThrow({ where: { id: ids.ada } })).pinHash!;
    for (const secret of ['pinHash', 'password', 'sessionVersion', u('ada'), u('prof'), pin, ids.ada, ids.prof]) {
      expect(text).not.toContain(secret);
    }
  });

  it('séance : seuls les travaux rattachés à la séance', async () => {
    as('prof');
    const body = await (await call(`sessionId=${sessionId}`)).json();
    expect(body.works.map((w: { id: string }) => w.id)).toEqual([adaWorkId]);
  });

  it('élève : tous ses travaux visibles par l’enseignant', async () => {
    as('prof');
    const body = await (await call(`studentId=${ids.ada}`)).json();
    expect(body.works.map((w: { id: string }) => w.id)).toEqual([adaWorkId]);
  });

  it('l’enseignant de l’autre groupe ne voit que son élève', async () => {
    as('hors');
    const body = await (await call(`studentId=${ids.bob}`)).json();
    expect(body.works).toHaveLength(1);
    expect(body.works[0].student.firstName).toBe('Bob');
  });

  it('borne la taille : trop de travaux ou trop d’octets sont refusés', async () => {
    expect(MAX_EXPORT_WORKS).toBe(100);
    const envelope = await buildExport(actor('prof', 'COACH'), { kind: 'work', id: adaWorkId });
    const huge = { ...envelope, works: Array.from({ length: 4 }, () => ({ ...envelope.works[0], content: 'x'.repeat(7 * 1024 * 1024) })) };
    expect(() => serializeExport(huge)).toThrow(/volumineux/);
  });

  it('une séance clôturée reste exportable', async () => {
    await closeSession(actor('prof', 'COACH'), sessionId);
    as('prof');
    expect((await call(`sessionId=${sessionId}`)).status).toBe(200);
  });
});

describe('GET /api/espace/teacher/legacy', () => {
  const callLegacy = () => legacyRoute(new Request('http://localhost/api/espace/teacher/legacy', { headers: { host: 'localhost' } }));

  it('anonyme 401, élève 403', async () => {
    as(null);
    expect((await callLegacy()).status).toBe(401);
    as('ada');
    expect((await callLegacy()).status).toBe(403);
  });

  it('enseignant : lecture seule, état « absent » quand aucun instantané n’a été importé', async () => {
    const previous = process.env.DOCUMENT_STORAGE_ROOT;
    process.env.DOCUMENT_STORAGE_ROOT = '/tmp/espace-legacy-absent-' + run;
    try {
      as('prof');
      const res = await callLegacy();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ state: 'ABSENT' });
    } finally {
      if (previous === undefined) delete process.env.DOCUMENT_STORAGE_ROOT;
      else process.env.DOCUMENT_STORAGE_ROOT = previous;
    }
  });

  it('n’expose aucune méthode d’écriture', async () => {
    const mod = await import('@/app/api/espace/teacher/legacy/route');
    expect(Object.keys(mod).filter((k) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(k))).toEqual([]);
  });
});
