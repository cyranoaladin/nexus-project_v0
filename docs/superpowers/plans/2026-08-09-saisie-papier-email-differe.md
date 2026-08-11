# Saisie papier avec e-mail parent différé Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'assistante de créer, saisir, générer et revoir un bilan papier avec téléphone parent obligatoire mais sans e-mail, puis de compléter le contact et diffuser sans modifier le snapshot du bilan.

**Architecture:** `User.id` reste l'identité ; `email`, `phone` et `phoneNormalized` sont des attributs. La création de foyer orchestre une suggestion de doublon à décision humaine, tandis qu'un service séparé complète ou rattache ultérieurement le compte parent. La readiness de diffusion est dérivée du foyer et contrôlée côté écran comme côté service.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma, PostgreSQL, Zod, Jest, Testing Library, Playwright.

---

## Chunk 1: Données et création du foyer

### Task 1: Téléphone parent canonique

**Files:**
- Create: `lib/contact/parent-phone.ts`
- Create: `__tests__/lib/contact/parent-phone.test.ts`

- [ ] Écrire des tests rouges pour `99 19 28 29`, `+216 99 19 28 29`, `00216...`, le champ d'affichage et les formats invalides.
- [ ] Exécuter `jest __tests__/lib/contact/parent-phone.test.ts --runInBand` et confirmer l'échec d'import attendu.
- [ ] Implémenter le parseur minimal qui retourne `{ display, normalized }` avec huit chiffres locaux.
- [ ] Rejouer le test ciblé et confirmer le vert.

### Task 2: Migration e-mail nullable et téléphone normalisé

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260809090000_deferred_parent_email/migration.sql`
- Create: `__tests__/bilans/deferred-parent-email-migration.test.ts`
- Create or modify: `__tests__/integration/deferred-parent-email.real.test.ts`

- [ ] Écrire le test source rouge : `User.email` nullable, `phoneNormalized` indexé, migration additive sans suppression de l'index unique.
- [ ] Exécuter le test ciblé et vérifier qu'il échoue sur le schéma actuel.
- [ ] Modifier le schéma et ajouter la migration `DROP NOT NULL`, colonne nullable, backfill prudent et index.
- [ ] Exécuter `prisma format`, `prisma generate`, puis le test source.
- [ ] Écrire le test PostgreSQL rouge qui crée plusieurs utilisateurs à e-mail nul et refuse un doublon non nul.
- [ ] Déployer les migrations sur le clone de test et rejouer ce test en vert.

### Task 3: Création sans e-mail, téléphone obligatoire et doublons humains

**Files:**
- Modify: `lib/bilans/saisie-papier/famille.ts`
- Modify: `app/dashboard/assistante/bilans/saisie-papier/family-form.tsx`
- Modify: `app/dashboard/assistante/bilans/saisie-papier/page.tsx`
- Modify: `__tests__/bilans/saisie-papier-famille.test.ts`
- Modify: `__tests__/bilans/saisie-papier-workflow.test.tsx`

- [ ] Écrire les tests rouges API : e-mail absent accepté, téléphone absent/invalide refusé, téléphone normalisé enregistré, aucune activation sans e-mail, flux avec e-mail inchangé.
- [ ] Exécuter les tests ciblés et relever les échecs attendus.
- [ ] Adapter le schéma Zod, les écritures parent/enfant et la mise en file conditionnelle.
- [ ] Rejouer les tests API en vert.
- [ ] Écrire les tests rouges de suggestion sur téléphone normalisé et sur prénom+nom+niveau, sans écriture ni rattachement automatique.
- [ ] Implémenter la projection des candidats et les décisions `ATTACH`/`CREATE_NEW`, revalidées côté serveur.
- [ ] Rejouer les tests API en vert.
- [ ] Écrire les tests rouges du formulaire : téléphone obligatoire, e-mail facultatif, message de suggestion et deux décisions.
- [ ] Adapter l'interface et les libellés de la page, puis rejouer les tests UI.

## Chunk 2: Contact différé et diffusion

### Task 4: Complétion ou rattachement du compte parent

**Files:**
- Create: `lib/bilans/staff/parent-contact-service.ts`
- Modify: `app/dashboard/assistante/bilans/actions.ts`
- Create: `__tests__/bilans/parent-contact-service.test.ts`

- [ ] Écrire un test rouge pour l'ajout d'une adresse libre : mise à jour du parent, activation en file et aucun update de snapshot.
- [ ] Implémenter la complétion transactionnelle minimale et l'action serveur staff-only.
- [ ] Rejouer le test en vert.
- [ ] Écrire un test rouge pour une adresse portée par un parent existant : rattachement de tous les élèves, aucun nouvel utilisateur, consentements régénérés.
- [ ] Implémenter ce rattachement et le refus d'un rôle incompatible.
- [ ] Rejouer les tests en vert.
- [ ] Ajouter le test d'intégration append-only qui compare contenu/checksum/révision/artefact avant et après.

### Task 5: Readiness et garde-fou de diffusion

**Files:**
- Modify: `lib/bilans/staff/review-service.ts`
- Modify: `app/dashboard/assistante/bilans/page.tsx`
- Modify: `__tests__/bilans/staff-review-surface.test.ts`

- [ ] Écrire les tests rouges pour l'état `Prêt — e-mail parent manquant`, le compteur, le bouton désactivé et la possibilité de prévisualiser.
- [ ] Ajouter le contact parent à la sélection Prisma et dériver `parentEmailMissing`/`diffusable` sans modifier le state machine canonique.
- [ ] Rejouer les tests de surface en vert.
- [ ] Écrire le test rouge qui appelle directement `validateAndPublishPendingReport` sans e-mail et vérifie que ni `validate` ni `publish` ne sont appelés.
- [ ] Ajouter le garde-fou serveur avant toute mutation puis rejouer le test.
- [ ] Brancher le formulaire « Ajouter l'e-mail du parent », revalider la page et vérifier que la diffusion devient disponible après complétion.

## Chunk 3: Non-régression, documentation et PR

### Task 6: Parcours canonique et parité

**Files:**
- Modify as needed: `__tests__/bilans/saisie-papier-parite.test.ts`
- Modify as needed: `__tests__/bilans/saisie-papier-provenance-migration.test.ts`
- Modify as needed: relevant integration tests under `__tests__/integration/`

- [ ] Ajouter ou préciser les assertions : `SAISIE_PAPIER` reste posé à l'INSERT, score identique, génération plancher sans e-mail, passation en ligne inchangée.
- [ ] Lancer toutes les suites bilans ciblées sans motif de filtre dans les suites elles-mêmes.
- [ ] Corriger uniquement les régressions introduites, sans toucher au scoring ni au candidat libre.

### Task 7: Audit et vérification complète

**Files:**
- Create: `docs/audits/2026-08-10-saisie-papier-email-differe.md`

- [ ] Documenter chemins audités, contraintes, décisions, migration, états d'écran, tests, risques et rollback.
- [ ] Lancer `npm run lint` et `npm run typecheck` avec `.env` neutralisé.
- [ ] Lancer la suite unitaire complète `npm test -- --runInBand` avec LLM et candidat libre désactivés.
- [ ] Lancer la suite d'intégration complète sur PostgreSQL clonable, sans filtre.
- [ ] Lancer le build de production neutralisé.
- [ ] Lancer les tests Playwright pertinents ou documenter précisément l'impossibilité.
- [ ] Inspecter `git diff --check`, le diff complet, le statut et l'absence de secrets.

### Task 8: Publication de la branche sans merge

**Files:**
- No product file.

- [ ] Créer des commits intentionnels uniquement avec les fichiers de cette tâche.
- [ ] Pousser `agent/saisie-papier-email-differe` sans force.
- [ ] Ouvrir une seule PR basée sur `main`, mentionnant la dépendance déjà satisfaite à #115, la migration et l'absence de déploiement.
- [ ] Demander la revue de `abenrhouma`.
- [ ] Ne pas merger et ne rien déployer.
