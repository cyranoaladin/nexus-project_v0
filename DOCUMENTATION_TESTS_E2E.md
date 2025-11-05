## Scénario Playwright — Dashboard élève (flux RAG)

Ce scénario vise à couvrir le parcours « l’élève consulte le dashboard, lance une recherche RAG, puis ouvre une ressource ». Il s’exécute via Playwright (`npm run test:e2e`).

### Pré requis

- Application Next.js accessible sur `http://localhost:3000` (variable `PLAYWRIGHT_BASE_URL` sinon).
- API FastAPI disponible sur `http://localhost:8000` (proxy `/pyapi`).
- Schéma base de données à jour (`alembic -c apps/api/db/alembic.ini upgrade head` avec `DATABASE_URL` pointant vers votre instance Postgres).
- Base de données peuplée avec au moins un élève (`student@test.local` / `password`) et des documents RAG indexés.
- Lancement recommandé : `npm run dev:all` (front + API) dans un terminal, puis tests Playwright dans un autre.

### Fichier de test

`playwright/dashboard-rag.spec.ts`

```ts
import { test, expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

test.describe('Dashboard RAG', () => {
	test('élève recherche et ouvre une ressource', async ({ page }) => {
		await page.goto(`${baseURL}/auth/signin`);
		await page.getByLabel('Email').fill('student@test.local');
		await page.getByLabel('Mot de passe').fill('password');
		await page.getByRole('button', { name: /se connecter/i }).click();

		await page.waitForURL(`${baseURL}/dashboard`);
		await page.getByRole('link', { name: /cours et syllabus/i }).click();

		const searchBox = page.getByPlaceholder('Rechercher une notion, un chapitre…');
		await searchBox.fill('dérivées');
		await searchBox.press('Enter');

		const firstCard = page.getByRole('article').first();
		await expect(firstCard).toContainText('dérivées');
		await firstCard.click();

		await expect(page).toHaveURL(/rag\/doc/);
		await expect(page.getByRole('heading')).toContainText(/dérivées/i);
	});
});
```

> ℹ️ Le test suppose qu’un clic sur une carte ouvre la page `/rag/doc/{id}`. Adaptez la sélection (role/texte) selon l’implémentation finale du front.

### Lancer les tests

```bash
npm install
npx playwright install  # Chrome + Firefox par défaut
# WebKit nécessite les paquets système : `npx playwright install --with-deps webkit` (sudo requis)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e -- --grep "Dashboard RAG"
```

> ℹ️ WebKit est désactivé par défaut dans `playwright.config.ts`. Définissez `PLAYWRIGHT_INCLUDE_WEBKIT=1` pour réactiver le projet une fois les dépendances système installées.

### Debug

- `npm run test:e2e:ui` pour rejouer avec l’UI Playwright.
- `DEBUG=pw:api` pour tracer les requêtes.
- Variable `E2E_STUDENT_EMAIL`/`E2E_STUDENT_PASSWORD` (à ajouter dans `playwright.config.ts`) si les identifiants changent.
