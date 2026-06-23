# Clôture du LOT 9 — Vraie Couverture & Sécurité

**Date de clôture :** 2026-04-23
**Statut :** CLOSED

## Résumé de l'exécution

Le LOT 9 a été scindé en 3 étapes critiques pour refermer la boucle de sécurité, passant d'une couverture trompeuse (tests mockés) à une isolation prouvée par le moteur de base de données et l'UI E2E.

### 1. Preuves API (Étape 1)
- L'isolation des lectures et écritures sur les bilans par les coachs (`/api/stages/[stageSlug]/bilans`) a été testée et prouvée. Un coach ne peut interagir qu'avec ses propres stages.

### 2. Preuves BDD Réelles (Étape 2)
L'utilisation stricte d'une base PostgreSQL (non mockée via Prisma) a permis de valider :
- **IDOR Parentalité (`activate-student`) :** Un parent authentifié se voit refuser en BDD l'activation d'un élève s'il ne possède pas la clé étrangère valide (`parentId`).
- **IDOR Ownership (`predict SSN`) :** Seuls les coachs avec une séance liée (`SessionBooking`) ou les parents légitimes peuvent déclencher la prédiction SSN d'un élève.
- **Correction d'incohérence métier :** Le test DB a révélé une faille réelle dans le code métier (`predict/route.ts`), qui interrogeait le modèle `SessionBooking` avec un `coachProfile.id` au lieu du `session.user.id` exigé par le schéma Prisma. Le bug est désormais corrigé.

### 3. Preuve E2E Navigateur (Étape 3)
- Création du test Playwright `coach-stage-bilans.spec.ts` exécuté **avec le middleware réellement actif** (suppression de `SKIP_MIDDLEWARE=true`).
- Vérifie le non-contournement de la logique applicative via manipulation d'URL UI. Un coach tentant d'accéder à la page bilan d'un stage non assigné est strictement bloqué (redirection ou message d'erreur).
- Séparation stricte de rôle prouvée : le middleware Next.js bloque nativement une session `student` naviguant vers `/dashboard/coach`.

## Surfaces désormais réellement protégées
- L'intégrité pédagogique (assignations de stage).
- Le compte élève (activation parentale fermée).
- L'ownership et le déclenchement de la machinerie ML (SSN Predict).

## Dette résiduelle (Hors Scope)
Les points T5 (passage à 100% de la suite Jest en mode DB réel), T7 (tests RAG/LLM) et T10 (tests de secrets en CI) n'ont pas été traités dans ces trois étapes, le focus absolu ayant été mis sur les P0 de sécurité IDOR et RBAC. Ils feront l'objet de routines CI futures.
