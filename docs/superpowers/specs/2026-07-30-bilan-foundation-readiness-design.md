# Bilan foundation readiness — conception de stabilisation

## Date

2026-07-30

## Base vérifiée

La stabilisation part exclusivement du SHA de la PR #87 :

`053868b3237cd6cb89916255626720672a945330`

Elle est réalisée dans la branche empilée
`fix/bilan-foundation-readiness-20260730`. Le moteur d'évaluation reste hors de
cette branche et partira du SHA stabilisé.

## Diagnostic des tests DB

Les suites globales ont été exécutées avec PostgreSQL 16 et pgvector réels,
après `prisma migrate deploy` :

- `origin/main` : 45 échecs sur 159 tests ;
- PR #87 : 47 échecs sur 175 tests.

Les deux bases présentent les mêmes deux causes historiques :

1. `createTestStudent` ne fournit pas le champ obligatoire
   `Student.gradeLevel`, introduit par la migration de normalisation ;
2. le test pgvector et le seed utilisent encore la colonne supprimée
   `pedagogical_contents.embedding` au lieu du seul champ
   `embedding_vector`.

Les deux échecs supplémentaires de la PR #87 sont des échecs d'infrastructure
propres au nouveau harness fresh/upgrade : celui-ci
n'acceptait que le port Compose `5434`, alors que le service PostgreSQL du job
CI écoute sur `5432`. Le garde-fou final accepte uniquement les deux ports de
test déclarés par le dépôt, sur une adresse loopback, depuis la base
`nexus_test` et vers des noms jetables strictement validés.

La correction aligne les fixtures et le seed sur le schéma versionné. Elle ne
relâche ni contrainte Prisma ni valeur d'assertion.

## Diagnostic des dépendances

L'inventaire npm distingue deux avis :

- `mathlive <= 0.109.2`, vulnérabilité XSS modérée, dépendance directe de
  production et donc potentiellement atteignable ;
- `brace-expansion <= 5.0.7`, vulnérabilité de déni de service élevée,
  propagée par les chaînes d'outillage Jest, ESLint et CycloneDX.

Le rapport de 37 vulnérabilités npm correspond à une vulnérabilité modérée de
production et à 36 entrées de graphe issues de l'avis `brace-expansion`. Les
corrections compatibles sont appliquées en priorité. Toute montée majeure
restante doit être comparée à ses contraintes de peer dependencies et ne peut
être masquée par un override incompatible.

Le contrôle `BOUND_SHA_MISMATCH` est un second sujet : l'exception existante
est liée à un ancien SHA. Si un risque d'outillage subsiste, la demande de
décision indiquera les paquets, l'atteignabilité, les mesures compensatoires,
l'expiration et l'action exacte du propriétaire. Aucun agent ne signe cette
décision et aucun secret GitHub n'est modifié.

## Stratégie de preuve

Les changements de comportement suivent un cycle rouge/vert :

1. test de régression isolé ;
2. preuve de l'échec attendu ;
3. correction minimale ;
4. test ciblé vert ;
5. suite DB globale sur PostgreSQL/pgvector réels.

Les dépendances sont traitées par groupe borné. Chaque groupe est suivi de
tests ciblés, typecheck, build, inspection du lockfile, audit production et
inspection de l'artefact standalone.

La sortie du lot exige ensuite les gates du dépôt, puis une seconde exécution
depuis un worktree détaché du SHA final.

## Frontières et non-objectifs

- aucune modification de migration déjà versionnée ;
- aucune migration de production ;
- aucun `prisma db push` ;
- aucune baisse des contrôles CI ou de sécurité ;
- aucune activation de feature flag ;
- aucune modification du corpus ni de son statut pédagogique ;
- aucun développement du moteur dans cette branche ;
- aucune approbation de risque fabriquée.

## Résultat attendu

La branche de stabilisation doit fournir zéro échec DB, corriger toutes les
vulnérabilités compatibles du périmètre, produire un dossier honnête pour le
risque résiduel éventuel et rendre le seul blocage possible explicitement
humain. La PR empilée cible la branche d'intégration, jamais `main`.
