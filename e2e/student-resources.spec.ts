import { test as base, expect } from '@playwright/test';

const run = !!process.env.E2E_RUN;
const test = run ? base : base.skip;

const dataset = [
  { id: '1', title: 'Ressource 1', subject: 'MATHEMATIQUES', tags: '["fiche"]', updatedAt: '2024-01-01T00:00:00.000Z' },
  { id: '2', title: 'Ressource 2', subject: 'NSI', tags: '["exercice"]', updatedAt: '2024-01-02T00:00:00.000Z' },
  { id: '3', title: 'Ressource 3', subject: 'MATHEMATIQUES', tags: '["fiche"]', updatedAt: '2024-01-03T00:00:00.000Z' },
  { id: '4', title: 'Ressource 4', subject: 'NSI', tags: '["quiz"]', updatedAt: '2024-01-04T00:00:00.000Z' },
  { id: '5', title: 'Algebra avancée', subject: 'MATHEMATIQUES', tags: '["fiche"]', updatedAt: '2024-01-05T00:00:00.000Z' },
];

test('Student resources: search and pagination', async ({ page }) => {
  await page.route('**/api/student/resources**', async (route) => {
    const url = new URL(route.request().url());
    const pageNum = parseInt(url.searchParams.get('page') ?? '1', 10);
    // Force a small page size in E2E to exercise pagination deterministically
    const pageSize = 2;
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const subject = url.searchParams.get('subject') ?? 'all';

    let filtered = dataset.slice();
    if (subject !== 'all') filtered = filtered.filter((d) => d.subject === subject);
    if (q) filtered = filtered.filter((d) => d.title.toLowerCase().includes(q));

    const total = Math.max(filtered.length, 20);
    const start = (pageNum - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize).map((d) => ({
      id: d.id,
      title: d.title,
      subject: d.subject,
      description: 'Lorem ipsum dolor sit amet',
      type: d.tags.includes('fiche') ? 'Fiche' : d.tags.includes('exercice') ? 'Exercices' : 'Document',
      lastUpdated: d.updatedAt,
    }));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: pageItems, total, page: pageNum, pageSize }),
    });
  });

  await page.goto('/dashboard/eleve/ressources');

  await expect(page.getByText('Ressources Pédagogiques')).toBeVisible();

  // First page
  await expect(page.getByRole('link', { name: 'Ressource 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ressource 2' })).toBeVisible();

  // Go to next page
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByRole('link', { name: 'Ressource 3' })).toBeVisible();

  // Search action
  await page.getByPlaceholder('Rechercher un titre, un mot-clé...').fill('Algebra');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByRole('link', { name: 'Algebra avancée' })).toBeVisible();

  // Ensure the "Ouvrir" action exists on a card
  await expect(page.getByRole('link', { name: /Ouvrir/i }).first()).toBeVisible();
});

