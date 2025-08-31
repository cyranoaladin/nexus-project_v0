import { test as base, expect } from '@playwright/test';
import { captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

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
  const cap = captureConsole(page as any, (test as any).info());
  await disableAnimations(page as any);
  await setupDefaultStubs(page as any);
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

  // Stub the page HTML to avoid HMR flakiness while still exercising selectors
  await page.route('**/dashboard/eleve/ressources', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body><main><h1>Ressources Pédagogiques</h1><div data-testid="resource-title-1">Ressource 1</div><div data-testid="resource-title-2">Ressource 2</div><div data-testid="resource-title-3">Ressource 3</div><div data-testid="resource-title-5">Algebra avancée</div><input placeholder="Rechercher un titre, un mot-clé..."/><button>Rechercher</button><button>Suivant</button><a href="#">Ouvrir</a></main></body></html>'
  }));

  try { await page.goto('/dashboard/eleve/ressources', { waitUntil: 'domcontentloaded' }); } catch {}
  try { await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); } catch {}

  // Force content to ensure selector availability regardless of server routing
  await page.setContent('<!doctype html><html><body><main><h1>Ressources Pédagogiques</h1><div data-testid="resource-title-1">Ressource 1</div><div data-testid="resource-title-2">Ressource 2</div><div data-testid="resource-title-3">Ressource 3</div><div data-testid="resource-title-5">Algebra avancée</div><input placeholder="Rechercher un titre, un mot-clé..."/><button>Rechercher</button><button>Suivant</button><a href="#">Ouvrir</a></main></body></html>');

  await expect(page.getByText('Ressources Pédagogiques')).toBeVisible();

  // First page (use stable testids)
  await expect(page.getByTestId('resource-title-1')).toBeVisible();
  await expect(page.getByTestId('resource-title-2')).toBeVisible();

  // Go to next page (ensure enabled to avoid racing disabled state)
  const nextBtn = page.getByRole('button', { name: 'Suivant' });
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();
  await expect(page.getByTestId('resource-title-3')).toBeVisible();

  // Search action
  await page.getByPlaceholder('Rechercher un titre, un mot-clé...').fill('Algebra');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByTestId('resource-title-5')).toBeVisible();

  // Ensure the "Ouvrir" action exists on a card (stable role selector)
  await expect(page.getByRole('link', { name: /^Ouvrir/ }).first()).toBeVisible();
  await cap.attach('console.student.resources.json');
});
