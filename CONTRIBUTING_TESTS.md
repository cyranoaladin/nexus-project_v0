# CONTRIBUTING – Tests (Nexus Réussite)

### Philosophie de Test

- **Pyramide**: privilégier les tests unitaires (rapides, ciblés) et d’intégration (API/lib). Un **smoke E2E** ultra-rapide garde la CI fiable. La **suite E2E complète** couvre les parcours critiques et cas d’erreur, avec mocks pour les dépendances externes (LLM, paiements, PDF).
- **Déterminisme**: pas d’appels réels vers les services externes en test; toujours mocker/stubber.
- **Stabilité**: utiliser des sélecteurs stables (`data-testid`) et les helpers (`loginAs`, `disableAnimations`, `captureConsole`, stubs réseau) pour éviter le flaky.

### Commandes Essentielles

- **Unitaires/Intégration (Jest)**
  - Lancer tous les tests:

    ```bash
    npm test
    ```

  - Couverture (≥ 90% sur les scopes configurés):

    ```bash
    npm run test:coverage
    ```

- **E2E (Playwright)**
  - Suite complète (Chromium/Firefox/WebKit selon config locale):

    ```bash
    npm run test:e2e
    ```

  - UI runner (debug):

    ```bash
    npm run test:e2e:ui
    ```

  - Smoke test uniquement (Chromium, rapide):

    ```bash
    npm run test:e2e -- --project=chromium -g "Smoke - Parcours critiques"
    ```

  - Exemples ciblés (Chromium):
    - Permissions COACH:

      ```bash
      npm run test:e2e -- --project=chromium -g "Permissions - COACH"
      ```

    - Inscription élève à un cours:

      ```bash
      npm run test:e2e -- --project=chromium -g "Flow - Inscription élève à un cours"
      ```

    - Génération PDF – attestation de fin de module:

      ```bash
      npm run test:e2e -- --project=chromium -g "Génération PDF - Attestation de fin de module"
      ```

    - Chat ARIA avec mock LLM:

      ```bash
      npm run test:e2e -- --project=chromium -g "ARIA Chat - E2E avec mock LLM"
      ```

    - Accessibilité (axe) – dashboard coach:

      ```bash
      npm run test:e2e -- --project=chromium -g "Le dashboard du coach doit être accessible"
      ```

    - Exécution par fichier:

      ```bash
      npm run test:e2e -- e2e/permissions/coach.spec.ts --project=chromium
      ```

### Source de Vérité

- `TESTING_STRATEGY.md` décrit: rôles/permissions, modèles de données (Prisma), flows critiques (inscription, sessions vidéo, paiements), ARIA/LLM/OpenAI, et standards qualité (accessibilité, résilience).
- E2E: **base URL unique** `http://localhost:3001`. Le runner charge `.env.e2e` via `dotenv-cli`. DB Postgres locale/CI: `localhost:5433` (voir workflow GitHub Actions et `playwright.config.ts`).

### Ajouter un nouveau test E2E – Workflow recommandé

1) Définir l’objectif et la portée (page/flow, rôle, prérequis). 2) Se référer aux sections pertinentes de `TESTING_STRATEGY.md`. 3) Mocker toute dépendance externe. 4) Réutiliser `loginAs`, `disableAnimations`, stubs réseau, `data-testid`. 5) Écrire des assertions robustes (peu de couplage visuel). 6) Nettoyage (teardown) pour isoler les données.

#### Modèle de prompt (à utiliser avec l’IA)

```md
Objectif : [Décrire clairement l'objectif. Ex: "Générer les tests E2E pour le parcours de souscription d'un élève."]

Contexte de Référence :
- Notre "source de vérité" est le document TESTING_STRATEGY.md. Appuie‑toi sur les sections [ex: "2. Base de Données", "3. Authentification", "6. Visioconférence"].
- Respecte le code et l’architecture existants.

Consignes Strictes (Règle d'Intégration Cohérente) :
- N'introduis aucune modification radicale à la logique métier, à l'architecture ou au schéma.
- Ajoute seulement de la couverture de test et fiabilise.
- Si une amélioration est identifiée (factorisation, gestion d’erreur), ne l’implémente pas : propose‑la comme "suggestion de refactoring".
- Réutilise helpers/fixtures/conventions existants.

Tâche Spécifique :
- [Décrire précisément ce qui doit être implémenté. Ex: Créer `e2e/flows/subscription.spec.ts` couvrant le scénario ...]

Données et Prérequis :
- Utiliser l’utilisateur de test [ex: `eleve@nexus.local`].
- Supposer [ex: pas de souscription active].
- Mocker les intégrations externes [ex: paiements/LLM/PDF] et simuler un retour de succès.
```

### CI/CD

- Le job **smoke** (Chromium) s’exécute sur chaque PR et bloque la fusion en cas d’échec.
- La suite **E2E complète** tourne après le smoke (et après Jest). Voir `.github/workflows/ci.yml`.

### Bonnes pratiques (rappel)

- Préférer `data-testid` pour cibler les éléments dynamiques.
- Centraliser les comptes de test et URLs dans `e2e/test-data.ts` et `.env.e2e`.
- Attacher les journaux/résultats (console, axe, etc.) au rapport Playwright pour faciliter les diagnostics.
