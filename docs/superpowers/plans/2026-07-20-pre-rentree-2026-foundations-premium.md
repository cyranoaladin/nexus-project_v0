# Pré-rentrée 2026 Fondations / Premium Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire une release candidate REVIEW intégrée, reproductible et non diffusable de la Pré-rentrée 2026 avec quatre niveaux, quatorze modules, soixante-dix séances, preuves pédagogiques, documents, communication, site et pilotage.

**Architecture:** Des sources JSON fermées sont compilées par TypeScript vers un snapshot unique. Le renderer Python et le site Next.js utilisent les mêmes dérivations ; tous les binaires restent dans `.artifacts/`. Les gates humaines et opérationnelles bloquent RELEASE sans bloquer la constitution d'un paquet REVIEW honnête.

**Tech Stack:** TypeScript, Zod, Jest, Next.js/React, Python 3, pytest, WeasyPrint, Playwright, openpyxl, JSON Schema, GitHub Actions.

---

## Chunk 1: Sources métier et contrats

### Task 1: État initial, spécification et contrats RED

**Files:**
- Create: `docs/superpowers/specs/2026-07-20-pre-rentree-2026-foundations-premium-design.md`
- Create: `docs/superpowers/plans/2026-07-20-pre-rentree-2026-foundations-premium.md`
- Modify: `__tests__/campaigns/pre-rentree-2026-structure.test.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-configurator.test.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`
- Modify: `__tests__/lib/pricing-canonical-validator.test.ts`

- [ ] Écrire les assertions RED pour `LEVEL_COUNT=4`, `PUBLIC_MODULE_COUNT=14`, `PUBLIC_SESSION_COUNT=70`, SNT Seconde, Philosophie Terminale et absence de Français Terminale.
- [ ] Écrire les assertions RED pour les deux gammes, les capacités 4–6/3–5 et les acomptes exacts.
- [ ] Exécuter les tests ciblés et confirmer qu'ils échouent sur les anciennes valeurs.
- [ ] Committer la conception et les tests RED.

### Task 2: Schémas et sources d'offres

**Files:**
- Create: `content/pre-rentree-2026/offers.json`
- Create: `content/pre-rentree-2026/offers.schema.json`
- Create: `content/pre-rentree-2026/manuals.registry.json`
- Create: `content/pre-rentree-2026/capabilities.json`
- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `data/pricing.canonical.json`
- Modify: `lib/campaigns/pre-rentree-2026/schema.ts`
- Modify: `lib/pricing.ts`

- [ ] Fermer les schémas et ajouter 3e, Philosophie et les identifiants de gamme.
- [ ] Définir les offres Fondations par niveau et les packs Premium sans tarif dupliqué.
- [ ] Calculer l'acompte et le solde depuis le taux canonique ; rejeter tout écart.
- [ ] Ajouter les gates manuels et capacités, initialement non approuvées lorsque la preuve manque.
- [ ] Exécuter les tests ciblés jusqu'au GREEN, puis refactorer les getters.
- [ ] Committer les sources canoniques.

### Task 3: Programmes canoniques

**Files:**
- Modify: `content/pre-rentree-2026/modules.json`
- Modify: `lib/campaigns/pre-rentree-2026/schema.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-modules.test.ts` or the existing module-contract test

- [ ] Écrire les tests RED d'unicité et d'exhaustivité des quatorze modules et soixante-dix séances.
- [ ] Ajouter Mathématiques/Français 3e et Philosophie Terminale, supprimer le module Français Terminale.
- [ ] Réviser SNT Seconde et auditer les dix modules restants pour niveau, progression et matérialité.
- [ ] Exécuter le contrat complet puis committer.

## Chunk 2: Preuves pédagogiques et gouvernance

### Task 4: Positionnements, évaluations et livrables

**Files:**
- Create: `content/pre-rentree-2026/positioning-tests.json`
- Create: `content/pre-rentree-2026/quick-assessments.json`
- Create: `content/pre-rentree-2026/session-deliverables.json`
- Create: `content/pre-rentree-2026/pedagogy.schema.json`
- Create: `__tests__/campaigns/pre-rentree-2026-pedagogy-artifacts.test.ts`

- [ ] Écrire les tests RED pour 14 sujets/corrigés/barèmes et leurs métadonnées.
- [ ] Écrire les tests RED pour 70 évaluations et 70 livrables, chacun relié à une séance.
- [ ] Matérialiser chaque contenu avec consigne/corrigé/critère/domaine et un contenu élève exploitable.
- [ ] Vérifier les références bidirectionnelles et l'absence de données nominatives.
- [ ] Exécuter les tests jusqu'au GREEN et committer.

### Task 5: Matrices de capacité, preuve et staffing

**Files:**
- Create: `docs/campaigns/pre-rentree-2026/VALUE-PROOF-MATRIX.md`
- Create: `docs/campaigns/pre-rentree-2026/STAFFING-MATRIX.md`
- Modify: `docs/campaigns/pre-rentree-2026/PARCOURS360-CAPABILITY-MATRIX.md`
- Modify: `docs/campaigns/pre-rentree-2026/COMPLIANCE-GAPS.md`
- Create: `__tests__/campaigns/pre-rentree-2026-public-capability-gates.test.ts`

- [ ] Écrire un test RED interdisant toute promesse sans capacité et preuve prêtes/approuvées.
- [ ] Décrire les capacités sans transformer `DESIGNED` ou `IMPLEMENTED` en engagement public.
- [ ] Créer une matrice de rôles non nominative et conserver les affectations publiques bloquées.
- [ ] Exclure manuels, qualifications et Premium 360 enrichi des supports publics tant que leurs gates manquent.
- [ ] Exécuter les tests et committer.

## Chunk 3: Snapshot et planning

### Task 6: Compilation et provenance

**Files:**
- Modify: `scripts/pre-rentree/publication-sources.ts`
- Modify: `scripts/pre-rentree/publication-derivations.ts`
- Modify: `scripts/pre-rentree/publication-snapshot-schema.ts`
- Modify: `scripts/pre-rentree/schemas/publication-snapshot.schema.json`
- Modify: `generated/pre-rentree-2026/publication.snapshot.json`
- Modify: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`

- [ ] Écrire les tests RED de provenance pour chaque nouvelle source et `sourceSetSha256`.
- [ ] Retirer tout SHA de commit auto-référentiel du contenu reproductible et conserver les distinctions head/base/merge dans le manifest externe.
- [ ] Compiler offres, capacités, preuves, manuels, communications et nouveaux outputs.
- [ ] Valider toutes les références JSON Pointer et conflits de sources.
- [ ] Régénérer deux fois et comparer le snapshot, puis committer.

### Task 7: Planning et gates d'affectation

**Files:**
- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `lib/campaigns/pre-rentree-2026/getters.ts`
- Modify: `scripts/pre-rentree/publication-derivations.ts`
- Create: `__tests__/campaigns/pre-rentree-2026-schedule-gates.test.ts`

- [ ] Écrire les tests RED pour 70 séances, pause, conflits, charges et compatibilité multimatières.
- [ ] Produire planning global, par niveau, salle, rôle enseignant et sélection élève.
- [ ] Faire échouer RELEASE si une gate salle/enseignant manque ; marquer le planning REVIEW comme brouillon.
- [ ] Exécuter les tests et committer.

## Chunk 4: Documents et communication

### Task 8: Contrat éditorial parents

**Files:**
- Modify: `content/pre-rentree-2026/parent-guide.fr.json`
- Modify: `content/pre-rentree-2026/parent-guide.schema.json`
- Create: `content/pre-rentree-2026/communication.fr.json`
- Create: `content/pre-rentree-2026/whatsapp.fr.json`
- Create: `__tests__/campaigns/pre-rentree-2026-communications.test.ts`

- [ ] Écrire les tests RED pour sections du Guide, 24 scripts WhatsApp, publications, carrousels, stories et trois Reels.
- [ ] Sourcer chaque affirmation factuelle ; distinguer éditorial et preuve.
- [ ] Utiliser la réservation seulement après validation et acompte reçu ; laisser les clauses non approuvées hors public.
- [ ] Ajouter tracking par canal sans donnée personnelle.
- [ ] Exécuter les tests et committer.

### Task 9: Renderer unifié REVIEW

**Files:**
- Modify: `scripts/pre-rentree/document_model.py`
- Modify: `scripts/pre-rentree/document_templates.py`
- Modify: `scripts/pre-rentree/document_renderer.py`
- Modify: `scripts/pre-rentree/generate_documents.py`
- Modify: `scripts/pre-rentree/templates/document.css`
- Modify: `scripts/pre-rentree/tests/test_document_*.py`

- [ ] Écrire les tests RED pour les nouveaux noms, les quatre niveaux et le marquage REVIEW.
- [ ] Générer Guide, brochure courte, Essentiel, comparatif, tarifs/réservation, quatre programmes, planning brouillon, FAQ et HTML accessibles.
- [ ] Générer kits WhatsApp/réseaux et visuels à partir du snapshot sans valeur métier codée.
- [ ] Ne pas générer la brochure manuels publiable ni un paquet privé tant que les gates manquent.
- [ ] Contrôler pagination, ligatures, taille minimale, QR, HTML mobile et absence de jargon technique visible.
- [ ] Exécuter les tests Python puis committer.

### Task 10: Pilotage, modèles internes et économie

**Files:**
- Create: `content/pre-rentree-2026/economic-model.json`
- Create: `content/pre-rentree-2026/crm.schema.json`
- Modify: `scripts/pre-rentree/generate_documents.py`
- Modify: `scripts/pre-rentree/package_documents.py`
- Create: `scripts/pre-rentree/tests/test_economic_model.py`
- Create: `scripts/pre-rentree/tests/test_review_toolkit.py`

- [ ] Écrire les tests RED du tableur, des formules et scénarios.
- [ ] Générer le XLSX v2 dans `.artifacts/` avec cellules/formules explicites.
- [ ] Générer des modèles internes anonymes et le CRM, uniquement dans le paquet REVIEW.
- [ ] Vérifier qu'aucun formulaire nominatif ou dossier PRIVATE n'est produit.
- [ ] Exécuter les tests et committer.

## Chunk 5: Site public et calculateur

### Task 11: DTO et configurateur quatre niveaux

**Files:**
- Modify: `lib/campaigns/pre-rentree-2026/getters.ts`
- Modify: `lib/campaigns/pre-rentree-2026/configurator.ts`
- Modify: `lib/campaigns/pre-rentree-2026/presentation.ts`
- Modify: `lib/analytics.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-configurator.test.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-landing-dto.test.ts`

- [ ] Écrire les tests RED pour Fondations/Premium et calcul exact de 30 %.
- [ ] Calculer les totaux Fondations par addition et Premium par pack.
- [ ] Ajouter 3e, Philosophie, SNT, manuels gated et message WhatsApp tracé.
- [ ] Exécuter tests et typecheck, puis committer.

### Task 12: Page et accessibilité

**Files:**
- Modify: `app/stages/pre-rentree-2026/page.tsx`
- Modify: `components/pre-rentree-2026/*.tsx`
- Modify: `e2e/pre-rentree-2026.spec.ts`
- Modify: `__tests__/components/pre-rentree-2026-*.test.tsx`

- [ ] Écrire les tests RED des sections, filtres, calculateur, CTA et gates.
- [ ] Mettre à jour les composants en réutilisant le design system existant.
- [ ] Vérifier mobile, clavier, landmarks, contrastes et fonctionnement sans dépendance distante.
- [ ] Exécuter tests composants et Playwright ciblé, puis committer.

## Chunk 6: Audits, packaging et CI

### Task 13: Audits et manifests

**Files:**
- Modify: `scripts/pre-rentree/document_audit.py`
- Modify: `scripts/pre-rentree/verify_release.py`
- Modify: `scripts/pre-rentree/verify_repository_hygiene.py`
- Modify: `scripts/pre-rentree/verify_reproducibility.py`
- Modify: `scripts/pre-rentree/package_documents.py`
- Modify: `scripts/pre-rentree/tests/test_*audit*.py`

- [ ] Écrire les tests RED pour prix, acomptes, 14/70/70/70, promesses, manuels, planning, packages et manifests.
- [ ] Ajouter scans secrets/PII/chemins locaux, contrôle de duplication et empreinte de l'arbre générateur.
- [ ] Distinguer revue visuelle automatisée, assistant et propriétaire.
- [ ] Vérifier les ZIP après compression et chaque fichier manifesté.
- [ ] Exécuter deux builds avec `SOURCE_DATE_EPOCH` identique et committer.

### Task 14: Commandes, lock et workflow

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/pre-rentree/requirements.lock`
- Modify: `.github/workflows/pre-rentree-documents.yml`
- Modify: `scripts/pre-rentree/README.md`

- [ ] Écrire/adapter les tests de contrat des commandes et du workflow.
- [ ] Épingler actions et dépendances, limiter les permissions et exécuter sur PR/branche/main.
- [ ] Ajouter les nouvelles sources aux triggers et les nouveaux audits au résumé CI.
- [ ] Exécuter le contrat workflow et committer.

## Chunk 7: Documentation et clôture

### Task 15: Documentation de campagne

**Files:**
- Modify: `docs/INDEX.md`
- Modify: `docs/campaigns/pre-rentree-2026/README.md`
- Modify: `docs/campaigns/pre-rentree-2026/SOURCE-OF-TRUTH-MAP.md`
- Modify: `docs/campaigns/pre-rentree-2026/PARENT-GUIDE-SOURCE-MAP.md`
- Modify: `docs/campaigns/pre-rentree-2026/RELEASE-PROCESS.md`
- Modify: `docs/campaigns/pre-rentree-2026/DECISIONS-REQUIRED.md`
- Modify: `docs/campaigns/pre-rentree-2026/CHANGELOG.md`

- [ ] Documenter sources, outputs, gates, manuels, staffing, capacités et procédure REVIEW/RELEASE.
- [ ] Ne conserver comme décisions ouvertes que propriétaire, juridique, confidentialité et engagements commerciaux réels.
- [ ] Corriger toute affirmation obsolète sur push/merge/déploiement.
- [ ] Exécuter les tests de documentation et committer.

### Task 16: Vérification finale, GitHub et rapport

**Files:**
- No production source expected unless a verification exposes a defect.

- [ ] Exécuter clean, snapshot, tests TS/Python, build, audit, package, verify, typecheck, tests Jest complets, sécurité, diff-check et statut Git.
- [ ] Rasteriser et inspecter toutes les pages ; consigner `ASSISTANT_VISUAL_REVIEW` sans usurper la revue propriétaire.
- [ ] Vérifier deux builds reproductibles et les SHA des ZIP.
- [ ] Lire chaque gate du cahier des charges et prouver son état.
- [ ] Committer les rapports sources nécessaires, pousser explicitement vers `nexus`, attendre la CI et vérifier le SHA distant.
- [ ] Maintenir la PR en brouillon, mettre à jour son corps et répondre au commentaire d'audit avec des preuves exactes.
