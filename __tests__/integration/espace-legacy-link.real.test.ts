/**
 * @jest-environment node
 *
 * Pont legacy POO — rattachement manuel d'une trace historique.
 *
 * La source est une base SQLite temporaire au schéma exact de l'archive
 * (`submissions` + index uniques). Garanties prouvées : aucune association
 * automatique, dry-run sans écriture, source intacte (empreinte), pas de double
 * import, aucun écrasement, refus des cas ambigus.
 */

jest.unmock('@/lib/prisma');

import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { POO_ACTIVITY_SLUG, getPooContent } from '@/lib/espace/catalog';
import { LinkError, applyLink, confirmTokenFor, planLink } from '@/lib/espace/legacy/link';
import { LegacyTraceError, openLegacySource, parseLegacyTrace, summarizeTrace, traceToWorkContent, type LegacyReader } from '@/lib/espace/legacy/reader';
import { applyProvisioning, parseRoster, syncActivities } from '@/lib/espace/provisioning';

const run = randomUUID().slice(0, 8);
const u = (n: string) => `${n}.${run}`.slice(0, 32);
const g = (n: string) => `${n}-${run}`;
const poo = getPooContent();

function stepsFor(filled: string[]) {
  return Object.fromEntries(
    poo.steps.map((s) => {
      const on = filled.includes(s.id);
      return [
        s.id,
        {
          code: on ? `${s.starter ?? ''}\n# élève` : '',
          answers: on ? Object.fromEntries(s.questions.map((q) => [q.id, q.correct])) : {},
          fields: on ? Object.fromEntries(s.fields.map((f) => [f.id, 'réponse historique'])) : {},
          hintCount: 0,
          quizChecked: on,
          completed: on,
          attemptCount: on ? 2 : 0,
          seconds: on ? 120 : 0,
          history: [],
          localRun: '',
          localRunAt: '',
          last: on && s.id === 'reperes'
            ? { at: '2026-09-26T08:00:00Z', mode: 'test', code: 'x', runtime: 'pyodide', result: { ok: true, error: null, output: '', mode: 'test', tests: [{ label: 't1', pass: true, message: '' }, { label: 't2', pass: false, message: 'non' }] } }
            : null,
        },
      ];
    }),
  );
}

function tracePayload(id: string, alias: string, filled: string[], over: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema: 'nexus-poo-trace/1',
    lessonVersion: poo.version,
    id,
    revision: 3,
    profile: { alias, groupe: 'G1', session: 'S1' },
    createdAt: '2026-09-26T07:00:00Z',
    updatedAt: '2026-09-26T08:30:00Z',
    current: filled.at(-1) ?? 'reperes',
    elapsed: 3600,
    steps: stepsFor(filled),
    ...over,
  });
}

let dir = '';
let dbPath = '';
let reader: LegacyReader;
const ids = { t1: 'a1b2c3d4e5f60001', t2: 'a1b2c3d4e5f60002', dupA: 'a1b2c3d4e5f60003', dupB: 'a1b2c3d4e5f60004', bad: 'a1b2c3d4e5f60005', old: 'a1b2c3d4e5f60006' };
let sourceHashAtStart = '';
let teacherId = '';
const studentIds: Record<string, string> = {};
const groupIds: string[] = [];

const roster = parseRoster({
  groups: [{ slug: g('p'), name: 'P' }],
  teachers: [{ username: u('prof'), firstName: 'Prof', lastName: `L${run}`, teaches: [{ group: g('p'), subjects: ['NSI'] }] }],
  students: [
    { username: u('ada'), firstName: 'Ada', lastName: `A${run}`, enrollments: [{ group: g('p'), subjects: ['NSI'] }] },
    { username: u('bob'), firstName: 'Bob', lastName: `B${run}`, enrollments: [{ group: g('p'), subjects: ['NSI'] }] },
    { username: u('cyd'), firstName: 'Cyd', lastName: `C${run}`, enrollments: [{ group: g('p'), subjects: ['NSI'] }] },
    { username: u('mat'), firstName: 'Mat', lastName: `M${run}`, enrollments: [{ group: g('p'), subjects: ['MATHS'] }] },
  ],
});

async function linksCount() {
  return prisma.espaceLegacyLink.count({ where: { studentId: { in: Object.values(studentIds) } } });
}

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  dir = await mkdtemp(path.join(tmpdir(), 'legacy-poo-'));
  dbPath = path.join(dir, 'traces.sqlite3');

  // Schéma EXACT de l'archive (cf. server.py::init_db).
  const src = new DatabaseSync(dbPath);
  src.exec('CREATE TABLE submissions(id TEXT PRIMARY KEY, client_id TEXT, received TEXT, sha TEXT, alias TEXT, groupe TEXT, session TEXT, payload TEXT)');
  src.exec('CREATE UNIQUE INDEX unique_payload ON submissions(sha)');
  src.exec('CREATE INDEX by_received ON submissions(received DESC, id DESC)');
  const insert = src.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?)');
  const put = (id: string, alias: string, filled: string[], received: string, over: Record<string, unknown> = {}) => {
    const payload = tracePayload(id, alias, filled, over);
    insert.run(id, `client-${id}`, received, createHash('sha256').update(payload).digest('hex'), alias, 'G1', 'S1', payload);
  };
  put(ids.t1, 'POO01', ['reperes', 'instances', 'consulter'], '2026-09-26T08:31:00Z');
  put(ids.t2, 'POO02', ['reperes'], '2026-09-26T08:32:00Z');
  put(ids.dupA, 'POO03', ['reperes'], '2026-09-26T08:33:00Z');
  put(ids.dupB, 'POO03', ['reperes', 'instances'], '2026-09-26T08:34:00Z'); // même alias, deux dépôts
  src.exec(`INSERT INTO submissions VALUES ('${ids.bad}','c','2026-09-26T08:35:00Z','shabad','POO04','G1','S1','{"pas":"une trace"}')`);
  put(ids.old, 'POO05', ['reperes'], '2026-09-26T08:36:00Z', { lessonVersion: '0.0.1' });
  src.close();

  sourceHashAtStart = createHash('sha256').update(await readFile(dbPath)).digest('hex');
  reader = openLegacySource(dbPath);

  await syncActivities(prisma);
  await applyProvisioning(prisma, roster, { adopt: false });
  teacherId = (await prisma.user.findUniqueOrThrow({ where: { username: u('prof') } })).id;
  for (const n of ['ada', 'bob', 'cyd', 'mat']) studentIds[n] = (await prisma.user.findUniqueOrThrow({ where: { username: u(n) } })).id;
  groupIds.push(...(await prisma.espaceGroup.findMany({ where: { slug: g('p') }, select: { id: true } })).map((x) => x.id));
}, 120_000);

afterAll(async () => {
  reader.close();
  const owned = { studentId: { in: [...Object.values(studentIds)] } };
  await prisma.espaceLegacyLink.deleteMany({ where: owned });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: owned } });
  await prisma.espaceWork.deleteMany({ where: owned });
  await prisma.espaceEnrollment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceGroup.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [teacherId, ...Object.values(studentIds)] } } });
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
}, 60_000);

describe('lecture seule de la source', () => {
  it('lit toutes les traces sans rien modifier (empreinte du fichier identique)', () => {
    expect(reader.count()).toBe(6);
    expect(reader.list().map((r) => r.id)).toHaveLength(6);
    expect(reader.get(ids.t1)?.alias).toBe('POO01');
    expect(reader.findByAlias('POO03')).toHaveLength(2);
    expect(reader.fileSha256()).toBe(sourceHashAtStart);
  });

  it('la source est réellement ouverte en lecture seule : une écriture est refusée par SQLite', () => {
    const probe = new DatabaseSync(dbPath, { readOnly: true });
    expect(() => probe.exec("DELETE FROM submissions WHERE id = 'x'")).toThrow(/readonly/i);
    probe.close();
  });
});

describe('format historique', () => {
  it('accepte une trace valide et en tire une progression calculée (pas celle déclarée)', () => {
    const trace = parseLegacyTrace(reader.get(ids.t1)!.payload);
    const summary = summarizeTrace(trace);
    expect(summary.requiredSteps).toBe(7);
    expect(summary.completedSteps).toBe(3);
    const content = traceToWorkContent(trace);
    expect(Object.keys(content.steps).sort()).toEqual(['consulter', 'instances', 'reperes']);
    expect(content.steps.reperes.tests).toMatchObject({ passed: 1, total: 2 });
  });

  it('refuse une trace non conforme et une version de leçon incompatible', () => {
    expect(() => parseLegacyTrace(reader.get(ids.bad)!.payload)).toThrow(LegacyTraceError);
    try {
      parseLegacyTrace(reader.get(ids.old)!.payload);
      throw new Error('should throw');
    } catch (e) {
      expect((e as LegacyTraceError).code).toBe('INCOMPATIBLE_VERSION');
    }
    expect(() => parseLegacyTrace('pas du json')).toThrow(LegacyTraceError);
  });

  it('refuse une étape inconnue', () => {
    const payload = tracePayload('a1b2c3d4e5f6ffff', 'X', ['reperes']);
    const parsed = JSON.parse(payload);
    parsed.steps.fantome = parsed.steps.reperes;
    expect(() => parseLegacyTrace(JSON.stringify(parsed))).toThrow(LegacyTraceError);
  });
});

describe('aucune association automatique', () => {
  it('élèves, traces et comptes coexistent sans qu’aucun lien n’existe', async () => {
    expect(await linksCount()).toBe(0);
    // Même alias ressemblant au nom d'un élève : rien n'est déduit.
    expect(await prisma.espaceWork.count({ where: { studentId: { in: Object.values(studentIds) } } })).toBe(0);
  });

  it('le plan (dry-run) n’écrit rien', async () => {
    const before = [await linksCount(), await prisma.espaceWork.count(), await prisma.espaceWorkVersion.count()];
    const plan = await planLink(prisma, reader, { traceId: ids.t1, username: u('ada') });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.alreadyLinked).toBe(false);
      expect(plan.summary.completedSteps).toBe(3);
      expect(plan.confirmToken).toBe(confirmTokenFor(ids.t1, u('ada')));
    }
    expect([await linksCount(), await prisma.espaceWork.count(), await prisma.espaceWorkVersion.count()]).toEqual(before);
  });
});

describe('refus des cas ambigus ou invalides', () => {
  it('trace non précisée / inconnue', async () => {
    expect(await planLink(prisma, reader, { username: u('ada') })).toMatchObject({ ok: false, refusal: 'TRACE_NOT_SPECIFIED' });
    expect(await planLink(prisma, reader, { traceId: 'inexistante0001', username: u('ada') })).toMatchObject({ ok: false, refusal: 'TRACE_NOT_FOUND' });
    expect(await planLink(prisma, reader, { alias: 'POO99', username: u('ada') })).toMatchObject({ ok: false, refusal: 'TRACE_NOT_FOUND' });
  });

  it('un alias partagé par deux dépôts est refusé et liste les candidats', async () => {
    const plan = await planLink(prisma, reader, { alias: 'POO03', username: u('ada') });
    expect(plan).toMatchObject({ ok: false, refusal: 'AMBIGUOUS_ALIAS' });
    if (!plan.ok) expect(plan.candidates?.map((c) => c.id).sort()).toEqual([ids.dupA, ids.dupB].sort());
  });

  it('un alias unique est accepté, en désignant bien la trace', async () => {
    const plan = await planLink(prisma, reader, { alias: 'POO02', username: u('bob') });
    expect(plan).toMatchObject({ ok: true, traceId: ids.t2 });
  });

  it('trace invalide ou version incompatible', async () => {
    expect(await planLink(prisma, reader, { traceId: ids.bad, username: u('ada') })).toMatchObject({ ok: false, refusal: 'INVALID_TRACE' });
    expect(await planLink(prisma, reader, { traceId: ids.old, username: u('ada') })).toMatchObject({ ok: false, refusal: 'INCOMPATIBLE_VERSION' });
  });

  it('élève inconnu, mal formé, non élève, ou non inscrit en NSI', async () => {
    expect(await planLink(prisma, reader, { traceId: ids.t1, username: 'personne.x' })).toMatchObject({ refusal: 'STUDENT_NOT_FOUND' });
    expect(await planLink(prisma, reader, { traceId: ids.t1, username: 'a b@c' })).toMatchObject({ refusal: 'STUDENT_NOT_FOUND' });
    expect(await planLink(prisma, reader, { traceId: ids.t1, username: u('prof') })).toMatchObject({ refusal: 'STUDENT_NOT_FOUND' });
    expect(await planLink(prisma, reader, { traceId: ids.t1, username: u('mat') })).toMatchObject({ refusal: 'STUDENT_NOT_ENROLLED' });
  });
});

describe('exécution', () => {
  it('refuse sans le jeton de confirmation exact, sans rien écrire', async () => {
    const before = await linksCount();
    await expect(applyLink(prisma, reader, { traceId: ids.t1, username: u('ada') }, 'oui', teacherId)).rejects.toMatchObject({ code: 'CONFIRMATION_MISMATCH' });
    await expect(applyLink(prisma, reader, { traceId: ids.t1, username: u('ada') }, confirmTokenFor(ids.t1, u('bob')), teacherId)).rejects.toBeInstanceOf(LinkError);
    expect(await linksCount()).toBe(before);
  });

  it('lie la trace choisie à l’élève choisi : travail, version, provenance — source intacte', async () => {
    const result = await applyLink(prisma, reader, { traceId: ids.t1, username: u('ada') }, confirmTokenFor(ids.t1, u('ada')), teacherId);
    expect(result.alreadyLinked).toBe(false);
    expect(result.sourceSha256Before).toBe(sourceHashAtStart);
    expect(result.sourceSha256After).toBe(sourceHashAtStart);

    const link = await prisma.espaceLegacyLink.findUniqueOrThrow({ where: { legacyTraceId: ids.t1 } });
    expect(link.studentId).toBe(studentIds.ada);
    expect(link.sourceAlias).toBe('POO01');
    expect(link.sourceSha).toBe(reader.get(ids.t1)!.sha);
    expect(link.sourceDbSha256).toBe(sourceHashAtStart);
    expect(link.linkedById).toBe(teacherId);

    const work = await prisma.espaceWork.findUniqueOrThrow({ where: { id: link.workId! }, include: { versions: true } });
    expect(work.studentId).toBe(studentIds.ada);
    expect(work.status).toBe('IN_PROGRESS');
    expect(work.progressSteps).toBe(3);
    expect(work.versions.map((v) => v.reason)).toEqual(['LEGACY_IMPORT']);
    expect(work.startedAt.toISOString()).toBe('2026-09-26T07:00:00.000Z'); // dates historiques conservées
  });

  it('est idempotent : relier la même paire ne crée rien de plus', async () => {
    const before = [await linksCount(), await prisma.espaceWork.count(), await prisma.espaceWorkVersion.count()];
    const again = await applyLink(prisma, reader, { traceId: ids.t1, username: u('ada') }, confirmTokenFor(ids.t1, u('ada')), teacherId);
    expect(again.alreadyLinked).toBe(true);
    expect([await linksCount(), await prisma.espaceWork.count(), await prisma.espaceWorkVersion.count()]).toEqual(before);
  });

  it('empêche le double import : la même trace ne va pas à un second élève', async () => {
    const plan = await planLink(prisma, reader, { traceId: ids.t1, username: u('bob') });
    expect(plan).toMatchObject({ ok: false, refusal: 'ALREADY_LINKED_ELSEWHERE' });
    await expect(applyLink(prisma, reader, { traceId: ids.t1, username: u('bob') }, confirmTokenFor(ids.t1, u('bob')), teacherId)).rejects.toMatchObject({ code: 'ALREADY_LINKED_ELSEWHERE' });
  });

  it('n’écrase jamais le travail existant d’un élève', async () => {
    // Ada a déjà un travail importé : une seconde trace ne l'écrase pas.
    const plan = await planLink(prisma, reader, { traceId: ids.t2, username: u('ada') });
    expect(plan).toMatchObject({ ok: false, refusal: 'STUDENT_HAS_WORK' });
    const before = JSON.stringify((await prisma.espaceWork.findFirstOrThrow({ where: { studentId: studentIds.ada } })).content);
    await expect(applyLink(prisma, reader, { traceId: ids.t2, username: u('ada') }, confirmTokenFor(ids.t2, u('ada')), teacherId)).rejects.toMatchObject({ code: 'STUDENT_HAS_WORK' });
    expect(JSON.stringify((await prisma.espaceWork.findFirstOrThrow({ where: { studentId: studentIds.ada } })).content)).toBe(before);
  });

  it('réutilise un brouillon vide (révision 0) mais jamais un travail commencé', async () => {
    const activity = await prisma.espaceActivity.findUniqueOrThrow({ where: { slug: POO_ACTIVITY_SLUG } });
    await prisma.espaceWork.create({ data: { studentId: studentIds.bob, activityId: activity.id } }); // brouillon vide
    const res = await applyLink(prisma, reader, { traceId: ids.t2, username: u('bob') }, confirmTokenFor(ids.t2, u('bob')), teacherId);
    expect(res.alreadyLinked).toBe(false);
    expect(await prisma.espaceWork.count({ where: { studentId: studentIds.bob } })).toBe(1); // pas de doublon
    const work = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: studentIds.bob } });
    expect(work.progressSteps).toBe(1);
  });

  it('à la fin de toute la suite la source est strictement inchangée', async () => {
    expect(reader.fileSha256()).toBe(sourceHashAtStart);
    expect(reader.count()).toBe(6);
    expect((await stat(dbPath)).size).toBeGreaterThan(0);
    // Seules deux traces ont été liées, par décision explicite ci-dessus.
    expect(await linksCount()).toBe(2);
  });
});
