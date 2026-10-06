/**
 * Garde catalogue (code) ↔ miroir en base, et réactivation des comptes techniques de validation — vraie base jetable.
 */

jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { ACTIVITIES, RECURSIVITE_ACTIVITY_SLUG } from '@/lib/espace/catalog';
import { verifyPin } from '@/lib/espace/pin';
import { auditActivities, disableAccount, enableTechnicalAccount, syncActivities } from '@/lib/espace/provisioning';

const run = randomUUID().slice(0, 6);
const techStudent = `val.t${run}`.slice(0, 32);
const techTeacher = `val.p${run}`.slice(0, 32);
const realStudent = `vrai.${run}`.slice(0, 32);
const created: string[] = [];

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await syncActivities(prisma);
  for (const [username, role] of [[techStudent, 'ELEVE'], [techTeacher, 'COACH'], [realStudent, 'ELEVE']] as const) {
    const u = await prisma.user.create({ data: { role, username, firstName: 'T', lastName: run, activatedAt: new Date(), disabledAt: new Date() } });
    created.push(u.id);
  }
}, 60_000);

afterAll(async () => {
  await syncActivities(prisma);
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
}, 60_000);

describe('auditActivities', () => {
  it('base synchronisée : aucun écart', async () => {
    expect(await auditActivities(prisma)).toEqual({ errors: [], warnings: [] });
  });

  it('activité du code absente de la base : écart bloquant, aucune écriture', async () => {
    await prisma.espaceActivity.delete({ where: { slug: RECURSIVITE_ACTIVITY_SLUG } });
    const audit = await auditActivities(prisma);
    expect(audit.errors).toEqual([expect.stringContaining(`MISSING_IN_DB ${RECURSIVITE_ACTIVITY_SLUG}`)]);
    expect(await prisma.espaceActivity.count({ where: { slug: RECURSIVITE_ACTIVITY_SLUG } })).toBe(0); // l'audit ne répare pas
    await syncActivities(prisma);
    expect((await auditActivities(prisma)).errors).toEqual([]);
  });

  it('matière, type, titre, étapes ou version différents : un écart par champ', async () => {
    await prisma.espaceActivity.update({ where: { slug: RECURSIVITE_ACTIVITY_SLUG }, data: { subject: 'MATHEMATIQUES', kind: 'RESOURCE_PACK', title: 'Autre', stepsTotal: 3, contentVersion: '0.9' } });
    const audit = await auditActivities(prisma);
    expect(audit.errors.map((e) => e.split(' ')[1])).toEqual(
      expect.arrayContaining([`${RECURSIVITE_ACTIVITY_SLUG}.subject`, `${RECURSIVITE_ACTIVITY_SLUG}.kind`, `${RECURSIVITE_ACTIVITY_SLUG}.title`, `${RECURSIVITE_ACTIVITY_SLUG}.stepsTotal`, `${RECURSIVITE_ACTIVITY_SLUG}.contentVersion`]),
    );
    await syncActivities(prisma);
  });

  it('ligne en base absente du code : simple avertissement', async () => {
    await prisma.espaceActivity.create({ data: { slug: `retire-${run}`, subject: 'NSI', moduleSlug: 'x', title: 'Retiré', kind: 'PYTHON_TP', contentVersion: '1' } });
    const audit = await auditActivities(prisma);
    expect(audit.errors).toEqual([]);
    expect(audit.warnings).toEqual([expect.stringContaining(`EXTRA_IN_DB retire-${run}`)]);
    await prisma.espaceActivity.delete({ where: { slug: `retire-${run}` } });
  });

  it('le catalogue du code n’a aucun slug dupliqué', () => {
    const slugs = ACTIVITIES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('syncActivities est idempotent et ne touche à aucun utilisateur', async () => {
    const usersBefore = await prisma.user.count();
    const rowsBefore = await prisma.espaceActivity.count();
    await syncActivities(prisma);
    await syncActivities(prisma);
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.espaceActivity.count()).toBe(rowsBefore);
    expect((await auditActivities(prisma)).errors).toEqual([]);
  });
});

describe('enableTechnicalAccount', () => {
  it('réactive un élève technique avec un nouveau code définitif, puis se referme', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { username: techStudent } });
    expect(before.disabledAt).not.toBeNull();
    const issued = await enableTechnicalAccount(prisma, techStudent);
    const after = await prisma.user.findUniqueOrThrow({ where: { username: techStudent } });
    expect(after.disabledAt).toBeNull();
    expect(after.pinMustChange).toBe(false);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await verifyPin(issued.secret, after.pinHash!)).toBe(true);

    await disableAccount(prisma, techStudent);
    const closed = await prisma.user.findUniqueOrThrow({ where: { username: techStudent } });
    expect(closed.disabledAt).not.toBeNull();
    expect(closed.sessionVersion).toBe(after.sessionVersion + 1);
  });

  it('réactive un enseignant technique avec un mot de passe neuf (jamais en clair en base)', async () => {
    const issued = await enableTechnicalAccount(prisma, techTeacher);
    const row = await prisma.user.findUniqueOrThrow({ where: { username: techTeacher } });
    expect(row.disabledAt).toBeNull();
    expect(row.password).toMatch(/^\$2[aby]\$/);
    expect(row.password).not.toContain(issued.secret);
    await disableAccount(prisma, techTeacher);
  });

  it('refuse tout compte qui n’est pas val.* : un vrai compte reste désactivé et intact', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { username: realStudent } });
    await expect(enableTechnicalAccount(prisma, realStudent)).rejects.toThrow(/comptes techniques/);
    await expect(enableTechnicalAccount(prisma, 'alaeddine')).rejects.toThrow(/comptes techniques/);
    expect(await prisma.user.findUniqueOrThrow({ where: { username: realStudent } })).toEqual(before);
  });
});
