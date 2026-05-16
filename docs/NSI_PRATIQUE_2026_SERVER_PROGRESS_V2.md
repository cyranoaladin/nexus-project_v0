# NSI Pratique 2026 — Server Progress V2

## État livré

La progression NSI pratique est synchronisée côté serveur avec `localStorage`
comme cache immédiat et fallback hors ligne.

## Modèle

Table Prisma : `nsi_practice_progress`.

- `userId` est unique et référence `users.id`.
- `data` contient le JSON `NsiProgress`.
- `updatedAt` sert de dernière synchronisation.
- La suppression utilisateur cascade vers sa progression.

## API élève

`GET /api/eleve/nsi-pratique-2026/progress`

- Authentification obligatoire.
- Rôle `ELEVE` obligatoire.
- Retourne uniquement la progression de `session.user.id`.
- Retourne `200 { data: null, updatedAt: null }` si aucune progression serveur.

`PUT /api/eleve/nsi-pratique-2026/progress`

- Authentification obligatoire.
- Rôle `ELEVE` obligatoire.
- Ignore tout identifiant client : `userId` vient toujours de la session.
- Valide le payload avec Zod.
- Limite le payload à 200 KB.
- Rejette les clés interdites : `userId`, `email`, `password`, `token`,
  `role`, `secret`, `apiKey`.
- Upsert dans `nsi_practice_progress`.

## API coach

`GET /api/coach/nsi-pratique-2026/students`

- Authentification obligatoire.
- Rôle `COACH` ou `ADMIN` obligatoire.
- Liste seulement les élèves assignés au coach avec `subjects` contenant `NSI`.
- Retourne un résumé de progression par élève.

`GET /api/coach/nsi-pratique-2026/students/[studentId]/progress`

- Authentification obligatoire.
- Rôle `COACH` ou `ADMIN` obligatoire.
- `404` si l'élève n'existe pas.
- `403` si le coach n'est pas assigné.
- `200 { data: null }` si l'élève assigné n'a pas encore de progression.

## Synchronisation client

Le hook `useNsiProgress` :

- charge `localStorage` immédiatement après montage client ;
- attend l'état d'authentification ;
- récupère la progression serveur si l'élève est authentifié ;
- fusionne progression locale et serveur ;
- migre automatiquement une progression locale vers le serveur si le serveur est vide ;
- sauvegarde localement à chaque modification ;
- sauvegarde côté serveur avec debounce de 1500 ms ;
- expose `syncStatus` et `lastSyncedAt`.

## RBAC

- Un élève lit et écrit uniquement sa propre progression.
- Un coach lit uniquement les élèves NSI qui lui sont assignés.
- Un coach non assigné reçoit `403`.
- Les pages dashboard restent protégées par le middleware d'authentification.
