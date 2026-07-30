# Bilans OpenRouter C0.6 / C1.1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer toute mutation postinstall de dépendances, propager un
graphe npm natif et durcir le contrat OpenRouter avec un preflight
cryptographiquement lié.

**Architecture:** C0.6 migre la toolchain de développement vers des versions
nativement compatibles avec `brace-expansion@5.0.8` et remplace le CLI SBOM
transitif par `npm sbom`. Après deux preuves de reproductibilité et des merges
explicites, C1.1 versionne les tentatives, les budgets et la preuve de preflight
sans raccorder le moteur métier.

**Tech Stack:** Node.js 22, npm 10, TypeScript, Jest, ESLint flat config,
OpenRouter Chat Completions, Zod, SHA-256/HMAC, GitHub Actions.

---

## Chunk 1: Fondation native

### Task 1: Verrouiller les gates de graphe

**Files:**
- Modify: `__tests__/scripts/security/brace-expansion-remediation.test.ts`
- Modify: `scripts/security/verify-brace-expansion-remediation.mjs`

- [ ] Ajouter des tests qui échouent tant qu'un `postinstall`, un patch de
      dépendance, `minimatch<10` ou `brace-expansion<5.0.8` existe.
- [ ] Exécuter le test ciblé et vérifier l'échec attendu.
- [ ] Étendre le vérificateur pour contrôler le manifeste, le lockfile et
      l'arbre physique sans supposer une mutation.
- [ ] Rejouer le test ciblé.

### Task 2: Migrer ESLint, Jest et le graphe natif

**Files:**
- Create: `eslint.config.mjs`
- Delete: `.eslintrc.json`
- Delete: `.eslintignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `scripts/security/apply-brace-expansion-compat.mjs`

- [ ] Ajouter un test de contrat pour la configuration flat et les versions
      parentes autorisées.
- [ ] Vérifier l'échec sur la toolchain historique.
- [ ] Installer ESLint 10, plugins flat compatibles, Jest 30, `glob@13` et
      `test-exclude@8`; retirer CycloneDX CLI et le `postinstall`.
- [ ] Générer la configuration flat équivalente.
- [ ] Exécuter `npm ci`, `npm ls`, les audits, lint et tests ciblés.
- [ ] Corriger uniquement les incompatibilités prouvées.

### Task 3: Remplacer le générateur SBOM transitif

**Files:**
- Modify: `scripts/generate-runtime-sbom.js`
- Modify: `.github/workflows/ci.yml`
- Modify: tests SBOM existants

- [ ] Écrire les tests rouges pour l'absence du CLI CycloneDX et la génération
      npm native complète/runtime.
- [ ] Remplacer l'appel CLI par `npm sbom`.
- [ ] Ajouter une validation structurelle et de graphe fail-closed.
- [ ] Vérifier les deux SBOM et les audits.

### Task 4: Reproductibilité double

**Files:**
- Create: `scripts/security/verify-native-dependency-reproducibility.mjs`
- Create: tests correspondants
- Update: rapports C0

- [ ] Écrire le test rouge de comparaison normalisée.
- [ ] Implémenter la comparaison package/lock/arbre/SBOM.
- [ ] Créer deux checkouts temporaires propres.
- [ ] Exécuter `npm ci`, tests, SBOM et build dans chacun.
- [ ] Vérifier zéro drift et documenter les checksums.
- [ ] Commit et push #88.

## Chunk 2: Propagation

### Task 5: Propager vers #89 puis #90

- [ ] Merger explicitement la nouvelle tête #88 dans #89.
- [ ] Exécuter les gates #89 et pousser sans force.
- [ ] Merger explicitement la nouvelle tête #89 dans #90.
- [ ] Vérifier l'absence de conflit et la parité de fondation.

## Chunk 3: Durcissement C1.1

### Task 6: Politique retry et budgets entiers

**Files:**
- Modify: `content/bilans/model-policies/bilan-model-policy-v1.1.json`
- Modify: `lib/llm/openrouter/policy.ts`
- Modify: `lib/llm/openrouter/config.ts`
- Modify: `lib/llm/openrouter/types.ts`
- Modify: tests policy/config

- [ ] Écrire les tests rouges du plan exact et des conversions micro-USD.
- [ ] Ajouter `retryPolicy` et recalculer le checksum.
- [ ] Implémenter le parseur décimal sans conversion monétaire par `Number`.
- [ ] Vérifier les bornes et relations entre budgets.

### Task 7: Historique, erreurs et finish reason

**Files:**
- Modify: `lib/llm/openrouter/client.ts`
- Modify: `lib/llm/openrouter/contracts.ts`
- Modify: `lib/llm/openrouter/errors.ts`
- Modify: tests client/fake server

- [ ] Écrire les tests rouges d'historique complet.
- [ ] Retourner `data`, `provenance`, `attempts`.
- [ ] Lire et normaliser l'enveloppe d'erreur bornée.
- [ ] Distinguer 503 générique et absence explicite de fournisseur conforme.
- [ ] Refuser tous les finish reasons sauf `stop`.
- [ ] Retirer `usage.include` et vérifier l'absence des paramètres dépréciés.

### Task 8: Intégrité du preflight

**Files:**
- Modify: `lib/llm/openrouter/capabilities.ts`
- Modify: `lib/llm/openrouter/types.ts`
- Modify: `scripts/bilans/openrouter-preflight.ts`
- Modify: tests capabilities/preflight

- [ ] Écrire les tests rouges checksum, temps, fingerprint, SHA et catalogue.
- [ ] Ajouter la preuve canonique et sa validation.
- [ ] Ajouter des limites séparées catalogue/complétion.
- [ ] Durcir la lecture privée de clé.
- [ ] Exécuter le preflight fake primaire/fallback.

## Chunk 4: Qualification

### Task 9: Preflight privé et gates globales

- [ ] Vérifier les permissions du fichier secret sans lire/afficher la clé.
- [ ] Si disponible, charger la clé uniquement dans l'environnement du process.
- [ ] Exécuter les deux modèles avec données synthétiques.
- [ ] Produire une preuve privée expurgée.
- [ ] Exécuter tests unitaires, DB, intégration, Playwright, typecheck, lint,
      build, audits, SBOM, sécurité et CodeQL.
- [ ] Mettre à jour #88/#89/#90, pousser et attendre tous les checks.
- [ ] Demander une revue indépendante, traiter les constats P0/P1.

