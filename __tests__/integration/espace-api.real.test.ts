/**
 * @jest-environment node
 *
 * (Environnement Node natif : `Request.formData()` / `File` du polyfill jsdom ne se
 * résolvent pas, alors que le runtime serveur réel est Node.)
 *
 * Espace pédagogique — accès DIRECT aux routes d'API (handlers réels, Postgres
 * réel). Prouve que la sécurité ne repose pas sur le masquage de l'interface :
 * anonyme, IDOR entre élèves, élève sur routes enseignant, corrigé interdit,
 * dépôts malveillants, CSRF, compte désactivé.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { auth } from '@/auth';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { MATHS_SUITES_ACTIVITY_SLUG, POO_ACTIVITY_SLUG, getPooContent } from '@/lib/espace/catalog';
import { applyProvisioning, parseRoster, syncActivities } from '@/lib/espace/provisioning';

import { POST as openWorkRoute } from '@/app/api/espace/works/route';
import { GET as getWork, PUT as putWork } from '@/app/api/espace/works/[id]/route';
import { POST as submitRoute } from '@/app/api/espace/works/[id]/submit/route';
import { POST as reviewRoute } from '@/app/api/espace/works/[id]/review/route';
import { GET as getAnnotations, POST as postAnnotation } from '@/app/api/espace/works/[id]/annotations/route';
import { GET as listVersions } from '@/app/api/espace/works/[id]/versions/route';
import { GET as listAttachmentsRoute, POST as uploadRoute } from '@/app/api/espace/works/[id]/attachments/route';
import { GET as downloadAttachment } from '@/app/api/espace/works/[id]/attachments/[attachmentId]/route';
import { GET as getResource } from '@/app/api/espace/resources/[activity]/[key]/route';
import { GET as overviewRoute } from '@/app/api/espace/teacher/overview/route';

const run = randomUUID().slice(0, 8);
const u = (n: string) => `${n}.${run}`.slice(0, 32);
const g = (n: string) => `${n}-${run}`;
const poo = getPooContent();
const step0 = poo.steps[0];

const roster = parseRoster({
  groups: [{ slug: g('principal'), name: 'Principal' }, { slug: g('racine'), name: 'Racine' }],
  teachers: [
    { username: u('prof'), firstName: 'Prof', lastName: `Api${run}`, teaches: [{ group: g('principal'), subjects: ['NSI', 'MATHS'] }] },
    { username: u('hors'), firstName: 'Hors', lastName: `Groupe${run}`, teaches: [{ group: g('racine'), subjects: ['MATHS'] }] },
  ],
  students: [
    { username: u('ada'), firstName: 'Ada', lastName: `A${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS', 'NSI'] }] },
    { username: u('bob'), firstName: 'Bob', lastName: `B${run}`, enrollments: [{ group: g('principal'), subjects: ['NSI', 'MATHS'] }] },
    { username: u('nsi'), firstName: 'Nsi', lastName: `Seul${run}`, enrollments: [{ group: g('principal'), subjects: ['NSI'] }] },
  ],
});

type Who = 'prof' | 'hors' | 'ada' | 'bob' | 'nsi';
const ids = {} as Record<Who, string>;
let storageRoot = '';
const userIds: string[] = [];
const groupIds: string[] = [];
const previousRoot = process.env.DOCUMENT_STORAGE_ROOT;

function as(who: Who | null) {
  (auth as jest.Mock).mockResolvedValue(who ? { user: { id: ids[who] } } : null);
}

function req(method: string, body?: unknown, headers: Record<string, string> = {}, path = '/api/espace/x') {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', host: 'localhost', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function jsonOf(res: Response) {
  return (await res.json()) as Record<string, any>;
}

async function open(who: Who, slug = POO_ACTIVITY_SLUG) {
  as(who);
  const res = await openWorkRoute(req('POST', { activitySlug: slug }));
  expect(res.status).toBe(200);
  return (await jsonOf(res)).work as { id: string; revision: number };
}

function fullStep() {
  return {
    code: `${step0.starter}\n# api`,
    fields: Object.fromEntries(step0.fields.map((f) => [f.id, 'réponse'])),
    choices: Object.fromEntries(step0.questions.map((q) => [q.id, q.correct])),
  };
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  storageRoot = await mkdtemp(path.join(tmpdir(), 'espace-api-'));
  process.env.DOCUMENT_STORAGE_ROOT = storageRoot;
  await mkdir(path.join(storageRoot, 'espace', 'resources', 'suites'), { recursive: true });
  await writeFile(path.join(storageRoot, 'espace', 'resources', 'suites', 'subject.pdf'), PDF);
  await writeFile(path.join(storageRoot, 'espace', 'resources', 'suites', 'correction.pdf'), PDF);
  await writeFile(path.join(storageRoot, 'espace', 'resources', 'suites', 'teacher-guide.pdf'), PDF);

  await syncActivities(prisma);
  await applyProvisioning(prisma, roster, { adopt: false });
  for (const who of ['prof', 'hors', 'ada', 'bob', 'nsi'] as const) {
    const row = await prisma.user.findUniqueOrThrow({ where: { username: u(who) } });
    ids[who] = row.id;
    userIds.push(row.id);
  }
  groupIds.push(...(await prisma.espaceGroup.findMany({ where: { slug: { in: roster.groups.map((x) => x.slug) } }, select: { id: true } })).map((x) => x.id));
}, 120_000);

afterAll(async () => {
  const works = { studentId: { in: userIds } };
  await prisma.espaceAnnotation.deleteMany({ where: { work: works } });
  await prisma.espaceWorkAttachment.deleteMany({ where: { work: works } });
  await prisma.espaceWorkVersion.deleteMany({ where: { work: works } });
  await prisma.espaceWork.deleteMany({ where: works });
  await prisma.espaceEnrollment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.espaceGroup.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
  if (previousRoot === undefined) delete process.env.DOCUMENT_STORAGE_ROOT;
  else process.env.DOCUMENT_STORAGE_ROOT = previousRoot;
  await rm(storageRoot, { recursive: true, force: true });
}, 60_000);

// ─── Anonyme ────────────────────────────────────────────────────────────────

describe('anonyme', () => {
  beforeEach(() => as(null));

  it('reçoit 401 sur chaque famille de routes', async () => {
    const some = 'cl-any';
    const responses = await Promise.all([
      openWorkRoute(req('POST', { activitySlug: POO_ACTIVITY_SLUG })),
      getWork(req('GET'), ctx({ id: some })),
      putWork(req('PUT', { baseRevision: 0, patch: {} }), ctx({ id: some })),
      submitRoute(req('POST', { baseRevision: 0 }), ctx({ id: some })),
      reviewRoute(req('POST', { action: 'REOPEN' }), ctx({ id: some })),
      getAnnotations(req('GET'), ctx({ id: some })),
      listVersions(req('GET'), ctx({ id: some })),
      listAttachmentsRoute(req('GET'), ctx({ id: some })),
      getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'subject' })),
      overviewRoute(req('GET', undefined, {}, `/api/espace/teacher/overview?activity=${POO_ACTIVITY_SLUG}`)),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(responses.length).fill(401));
  });
});

// ─── Isolation entre élèves (IDOR) ──────────────────────────────────────────

describe('élève A / élève B', () => {
  let adaWork: { id: string; revision: number };

  beforeAll(async () => {
    adaWork = await open('ada');
    as('ada');
    const r = await putWork(req('PUT', { baseRevision: 0, patch: { stepId: step0.id, step: fullStep() } }), ctx({ id: adaWork.id }));
    expect(r.status).toBe(200);
  });

  it('A lit son propre travail : 200', async () => {
    as('ada');
    const res = await getWork(req('GET'), ctx({ id: adaWork.id }));
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.mode).toBe('student');
    expect(body.work.content.steps[step0.id].code).toContain('# api');
  });

  it('B lit le travail de A en changeant l’identifiant : 404 identique à un identifiant inexistant', async () => {
    as('bob');
    const stolen = await getWork(req('GET'), ctx({ id: adaWork.id }));
    const missing = await getWork(req('GET'), ctx({ id: 'cl-inexistant' }));
    expect(stolen.status).toBe(404);
    expect(await jsonOf(stolen)).toEqual(await jsonOf(missing));
  });

  it('B ne peut ni écrire, ni remettre, ni lister fichiers, ni lire annotations de A', async () => {
    as('bob');
    expect((await putWork(req('PUT', { baseRevision: 1, patch: { stepId: step0.id, step: { code: 'pwned' } } }), ctx({ id: adaWork.id }))).status).toBe(404);
    expect((await submitRoute(req('POST', { baseRevision: 1 }), ctx({ id: adaWork.id }))).status).toBe(404);
    expect((await listAttachmentsRoute(req('GET'), ctx({ id: adaWork.id }))).status).toBe(404);
    expect((await getAnnotations(req('GET'), ctx({ id: adaWork.id }))).status).toBe(404);
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: adaWork.id } });
    expect(JSON.stringify(row.content)).not.toContain('pwned');
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('la réponse ne contient aucun secret ni donnée d’un autre compte', async () => {
    as('ada');
    const text = JSON.stringify(await jsonOf(await getWork(req('GET'), ctx({ id: adaWork.id }))));
    for (const forbidden of ['pinHash', 'password', 'sessionVersion', 'username', ids.bob]) expect(text).not.toContain(forbidden);
  });
});

// ─── Élève sur les routes enseignant ────────────────────────────────────────

describe('élève sur les routes enseignant', () => {
  it('reçoit 403 partout', async () => {
    const w = await open('ada');
    as('ada');
    const responses = await Promise.all([
      reviewRoute(req('POST', { action: 'MARK_CORRECTED' }), ctx({ id: w.id })),
      postAnnotation(req('POST', { kind: 'GENERAL', body: 'x' }), ctx({ id: w.id })),
      listVersions(req('GET'), ctx({ id: w.id })),
      overviewRoute(req('GET', undefined, {}, `/api/espace/teacher/overview?activity=${POO_ACTIVITY_SLUG}`)),
    ]);
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403]);
  });
});

// ─── Enseignant ─────────────────────────────────────────────────────────────

describe('enseignant', () => {
  it('affecté : accède au travail, voit le suivi de ses élèves seulement', async () => {
    const w = await open('nsi');
    as('prof');
    expect((await getWork(req('GET'), ctx({ id: w.id }))).status).toBe(200);
    const overview = await jsonOf(await overviewRoute(req('GET', undefined, {}, `/api/espace/teacher/overview?activity=${POO_ACTIVITY_SLUG}`)));
    expect(overview.rows.map((r: { name: string }) => r.name)).toEqual(expect.arrayContaining([`Ada A${run}`, `Bob B${run}`, `Nsi Seul${run}`]));
    expect(overview.counts.students).toBe(3);
  });

  it('non affecté à ce groupe : 404 sur le travail, et suivi vide', async () => {
    const w = await open('bob');
    as('hors');
    expect((await getWork(req('GET'), ctx({ id: w.id }))).status).toBe(404);
    expect((await reviewRoute(req('POST', { action: 'REOPEN' }), ctx({ id: w.id }))).status).toBe(404);
    const overview = await jsonOf(await overviewRoute(req('GET', undefined, {}, `/api/espace/teacher/overview?activity=${POO_ACTIVITY_SLUG}`)));
    expect(overview.counts.students).toBe(0); // « hors » n'enseigne pas le NSI, ni à ce groupe
  });

  it('corrige via l’API ; l’élève voit alors le retour, jamais avant', async () => {
    const w = await open('ada');
    as('ada');
    let work = (await jsonOf(await getWork(req('GET'), ctx({ id: w.id })))).work;
    const sub = await submitRoute(req('POST', { baseRevision: work.revision }), ctx({ id: w.id }));
    expect(sub.status).toBe(200);

    as('prof');
    const ann = await postAnnotation(req('POST', { kind: 'GENERAL', body: 'Très bien <b>géré</b>.' }), ctx({ id: w.id }));
    expect(ann.status).toBe(201);

    as('ada');
    expect((await jsonOf(await getAnnotations(req('GET'), ctx({ id: w.id })))).annotations).toHaveLength(0); // pas encore rendu

    as('prof');
    expect((await reviewRoute(req('POST', { action: 'MARK_CORRECTED' }), ctx({ id: w.id }))).status).toBe(200);

    as('ada');
    const seen = (await jsonOf(await getAnnotations(req('GET'), ctx({ id: w.id })))).annotations;
    expect(seen).toHaveLength(1);
    expect(seen[0].body).toBe('Très bien <b>géré</b>.'); // texte brut : l'échappement se fait à l'affichage
    work = (await jsonOf(await getWork(req('GET'), ctx({ id: w.id })))).work;
    expect(work.status).toBe('CORRECTED');
    expect(work.editable).toBe(false);
  });
});

// ─── Conflits via HTTP ──────────────────────────────────────────────────────

describe('autosave via HTTP', () => {
  it('409 avec la version courante sur écriture obsolète, 423 une fois remis', async () => {
    const w = await open('nsi');
    as('nsi');
    const first = await putWork(req('PUT', { baseRevision: 0, patch: { stepId: step0.id, step: fullStep() } }), ctx({ id: w.id }));
    expect(first.status).toBe(200);
    const stale = await putWork(req('PUT', { baseRevision: 0, patch: { stepId: poo.steps[1].id, step: { code: 'autre' } } }), ctx({ id: w.id }));
    expect(stale.status).toBe(409);
    const body = await jsonOf(stale);
    expect(body.error).toBe('REVISION_CONFLICT');
    expect(body.details.current.revision).toBe(1);
    expect(body.details.current.content.steps[step0.id]).toBeDefined();

    expect((await submitRoute(req('POST', { baseRevision: 1 }), ctx({ id: w.id }))).status).toBe(200);
    const locked = await putWork(req('PUT', { baseRevision: 2, patch: { stepId: step0.id, step: { code: 'tard' } } }), ctx({ id: w.id }));
    expect(locked.status).toBe(423);
  });

  it('refuse les corps hors schéma sans rien écrire', async () => {
    const w = await open('bob');
    as('bob');
    expect((await putWork(req('PUT', { baseRevision: 0, patch: { stepId: step0.id, step: { evil: 1 } }, extra: true }), ctx({ id: w.id }))).status).toBe(400);
    expect((await putWork(req('PUT', 'pas du json' as unknown as object), ctx({ id: w.id }))).status).toBe(400);
  });
});

// ─── CSRF ───────────────────────────────────────────────────────────────────

describe('contrôles de requête', () => {
  it('refuse une écriture dont l’Origin n’est pas l’hôte', async () => {
    as('ada');
    const res = await openWorkRoute(req('POST', { activitySlug: POO_ACTIVITY_SLUG }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('accepte l’Origin identique à l’hôte (derrière un proxy : x-forwarded-host)', async () => {
    as('ada');
    const res = await openWorkRoute(req('POST', { activitySlug: POO_ACTIVITY_SLUG }, { origin: 'https://nexusreussite.academy', 'x-forwarded-host': 'nexusreussite.academy' }));
    expect(res.status).toBe(200);
  });

  it('refuse une écriture qui n’est pas du JSON (requête « simple » inter-sites)', async () => {
    as('ada');
    const res = await openWorkRoute(new Request('http://localhost/api/espace/works', { method: 'POST', headers: { 'content-type': 'text/plain', host: 'localhost' }, body: JSON.stringify({ activitySlug: POO_ACTIVITY_SLUG }) }));
    expect(res.status).toBe(400);
  });
});

// ─── Compte désactivé ───────────────────────────────────────────────────────

describe('compte désactivé', () => {
  it('perd l’accès immédiatement même avec une session encore valide', async () => {
    const w = await open('nsi');
    await prisma.user.update({ where: { id: ids.nsi }, data: { disabledAt: new Date() } });
    try {
      as('nsi');
      expect((await getWork(req('GET'), ctx({ id: w.id }))).status).toBe(401);
    } finally {
      await prisma.user.update({ where: { id: ids.nsi }, data: { disabledAt: null } });
    }
  });
});

// ─── Ressources de maths : le corrigé reste privé ───────────────────────────

describe('ressources du module Suites', () => {
  it('l’élève inscrit lit le sujet', async () => {
    as('ada');
    const res = await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'subject' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('l’élève n’obtient JAMAIS le corrigé ni le guide, 404 identique à une clé inconnue', async () => {
    as('ada');
    const correction = await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'correction' }));
    const guide = await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'teacher-guide' }));
    const unknown = await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'nimporte' }));
    expect([correction.status, guide.status, unknown.status]).toEqual([404, 404, 404]);
    expect(await jsonOf(correction)).toEqual(await jsonOf(unknown));
  });

  it('l’enseignant de la matière lit le corrigé ; un élève non inscrit à la matière ne lit rien', async () => {
    as('prof');
    expect((await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'correction' }))).status).toBe(200);
    as('nsi'); // NSI seulement : pas inscrit en Maths
    expect((await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key: 'subject' }))).status).toBe(404);
  });

  it('un clé de traversée de chemin n’atteint aucun fichier', async () => {
    as('prof');
    for (const key of ['../../etc/passwd', '..%2F..%2Fetc%2Fpasswd', 'subject.pdf', '/etc/passwd']) {
      expect((await getResource(req('GET'), ctx({ activity: MATHS_SUITES_ACTIVITY_SLUG, key }))).status).toBe(404);
    }
  });
});

// ─── Dépôts de fichiers ─────────────────────────────────────────────────────

describe('dépôt de copies', () => {
  function multipart(name: string, bytes: Buffer, type = 'application/pdf') {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(bytes)], name, { type }));
    return new Request('http://localhost/api/espace/works/x/attachments', { method: 'POST', body: form, headers: { host: 'localhost' } });
  }

  let work: { id: string };

  beforeAll(async () => {
    work = await open('ada', MATHS_SUITES_ACTIVITY_SLUG);
  });

  it('accepte un PDF, le range sous un nom serveur aléatoire, et le travail est commencé', async () => {
    as('ada');
    const res = await uploadRoute(multipart('../../copie évil.pdf', PDF), ctx({ id: work.id }));
    expect(res.status).toBe(201);
    const { attachment } = await jsonOf(res);
    expect(attachment.originalName).not.toContain('/');
    const row = await prisma.espaceWorkAttachment.findFirstOrThrow({ where: { id: attachment.id } });
    expect(row.storagePath).toMatch(/^espace\/uploads\/[^/]+\/[0-9a-f-]{36}\.pdf$/);
    expect(row.storagePath).not.toContain('copie');
    expect((await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } })).status).toBe('IN_PROGRESS');
    const onDisk = await readdir(path.join(storageRoot, 'espace', 'uploads', work.id));
    expect(onDisk).toHaveLength(1);
  });

  it('refuse du HTML déguisé en PDF (le type se lit dans les octets, pas dans l’en-tête)', async () => {
    as('ada');
    const res = await uploadRoute(multipart('x.pdf', Buffer.from('<html><script>alert(1)</script></html>'), 'application/pdf'), ctx({ id: work.id }));
    expect(res.status).toBe(400);
  });

  it('refuse un fichier vide, un exécutable et un fichier trop gros', async () => {
    as('ada');
    expect((await uploadRoute(multipart('v.pdf', Buffer.alloc(0)), ctx({ id: work.id }))).status).toBe(400);
    expect((await uploadRoute(multipart('x.png', Buffer.from('MZ\u0090\u0000\u0003'), 'image/png'), ctx({ id: work.id }))).status).toBe(400);
    const big = Buffer.concat([PDF, Buffer.alloc(8 * 1024 * 1024)]);
    expect((await uploadRoute(multipart('gros.pdf', big), ctx({ id: work.id }))).status).toBe(400);
  });

  it('l’élève propriétaire et l’enseignant téléchargent ; un autre élève non', async () => {
    const attachment = await prisma.espaceWorkAttachment.findFirstOrThrow({ where: { workId: work.id } });
    const c = ctx({ id: work.id, attachmentId: attachment.id });
    as('ada');
    expect((await downloadAttachment(req('GET'), c)).status).toBe(200);
    as('prof');
    expect((await downloadAttachment(req('GET'), c)).status).toBe(200);
    as('bob');
    expect((await downloadAttachment(req('GET'), c)).status).toBe(404);
    as('hors');
    expect((await downloadAttachment(req('GET'), c)).status).toBe(404);
  });

  it('plus aucun dépôt une fois le travail remis', async () => {
    as('ada');
    const row = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
    expect((await submitRoute(req('POST', { baseRevision: row.revision }), ctx({ id: work.id }))).status).toBe(200);
    expect((await uploadRoute(multipart('encore.pdf', PDF), ctx({ id: work.id }))).status).toBe(423);
  });

  it('on ne remet pas un exercice sans fichier', async () => {
    const empty = await open('bob', MATHS_SUITES_ACTIVITY_SLUG);
    await prisma.espaceWork.update({ where: { id: empty.id }, data: { status: 'IN_PROGRESS' } });
    as('bob');
    const res = await submitRoute(req('POST', { baseRevision: 0 }), ctx({ id: empty.id }));
    expect(res.status).toBe(409);
    expect((await jsonOf(res)).error).toBe('WORK_EMPTY');
  });
});
