# PR #74 Release Candidate Implementation Plan

> **For agentic workers:** REQUIRED: execute in the current session only. Subagents are disabled for this task, and the PR branch must remain the sole working branch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire un candidat de release Pré-rentrée 2026 vérifiable, bloqué par défaut et au plus `READY_FOR_OWNER_GO`.

**Architecture:** Sources canoniques strictes, provenance en trois champs, gate serveur central, générateurs sans duplication tarifaire et kit public séparé des informations internes.

**Tech Stack:** Next.js 15, TypeScript/Zod, Jest, Python/pytest, Playwright, WeasyPrint, GitHub Actions.

---

## Chunk 1 — CI et provenance

### Task 1: Sécurité des dépendances et actions

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `.github/workflows/*.yml`
- Modify: `security/npm-tree-exceptions.json`
- Modify: `scripts/validate-npm-tree.js`, `scripts/generate-runtime-sbom.js`
- Test: `__tests__/scripts/validate-npm-tree.test.ts`, `__tests__/scripts/generate-runtime-sbom.test.ts`

- [x] Reproduire l’audit Next.js high.
- [x] Écrire les tests de gouvernance de l’exception.
- [x] Passer Next.js à `15.5.21` et régénérer le lock avec npm `10.9.8`.
- [x] Épingler checkout/setup-node/setup-python/upload-artifact aux SHA Node 24.
- [x] Exécuter `npm ci`, les deux audits, tests de politique et validation YAML.
- [x] Commit atomique.

### Task 2: Provenance documentaire

**Files:**
- Modify: `scripts/pre-rentree/publication-sources.ts`
- Modify: `scripts/pre-rentree/publication-snapshot-schema.ts`
- Modify: `scripts/pre-rentree/build-publication-snapshot.ts`
- Modify: `package.json`, `.github/workflows/pre-rentree-documents.yml`
- Modify: renderers/audits/manifests utilisant `sourceRepoSha`
- Test: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`
- Test: `scripts/pre-rentree/tests/test_document_*.py`

- [ ] Écrire les tests RED pour les trois champs et l’indépendance à `origin/main`.
- [ ] Implémenter `sourceAnchorSha`, `repositoryCommitSha`, `sourceSetSha256`.
- [ ] Fournir le SHA de tête de PR depuis le workflow.
- [ ] Régénérer schéma/snapshot et prouver la reproductibilité.
- [ ] Corriger le mock Tabs pour ne pas transmettre `forceMount` au DOM.
- [ ] Commit atomique.

## Chunk 2 — Contrat commercial et gate

### Task 3: Capacités, SNT et tarifs

**Files:**
- Modify: `data/pricing.canonical.json`
- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `content/pre-rentree-2026/*.json`, `content/pre-rentree-2026/jpo-2026/**`
- Modify: `tools/pdf-generator/generate_all_pdfs.py`
- Modify: configurateur, loaders, schémas et tests Pré-rentrée

- [ ] Écrire les tests RED : Fondations 4–6, Premium 3–5, aucune SNT Seconde.
- [ ] Retirer le module/offre/créneau SNT à la source.
- [ ] Dériver acompte et solde du pricing dans tous les générateurs.
- [ ] Comparer JSON, UI, PDF et exports.
- [ ] Régénérer snapshot et sorties.
- [ ] Commit atomique.

### Task 4: Promesses et publication fail-closed

**Files:**
- Modify: contenus parents, communication, WhatsApp, FAQ et générateurs
- Create/Modify: gate serveur campagne et consommateurs page/API/SEO/downloads
- Modify: `data/campaigns/pre-rentree-2026.json`
- Test: contrats publics et tests de routes/surfaces

- [ ] Écrire les tests RED pour les promesses interdites et le blocage hors `PUBLIC_READY`.
- [ ] Utiliser « Enseignants expérimentés, en exercice dans le système français ».
- [ ] Retirer positionnement personnalisé et bilan final écrit des surfaces publiques.
- [ ] Maintenir `enablePreRegistration=false` et CTA demande d’information.
- [ ] Appliquer le gate au site, API, SEO, métadonnées, téléchargements et formulaires.
- [ ] Commit atomique.

## Chunk 3 — Pédagogie, opérations et kit

### Task 5: Conformité pédagogique

**Files:**
- Modify: `CONFORMITE_PROGRAMMES.md`
- Modify: modules/matrice officielle et contenus générés
- Modify: `DEBTS.md`
- Test: contrat programme Pré-rentrée

- [ ] Refaire le différentiel 2019/2026 avec source et section.
- [ ] Corriger les affirmations historiques inexactes.
- [ ] Présenter les modules comme sélection de priorités/prérequis/méthodes.
- [ ] Garder Maths en validation et SVT en DRAFT.
- [ ] Appliquer la formulation calculatrice SVT.
- [ ] Commit atomique.

### Task 6: Gates opérationnels

**Files:**
- Modify: décisions propriétaire, preuves et dettes
- Create: matrice de gates datée et responsabilisée
- Test: gates serveur/publication

- [ ] Formaliser les gates obligatoires et leurs preuves.
- [ ] Conserver les identités privées et rôles publics abstraits.
- [ ] Bloquer créneaux/salles publics sans validation.
- [ ] Commit atomique.

### Task 7: Kit complet

**Files:**
- Modify: `content/pre-rentree-2026/week-one-campaign.fr.json`
- Modify: renderers Week One/full campaign/PDF
- Modify: `assets/campaigns/pre-rentree-2026/**`
- Modify: `assets/campaigns/pre-rentree-2026/release-inventory.json`

- [ ] Paramétrer la date de lancement et recalculer J1/J2.
- [ ] Régénérer visuels, textes, carrousel, stories, Reel MP4/SRT, programmes, tarifs, plannings, FAQ, calendrier, WhatsApp et vente interne.
- [ ] Régénérer manifestes, checksums, inventaires, planches contact et rasters PDF.
- [ ] Contrôler visuellement les sorties et techniquement MP4/SRT.
- [ ] Exclure toute source/audit/infrastructure du kit public.
- [ ] Commit atomique.

## Chunk 4 — Infrastructure et validation

### Task 8: Hygiène infrastructure

**Files:**
- Modify: docs/scripts suivis contenant des détails d’exploitation
- Modify: `DEBTS.md`
- Create: runbook privé ignoré ou gabarit public assaini

- [ ] Neutraliser IP, utilisateur, chemins, processus, anciennes versions et commandes sensibles.
- [ ] Isoler la dette de réconciliation des dépôts.
- [ ] Séparer les changements Docker non requis.
- [ ] Désactiver les scripts de déploiement incompatibles.
- [ ] Commit atomique.

### Task 9: Validation finale et PR

- [ ] Exécuter toutes les suites depuis un checkout propre.
- [ ] Inspecter chaque check GitHub après push sans force.
- [ ] Répondre puis résoudre uniquement les fils prouvés.
- [ ] Mettre à jour la description PR avec preuves et revues humaines demandées.
- [ ] Établir le verdict sans dépasser `READY_FOR_OWNER_GO`.
