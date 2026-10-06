# Espace pédagogique Terminale — rapport de mission

## Date

2026-10-02

## Contexte

Transformer le prototype du TP POO (module autonome sous `/ateliers/poo/`) en espace pédagogique intégré à `nexus-project_v0` : connexion sans email pour les élèves, tableau de bord, TP avec sauvegarde automatique, remise, suivi et correction côté enseignant, module de Maths, et pont manuel vers l'archive historique. Architecture : `docs/espace/ARCHITECTURE.md`. Exploitation : `docs/espace/RUNBOOK.md`. Déploiement : `docs/espace/DEPLOIEMENT.md`.

## Problèmes observés

1. **Le legacy ne contient aucune trace.** `traces.sqlite3` : 0 dépôt ; les 7 sauvegardes quotidiennes aussi ; les seules écritures (26/09) sont 8 dépôts de test supprimés dans la minute, aucun trafic élève. Les identifiants `POO01…` sont des valeurs d'un champ libre `alias`, jamais stockées côté serveur. Le travail d'éventuels élèves, s'il existe, est dans leur navigateur ou dans des fichiers JSON hors serveur. (`docs/legacy-poo/LEGACY_POO_INVENTORY.md`)
2. **Risque d'effacement dans le legacy** : purge à 90 jours + rotation de 14 sauvegardes. Non modifié (aucune donnée en jeu).
3. **La prod n'est pas `main`** : release `724f8982d`, 653 commits / 18 migrations derrière.
4. **`prisma migrate deploy` échouerait en prod** : 3 migrations marquées « annulées » dont les effets existent déjà (reproduit en simulation, P3018).
5. **Identités réelles ambiguës** : deux comptes COACH « Alaeddine BEN RHOUMA » ; cinq élèves de la liste existent déjà (dont un en double, et deux en attente d'activation familiale).
6. L'authentification n'avait ni identifiant sans email ni garde utilisable sans email (`requireAuth` exige un email) ; `Student.parentId` est obligatoire.
7. L'arbre de travail courant était sale (109 modifiés) : tout le travail s'est fait dans un worktree dédié.

## Décisions prises

- Fournisseur NextAuth `espace` distinct (flux email inchangé), `User.username` + `User.pinHash`, élèves sans ligne `Student`, enseignant = rôle `COACH` existant, `Subject` existant (`MATHS` = `MATHEMATIQUES`).
- Autosave à révision optimiste (verrou en SQL), rejeu idempotent, file locale IndexedDB, conflit explicite sur la même étape.
- Corrigés jamais servis aux élèves (404 uniforme) ; fichiers privés, type lu dans les octets.
- Pont legacy : lecture seule, dry-run, jeton de confirmation, refus des cas ambigus ; association par **CLI uniquement** (le répertoire legacy est `0700 nexus-poo`, l'application web ne peut pas — et ne doit pas — y écrire).
- Liste réelle des élèves (mineurs) **hors Git** ; le dépôt n'embarque qu'un exemple fictif.
- Adoption d'un compte existant : jamais silencieuse ; un compte « en attente d'activation » exige une décision écrite (`activatePending`), car l'adopter neutraliserait le lien d'activation de la famille.
- Déploiement : **non exécuté** (voir risques) ; plan et décisions dans `DEPLOIEMENT.md`.

## Fichiers modifiés

Création (hors tests) : `lib/espace/**` (domaine, services, client), `lib/auth/espace-authorize.ts`, `app/api/espace/**` (19 routes), `app/espace/**` (pages élève, enseignant, connexion), `components/espace/**`, `content/espace/nsi-poo/**`, `scripts/espace/**` (provision, legacy-poo, install-resources), `prisma/migrations/20261002210000_add_espace_pedagogique`, `docs/espace/**`, `docs/legacy-poo/**`.

Modifications de l'existant (toutes additives ou de classement) : `prisma/schema.prisma` (+294, −0), `auth.ts` (second fournisseur, après le premier), `middleware.ts` (`/espace`), `lib/security-headers.ts` (`connect-src` jsdelivr), `lib/rate-limit/{runtime,sensitive}.ts` (presets et scopes), `app/robots.ts`, `next.config.mjs` (trace de `runner.py`), `data/security/account-deletion-fk-manifest.json` (+10 clés classées), `lib/security/account-deletion-guard.ts` (libellés), `scripts/audit/site-map.mjs` (zone authentifiée `/espace`), `.github/workflows/ci.yml` (suites real-DB), et listes blanches de garde-fous d'architecture existants (vouvoiement, charte lux, autorité de session, inventaire des mutations `User`).

## Tests exécutés

| Commande | Résultat |
|---|---|
| `npm run typecheck` | 0 erreur |
| `npm run lint` | sortie 0 ; ESLint `--max-warnings 0` sur tous les fichiers de l'espace : 0 alerte |
| `jest.unit.config.js` (complet, `-w 4`) | 1 283 suites, 14 415 tests, 0 échec |
| Intégration (vraie base) `__tests__/integration/espace-*` | 107 tests, 5 suites |
| Garde `test:lanes:check` | « Aucun fichier de test orphelin » |
| Vérité terrain `db:check-account-deletion-fk-manifest` | `DB_FKS == MANIFEST_FKS`, PASS |
| E2E Chromium sur build de production | 14 / 14 en `V1_ONLY` et en `HYBRID` ; 14 / 14 sur la release de prod portée |
| `next build` | OK (TP POO : 141 kB de JS initial ; correction : 116 kB) |

## Résultats

- Fonctions couvertes et leur preuve : voir le tableau du rapport final (connexion, session, tableaux de bord, TP, autosave, hors connexion, versionnage, remise, correction, annotations, Maths, pont legacy).
- Performance : nombre de requêtes SQL **constant** (3 ou 30 élèves) et colonne `content` jamais chargée dans les listes (`espace-queries.real.test.ts`).
- Sécurité : IDOR (404 indiscernable), élève sur routes enseignant (403), corrigé interdit, CSRF (Origin + JSON), compte désactivé immédiatement refusé, dépôts malveillants refusés, XSS (texte échappé).
- Accessibilité : 0 violation axe (corrigées : liste de définitions mal formée, ordre des titres, libellés englobant les options d'un `select`).
- Défauts réels trouvés et corrigés pendant la mission : course sur l'ouverture d'un travail (`upsert` non atomique, mesuré en échec), 9 incohérences de garde-fous du dépôt, 3 défauts d'accessibilité, homonymes et activation familiale dans le provisioning.

## Risques restants

1. **Déploiement non fait** : décisions requises (base A/B, comptes ambigus, adoptions) — `DEPLOIEMENT.md` §3.
2. **`CORE_V2_AUTH_MODE=V2_ONLY` incompatible** avec les identités de l'espace (déduit du code, non testé).
3. **Pyodide** dépend de `cdn.jsdelivr.net` (≈ 10 Mo au premier chargement) ; un test E2E l'exerce réellement mais reste tributaire du réseau.
4. **Aucun élève n'a travaillé sur cette plateforme** : la qualité pédagogique réelle (rythme, ergonomie en classe) n'est pas évaluée.
5. Un test statique du dépôt (`npc-storage-contract`) reçoit parfois un `SIGTERM` de worker en parallélisme maximal sur cette machine ; il passe seul et à 4 workers (non lié à la mission).
6. 3 suites échouent déjà sur la release de prod (`aria/context`, `session-booking`, `validate-npm-tree`), à l'identique sans l'espace.

## Rollback

Applicatif : rebasculer la release précédente. **Ne jamais supprimer** `espace_*` ni les colonnes de `users` (travaux d'élèves). Détail : `docs/espace/DEPLOIEMENT.md` §6 et `docs/espace/RUNBOOK.md` §6.
