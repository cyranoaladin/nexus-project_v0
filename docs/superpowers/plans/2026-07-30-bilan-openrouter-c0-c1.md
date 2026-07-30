# Plan d'implémentation C0/C1 — dépendances et client OpenRouter

> Base : PR #88 puis PR #89. C1 reste une branche empilée séparée.

**But :** supprimer sans exception la vulnérabilité `brace-expansion`, propager
la fondation et livrer une petite PR de contrat OpenRouter non raccordée au
moteur métier.

**Architecture :** C0 utilise l'upstream officiel 5.0.8 avec un adaptateur
fail-closed des deux anciens consommateurs `minimatch`. C1 charge une politique
JSON versionnée dans une frontière serveur unique, produit des snapshots de
capacités immuables et appelle Chat Completions avec un payload fermé.

**Stack :** Node 22, npm 10, TypeScript, Jest, Zod, fetch natif, GitHub Actions.

---

## Tâche 1 — Test de sécurité du graphe

**Fichiers :**

- créer `scripts/security/apply-brace-expansion-compat.mjs`
- créer `scripts/security/verify-brace-expansion-remediation.mjs`
- créer `__tests__/security/brace-expansion-remediation.test.ts`

1. Écrire les tests qui échouent sur les versions 1.x/2.x.
2. Vérifier l'échec ciblé.
3. Implémenter l'adaptateur fail-closed et le vérificateur.
4. Ajouter l'override 5.0.8 et le `postinstall`.
5. Régénérer le lockfile sans `--force`.
6. Vérifier CommonJS, ESM, minimatch 3/9/10 et la borne de l'avis.

## Tâche 2 — Audits, SBOM et trace d'exception

**Fichiers :**

- modifier `package.json` et `package-lock.json`
- modifier le document de décision de risque existant
- compléter l'audit de fondation applicable

1. Exécuter les audits complet/runtime.
2. Générer les SBOM complet/runtime.
3. Marquer l'ancienne demande `SUPERSEDED_BY_DEPENDENCY_FIX`.
4. Exécuter toutes les gates de #88.
5. Committer et pousser #88.
6. Mettre à jour sa draft PR et contrôler CI/CodeQL/GitGuardian.

## Tâche 3 — Protection et propagation

1. Mettre à jour le ruleset `main-protection` sans bypass.
2. Relire les règles effectives de `main`.
3. Fusionner explicitement la nouvelle tête #88 dans #89.
4. Rejouer les gates de parité.
5. Committer/pousser #89 et contrôler sa CI.

## Tâche 4 — Worktree C1 et tests de politique

**Fichiers :**

- créer `content/bilans/model-policies/bilan-model-policy-v1.1.json`
- créer `lib/llm/openrouter/config.ts`
- créer `lib/llm/openrouter/types.ts`
- créer `lib/llm/openrouter/errors.ts`
- créer les tests sous `__tests__/lib/llm/openrouter/`

1. Créer branche/worktree C1 depuis la nouvelle tête #89.
2. Écrire les tests de politique et configuration.
3. Vérifier leur échec.
4. Implémenter le chargeur serveur, validation et checksums.
5. Vérifier le succès.

## Tâche 5 — Capacités et client

**Fichiers :**

- créer `lib/llm/contracts.ts`
- créer `lib/llm/openrouter/capabilities.ts`
- créer `lib/llm/openrouter/client.ts`
- créer une fixture figée sous `__tests__/fixtures/openrouter/`
- créer le fake serveur et ses tests

1. Écrire les tests du snapshot et du payload fermé.
2. Vérifier leur échec.
3. Implémenter le snapshot immuable.
4. Implémenter client, erreurs, retries, fallback et provenance.
5. Tester tous les codes et métadonnées exigés.

## Tâche 6 — Preflight et architecture

**Fichiers :**

- créer `scripts/bilans/openrouter-preflight.ts`
- modifier `package.json`
- créer les tests d'architecture

1. Écrire les tests de commande et d'architecture.
2. Implémenter les commandes capacités/preflight.
3. Garantir les permissions 0700/0600 et le rapport expurgé.
4. Vérifier qu'aucun appel réel n'est effectué en CI.

## Tâche 7 — Documentation C1

**Fichiers :**

- créer `docs/adr/009-openrouter-canonical-report-generation.md`
- créer `docs/audits/bilan-llm-provider-inventory.md`
- créer `docs/specs/bilan-openrouter-model-policy.md`
- créer `docs/specs/bilan-openrouter-client-contract.md`
- créer `docs/runbooks/bilan-openrouter-preflight.md`
- modifier `.env.example`

Documenter les décisions, l'inventaire legacy, les erreurs, la confidentialité,
le preflight, les budgets owner et l'absence de raccordement métier.

## Tâche 8 — Gates et publication C1

1. Exécuter npm ci, tests ciblés/globaux, DB, intégration, Playwright, corpus,
   Prisma, typecheck, lint, build, sécurité, audits et SBOM.
2. Vérifier le diff et l'absence de migration Prisma.
3. Faire un checkout propre du SHA final et répéter les gates essentielles.
4. Committer par thèmes.
5. Pousser sans force.
6. Ouvrir une draft PR vers #89.
7. Contrôler tous les checks et CodeQL.

