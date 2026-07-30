# Admissibilité de la fondation bilans et pré-rentrée

## Date

2026-07-30, Africa/Tunis.

## État initial vérifié

- dépôt : `git@github.com:cyranoaladin/nexus-project_v0.git` ;
- base `origin/main` :
  `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` ;
- tête annoncée et constatée de la PR #87 :
  `053868b3237cd6cb89916255626720672a945330` ;
- branche de correction :
  `fix/bilan-foundation-readiness-20260730` ;
- PR #87 : ouverte, draft, mergeable, état GitHub `UNSTABLE` ;
- run CI audité : `30501190087` ;
- contrôle documentaire externe : run `30501190086`, vert ;
- règles de protection : non exposées par l'API GitHub, réponse 404.

L'audit a été réalisé avant toute écriture. Le SHA distant ne divergeait pas du
SHA annoncé.

## Matrice initiale des gates

| Gate | État initial | Cause racine | Contrôlable par le code | Action |
|---|---|---|---:|---|
| Unit | vert | 612 suites + 1 ignorée, 7 558 tests + 4 ignorés | oui | non-régression globale |
| Integration | vert | 13 suites, 140 tests | oui | non-régression sur PostgreSQL/Redis réels |
| Real DB | vert dans la CI PR, rouge global local | job PR limité à 10 tests ; suite `test:db` : 45 défauts historiques | oui | réparer factory, contrat pgvector et harness |
| E2E | vert | 169 tests | oui | reproduire sur standalone |
| Build | vert | aucune erreur | oui | reconstruire et auditer le standalone |
| Lint | vert | avertissements historiques sous le seuil | oui | vérifier après mise à jour |
| Typecheck | vert | aucune erreur | oui | vérifier après mise à jour |
| Documents | vert | contrôles interne et externe réussis | oui | ajouter les rapports factuels |
| Dependency Integrity | rouge | audit complet + `BOUND_SHA_MISMATCH` | partiellement | corriger le runtime ; préparer la décision propriétaire résiduelle |
| Security Scan | rouge | même mismatch après Semgrep et OSV | partiellement | conserver les scans ; décision humaine bornée |
| CodeQL | vert | trois analyses réussies | non requis | surveiller le nouveau SHA |
| GitGuardian | vert | aucun secret détecté | non requis | surveiller le nouveau SHA |
| CI Success | rouge | agrégation des deux jobs rouges | indirectement | ne pas déclarer la CI verte sans décision propriétaire |

## Réparations contrôlables par le code

### Suite DB globale

La reproduction exacte a établi :

- `origin/main` : 45 échecs sur 159 tests ;
- tête PR #87 : 47 échecs sur 175 tests, dont les mêmes 45 défauts et deux
  restrictions de port propres au nouveau harness ;
- branche corrigée : 176 tests sur 176, 13 suites sur 13.

Les corrections sont détaillées dans
`docs/audits/2026-07-30-global-db-test-repair.md`. Elles rétablissent :

- la valeur enum `Student.gradeLevel` dans la factory réelle ;
- le contrat pgvector après suppression de la colonne historique
  `embedding` ;
- la compatibilité sûre du test fresh/upgrade avec le port PostgreSQL 5432
  de GitHub Actions ;
- un nettoyage transactionnel efficace sans relâcher l'isolation.

Aucune migration existante n'a été modifiée et aucune migration n'a été
appliquée hors des bases locales jetables.

### Dépendance de production

`mathlive@0.108.3`, vulnérable à
`GHSA-fm7p-gw32-828p`, a été remplacé par `0.110.0`. Un test d'adaptateur a
également couvert la séparation entre le conteneur impératif MathLive et le
fallback React, afin d'éviter la suppression d'un nœud géré par React.

Résultat :

- audit production au seuil moderate : zéro vulnérabilité ;
- SBOM runtime CycloneDX 1.6 : 523 composants, MathLive `0.110.0` ;
- standalone : aucun `brace-expansion` ;
- test MathInput : 1 sur 1 ;
- typecheck, lint et build : verts.

### Risque d'outillage résiduel

L'audit complet conserve 36 entrées high, zéro critical. Toutes propagent le
même avis `GHSA-mh99-v99m-4gvg` sur `brace-expansion` via ESLint, Jest et le
générateur CycloneDX. Ces dépendances :

- sont exclusivement de développement ;
- sont absentes de l'audit `--omit=dev` ;
- sont absentes du SBOM runtime ;
- sont absentes du standalone ;
- ne traitent aucune entrée HTTP publique.

Le risque n'est pas déclaré inexploitable. La demande non signée se trouve
dans
`docs/security/2026-07-30-dependency-risk-decision-request.md`.
Le SHA exact doit être ajouté à la draft PR après le dernier commit, puis lié
par le propriétaire à une exception de quatorze jours maximum. Aucun nom,
secret ou accord n'a été fabriqué.

## Résultats locaux de sortie

| Contrôle | Résultat | Compteur ou preuve |
|---|---|---|
| installation | vert | 1 273 paquets |
| tests unitaires globaux | vert | 613 suites réussies, 1 ignorée ; 7 559 tests réussis, 4 ignorés |
| tests sécurité bilans ciblés | vert | 8 suites, 195 tests |
| tests DB globaux | vert | 13 suites, 176 tests |
| intégration réelle | vert | 14 suites, 149 tests |
| Playwright standalone | vert | 169 tests |
| corpus TypeScript | vert | 53 suites, 404 tests |
| corpus Python | vert | 265 réussis, 2 ignorés |
| corpus canonique | vert | tous les compteurs et le hash attendus |
| typecheck | vert | zéro erreur |
| lint | vert | zéro nouvelle erreur |
| build | vert | 145 pages statiques ; standalone valide |
| Prisma | vert | validate et generate |
| sécurité dépôt | vert | aucun secret ou artefact public interdit |
| audit production | vert | zéro vulnérabilité |
| audit complet | décision humaine | 36 high d'outillage, zéro critical |

Le passage de 7 558 à 7 559 tests unitaires correspond au nouveau test
MathInput. Le passage des 257 tests Python annoncés précédemment à 265
correspond à l'état réellement présent au SHA audité ; aucun test n'a été
supprimé ou neutralisé.

### Complément : suite Playwright complète

La configuration CI historique ne couvre que `e2e/real/pages`, alors que la
commande locale complète découvre 228 scénarios. Trois fichiers de cette
suite complète conservaient des attentes antérieures à la release
informationnelle active :

- ancien CTA homepage `#planning` au lieu du CTA canonique vers les offres ;
- entrée permanente Pré-rentrée supposée active malgré le gate propriétaire
  explicite `canShowPreRentreeInPermanentNav() === false` ;
- ancien configurateur parent avec préremplissage du bilan, désormais
  volontairement fermé ;
- anciens compteurs de matières, de documents et ancien texte de salles.

Les tests ont été réalignés sur les sources actives sans réduire leur nombre
ni ouvrir une capacité fermée. Ils vérifient désormais le CTA informationnel,
le plafond de quatre matières, l'absence de préremplissage bilan, l'absence de
Physique-Chimie Seconde, l'absence de clés de réponse, les huit documents de
l'allowlist et la fermeture de la navigation permanente.

Résultat terminal :

`npx playwright test --config=playwright.config.ts --project=chromium --reporter=line`
— **228/228 tests réussis en 5 min 46 s**.

Le corpus conserve :

- 17 modules et 17 CPS ;
- 85 séances ;
- 141 nœuds, dont 136 évalués ;
- 408 items, dont 33 à correction manuelle ;
- 255 banques, 765 exercices et 765 corrigés ;
- 85 exit tickets et 255 questions ;
- 340 fichiers unitaires ;
- zéro consigne exactement dupliquée ;
- le hash reproductible
  `282bd45a97115fcf9b177b4b22430c1bbd9415a79a54d5c56f463564f19e2408`.

Les 17 modules restent `HUMAN_VALIDATION_REQUIRED`. Aucun module de
Physique-Chimie Seconde n'est créé ou référencé.

## Environnement et limites observées

- la CI principale ne ciblait initialement que `main` et la branche figée de
  la PR #79 : les bases des PR empilées #88 et #89 ont été ajoutées
  explicitement au filtre `pull_request` afin que chaque tête soit soumise
  aux mêmes jobs avant retargeting ;
- les commandes d'intégration et Prisma exigent une `DATABASE_URL`
  explicite ; un premier lancement sans cette variable a échoué avant
  exécution métier, puis le lancement documenté avec PostgreSQL local a
  réussi ;
- Pytest exige le snapshot généré et ignoré par Git ; la commande
  `npm run pre-rentree:snapshot` a été exécutée avant la suite ;
- le serveur E2E a tenté un SMTP local non provisionné pendant un scénario ;
  les tests ont vérifié le comportement attendu et sont tous passés ;
- Node local est `22.21`, tandis que la CI épingle `22.23.1`. Le validateur
  d'arbre npm signale localement cette différence de plateforme ; le job CI
  exécuté sous la version exacte passait ce contrôle avant le gate d'audit.

## Risques et responsables restants

| Priorité | Élément | Responsable attendu | Dépendance | Critère d'acceptation |
|---|---|---|---|---|
| P0 | décision temporaire `brace-expansion` | propriétaire sécurité/technique | SHA final poussé et preuves CI | décision réelle signée, liée au SHA, expirant sous 14 jours |
| P0 | remplacement de l'exception | propriétaire GitHub | décision précédente | secret mis à jour par le propriétaire, jobs relancés sans changement de code |
| P0 | suppression définitive de l'exception | maintenance outillage | correctifs upstream ou remplacement testé | audit complet à zéro high/critical, lint/Jest/SBOM/build verts |
| P0 production | validation pédagogique des 17 modules | responsable pédagogique et enseignants disciplinaires | paquets de revue liés aux hashes | approbations nominatives et hashes inchangés |
| P0 production | configuration Redis/SMTP et migrations | équipe d'exploitation | secrets réels et fenêtre autorisée | smoke tests internes réussis, flags toujours désactivés avant décision |

## Rollback

Le lot ne modifie pas le schéma. Son rollback applicatif consiste à revenir
sur les commits de test, dépendances et documentation. Revenir à MathLive
`0.108.3` réintroduirait une vulnérabilité runtime et n'est donc pas une
stratégie acceptable. Les conteneurs PostgreSQL et Redis utilisés pour la
preuve sont locaux et jetables.

## Verdict technique

Les défauts contrôlables par le code sont réparés et toutes les gates locales
obligatoires passent. La branche ne doit toutefois pas être présentée comme
fusionnable tant que la décision humaine bornée n'a pas rendu
`Dependency Integrity`, `Security Scan` et par conséquent `CI Success` verts.
