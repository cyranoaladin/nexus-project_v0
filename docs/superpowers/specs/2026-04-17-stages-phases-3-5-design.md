# Stages Phases 3-5 Design

**Date:** 2026-04-17

## Goal

Completer la reprise des phases 3 a 5 du module stages sans casser les flux existants: administration CRUD, catalogue public et detail dynamique, inscription publique, activation de compte liee aux stages, puis couverture Jest des routes principales.

## Constraints

- Conserver les patterns UI et dashboard deja en place.
- Ne pas introduire de nouvelle dependance UI ou state client persistante.
- Conserver la retrocompatibilite des routes et pages existantes, notamment `fevrier-2026`.
- Verifier `typecheck`, `lint`, `test` et `build` apres chaque bloc.

## Existing Architecture

- Les routes publiques stages existent deja sous `app/api/stages/*`.
- La confirmation d'une reservation de stage genere deja un lien `auth/activate?token=...&source=stage`.
- Le flux d'activation standard repose sur `app/api/student/activate` et `lib/services/student-activation.service.ts`.
- Les dashboards stages eleve, parent, coach et assistante utilisent deja `WeeklyCalendar`, `StageBilanCard` et `StageReservationStatus`.
- La navigation dashboard est centralisee dans `components/navigation/navigation-config.ts`.

## Proposed Changes

## 1. Authentication

- Ajouter une route publique `POST /api/auth/resend-activation` avec anti-enumeration, rate limiting memoire simple et reemploi du template mail existant.
- Adapter la page `app/auth/activate/page.tsx` pour:
  - personnaliser le message si `source=stage`
  - rediriger apres succes vers `/dashboard/eleve/stages` pour ce cas
  - conserver strictement le comportement standard sinon
- Adapter `app/auth/signin/page.tsx` pour garder le message credentials standard, mais ajouter un flux inline "Compte non active ?" branchant sur `resend-activation`.
- Etendre le service d'activation pour accepter les tokens issus de `StageReservation.activationToken` en plus des tokens `User.activationToken`.

## 2. Admin Stages

- Creer les routes admin suivantes:
  - `app/api/admin/stages/route.ts`
  - `app/api/admin/stages/[stageId]/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts`
  - `app/api/admin/stages/[stageId]/coaches/route.ts`
- Respecter les guards `requireRole` et `requireAnyRole` avec les signatures existantes.
- Exposer un contrat d'administration complet: listing avec KPIs, detail stage, CRUD souple, archivage logique, sessions et assignments coachs.
- Ajouter une page `app/dashboard/admin/stages/page.tsx` basee sur le pattern dashboard client existant avec `DashboardPilotage`, `Card`, `Tabs`, `Button`, `Table`, `Dialog/Modal`.
- Ajouter l'entree correspondante a la navigation admin.

## 3. Public Stages

- Remplacer `app/stages/page.tsx` par un catalogue server-side base sur `/api/stages`.
- Ajouter `app/stages/[stageSlug]/page.tsx` pour le detail dynamique avec SEO server-side.
- Ajouter `app/stages/[stageSlug]/inscription/page.tsx` comme formulaire client en 3 etapes avec validation Zod et soumission vers `/api/stages/[slug]/inscrire`.
- Ajouter `app/stages/[stageSlug]/bilan/[reservationId]/page.tsx` en reprenant le pattern dynamique du bilan `fevrier-2026`.
- Garder `fevrier-2026` intacte et toujours accessible.

## 4. Testing

- Extraire une fonction pure `computeReservationStatus` dans `lib/stages/capacity.ts`.
- Couvrir:
  - inscription publique
  - confirmation de reservation
  - listing/detail des stages
  - logique pure de capacite
- Suivre les patterns Jest existants: mock `@/auth`, `@/lib/prisma`, email et Telegram.

## Data Flow

- Public inscription:
  - lecture stage visible et ouvert
  - anti-doublon par email/stage
  - calcul du statut en fonction de la capacite
  - creation reservation
  - email + Telegram non bloquants
- Admin confirmation:
  - validation auth staff
  - confirmation reservation
  - creation utilisateur eleve si necessaire
  - generation token activation stage
  - envoi du mail d'activation
- Activation:
  - verification uniforme du token utilisateur ou reservation stage
  - affectation du mot de passe et activation du compte
  - invalidation du token consomme

## Error Handling

- 400 pour payload ou query invalides
- 401/403 pour auth admin/staff
- 404 pour stage ou reservation introuvable/inaccessible
- 409 pour doublon d'inscription, reservation deja confirmee, suppression interdite si inscrits confirmes
- reponses de `resend-activation` toujours neutres pour eviter l'enumeration

## Testing Strategy

- TDD sur les ajouts API/auth et sur la logique pure.
- Validation fonctionnelle UI via `typecheck`, `lint`, `build`.
- Les pages client s'appuient sur des contrats API testables plutot que sur une logique complexe locale.
