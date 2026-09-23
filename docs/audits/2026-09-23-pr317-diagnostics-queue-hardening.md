# PR #317 — Durcissement de la file des diagnostics candidats libres

## Date

23 septembre 2026

## Contexte

La PR #317 ajoute une file opérationnelle Core v2 pour retrouver les dépôts de diagnostics candidats libres. Une première revue a identifié quatre risques bloquants : exposition de versions supplantées, pagination instable, projection candidat trop large et matérialisation complète de l'historique en mémoire. La qualification finale doit également prouver le parcours ADMIN réel, sans exposer de données académiques confidentielles.

Branche qualifiée : `feat/admin-diagnostics-queue`.

Commits fonctionnels examinés :

- `cb05f63db` — contrat canonique de soumission courante et projection candidat minimale ;
- `a17a54428` — requête SQL bornée sur la soumission courante ;
- `ef07c3c29` — validation stricte des lignes SQL brutes ;
- `7635ceddb`, `04f6f4367`, `8e9fb0940` — curseur keyset opaque, validation canonique et métadonnée de fraîcheur ;
- `1825859b2` — remplacement des listes périmées et déduplication client ;
- `fdb311cd7`, `c373025ca`, `9f6031066` — preuve Playwright et durcissement de sa frontière de données ;
- `f4a4873b8` — collecte CI du test gardé avec identité de base jetable explicite.

## Problèmes observés

- Une attribution pouvait exposer plusieurs versions comme tâches opérationnelles alors qu'une seule soumission courante doit être actionnable.
- Une version `REJECTED` plus récente ne doit ni supplanter la dernière version utilisable, ni devenir une tâche si elle est le seul historique.
- La pagination par recherche de ligne puis découpage pouvait repartir silencieusement au début après mutation du jeu de données.
- La file n'a besoin que de l'identité minimale du candidat ; les coordonnées, états de compte, métadonnées utilisateur et contenus académiques n'ont aucune raison d'en franchir la frontière.
- La requête initiale chargeait l'historique avant de filtrer et découper côté Node.
- La revue Codex fraîche du head `a569ba146` a relevé trois cas résiduels : une attribution révoquée restait opérationnelle, l'identité d'instrument provenait du catalogue vivant plutôt que du snapshot d'attribution, et une erreur de première page après changement de filtre laissait visibles les anciennes lignes.
- Pendant les gates finaux, `npm run test:lanes:check` échouait en RED : la collecte Playwright chargeait le module du nouveau test sans fournir sa garde `E2E_DISPOSABLE_STACK=1`. La collecte injecte désormais uniquement l'identité exacte de la base jetable ; l'exécution réelle reste fail-closed.

## Décisions prises

- La soumission courante est la version maximale parmi `RECEIVED`, `READABLE` et `ANALYZED`. `REJECTED` reste un historique d'audit non opérationnel. Cette définition est centralisée dans `lib/diagnostics/current-submission.ts` et réutilisée par la file, le pipeline et les deux écrans existants.
- Le repository Core v2 exécute une requête PostgreSQL paramétrée et bornée : soumission utilisable la plus récente par attribution, dernier brouillon, projection d'état, filtre, tri keyset, puis `LIMIT + 1`.
- Le curseur opaque contient la version du contrat, le filtre et le triplet de tri `(stateRank, lastActivityAt, submissionId)`. Un ancrage absent ou modifié retourne `listChanged: true` ; le client remplace alors la liste au lieu d'ajouter une première page redémarrée.
- Le client déduplique les lignes par `submissionId` en conservant l'ordre serveur.
- Les attributions `REVOKED` sont exclues de la file opérationnelle, même si leur dernière soumission reste `RECEIVED` ; la file expose la clé et la version figées par l'attribution, jamais celles mutables du catalogue vivant.
- Une erreur sur une nouvelle première page vide les lignes, le curseur et l'avis de rafraîchissement du filtre précédent. Une erreur de pagination conserve en revanche les lignes déjà chargées.
- Le DTO candidat est strictement `{ id, firstName, lastName }`. Le SQL ne sélectionne aucun email, téléphone, statut/activation de compte, timestamp User, clé de stockage, nom de fichier, empreinte, texte extrait, proposition IA ou revue humaine.
- Les lignes SQL brutes sont validées fail-closed par Zod avant mapping.
- Le test E2E est auto-contenu côté données Core v2 et refuse de s'exécuter sans la garde jetable et l'URL PostgreSQL exacte `localhost:5435/core_v2_e2e`.

## Fichiers modifiés

- Contrat métier : `lib/diagnostics/current-submission.ts`, `lib/core-v2/diagnostics/submission-pipeline.ts`.
- Repository/API : `lib/core-v2/queries/diagnostics-queue.ts`, `app/api/v2/staff/diagnostics/submissions/route.ts`.
- UI/navigation : `components/dashboard/core-v2/DiagnosticsQueueWorkspace.tsx`, `DiagnosticsLibresWorkspace.tsx`, `DiagnosticsPanel.tsx`, page ADMIN et navigation.
- Preuves : tests Jest ciblés, `e2e/auth/core-v2-diagnostics-queue.spec.ts`, inventaire d'autorité de session.
- Gates : `scripts/testing/check-ci-test-lane-coverage.mjs`.

## Tests exécutés

- RED fonctionnel initial documenté par les contre-exemples de supersession, rejet, projection PII, matérialisation non bornée et pagination périmée.
- RED de revue fraîche reproduit exactement : 2 échecs Core v2 sur révocation/snapshots et 1 échec composant sur les lignes périmées après erreur de première page ; GREEN après les trois correctifs minimaux (30/30 Core v2 et 8/8 composant).
- Gates post-correction : repository + route file (42/42), composants diagnostics (11/11), architecture Core v2 (58/58), typecheck vert et lint vert avec les mêmes 26 avertissements préexistants hors diff.
- GREEN ciblé Core v2 : 3 suites, 51 tests passés.
- GREEN ciblé composants : 2 suites, 10 tests passés.
- GREEN suite Core v2 complète sur `nexus_pr317_test` jetable : 50 suites passées, 1 ignorée ; 466 tests passés, 3 ignorés.
- GREEN architecture Core v2 : 2 suites, 58 tests passés.
- GREEN `npm run typecheck`.
- GREEN `npm run lint` avec 26 avertissements `no-explicit-any` préexistants, tous hors diff de la PR.
- GREEN `npm run check:e2e-ownership && npm run check:e2e-syntax` : 128 specs suivies/possédées, aucun orphelin, aucune quarantaine inconditionnelle.
- GREEN `npm run test:zero-debt` : aucun skip/todo/focus/quarantaine détecté.
- RED puis GREEN `npm run test:lanes:check` après correction de la collecte gardée : 1 563 fichiers de test atteignables, aucun orphelin.
- Parcours E2E réel sur stack jetable Core v1/Core v2 séparée, serveur standalone HYBRID et Chromium : 1 test passé en 4,3 s. Commande : `npx playwright test e2e/auth/core-v2-diagnostics-queue.spec.ts --config=playwright.auth.config.ts --project=chromium --reporter=line`.
- Build Next.js de production : compilation, validation TypeScript et génération de 95/95 pages réussies.
- Suite Jest standard complète : 1 test hors diff a dépassé le timeout de 5 s sous charge (`assistante-student-operational-workflow`), pour 13 920 tests passés. Le fichier concerné repasse isolément : 3/3 en 0,916 s. Cet écart est consigné et n'est pas présenté comme un succès de la suite complète.
- GREEN `git diff --check origin/main`.

## Résultats

- Une attribution ne produit qu'une action pour sa version utilisable courante ; les anciennes versions et les rejets restent accessibles uniquement par les parcours historiques/détail autorisés.
- La pagination est bornée en base, stable, explicite en cas de liste incompatible et défendue par une déduplication client.
- La réponse de file respecte une allow-list logistique minimale ; les tests exacts et l'E2E vérifient l'absence de PII inutile et de la sentinelle académique confidentielle.
- La revue du diff complet n'a relevé ni contenu académique sélectionné par la file, ni élargissement de droits, ni fichier produit accidentel.
- Le head `a569ba146` avait 49 checks GitHub terminaux acceptables, puis la [revue automatisée fraîche `5288570817`](https://github.com/cyranoaladin/nexus-project_v0/pull/317#pullrequestreview-5288570817) a produit les trois P2 ci-dessus. Un nouveau cycle CI et une nouvelle revue fraîche restent à rattacher au SHA de correction après push. Aucune revue humaine ni fusion ne doit être demandée avant leur conclusion verte/acceptable.

## Risques restants

- La suite Jest standard complète a connu un timeout non reproductible isolément dans un test extérieur à cette PR ; les checks distants devront confirmer l'absence de récurrence sur le SHA final.
- La validation locale ne remplace pas les lanes GitHub, notamment `auth-chromium`. Leur conclusion doit être enregistrée avant de demander une nouvelle revue automatisée.
- Le répertoire `.next/standalone` a produit un avertissement Jest de collision de nom de module avec le client Prisma généré source. Il n'a pas affecté les résultats, mais le nettoyage des artefacts build avant Jest peut éviter ce bruit dans les exécutions locales futures.

## Rollback

- Ne pas modifier ni supprimer les données de soumission pour revenir en arrière.
- Revenir aux commits de la PR dans l'ordre inverse, en commençant par le correctif de collecte CI, le client, la pagination, la requête bornée puis le contrat partagé.
- Si seule la page doit être retirée temporairement, retirer sa navigation et sa route de liste tout en conservant les données et routes détail historiques.
- Après rollback, relancer les migrations sans opération destructive, les tests Core v2, les guards d'architecture, le typecheck, le lint et la lane auth Playwright.
