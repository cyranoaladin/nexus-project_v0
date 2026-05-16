# NSI Pratique 2026 — Production Runbook

## 1. Routes élève
Interface accessible aux rôles `ELEVE` :
- `/dashboard/eleve/nsi-pratique-2026` : tableau de bord de progression NSI pratique.

## 2. Routes coach
Interface accessible aux rôles `COACH` et `ADMIN` :
- `/dashboard/coach/nsi-pratique-2026` : vue cohorte des élèves et leur progression.

## 3. API élève
Endpoints authentifiés (NextAuth + RBAC `ELEVE`) :
- `GET /api/eleve/nsi-pratique-2026/progress` : retourne la progression de l'utilisateur connecté.
- `PUT /api/eleve/nsi-pratique-2026/progress` : persiste la progression côté serveur.
  - Contrainte : le payload est strictement typé. Toute tentative d'injection de champ `userId`, `password`, `token`, `hash` ou `secret` doit être rejetée avec un `400 Bad Request`.

## 4. API coach
Endpoints authentifiés (NextAuth + RBAC `COACH`/`ADMIN`) :
- `GET /api/coach/nsi-pratique-2026/students` : liste des élèves du coach connecté avec aperçu de leur progression.
- `GET /api/coach/nsi-pratique-2026/students/{studentId}/progress` : détail complet de la progression d'un élève spécifique.
  - Contrainte : un coach ne peut consulter que les élèves qui lui sont rattachés.

## 5. Table Prisma
Nom de table cible : `nsi_practice_progress`

Schéma opérationnel (extrait logique) :
