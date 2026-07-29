# Audit d'intégration — bilans gratuits et corpus pré-rentrée

## Date

2026-07-29

## Base et sources

| Élément | Valeur vérifiée |
|---|---|
| Dépôt distant | `git@github.com:cyranoaladin/nexus-project_v0.git` |
| Base | `origin/main` |
| SHA de base | `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` |
| Branche lot A | `feat/bilan-gratuit-canonical-go-live` |
| SHA lot A | `c73689704c8bcb4276b5dd59edf8b27c4ea54503` |
| Branche lot B | `feat/pre-rentree-pedagogy-corpus` |
| SHA lot B | `e2b5d8ccb400fd2c87b0f68c0428611be33eac56` |
| Merge-base base/A | `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` |
| Merge-base base/B | `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` |
| Merge-base A/B | `c6e055fb82216e46aab00f121f7817aed00e62ca` |
| Branche d'intégration | `integration/bilan-pre-rentree-canonical-20260729` |
| Worktree | `/home/alaeddine/.config/superpowers/worktrees/nexus-project_v0/bilan-pre-rentree-integration` |

Le fetch `origin --prune` a été exécuté avant l'audit. Les deux SHA complets
sont accessibles, contenus par leurs branches annoncées et leurs worktrees
sources étaient propres.

Le lot A comporte 29 commits au-dessus de `origin/main`, dont les quatre
commits de préparation communs. Le lot B en comporte 27, dont les mêmes quatre
commits. Aucun historique n'a été aplati.

## État initial des espaces de travail

Le dépôt principal était sur `prepared/pre-rentree-navbar-entry`, en avance de
deux commits, avec huit fichiers modifiés et deux chemins non suivis, dont
`prisma/schema.prisma` et une migration d'extension d'outbox. Aucune de ces
modifications n'a été déplacée, réinitialisée, nettoyée ou copiée.

Les worktrees A et B n'ont pas été modifiés. Le worktree d'intégration a été
créé proprement depuis le dernier `origin/main`.

## Inventaire des lots

### Lot A

- 70 chemins par rapport à `origin/main` : 44 ajouts, 26 modifications ;
- 13 018 insertions et 219 suppressions de lignes ;
- aucune suppression ni renommage de fichier ;
- schéma Prisma et migration additive ;
- APIs v1, services bilans, Auth.js, liens magiques, IDOR, rate limiting et
  audits.

### Lot B

- 424 chemins par rapport à `origin/main` ;
- merge effectif dans l'intégration : 419 chemins, 410 ajouts et 9
  modifications, car les quatre commits préparatoires étaient déjà présents ;
- aucune suppression ni renommage ;
- aucun changement Prisma, API, Auth.js ou interface volontaire ;
- corpus, scripts, tests et gouvernance pédagogique.

## Matrice des chevauchements

| Chemin / concept | Lot A | Lot B | `origin/main` | Nature | Risque | Décision | Validation |
|---|---|---|---|---|---|---|---|
| `components/layout/CorporateNavbar.tsx` et test | reprend les commits communs | reprend les mêmes commits communs | version antérieure | textuel apparent, contenu identique par merge-base commun | régression navigation | conserver une seule histoire commune | tests navbar + diff de merge |
| `lib/campaigns/pre-rentree-2026/release-gate.ts` | commun | commun | antérieur | textuel apparent | flag campagne dupliqué | résolution Git naturelle par ancêtre commun | tests release-gate |
| plan de go-live bilan | tâches cochées dans A | version commune non cochée | absent/antérieur | documentaire | perte de preuve A | merge A d'abord ; B ne remplace pas la version descendante | inspection des parents du merge |
| `package.json` | inchangé après préparation | ajoute quatre scripts pédagogiques et le gate CI | scripts pré-rentrée sans corpus | configuration | perte d'un gate ou script concurrent | conserver les scripts B, aucun script parallèle créé | exécution des commandes réelles |
| lock npm, Jest, TypeScript, CI | aucun delta exclusif | aucun delta exclusif | canonique | absence de conflit | faible | conserver ; une correction Jest dédiée est ajoutée pour les exports Node `yaml` | tests complets |
| `scripts/pre-rentree/requirements.lock` | aucun | ajoute `PyYAML==6.0.1` | sans YAML | dépendance Python | environnement non reproductible | installer le lock exact dans un venv | `pip check` + Pytest |
| `prisma/schema.prisma` et migration | ajoute les demandes et extensions canoniques | aucun changement | fondation bilans | schéma | duplication de modèles ou perte de contrainte | retenir A sans table spéculative ; utiliser les champs de provenance existants | fresh/upgrade/validate/generate |
| branches historiques Prisma | hors lot | hors lot | plusieurs branches anciennes | sémantique | reprise de schéma concurrent | ne reprendre aucune branche ancienne ; documenter `fix/bilan-lead-pipeline` et le worktree sale | audit des merge-bases |
| `app/api/bilan-gratuit/v1`, `auth.ts`, `lib/bilans` | runtime sécurisé | aucun changement | runtime historique | fonctionnel | affaiblissement sécurité | conserver A, puis tests négatifs | API/auth/IDOR/rejeu/idempotence |
| `content/pre-rentree-2026/modules.json` | consommé indirectement | source catalogue des 17 modules/85 séances | catalogue campagne | source de vérité | compteur ou ID divergent | conserver comme catalogue canonique | catalogue applicatif + validateurs |
| `pedagogy/manifest.yaml`, CPS, kits | absent | source éditoriale et index | absent | source de vérité | publication accidentelle | conserver sous `content`, jamais sous `public` | hash + hygiène |
| `lib/bilans/catalog/fixtures/maths-nsi.v1.ts` | adaptateur TypeScript historique | nouveau corpus couvre les tests | adaptateur préexistant | conflit sémantique non détecté par Git | deux définitions pédagogiques | supprimer l'adaptateur ; dériver 17 packs via `PedagogyCatalog` | tests catalogue |
| `modules.json: VALIDATED` vs manifeste/CPS | n/a | statuts divergents par rôle | `VALIDATED` structurel | contrat métier | exposition de contenu non relu | `VALIDATED` = structure campagne ; manifeste/CPS = autorité éditoriale | refus assignment/publication |
| 33 réponses courtes | moteur non complet | `correctionManuelle: true` | états canoniques sans ce statut | contrat métier | score faux ou prématuré | contrat `EN_ATTENTE_CORRECTION_MANUELLE`, aucune table spéculative | tests score/groupe/bilan bloqués |
| Physique-Chimie Seconde | niveau admissible générique | module absent | module absent | absence métier | invention par fallback | refus explicite et lookup inconnu | test négatif |
| `.env.example` / Docker | timeout distribué dans A | aucun | variables partielles | configuration | activation implicite ou Redis absent | centraliser flags faux, Redis/Upstash et email équipe | test de configuration |
| trace standalone | non traité | corpus interne | pas de trace corpus | packaging serveur | fichiers absents au runtime ou copie publique | inclure dans le trace API v1, jamais dans `public` | build + audit artefact |
| `docs/bilans/dossiers_tests_prerentree` | documentation bilan | snapshot/import historique | non canonique | gouvernance | source runtime concurrente | conserver comme entrée historique seulement | SOURCE-OF-TRUTH + recherche imports |
| `.artifacts/pre-rentree-2026/pedagogy` | aucun | sorties générées ignorées | ignoré | génération | seconde source suivie | ne rien suivre ; modifier sources/générateurs seulement | `git ls-files` vide |

## Stratégie Git exécutée

1. baseline propre depuis `origin/main` ;
2. merge explicite du lot A :
   `5a047a6e542b9b30970224540af1620ab86e63b6` ;
3. tests ciblés du lot A et migration éphémère ;
4. merge explicite du lot B :
   `1727cbbfda19713d47cf2f13242e5e47cb5ab445` ;
5. tests ciblés et reproductibilité du lot B ;
6. commits dédiés de conception, plan, raccordement, configuration,
   documentation et tests.

Les merges `--no-ff` ont utilisé les SHA complets. Git n'a rencontré aucun
conflit textuel. Les résolutions ont donc porté sur les conflits sémantiques
décrits dans la matrice.

## Décisions d'intégration

1. `lib/pre-rentree/pedagogy/` est l'unique lecteur applicatif du corpus.
2. Le chargeur est `server-only`, valide Zod + YAML borné, vérifie tous les
   hashes, les relations, les compteurs, les huit nœuds évalués par CPS,
   l'ordre A/B/C et l'unicité de la bonne réponse des QCM.
3. Les usages revue, affectation et publication sont distincts et fail-closed.
4. `lib/bilans/catalog` dépend de l'interface canonique ; l'ancien adaptateur
   TypeScript est supprimé.
5. Prisma conserve l'état et la provenance, pas les définitions.
6. Aucun modèle du moteur incomplet n'est ajouté.
7. Le statut de correction manuelle est un contrat obligatoire avant score,
   groupe ou bilan final.
8. Le corpus est tracé dans le bundle serveur API, jamais copié sous `public`.
9. Les flags sont serveur uniquement et faux par défaut.

## Hypothèses explicites

- le statut `VALIDATED` de `modules.json` est un statut structurel de campagne,
  car le manifeste, les CPS et la politique de ressources imposent tous une
  validation humaine distincte ;
- les champs de provenance existants de `CanonicalAssessmentAttempt` sont le
  point d'ancrage du prochain moteur ;
- l'absence de tables de réponse/correction dans le lot A signifie que leur
  conception appartient au prochain lot et ne doit pas être anticipée ici ;
- les fichiers de `docs/bilans/dossiers_tests_prerentree` restent des preuves
  d'import, jamais une source runtime ;
- aucune validation technique exécutée dans ce lot ne vaut validation
  pédagogique.

## Baseline `origin/main`

| Commande | Résultat |
|---|---|
| `npm ci` | réussi, 1 272 paquets ; audit npm : 37 vulnérabilités historiques |
| `npm run lint` | réussi avec avertissements historiques |
| `npm run typecheck` | réussi |
| `npm run test -- --runInBand --silent` | 590 suites réussies, 1 ignorée ; 7 200 tests réussis, 4 ignorés |
| `npm run pre-rentree:test:ts` | 53 suites, 404 tests réussis |
| Pytest pré-rentrée | 160 tests réussis |
| `npm run build` | réussi, 144 pages ; avertissements Edge `jose` historiques |
| `npx prisma validate` | réussi avec URL locale factice |
| `npx prisma generate` | réussi |
| 51 migrations sur PostgreSQL éphémère | réussi |
| `npm run test:db` | 7 suites en échec, 4 réussies ; 45 tests en échec, 114 réussis |

Les échecs DB de base sont antérieurs : la factory `createTestStudent` omet
`gradeLevel` devenu obligatoire et un test pgvector cible la colonne
`embedding` supprimée. La suite de schéma canonique des bilans et le contrôle
des migrations étaient déjà verts.

## Vérifications d'intégration déjà exécutées

| Commande / périmètre | Résultat |
|---|---|
| 24 suites ciblées lot A | 431 tests réussis |
| deux suites PostgreSQL réelles intake/magic | 17 tests réussis |
| migration bilan fresh + upgrade | 15 tests réussis |
| schéma canonique bilan | 12 tests réussis lors de la passe combinée |
| `npm run pre-rentree:pedagogy:verify` | compteurs exacts, 103 fichiers, hash `282bd45a97115fcf9b177b4b22430c1bbd9415a79a54d5c56f463564f19e2408` |
| Pytest pédagogique ciblé | 103 réussis, 2 ignorés |
| TypeScript pré-rentrée après merge B | 53 suites, 404 tests réussis |
| nouveau catalogue + correction manuelle + catalogue bilan | 3 suites, 28 tests réussis |
| configuration/flags | 2 suites, 15 tests réussis |
| typecheck et lint ciblé | réussis |

Le premier essai des tests PostgreSQL réels sur le port isolé 55434 a été
refusé par la garde du harnais, strictement limitée à 5434. Le second essai a
révélé un client Prisma généré avant le merge ; après `prisma generate`, les
17 tests ont réussi. Aucun code métier n'a été modifié pour contourner ces
gardes.

## Gates finaux

| Gate | Résultat |
|---|---|
| `npm ci` | réussi, 1 272 paquets ; audit npm inchangé : 37 vulnérabilités de dépendances historiques, dont 36 élevées |
| `npm run test -- --runInBand --silent` | réussi : 611 suites, 1 ignorée ; 7 557 tests réussis, 4 ignorés ; 7 snapshots |
| `python -m pytest scripts/pre-rentree/tests -q` | réussi : 265 tests, 2 ignorés, en 767,39 s |
| `npm run pre-rentree:test:ts` | réussi : 53 suites, 404 tests |
| `npm run pre-rentree:pedagogy:verify` | réussi : tous les compteurs, 103 sorties, reproductibilité vraie et hash attendu |
| `npm run lint` | réussi avec les avertissements historiques du dépôt ; aucun avertissement ajouté dans la frontière |
| `npm run typecheck` | réussi |
| `npm run build` | réussi : 145 pages ; traces, audit et standalone valides |
| corpus dans le standalone | 380 fichiers internes tracés ; aucun chemin sous `public/pre-rentree-2026/pedagogy` |
| `npx prisma validate` | réussi |
| `npx prisma generate` | réussi, client 6.19.3 |
| migration fresh + upgrade | réussi : 15 tests ; 52 migrations sur PostgreSQL jetable |
| PostgreSQL intake + magic réel | réussi : 2 suites, 17 tests |
| `npm run test:db` | baseline historique conservée : 7 suites en échec, 5 réussies ; 45 tests en échec, 130 réussis sur 175 |
| `npm run security:repo` | réussi : clés privées, infrastructure publique et Telegram |
| tests d'hygiène Python | réussi : 6 tests ; faux positif du marqueur de clé corrigé sans réduire le motif |
| tests ciblés sécurité/raccordement | réussi : 27 suites, 449 tests avant l'ajout du dernier invariant QCM |
| `git ls-files '.artifacts/pre-rentree-2026/pedagogy/**'` | vide |
| tests supprimés | aucun |
| chemins corpus sous `public/` | aucun |
| chemins absolus de worktree dans `app`, `lib`, `scripts`, `content` | aucun |
| parsing YAML dans `app/api` | aucun |

La suite Jest gagne exactement trois suites et dix-neuf tests par rapport au
lot A annoncé. La suite Python gagne huit tests par rapport au lot B annoncé.
Aucun test n'a été supprimé ou ignoré pour obtenir ces compteurs.

Le gate DB global échoue pour les mêmes 45 tests que la baseline :
`createTestStudent` omet `gradeLevel` et le stress test ARIA référence encore
la colonne pgvector `embedding`. Les nouvelles suites
`canonical-bilans-schema` et `bilan-request-schema` sont vertes. Le passage de
11 à 12 suites et de 159 à 175 tests provient de l'ajout du lot A.

`git diff --check origin/main...HEAD` signale les fins de ligne et espaces
terminaux déjà livrés dans les 340 fichiers canoniques du lot B, notamment le
CSV CRLF explicitement autorisé par les tests d'hygiène. Ils ne sont pas
normalisés dans cette convergence : une normalisation modifierait l'ensemble
de hashes du manifeste et le hash reproductible sans décision pédagogique.
Les fichiers d'intégration propres passent `git diff --check`.

La reproduction depuis un worktree détaché propre du SHA final est consignée
dans la section suivante avant le push.

## Reproduction du SHA final

Un worktree détaché propre a été créé au SHA
`ef8dcf2cb4f620ee62a60ba025487f4c3b6e421d`, qui inclut la première version
du rapport de gates.

- [x] `npm ci` : 1 272 paquets ;
- [x] catalogue/raccordement/sécurité : 24 suites, 423 tests ;
- [x] `npm run security:repo` ;
- [x] pipeline pédagogique : 103 fichiers et hash
  `282bd45a97115fcf9b177b4b22430c1bbd9415a79a54d5c56f463564f19e2408` ;
- [x] typecheck ;
- [x] Prisma validate/generate ;
- [x] build : 145 pages, traces et standalone valides, 380 fichiers du
  corpus côté serveur et aucun sous le répertoire public.

Le commit suivant ne modifie que ce rapport de preuve. Un second checkout
détaché de la tête finale est utilisé avant le push pour confirmer le SHA
exact.

## Risques résiduels

- les 17 modules attendent une validation humaine nominative ;
- le moteur affectation/réponse/correction/score n'est pas implémenté ;
- la migration de production, Redis/Upstash, SMTP, déploiement, activation et
  surveillance ne sont pas exécutés dans ce lot ;
- la suite DB globale conserve 45 échecs historiques, sans nouvel échec ;
- le corpus canonique conserve ses fins de ligne et espaces historiques
  couverts par ses hashes ; toute normalisation doit être un changement
  éditorial explicite avec régénération du manifeste ;
- l'audit `npm` conserve 37 vulnérabilités de dépendances historiques ;
- la présence du corpus dans le standalone augmente l'artefact serveur mais ne
  le rend pas public.

## Rollback

- remettre le flag d'intake à `false` ;
- revenir aux commits d'intégration applicatifs si nécessaire ;
- préserver les données et la migration additive déjà appliquée ;
- ne jamais corriger une sortie générée ou recopier le corpus en base ;
- reconstruire `.artifacts/` depuis les sources.

## Verdict

`PASS WITH BLOCKERS`. Le raccordement est fonctionnel et les gates de
convergence sont verts. Les bloqueurs de production sont la validation
humaine, la migration autorisée, la configuration Redis/Upstash/SMTP, le
déploiement, les smoke tests et l'activation contrôlée.
