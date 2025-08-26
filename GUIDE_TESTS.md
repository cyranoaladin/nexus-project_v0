Tu es un **ingénieur QA senior** chargé d’implémenter une stratégie de tests exhaustive pour ce projet. Tu vas :

- Normaliser et instrumenter le code pour le test (attributs data‑test, seeds, mocks).
- Couvrir **unitaires + intégration + e2e + accessibilité + régression visuelle + perf légère + contrats API**.
- Écrire des **tests qui échouent** si une page est incomplète, si des boutons sont inactifs, si une route est cassée, si les données ne viennent pas de la vraie source prévue, si l’Agenda/ARIA ne sont pas réellement implémentés.
- Produire des **artefacts de preuve** (screenshots, vidéos, traces, rapports de couverture, journaux réseau).
- Mettre tout cela dans le **CI** avec seuils de qualité bloquants.

## 0) Hypothèses techniques (à adapter si le repo diffère)

- Front : React/Next.js (app ou pages), TypeScript, React Query/Axios, Tailwind.
- Tests unitaires/intégration : **Vitest** + **React Testing Library**.
- E2E : **Playwright** (prioritaire) ou Cypress si déjà en place.
- Accessibilité : **axe-core** (jest-axe/axe-playwright).
- Régression visuelle : **Playwright snapshots** (ou Percy si disponible).
- Contrats API : **OpenAPI** si présent, sinon **Pact** côté consumer.
- Données : DB SQL/NoSQL accessible via API ; possibilité d’**environnements éphémères**/base seedée.

> Si l’outillage diffère, détecte et adapte automatiquement avec l’équivalent.

## 1) Préparation & instrumentation

1. Ajoute des **attributs `data-testid`** stables pour : tous les boutons, liens, CTAs, menus, onglets, cartes dashboard, composants Agenda, composants ARIA (y compris **image mascotte**), modales, toasts, formulaires.
2. Ajoute un **mappeur de routes** (`/tests/routes.map.json`) listant toutes les pages attendues + rôle(s) autorisés + sélecteurs clés à vérifier (ex : `h1`, tableau principal, composants critiques) + **indicateurs de “page complétée”** (ex : “pas de placeholder”, présence de données métier).
3. Ajoute une **fabrique de données de test** (fixtures) + **script seed** réexécutable pour e2e : `pnpm seed:test` ou équivalent. Inclure cas “vides”, “1 élément”, “N éléments”, erreurs 4xx/5xx.
4. Activer **feature flags** si utilisés (ARIA avancé, Agenda) et exposer un flag par défaut **ON en e2e** pour valider la fonctionnalité réelle.

## 2) Tests unitaires (Vitest + RTL)

Objectif : logique pure + rendu minimal + états UI critiques.

- **Boutons/CTA** : chaque composant bouton vérifie les props `disabled`, `onClick` appelé, styles d’état, et **rendu accessible** (`role="button"`, `aria-label`).
- **Liens/navigation** : sur composants Link/MenuItem, vérifie la présence d’URL **valide** (non vide, non “#”), option `prefetch` si Next.
- **Sélecteurs de données** : les composants affichant des données ne doivent **jamais** afficher “Lorem ipsum”, “N/A” générique, ou placeholders au‑delà d’un délai simulé ; simule `success/error/loading` via **MSW** en tests d’intégration.
- **Synchronisation DB** (niveau unité/intégration) : pour les hooks data (ex. `useAgenda`, `useDashboardStats`), mocke l’API avec MSW **suivant un schéma** ; assertions sur :
  - mapping champ à champ (ex. `db.event.start` → `UI.startTime`).
  - conversions de types (dates/numériques).
  - invalidation cache après mutation (create/update/delete) → **refetch** attendu.

- **ARIA UI** : composants “ARIA interface” doivent rendre : zone chat, boutons avancés (ex: “Expliquer”, “Générer quiz”), **image mascotte** visible (alt correct), états disabled/enabled selon contexte.

**Couverture minimale (bloquante)** : lignes ≥ 85%, branches ≥ 80% sur `components/`, `hooks/`, `utils/`.

## 3) Tests d’intégration (RTL + MSW)

- **Pages complètes** : pour chaque page critique (listée dans `routes.map.json`), monte la page + MSW avec **réponses seed** et vérifie :
  - Titre/H1 correct, présence des widgets principaux.
  - **Requêtes réseau** effectuées vers les endpoints attendus (via MSW assertions).
  - **Données réelles** injectées (vérifier champs significatifs, pas de placeholders).
  - États edge : vide, pagination, filtres, erreurs (toast/alerte visible et action de retry).

- **Formulaires/mutations** : submit → MSW répond 200 → UI se met à jour **sans refresh** ; répond 4xx/5xx → messages d’erreur accessibles et pas de “success” fantôme.

## 4) E2E (Playwright)

Créer une **matrice** de parcours pour **tous les rôles** (admin, enseignant, élève, parent si existant) :

- **Navigation exhaustive des boutons/liens** : un test “crawler” générique :
  - Sur chaque page du site (partant du dashboard racine par rôle), collecte tous les éléments cliquables (`role=button`, `role=link`, `[data-testid]`, `[href]`) **visibles & activés**.
  - Clique chaque élément **dans un nouveau contexte** (isolation par bouton) ; valide :
    - La navigation n’ouvre **pas** de page 404/500.
    - Le statut HTTP final est 200/OK.
    - La route fait partie de `routes.map.json`.
    - Les **sélecteurs clés** de la page cible sont présents.
    - **Aucune donnée placeholder** (cf. regex interdits : `Lorem`, `TODO`, `Coming soon`, `—`).
    - Présence de **données seed** attendues (ex : nom d’élève, cours, stats).

  - S’il y a `target=_blank`, intercepte la nouvelle page et applique les mêmes checks.

- **Détection de boutons inactifs** : échoue si un bouton attendu (dans `routes.map.json`) est `disabled` ou non interactif quand le flag/permission le requiert.
- **Agenda (fonctionnalité déclarée non implémentée)** :
  - Test e2e **rouge par défaut** : création d’événement, affichage dans la grille, édition, suppression, persistance après reload → **doit réussir**. Tant que ce n’est pas livré, ces tests échouent pour éviter les faux “green”.

- **Interface ARIA avancée** :
  - Vérifie présence de l’**image mascotte** (src non vide, `alt="ARIA mascotte"`), boutons avancés (“Expliquer”, “Générer quiz”, “Suggérer planning”, etc.), envoi/réception message mock (via MSW proxy ou stub backend), états “thinking/streaming”.

- **Dashboards** :
  - Cartes KPI : valeurs non nulles, formats corrects, tooltips visibles.
  - Filtres/exports : changent réellement les résultats ; export télécharge un fichier non vide (mime/type).

- **Erreurs de route/ressource** :
  - Intercepte 401/403/404/500 simulés → UI montre des vues d’erreur **designées** (pas écran blanc) + bouton “Réessayer” fonctionnel.

### E2E – Accessibilité, visuel, perf légère

- **A11y** : `@axe-core/playwright` sur chaque page → aucune violation “serious/critical”. Vérifie focus trap dans modales, ordre de tabulation, labels.
- **Visuel** : snapshot par page et composants clés (mascotte ARIA incluse). Ajoute **seuil** de diff ≤ 0.1%.
- **Perf légère** : collecte **Web Vitals** via Playwright traces ou Lighthouse CI (si dispo) → LCP < 2.5s sur pages clés (en CI “mobile slow 4G” profil).

## 5) Synchronisation avec la base de données (vérif “vraies données”)

- En **e2e** sur env de préprod/preview avec **DB seedée** :
  - Après action UI (création/édition/suppression), appelle un **endpoint d’inspection** (ou script DB) pour **vérifier l’état réel** du record (ex : via API admin/health/inspect).
  - Compare l’ID et le contenu retournés par l’API/DB avec ce que l’UI affiche.
  - **Interdire tout mock** sur ces tests CRUD critiques (marqueur `@live`).

- Ajoute un **test de cohérence** : pour N éléments listés en UI, l’API renvoie N éléments avec les mêmes IDs triés (ou un mapping documenté). Échoue si divergence.

## 6) Contrats API

- Si OpenAPI présent : valider chaque réponse avec le **schéma** (zod/openapi-validator). Échec si champ manquant/renommé.
- Sinon, introduire **Pact** : contrats côté front pour endpoints utilisés par UI critique (Agenda, ARIA, Dashboards).

## 7) CI/CD & Qualité bloquante

- **Workflows** :
  - `test:unit` → rapport couverture (lcov), seuils bloquants (85/80).
  - `test:integration` (MSW).
  - `test:e2e` (Playwright) sur **preview avec seed**.
  - `test:accessibility`, `test:visual`.

- **Artefacts à uploader** :
  - Screenshots, vidéos, **traces Playwright**, rapports axe, diff visuels, coverage HTML, **journal des liens parcourus** (CSV : `sourcePage, elementText, targetUrl, status, checks`).

- **Stratégie flakiness** :
  - Retries limités (2), `test.slow()` balisé, **quarantine** auto des tests instables + rapport.

- **Gating** :
  - Échec du pipeline si : violation a11y serious/critical, diff visuel > seuil, page sans données réelles, bouton inactif attendu actif, route non documentée, Agenda/ARIA non conformes.

## 8) Définitions de “page complétée”

Une page est **complétée** si et seulement si :

- Titres/headers présents, pas de placeholders/interdites (`Lorem`, `TODO`, `TBD`, `N/A`).
- **Données métier réelles** affichées (issus de l’API/DB seed), au moins 3 champs clés validés.
- Actions principales actives (boutons non `disabled`) et aboutissent à des effets visibles/DB.
- Aucune erreur console (JS) en e2e.
- Zéro violation a11y serious/critical.

## 9) Dossier & scripts (exemple)

```
/tests
  /unit
  /integration
  /e2e
    /routes.map.json
    /snapshots
  /fixtures
  /reports
/playwright.config.ts
/vitest.config.ts
/msw/handlers.ts
/scripts/seed-test.ts
```

Scripts `package.json` :

```
"test": "vitest run",
"test:unit": "vitest run --coverage",
"test:integration": "vitest run -t integration",
"test:e2e": "playwright test",
"test:accessibility": "playwright test --grep @a11y",
"test:visual": "playwright test --grep @visual",
"seed:test": "ts-node scripts/seed-test.ts"
```

## 10) Exemples de tests (concis)

### Playwright – Crawl des boutons/liens

```ts
test('crawl buttons & links on all pages', async ({ page, context }) => {
  const routes = JSON.parse(await fs.readFile('tests/e2e/routes.map.json', 'utf-8'));
  for (const route of routes) {
    const p = await context.newPage();
    await p.goto(route.path);
    const clickables = p.locator(
      'a:visible, button:visible, [role="button"]:visible, [data-testid]:visible'
    );
    const count = await clickables.count();
    for (let i = 0; i < count; i++) {
      const el = clickables.nth(i);
      const text = (await el.textContent())?.trim() || (await el.getAttribute('aria-label')) || '';
      const [newPage] = await Promise.all([
        context.waitForEvent('page').catch(() => null),
        el.click({ trial: false }),
      ]);
      const target = newPage ?? p;
      await target.waitForLoadState('networkidle');
      const status = await target.evaluate(() =>
        performance.getEntriesByType('resource').length ? 200 : 200
      );
      expect(status, `HTTP status not OK for ${route.path} -> ${text}`).toBe(200);
      const url = target.url();
      expect(routes.map((r) => r.path)).toContain(new URL(url).pathname);
      await expect(target.locator(route.requiredSelector)).toBeVisible();
      // interdit placeholders
      const bodyText = await target.locator('body').innerText();
      expect(bodyText).not.toMatch(/Lorem|TODO|Coming soon|N\/A|—/i);
    }
    await p.close();
  }
});
```

### RTL + MSW – Page affiche données réelles

```ts
it('Dashboard affiche données seedées', async () => {
  render(<Dashboard />);
  await screen.findByText(/Statistiques/i);
  expect(await screen.findByText('Cours NSI')).toBeInTheDocument();
  expect(screen.queryByText(/Lorem|TODO|N\/A/i)).toBeNull();
});
```

### E2E – Agenda (doit prouver implémentation réelle)

```ts
test('Agenda CRUD persistant', async ({ page }) => {
  await page.goto('/agenda');
  await page.getByRole('button', { name: /nouvel événement/i }).click();
  await page.fill('[name="title"]', 'Devoir NSI');
  await page.fill('[name="date"]', '2025-09-10');
  await page.getByRole('button', { name: /enregistrer/i }).click();
  await expect(page.getByText('Devoir NSI')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Devoir NSI')).toBeVisible(); // persistance
});
```

### A11y (jest-axe)

```ts
const { container } = render(<AriaInterface />);
const results = await axe(container);
expect(results.violations.filter(v => ['serious','critical'].includes(v.impact)).length).toBe(0);
```

## 11) Rapports & preuves

- Exiger en sortie de CI :
  - `reports/coverage/index.html`
  - `playwright-report/` + `trace.zip` + vidéos
  - `reports/a11y/*.json`
  - `reports/visual/*.png`
  - `reports/link-crawl.csv`

- Ajouter un **résumé Markdown** auto‑généré listant :
  - Boutons cassés/inactifs + page source + raison.
  - Pages non complétées (placeholders, sélecteurs manquants).
  - Divergences UI ↔ DB.
  - Violations a11y/visuel.

## 12) Règle d’or Anti‑“100% passed” trompeur

- **Interdire** la réussite si **au moins un** des critères suivants est vrai :
  - Placeholder détecté sur une page répertoriée.
  - Bouton attendu non interactif.
  - Route non documentée (non listée dans `routes.map.json`).
  - Test Agenda/ARIA échoue.
  - Écart UI↔DB (lecture/écriture) détecté.
  - Violation a11y serious/critical.
  - Diff visuel > seuil.

Exécute maintenant :

1. Inspecte le repo et confirme/ajuste les outils.
2. Crée/complète `routes.map.json`, seeds & handlers MSW.
3. Ajoute/peaufine les attributs `data-testid`.
4. Écris/organise les suites de tests.
5. Configure CI avec seuils/artefacts.
6. Lance la matrice complète et fournis **les artefacts** et **un résumé clair des échecs**.

S’il manque des infos (schémas API, rôles, environnements), **demande‑les explicitement** et bloque les tests correspondants avec un tag `@blocked` jusqu’à réception.
