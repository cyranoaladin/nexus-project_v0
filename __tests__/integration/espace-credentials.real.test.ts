/**
 * @jest-environment node
 *
 * Changement autonome du code/mot de passe et réinitialisation par l'enseignant : handlers réels, Postgres réel.
 * Prouve : secret actuel exigé, confirmation, force, ancien secret invalide / nouveau valide, impossibilité de
 * viser un autre compte, périmètre enseignant, anonyme refusé, aucun secret dans les journaux ni le journal de sécurité.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/logger', () => {
  const calls: unknown[][] = [];
  const record = (...args: unknown[]) => { calls.push(args); };
  return { logger: { info: record, warn: record, error: record, debug: record, child: () => ({ info: record, warn: record, error: record, debug: record }) }, __calls: calls };
});

import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { auth } from '@/auth';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { authorizeEspaceCredentials } from '@/lib/auth/espace-authorize';
import { applyProvisioning, parseRoster, syncActivities } from '@/lib/espace/provisioning';

import { POST as changeRoute } from '@/app/api/espace/account/credential/route';
import { POST as resetRoute } from '@/app/api/espace/teacher/students/[id]/reset-code/route';

const run = randomUUID().slice(0, 8);
const u = (n: string) => `${n}.${run}`.slice(0, 32);
const g = (n: string) => `${n}-${run}`;

type Who = 'prof' | 'hors' | 'ada' | 'bob' | 'cleo';
const ids = {} as Record<Who, string>;
const secrets: Record<string, string> = {};
const userIds: string[] = [];

const roster = parseRoster({
  groups: [{ slug: g('principal'), name: 'Principal' }, { slug: g('racine'), name: 'Racine' }],
  teachers: [
    { username: u('prof'), firstName: 'Prof', lastName: `Cred${run}`, teaches: [{ group: g('principal'), subjects: ['NSI', 'MATHS'] }] },
    { username: u('hors'), firstName: 'Hors', lastName: `Groupe${run}`, teaches: [{ group: g('racine'), subjects: ['MATHS'] }] },
  ],
  students: [
    { username: u('ada'), firstName: 'Ada', lastName: `Alpha${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] },
    { username: u('bob'), firstName: 'Bob', lastName: `Beta${run}`, enrollments: [{ group: g('principal'), subjects: ['MATHS'] }] },
    { username: u('cleo'), firstName: 'Cleo', lastName: `Gamma${run}`, enrollments: [{ group: g('racine'), subjects: ['MATHS'] }] },
  ],
});

function as(who: Who | null) {
  (auth as jest.Mock).mockResolvedValue(who ? { user: { id: ids[who] } } : null);
}
function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/espace/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON de test
const jsonOf = async (res: Response) => (await res.json()) as Record<string, any>;
const login = (who: Who, secret: string) => authorizeEspaceCredentials({ username: u(who), secret });

const NEW_CODE = 'Lune8Fox';
const NEW_PASSWORD = 'le cheval gris traverse la vallée';

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await syncActivities(prisma);
  const { credentials } = await applyProvisioning(prisma, roster, { adopt: false, temporaryCodes: true });
  for (const c of credentials) secrets[c.username] = c.secret;
  for (const who of ['prof', 'hors', 'ada', 'bob', 'cleo'] as Who[]) {
    const user = await prisma.user.findUniqueOrThrow({ where: { username: u(who) } });
    ids[who] = user.id;
    userIds.push(user.id);
  }
}, 120_000);

afterAll(async () => {
  await prisma.espaceSecurityEvent.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { actorId: { in: userIds } }] } });
  await prisma.espaceEnrollment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.espaceTeacherAssignment.deleteMany({ where: { teacherId: { in: userIds } } });
  await prisma.espaceGroup.deleteMany({ where: { slug: { in: [g('principal'), g('racine')] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}, 60_000);

describe('élève : changement autonome du code personnel', () => {
  it('les comptes émis avec codes temporaires portent le drapeau « à changer »', async () => {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: ids.ada }, select: { pinMustChange: true } });
    expect(row.pinMustChange).toBe(true);
  });

  it('refuse un anonyme', async () => {
    as(null);
    const res = await changeRoute(req({ current: 'x', next: NEW_CODE, confirm: NEW_CODE }));
    expect(res.status).toBe(401);
  });

  it('refuse un mauvais code actuel (400, champ « current ») sans rien modifier', async () => {
    as('ada');
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.ada }, select: { pinHash: true, sessionVersion: true } });
    const res = await changeRoute(req({ current: 'ZZZZZZZZ', next: NEW_CODE, confirm: NEW_CODE }));
    expect(res.status).toBe(400);
    const body = await jsonOf(res);
    expect(body.message).toBe('Le code personnel actuel est incorrect.');
    expect(body.details).toMatchObject({ field: 'current' });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.ada }, select: { pinHash: true, sessionVersion: true } });
    expect(after).toEqual(before);
  });

  it('refuse une confirmation différente', async () => {
    as('ada');
    const res = await changeRoute(req({ current: secrets[u('ada')], next: NEW_CODE, confirm: 'Autre8Fox' }));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).message).toBe('Les deux nouveaux codes ne correspondent pas.');
  });

  it.each(['123456', 'password', 'ab12', 'ada', '   '])('refuse le code faible « %s »', async (weak) => {
    as('ada');
    const res = await changeRoute(req({ current: secrets[u('ada')], next: weak, confirm: weak }));
    expect(res.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.ada }, select: { pinMustChange: true } })).pinMustChange).toBe(true);
  });

  it('refuse un nouveau code identique à l’actuel', async () => {
    as('ada');
    const res = await changeRoute(req({ current: secrets[u('ada')], next: secrets[u('ada')], confirm: secrets[u('ada')] }));
    expect(res.status).toBe(400);
  });

  it('ne permet jamais de viser un autre compte : un userId dans le corps est rejeté', async () => {
    as('ada');
    const res = await changeRoute(req({ userId: ids.bob, current: secrets[u('ada')], next: NEW_CODE, confirm: NEW_CODE }));
    expect(res.status).toBe(400);
    expect((await login('bob', secrets[u('bob')]))).not.toBeNull(); // le code de Bob est intact
  });

  it('accepte le bon code actuel + un nouveau code valide : ancien invalide, nouveau valide, sessions révoquées, drapeau levé', async () => {
    as('ada');
    const bobBefore = await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinHash: true, sessionVersion: true } });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.ada }, select: { sessionVersion: true } });
    const res = await changeRoute(req({ current: secrets[u('ada')], next: NEW_CODE, confirm: NEW_CODE }));
    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({ ok: true, signedOut: true });
    expect(res.headers.get('cache-control')).toBe('no-store');

    expect(await login('ada', secrets[u('ada')])).toBeNull(); // ancien code refusé
    expect(await login('ada', NEW_CODE)).toMatchObject({ id: ids.ada }); // nouveau code accepté
    expect(await login('ada', 'lune8-fox')).toMatchObject({ id: ids.ada }); // casse et tirets sans effet, comme à la connexion

    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.ada }, select: { sessionVersion: true, pinMustChange: true, pinHash: true } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(after.pinMustChange).toBe(false);
    expect(after.pinHash).not.toContain(NEW_CODE); // jamais en clair
    expect(after.pinHash).toMatch(/^\$2[aby]\$/);
    // Un autre élève n'a pas été touché.
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinHash: true, sessionVersion: true } })).toEqual(bobBefore);
  });
});

describe('enseignant : changement autonome du mot de passe', () => {
  it('refuse un mauvais mot de passe actuel', async () => {
    as('prof');
    const res = await changeRoute(req({ current: 'pas-le-bon-mot-de-passe', next: NEW_PASSWORD, confirm: NEW_PASSWORD }));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).message).toBe('Le mot de passe actuel est incorrect.');
  });

  it('refuse un mot de passe faible (moins de 12 caractères, trivial)', async () => {
    as('prof');
    for (const weak of ['court1234', 'password', 'aaaaaaaaaaaaaa']) {
      const res = await changeRoute(req({ current: secrets[u('prof')], next: weak, confirm: weak }));
      expect(res.status).toBe(400);
    }
    expect(await login('prof', secrets[u('prof')])).not.toBeNull();
  });

  it('accepte une phrase de passe : ancien refusé, nouveau accepté, hash bcrypt, sessions révoquées', async () => {
    as('prof');
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.prof }, select: { sessionVersion: true } });
    const res = await changeRoute(req({ current: secrets[u('prof')], next: NEW_PASSWORD, confirm: NEW_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await login('prof', secrets[u('prof')])).toBeNull();
    expect(await login('prof', NEW_PASSWORD)).toMatchObject({ id: ids.prof });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.prof }, select: { sessionVersion: true, password: true } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(after.password).not.toContain('cheval');
    expect(await bcrypt.compare(NEW_PASSWORD, after.password!)).toBe(true);
  });
});

describe('réinitialisation d’un élève par son enseignant', () => {
  it('refuse un anonyme et un élève', async () => {
    as(null);
    expect((await resetRoute(req({}), ctx(ids.bob))).status).toBe(401);
    as('ada');
    expect((await resetRoute(req({}), ctx(ids.bob))).status).toBe(403);
  });

  it('refuse (404 indiscernable) un enseignant qui n’enseigne pas à cet élève', async () => {
    as('hors');
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinHash: true } });
    expect((await resetRoute(req({}), ctx(ids.bob))).status).toBe(404);
    expect((await resetRoute(req({}), ctx('inconnu-id'))).status).toBe(404);
    expect((await resetRoute(req({}), ctx(ids.prof))).status).toBe(404); // un enseignant n'est pas un élève
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinHash: true } })).pinHash).toBe(before.pinHash);
  });

  it('réinitialise pour l’enseignant affecté : code temporaire une fois, hash seul stocké, changement obligatoire, audit', async () => {
    as('prof');
    const res = await resetRoute(req({}), ctx(ids.bob));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { temporaryCode } = await jsonOf(res);
    expect(temporaryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    expect(await login('bob', secrets[u('bob')])).toBeNull(); // l'ancien code ne fonctionne plus
    expect(await login('bob', temporaryCode)).toMatchObject({ id: ids.bob });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinMustChange: true, pinHash: true } });
    expect(row.pinMustChange).toBe(true);
    expect(row.pinHash).not.toContain(temporaryCode.replace('-', ''));

    // L'élève choisit alors son propre code : le code temporaire devient inutilisable.
    as('bob');
    const change = await changeRoute(req({ current: temporaryCode, next: 'Pomme42Kiwi', confirm: 'Pomme42Kiwi' }));
    expect(change.status).toBe(200);
    expect(await login('bob', temporaryCode)).toBeNull();
    expect(await login('bob', 'Pomme42Kiwi')).toMatchObject({ id: ids.bob });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.bob }, select: { pinMustChange: true } })).pinMustChange).toBe(false);
  });

  it('l’enseignant n’a aucune route pour LIRE un code : seule la réinitialisation existe', async () => {
    as('prof');
    const res = await resetRoute(req({}), ctx(ids.ada));
    const body = JSON.stringify(await jsonOf(res));
    expect(body).not.toContain(NEW_CODE); // le nouveau code choisi par Ada n'est jamais renvoyé
    expect(body).not.toMatch(/\$2[aby]\$/); // ni aucun hash
  });
});

describe('journal de sécurité et journaux applicatifs', () => {
  it('enregistre les événements sans aucun secret ni hash', async () => {
    const events = await prisma.espaceSecurityEvent.findMany({ where: { userId: { in: userIds } }, orderBy: { createdAt: 'asc' } });
    const types = events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['PASSWORD_CHANGED', 'PASSWORD_RESET_BY_TEACHER']));
    const reset = events.find((e) => e.type === 'PASSWORD_RESET_BY_TEACHER')!;
    expect(reset).toMatchObject({ userId: ids.bob, actorId: ids.prof });
    const dump = JSON.stringify(events);
    for (const secret of [NEW_CODE, NEW_PASSWORD, 'Pomme42Kiwi', ...Object.values(secrets)]) expect(dump).not.toContain(secret);
    expect(dump).not.toMatch(/\$2[aby]\$/);
  });

  it('ne journalise jamais un secret', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- accès au tampon de la doublure du logger
    const calls = (require('@/lib/logger') as { __calls: unknown[][] }).__calls;
    const dump = JSON.stringify(calls);
    expect(calls.length).toBeGreaterThan(0);
    for (const secret of [NEW_CODE, NEW_PASSWORD, 'Pomme42Kiwi', 'lune8-fox', ...Object.values(secrets)]) expect(dump).not.toContain(secret);
    expect(dump).not.toMatch(/\$2[aby]\$/);
  });
});
