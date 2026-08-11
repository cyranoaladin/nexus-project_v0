# Bilans : nom réel au rendu et revue assistante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Afficher le vrai nom de l’élève uniquement dans l’en-tête HTML/PDF des trois audiences, fournir à l’assistante les PDF de revue et rendre le workflow de saisie papier lisible, sans modifier les matérialisations historiques ni l’identité pseudonyme canonique.

**Architecture:** Le moteur continue de recevoir exclusivement la `RenderIdentity` pseudonyme issue du snapshot. Une identité humaine de présentation, construite depuis `student.user.firstName/lastName`, est injectée séparément après le rendu déterministe du contenu et utilisée uniquement par l’en-tête HTML/PDF. La route de revue staff génère à la demande un PDF privé et non persisté pour une révision en attente. Les comptes synthétiques sont exclus de la recherche par une politique centralisée appliquée aux deux identités du foyer.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Prisma/PostgreSQL, Jest/Testing Library, Playwright/Chromium pour le PDF.

---

## Chunk 1: Verrouiller les frontières d’identité au rendu

### Task 1: Tests rouges — alias canonique et nom humain dans les trois audiences

**Files:**
- Modify: `__tests__/bilans/render-identity-pseudonymity.test.ts`
- Modify: `__tests__/bilans/report-materialization.test.ts`
- Modify: `__tests__/bilans/render-pdf.test.ts`

- [ ] Ajouter un test qui conserve `ELEVE_XXXX` dans le snapshot, la FactSheet et la révision, puis vérifie le vrai prénom/nom uniquement dans l’en-tête HTML pour `ELEVE`, `PARENTS` et `NEXUS`.
- [ ] Ajouter un test de matérialisation prouvant que le moteur reçoit toujours l’alias alors que le document généré reçoit séparément l’identité humaine.
- [ ] Ajouter au test PDF réel la chaîne exacte `é à è ê ç`, l’extraire du PDF et vérifier sa présence exacte.
- [ ] Exécuter les trois fichiers ciblés et constater un échec dû à l’absence de l’identité humaine séparée.

### Task 2: Implémenter l’identité humaine de présentation

**Files:**
- Create: `lib/bilans/render/human-identity.ts`
- Modify: `lib/bilans/render/html.ts`
- Modify: `lib/bilans/render/pdf.ts`
- Modify: `lib/bilans/render/render-identity.ts`
- Modify: `lib/bilans/core/report-materialization.ts`
- Modify: `lib/bilans/core/report-service.ts`

- [ ] Créer un type minimal `HumanRenderIdentity` et un constructeur normalisant prénom et nom depuis la fiche utilisateur de l’élève.
- [ ] Garder `buildDeterministicReport` et sa validation pseudonyme inchangés ; substituer l’identité humaine uniquement lors de la construction de l’en-tête HTML.
- [ ] Propager l’identité humaine comme paramètre de présentation distinct dans les chemins HTML/PDF et de matérialisation.
- [ ] Charger `student.user.firstName/lastName` dans les services de prévisualisation et de publication, sans écrire ces valeurs dans le snapshot, la FactSheet ou la révision.
- [ ] Exécuter les tests ciblés jusqu’au vert.
- [ ] Commit: `feat: projeter le vrai nom dans les rendus de bilan`

## Chunk 2: PDF de revue staff par audience

### Task 3: Tests rouges — accès, audiences, prévisualisation et téléchargement

**Files:**
- Create: `__tests__/bilans/staff-review-pdf-route.test.ts`
- Modify: `__tests__/bilans/staff-review-surface.test.ts`

- [ ] Tester `ELEVE`, `PARENTS` et `NEXUS`, le mode inline par défaut et `download=1` en pièce jointe.
- [ ] Tester `Content-Type: application/pdf`, `Cache-Control: private, no-store` et un nom de fichier sûr.
- [ ] Tester qu’une assistante peut rendre une révision en attente, tandis qu’un parent, un élève, une audience invalide ou une révision non révisable ne reçoit aucun document.
- [ ] Tester la présence des deux actions « Prévisualiser le PDF » et « Télécharger le PDF » sur chaque audience.
- [ ] Exécuter les tests ciblés et constater l’absence de la route et des actions.

### Task 4: Implémenter la route et les actions de revue

**Files:**
- Create: `app/dashboard/assistante/bilans/[revisionId]/document/[audience]/route.ts`
- Modify: `lib/bilans/staff/review-service.ts`
- Modify: `lib/bilans/core/report-service.ts`
- Modify: `app/dashboard/assistante/bilans/page.tsx`

- [ ] Ajouter un service staff qui vérifie le rôle `ASSISTANTE`, la révision en attente et l’audience, puis génère le PDF à la volée sans persistance.
- [ ] Retourner le PDF privé avec une disposition inline ou attachment selon `download=1`.
- [ ] Ajouter les deux actions par audience dans la zone de revue, sans élargir la route publique publiée.
- [ ] Exécuter les tests de route et de surface jusqu’au vert.
- [ ] Commit: `feat: ajouter les pdf de revue assistante`

## Chunk 3: Recherche propre et workflow cinq étapes

### Task 5: Tests rouges — exclusion des comptes synthétiques et navigation réelle

**Files:**
- Create: `__tests__/bilans/test-account-filter.test.ts`
- Modify: `__tests__/bilans/saisie-papier-workflow.test.tsx`
- Modify: `__tests__/bilans/saisie-papier-page-access.test.tsx`

- [ ] Tester tous les motifs d’exclusion : `@example.test`, `@invalid.residual`, `smoke`, `DO_NOT_USE`, `residual`, et l’adresse exacte `parent-technique@nexusreussite.academy`.
- [ ] Tester que l’exclusion s’applique à l’e-mail élève comme à l’e-mail parent et qu’un foyer réel reste visible.
- [ ] Tester les cinq états atteignables : sélection/création du foyer, ajout/sélection de l’enfant, matière, saisie, validation.
- [ ] Tester les retours arrière et la recherche réactive par nom d’élève/e-mail parent.
- [ ] Exécuter les tests ciblés et constater les échecs attendus.

### Task 6: Implémenter la politique de recherche et le workflow

**Files:**
- Create: `lib/bilans/saisie-papier/test-account-filter.ts`
- Create: `components/bilans/PaperEntryStudentSearch.tsx`
- Modify: `app/dashboard/assistante/bilans/saisie-papier/page.tsx`
- Modify: `components/bilans/PaperEntryWorkflowSteps.tsx`
- Modify: `components/bilans/PaperEntryGrid.tsx`

- [ ] Centraliser les motifs d’exclusion et les traduire en filtre Prisma, puis appliquer une défense côté projection aux deux membres du foyer.
- [ ] Ne jamais supprimer ni modifier les comptes concernés.
- [ ] Rendre la recherche réactive avec un délai court et conserver un bouton de soumission accessible.
- [ ] Faire correspondre chaque état URL/formulaire à une étape réelle et proposer des retours explicites vers les étapes précédentes.
- [ ] Afficher l’étape 5 lorsque toutes les réponses sont complètes, avant la validation définitive.
- [ ] Exécuter les tests ciblés jusqu’au vert.
- [ ] Commit: `feat: fluidifier la saisie papier assistante`

## Chunk 4: Vue récente, audit et non-régression

### Task 7: Tests rouges — états lisibles, cartes sans JSON brut

**Files:**
- Modify: `__tests__/bilans/staff-review-surface.test.ts`
- Modify: `__tests__/bilans/staff-review-service.test.ts`

- [ ] Tester les libellés exacts `En attente de diffusion`, `Diffusé` et `Rejeté`.
- [ ] Tester qu’une carte affiche le nom de l’élève et son état, mais jamais le JSON brut de la révision.
- [ ] Tester que seules les révisions en attente exposent les contrôles valider/rejeter et les PDF de revue.
- [ ] Exécuter les tests ciblés et constater les échecs attendus.

### Task 8: Implémenter la vue récente et produire l’artefact d’exclusion

**Files:**
- Modify: `lib/bilans/staff/review-service.ts`
- Modify: `app/dashboard/assistante/bilans/page.tsx`
- Create: `docs/audits/2026-08-09-bilans-assistante-comptes-exclus.md`

- [ ] Charger une vue récente bornée avec l’élève associé et dériver un statut de présentation stable.
- [ ] Remplacer le JSON brut par des cartes navy/or lisibles : élève, matière, date, origine, état.
- [ ] Garder les contrôles de décision uniquement pour les éléments révisables.
- [ ] Documenter les 11 comptes recensés, les motifs, la date et l’absence totale de suppression.
- [ ] Exécuter les tests de surface/service jusqu’au vert.
- [ ] Commit: `feat: clarifier la file de bilans assistante`

## Chunk 5: Vérification complète, rendu visuel et PR

### Task 9: Vérifications sans filtre

**Files:**
- Modify if needed: `docs/audits/2026-08-09-bilans-assistante-comptes-exclus.md`

- [ ] Vérifier qu’aucune migration Prisma n’a été créée et que les trois matérialisations historiques ne font l’objet d’aucune réécriture.
- [ ] Lancer `npm run lint`.
- [ ] Lancer `npm run typecheck`.
- [ ] Lancer la suite complète sans filtre : `env -u DATABASE_URL -u DIRECT_URL -u OPENROUTER_API_KEY -u DOCUMENT_ENCRYPTION_KEY -u CANDIDAT_LIBRE_ENABLED NEXTAUTH_URL=http://localhost:3000 npm run test -- --runInBand`.
- [ ] Lancer `npm run build` dans le même environnement neutralisé.
- [ ] Vérifier la surface avec Playwright et produire des captures des écrans modifiés, sans données personnelles réelles.
- [ ] Inspecter le diff, lancer une revue de code finale et corriger toute régression trouvée.

### Task 10: Publier la PR sans merge

- [ ] Confirmer le périmètre des commits et l’absence de secrets/artefacts temporaires.
- [ ] Pousser `feat/bilans-real-name-pdf-assistante`.
- [ ] Ouvrir une PR vers `main` avec le rapport d’audit, les tests, les captures et le rollback applicatif.
- [ ] Demander l’approbation de `abenrhouma` si GitHub l’autorise ; ne pas fusionner.
- [ ] Attendre les contrôles CI et corriger sur la même branche jusqu’à obtention du vert.
