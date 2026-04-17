# Stages Phases 3-5 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completer les blocs auth, admin stages, pages publiques stages et tests API de reprise phases 3 a 5.

**Architecture:** Les comportements sont ajoutes par couches. D'abord l'authentification et l'activation pour fiabiliser le flux de confirmation stage, puis le CRUD admin et enfin les pages publiques qui consomment les contrats API existants. Les tests couvrent la logique pure et les routes critiques pour stabiliser l'ensemble.

**Tech Stack:** Next.js App Router, React client/server components, Prisma, NextAuth credentials, Zod, Jest.

---

## Chunk 1: Auth Stage Activation

### Task 1: Etendre le service d'activation

**Files:**
- Modify: `lib/services/student-activation.service.ts`
- Test: `__tests__/api/student.activate.route.test.ts`

- [ ] Ajouter d'abord les tests manquants pour couvrir les tokens issus de `StageReservation` et la redirection stage.
- [ ] Executer le sous-ensemble Jest cible et verifier l'echec.
- [ ] Implementer la verification/consommation multi-source sans casser le flux `User.activationToken`.
- [ ] Relancer les tests cibles.

### Task 2: Ajouter resend-activation

**Files:**
- Create: `app/api/auth/resend-activation/route.ts`
- Test: `__tests__/api/auth.resend-activation.route.test.ts`
- Reference: `app/api/auth/reset-password/route.ts`

- [ ] Ecrire la suite de tests anti-enumeration et rate limit memoire.
- [ ] Verifier qu'elle echoue.
- [ ] Implementer la route avec Zod, reponse neutre et envoi de mail non bloquant.
- [ ] Relancer les tests cibles.

### Task 3: Mettre a jour les pages signin/activate

**Files:**
- Modify: `app/auth/activate/page.tsx`
- Modify: `app/auth/signin/page.tsx`

- [ ] Ajouter le support `source=stage` et le formulaire inline de renvoi d'activation.
- [ ] Garder le flux standard intact.
- [ ] Verifier par `typecheck` puis par la batterie complete du bloc.

### Task 4: Verifier le bloc auth

- [ ] Run: `npm run typecheck`
- [ ] Run: `npm run lint`
- [ ] Run: `npm test`
- [ ] Run: `npm run build`

## Chunk 2: Admin Stages

### Task 5: Ecrire les tests d'API admin stages

**Files:**
- Create: `__tests__/api/admin.stages.route.test.ts`

- [ ] Couvrir GET/POST liste stages, detail, update, archive, sessions et coach assignments sur les cas critiques.
- [ ] Verifier les echecs.

### Task 6: Implementer les routes admin stages

**Files:**
- Create: `app/api/admin/stages/route.ts`
- Create: `app/api/admin/stages/[stageId]/route.ts`
- Create: `app/api/admin/stages/[stageId]/sessions/route.ts`
- Create: `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts`
- Create: `app/api/admin/stages/[stageId]/coaches/route.ts`

- [ ] Implementer les schemas Zod et guards role par role.
- [ ] Ajouter les validations de coach, dates et suppression logique.
- [ ] Relancer les tests d'API admin stages.

### Task 7: Ajouter la page dashboard admin stages

**Files:**
- Create: `app/dashboard/admin/stages/page.tsx`
- Modify: `components/navigation/navigation-config.ts`

- [ ] Reprendre le layout admin existant.
- [ ] Brancher la page sur les nouvelles routes via `fetch`.
- [ ] Ajouter l'entree de navigation admin.

### Task 8: Verifier le bloc admin

- [ ] Run: `npm run typecheck`
- [ ] Run: `npm run lint`
- [ ] Run: `npm test`
- [ ] Run: `npm run build`

## Chunk 3: Public Stages

### Task 9: Ecrire les tests de logique publique

**Files:**
- Create: `lib/stages/capacity.ts`
- Create: `__tests__/lib/stages/stage-capacity.test.ts`

- [ ] Ecrire les tests de statut de reservation.
- [ ] Verifier l'echec puis implementer la fonction pure.

### Task 10: Mettre a jour les routes publiques si necessaire

**Files:**
- Modify: `app/api/stages/[stageSlug]/inscrire/route.ts`
- Modify: `app/api/stages/route.ts`
- Modify: `app/api/stages/[stageSlug]/route.ts`

- [ ] Rebrancher l'inscription sur la fonction pure.
- [ ] Harmoniser les contrats retour attendus par les nouvelles pages.

### Task 11: Implementer le catalogue, le detail, l'inscription et le bilan dynamique

**Files:**
- Modify: `app/stages/page.tsx`
- Create: `app/stages/[stageSlug]/page.tsx`
- Create: `app/stages/[stageSlug]/inscription/page.tsx`
- Create: `app/stages/[stageSlug]/bilan/[reservationId]/page.tsx`

- [ ] Respecter le style landing/Corporate existant.
- [ ] Utiliser server components pour catalogue et detail.
- [ ] Utiliser un composant client pour le formulaire d'inscription.

### Task 12: Verifier le bloc public

- [ ] Run: `npm run typecheck`
- [ ] Run: `npm run lint`
- [ ] Run: `npm test`
- [ ] Run: `npm run build`

## Chunk 4: Stage API Test Coverage

### Task 13: Ajouter les suites Jest demandees

**Files:**
- Create: `__tests__/api/stages/inscriptions.test.ts`
- Create: `__tests__/api/stages/confirm.test.ts`
- Create: `__tests__/api/stages/stages-list.test.ts`

- [ ] Ecrire les cas listage, detail, inscription et confirmation.
- [ ] Mock auth, prisma, email et telegram selon les patterns du repo.

### Task 14: Stabiliser les contrats si les tests revelent un ecart

**Files:**
- Modify: routes stages concernees uniquement si necessaire

- [ ] Corriger les incoherences minimales exposees par Jest.
- [ ] Relancer les suites cibles puis la batterie complete.

### Task 15: Verification finale

- [ ] Run: `npm run typecheck`
- [ ] Run: `npm run lint`
- [ ] Run: `npm test`
- [ ] Run: `npm run build`
