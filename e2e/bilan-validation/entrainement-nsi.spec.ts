/**
 * Module « Préparation de l'évaluation » (NSI — TAD, POO, récursivité) :
 * l'élève inscrit en NSI voit l'activité, télécharge les cinq documents
 * (sujets, corrigés en auto-correction, fiche) et peut déposer une copie.
 * Un élève non inscrit en NSI n'y accède pas.
 */
import { randomBytes } from 'node:crypto';
import { test, expect, login, assertLocalHarness, type Account } from './fixtures';
import { prisma } from '../../lib/prisma';
import { applyProvisioning, parseRoster, syncActivities } from '../../lib/espace/provisioning';
import { NSI_ENTRAINEMENT_ACTIVITY_SLUG, getActivityDef } from '../../lib/espace/catalog';

const PAGE_PATH = '/espace/nsi/entrainement-evaluation';

async function makeNsiCohort(): Promise<{ nsiStudent: Account; mathsStudent: Account }> {
  assertLocalHarness();
  const run = randomBytes(5).toString('hex');
  const nsiGroup = `ent-${run}-nsi`;
  const mathsGroup = `ent-${run}-maths`;
  const username = (k: string) => `ent.${run}.${k}`;
  const roster = parseRoster({
    groups: [
      { slug: nsiGroup, name: `Fictif ${nsiGroup}` },
      { slug: mathsGroup, name: `Fictif ${mathsGroup}` },
    ],
    teachers: [
      { username: username('teacher'), firstName: 'Professeur', lastName: `Fictif${run}`, teaches: [{ group: nsiGroup, subjects: ['NSI'] }] },
    ],
    students: [
      { username: username('nsi'), firstName: 'EleveNsi', lastName: `Fictif${run}`, enrollments: [{ group: nsiGroup, subjects: ['NSI'] }] },
      { username: username('maths'), firstName: 'EleveMaths', lastName: `Fictif${run}`, enrollments: [{ group: mathsGroup, subjects: ['MATHS'] }] },
    ],
  });
  const result = await applyProvisioning(prisma, roster, { adopt: false, temporaryCodes: false });
  await syncActivities(prisma);
  const credentials = new Map(result.credentials.map((c) => [c.username, c.secret]));
  const users = await prisma.user.findMany({ where: { username: { in: [username('nsi'), username('maths')].map((u) => u.toLowerCase()) } } });
  const account = (key: string): Account => {
    const u = users.find((row) => row.username === username(key).toLowerCase())!;
    return { id: u.id, username: u.username!, secret: credentials.get(u.username!)!, firstName: key, lastName: `Fictif${run}` };
  };
  return { nsiStudent: account('nsi'), mathsStudent: account('maths') };
}

test('élève NSI : activité visible, cinq documents téléchargeables, dépôt de copie possible', async ({ page }) => {
  const { nsiStudent } = await makeNsiCohort();
  await login(page, nsiStudent);

  // L'activité apparaît dans « Mes matières » avec un lien vers sa page.
  await page.goto('/espace/eleve/matieres');
  const link = page.locator(`a[href="${PAGE_PATH}"]`).first();
  await expect(link).toBeVisible();

  // La page du module liste exactement les cinq documents, corrigés compris.
  await page.goto(PAGE_PATH);
  const def = getActivityDef(NSI_ENTRAINEMENT_ACTIVITY_SLUG)!;
  expect(def.resources).toHaveLength(5);
  for (const resource of def.resources) {
    await expect(page.locator(`a[href="/api/espace/resources/${def.slug}/${resource.key}"]`)).toBeVisible();
  }

  // Chaque document se télécharge en PDF (session de l'élève, pas d'URL secrète).
  for (const resource of def.resources) {
    const response = await page.request.get(`/api/espace/resources/${def.slug}/${resource.key}`);
    expect(response.status(), `ressource ${resource.key}`).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  }

  // Dépôt d'une copie : le fichier apparaît dans la liste des pièces jointes.
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({
    name: 'copie-entrainement.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`),
  });
  await expect(page.locator('a[href*="/attachments/"]').first()).toBeVisible();
});

test('élève non inscrit en NSI : le module est refusé et absent de ses matières', async ({ page }) => {
  const { mathsStudent } = await makeNsiCohort();
  await login(page, mathsStudent);

  await page.goto('/espace/eleve/matieres');
  await expect(page.locator(`a[href="${PAGE_PATH}"]`)).toHaveCount(0);

  await page.goto(PAGE_PATH);
  await expect(page.getByRole('heading', { name: 'Ce module n’est pas dans tes matières' })).toBeVisible();

  // L'API refuse aussi la ressource directement (pas seulement la page).
  const response = await page.request.get(`/api/espace/resources/${NSI_ENTRAINEMENT_ACTIVITY_SLUG}/sujet-1`);
  expect(response.status()).not.toBe(200);
});
