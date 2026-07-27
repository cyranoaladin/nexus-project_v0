# Pré-rentrée 2026 Public Release Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une release informative Pré-rentrée 2026, cohérente sur le
site, les PDF et la campagne, sans toucher au Bilan gratuit.

**Architecture:** Les données internes restent côté serveur. Un adaptateur
public sanitisé alimente la page et les composants. Les PDF et assets publics
sont régénérés depuis les mêmes sources canoniques et vérifiés avant toute
autorisation de publication.

**Tech Stack:** Next.js 15, React, TypeScript, Jest, Playwright, Python 3.12,
pytest, WeasyPrint/PyMuPDF, qpdf, npm/GitHub Actions.

---

## Chunk 1: Reproduction, planning et page

### Task 1: Reproduire les anomalies et protéger le périmètre

**Files:**

- Create: `docs/campaigns/pre-rentree-2026/FINAL-PUBLIC-RELEASE-AUDIT.md`
- Modify: `__tests__/campaigns/pre-rentree-2026-final-public-release.test.ts`
- Modify: `__tests__/components/pre-rentree-2026-sections.test.tsx`
- Modify: `__tests__/components/pre-rentree-2026-planning-selector.test.tsx`
- Modify: `__tests__/components/pre-rentree-2026-page.test.tsx`

- [ ] Écrire les assertions qui reproduisent le double comptage, les CTA
  interdits, le plafond absent, l'intégration canonique absente et la fuite de
  données non sanitisées.
- [ ] Lancer chaque test ciblé et confirmer l'échec attendu.
- [ ] Vérifier le regex Bilan et committer
  `test(pre-rentree): reproduce final public release gaps`.

### Task 2: Modéliser matière et cohortes sans double comptage

**Files:**

- Create: `lib/campaigns/pre-rentree-2026/public-schedule.ts`
- Modify: `components/pre-rentree-2026/ScheduleSection.tsx`
- Modify: `lib/campaigns/pre-rentree-2026/getters.ts`
- Test: `__tests__/campaigns/pre-rentree-2026-public-schedule.test.ts`
- Test: `__tests__/components/pre-rentree-2026-sections.test.tsx`

- [ ] Écrire les tests rouges Première SVT, Terminale NSI et Terminale SVT.
- [ ] Implémenter `PublicSubjectScheduleRow` avec `studentSessionCount=5`,
  `studentHours=10` et une liste de cohortes.
- [ ] Masquer les salles lorsque `roomAssignmentsValidated=false`.
- [ ] Vérifier les tests ciblés puis committer
  `fix(pre-rentree): model alternative cohorts without double counting`.

### Task 3: Durcir le sélecteur

**Files:**

- Modify: `components/pre-rentree-2026/StagePlanningSelector.tsx`
- Modify: `lib/campaigns/pre-rentree-2026/itinerary.ts`
- Modify: `lib/campaigns/pre-rentree-2026/configurator.ts`
- Test: `__tests__/components/pre-rentree-2026-planning-selector.test.tsx`
- Test: `__tests__/campaigns/pre-rentree-2026-student-idle-time.test.ts`

- [ ] Ajouter les tests rouges du maximum quatre.
- [ ] Ajouter `MAX_SUBJECTS_PER_PACK=4` et le message exact.
- [ ] Bloquer tous les statuts hors `COMPACT`/`NO_SHARED_DAY`.
- [ ] Produire un lien WhatsApp incluant niveau, profil, matières, dates,
  horaires, cohortes, attente et réserve de disponibilité.
- [ ] Afficher `CAPACITY_TO_CONFIRM` et retirer tout lien Bilan du sélecteur.
- [ ] Vérifier puis committer
  `fix(pre-rentree): harden planning selector and availability CTA`.

### Task 4: Intégrer le parcours parent canonique

**Files:**

- Modify: `lib/campaigns/pre-rentree-2026/public-surface.ts`
- Modify: `app/stages/pre-rentree-2026/page.tsx`
- Modify: `components/pre-rentree-2026/ScheduleSection.tsx`
- Modify: `components/pre-rentree-2026/ProgramsSection.tsx`
- Modify: `lib/campaigns/pre-rentree-2026/documents.ts`
- Test: `__tests__/components/pre-rentree-2026-page.test.tsx`
- Test: `__tests__/campaigns/pre-rentree-2026-public-surfaces.test.ts`
- Test: `e2e/pre-rentree-2026.spec.ts`

- [ ] Écrire les tests rouges du DTO public et de l'ordre des sections.
- [ ] Étendre l'adaptateur serveur sans exposer identité, rôle, gouvernance ou
  code opérationnel.
- [ ] Rendre offres, planning, méthode, programmes, sept PDF, FAQ et WhatsApp.
- [ ] Conserver 404/noindex avant `PUBLIC_READY`.
- [ ] Vérifier puis committer
  `feat(pre-rentree): expose sanitized planning and downloads on canonical page`.

## Chunk 2: PDF, campagne et provenance

### Task 5: Aligner les sept PDF et le pipeline public

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/pre-rentree-documents.yml`
- Modify: `tools/pdf-generator/generate_all_pdfs.py`
- Modify: `tools/pdf-generator/generate_level_dossiers.py`
- Modify: `scripts/pre-rentree/render_final_pdf_review.py`
- Create: `scripts/pre-rentree/verify_public_pdfs.py`
- Modify: `scripts/pre-rentree/tests/test_workflow_contract.py`
- Modify: `scripts/pre-rentree/tests/test_legacy_pdf_generator_contract.py`
- Modify: `scripts/pre-rentree/tests/test_level_dossiers.py`

- [ ] Écrire les tests rouges des aliases, du workflow et des contrôles PDF.
- [ ] Ajouter `pre-rentree:public-pdfs` et
  `pre-rentree:public-pdfs:verify`.
- [ ] Garder `pre-rentree:legacy-pdfs` comme alias déprécié.
- [ ] Supprimer comparaison marché, réservation et salles non validées.
- [ ] Régénérer les sept PDF et leurs checksums.
- [ ] Vérifier qpdf, texte, pages, polices, liens et claims.
- [ ] Committer
  `fix(pre-rentree): align seven public PDFs and public pipeline`.

### Task 6: Régénérer la campagne canonique et datée

**Files:**

- Modify: `content/pre-rentree-2026/week-one-campaign.fr.json`
- Modify: `scripts/pre-rentree/render_week_one_kit.py`
- Modify: `scripts/pre-rentree/render_full_campaign.py`
- Modify: `scripts/pre-rentree/tests/test_week_one_assets.py`
- Modify: `__tests__/campaigns/pre-rentree-2026-week-one-kit.test.ts`
- Regenerate: `assets/campaigns/pre-rentree-2026/week-one/**`
- Regenerate: `assets/campaigns/pre-rentree-2026/full-campaign/**`

- [ ] Écrire le test rouge anti-PC Seconde sur sources et rendus.
- [ ] Dériver les matières du contrat commercial.
- [ ] Remplacer tous les CTA inscription/réservation/paiement.
- [ ] Générer le calendrier avec `PRE_RENTREE_LAUNCH_DATE=2026-07-26`.
- [ ] Vérifier qu'aucune date finale n'est nulle.
- [ ] Committer
  `fix(pre-rentree): regenerate canonical campaign without stale Seconde claims`.

### Task 7: Produire les assets sociaux publics

**Files:**

- Modify: `scripts/pre-rentree/render_week_one_kit.py`
- Modify: `scripts/pre-rentree/tests/test_week_one_assets.py`
- Create/Regenerate: `assets/campaigns/pre-rentree-2026/week-one/PUBLIC/**`
- Create/Regenerate: `assets/campaigns/pre-rentree-2026/week-one/REVIEW/**`

- [ ] Écrire les tests rouges dimensions, filigrane, CTA, téléphone, lieu,
  dates et matières.
- [ ] Générer Feed/Story principal, quatre niveaux, carrousel et Reel existant.
- [ ] Générer les contact sheets.
- [ ] Vérifier visuellement puis committer
  `feat(pre-rentree): deliver public social assets and dated calendar`.

### Task 8: Aligner version, gates et provenance

**Files:**

- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `content/pre-rentree-2026/release-gates.json`
- Modify: `content/pre-rentree-2026/publication-decisions.owner.json`
- Modify: `assets/campaigns/pre-rentree-2026/documents-final/manifest.json`
- Modify: `scripts/pre-rentree/build_release_inventory.py`
- Regenerate: `assets/campaigns/pre-rentree-2026/release-inventory.json`

- [ ] Écrire les tests rouges version 2.1.0, 7 PDF et comptes 14/70/17/85.
- [ ] Corriger gates salles/assets/page/PDF/calendrier.
- [ ] Séparer manifeste revue, release candidate et final.
- [ ] Lier l'inventaire à la branche et à la PR finales.
- [ ] Laisser `publication_authorization` ouvert.
- [ ] Committer
  `fix(pre-rentree): align gates version counts and release provenance`.

## Chunk 3: Sécurité, QA, PR et déploiement

### Task 9: Résoudre Dependency Integrity

**Files éventuels, commit séparé:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/**`
- Modify: `security/**`
- Modify: `scripts/validate-npm-tree.js`
- Modify: `scripts/generate-runtime-sbom.js`

- [ ] Vérifier les versions officielles npm et les chaînes parentes.
- [ ] Tester uniquement une mise à jour officielle compatible.
- [ ] Exécuter les deux audits npm.
- [ ] Si l'audit complet reste rouge, ne pas créer de GO et terminer avec le
  verdict Dependency Integrity.
- [ ] Si une solution officielle existe, vérifier tout le dépôt puis committer
  `fix(security): resolve dependency integrity with official toolchain updates`.

### Task 10: Exécuter la QA finale

**Files:**

- Modify: `e2e/pre-rentree-2026.spec.ts`
- Create: `docs/campaigns/pre-rentree-2026/FINAL-VISUAL-QA.md`
- Create/Regenerate: `assets/qa/pre-rentree-2026/final-public-release/**`

- [ ] Exécuter les commandes locales bloquantes depuis un checkout propre.
- [ ] Exécuter E2E fermé et release candidate.
- [ ] Vérifier le Bilan en lecture seule.
- [ ] Produire captures, contact sheets, contraste et overflow.
- [ ] Vérifier le diff Bilan puis committer les tests et la documentation QA.

### Task 11: PR, GO conditionnel, merge et déploiement

- [ ] Pousser la branche sans force.
- [ ] Ouvrir une Draft PR vers `main` avec toutes les preuves.
- [ ] Attendre tous les checks requis et refuser absent/skipped/neutral.
- [ ] Vérifier runbook privé, rollback et pré-health sans exposer de secret.
- [ ] Si tous les gates sont verts, créer le commit GO limité, retester, taguer
  et commenter.
- [ ] Rendre la PR prête, obtenir les reviews et merger sans `--admin`.
- [ ] Déployer exactement le SHA fusionné selon le runbook.
- [ ] Exécuter les smoke externes ; rollback immédiat sur critère critique.
- [ ] Fermer #75 à #78 uniquement après déploiement réussi.
