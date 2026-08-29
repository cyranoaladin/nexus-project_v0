# Réparation de la suite DB globale

## Date

2026-07-30, Africa/Tunis.

## Base

- `origin/main` :
  `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b`
- PR #87 :
  `053868b3237cd6cb89916255626720672a945330`
- branche de correction :
  `fix/bilan-foundation-readiness-20260730`

Les reproductions utilisent PostgreSQL 16 avec l'extension pgvector réelle et
un schéma construit exclusivement par `prisma migrate deploy`.

## Reproduction

| Base | Suites | Tests | Échecs | Durée | Causes |
|---|---:|---:|---:|---:|---|
| `origin/main` | 11 | 159 | 45 | 27,087 s | factory `Student.gradeLevel`, colonne pgvector historique |
| PR #87 | 12 | 175 | 47 | 34,414 s | mêmes 45 échecs, plus deux tests fresh/upgrade limités au port 5434 |

La différence de deux tests n'est pas une régression de la migration. Le
harness ajouté par la PR #87 refusait le port `5432` utilisé par le service
PostgreSQL de la CI.

## Causes racines et décisions

### Factory Student

`20260430200000_normalize_student_grade_level` rend
`Student.gradeLevel` obligatoire. La factory commune continuait à créer
uniquement le libellé historique `grade: "Terminale"`.

Décision : fournir `GradeLevel.TERMINALE` par défaut avant l'override explicite.
La contrainte Prisma n'est ni rendue nullable ni contournée.

Preuve TDD :

- nouveau test réel
  `__tests__/db/test-database-factory.test.ts` ;
- rouge : `Argument gradeLevel is missing` ;
- vert : valeur persistée `TERMINALE`.

### Contrat pgvector

`20260421083000_remove_embedding_legacy_column` supprime définitivement
`pedagogical_contents.embedding`. Le test ARIA et `prisma/seed.ts` continuaient
à l'insérer.

Décision : écrire uniquement `embedding_vector` et `tags`. Le test ne passe
plus par un fallback HTTP qui masquait dix réponses `401` ; il exécute dix
requêtes de voisinage `<=>` concurrentes sur pgvector et vérifie le contenu le
plus proche.

### Harness fresh/upgrade

Le contrôle de sécurité acceptait uniquement `localhost:5434/nexus_test`.
Docker Compose utilise bien 5434, mais GitHub Actions expose PostgreSQL sur
5432.

Décision : autoriser uniquement les ports locaux 5432 et 5434, tout en
conservant :

- l'hôte loopback obligatoire ;
- la base source exacte `nexus_test` ;
- les noms jetables
  `nexus_bilan_(fresh|upgrade)_[a-f0-9]+` ;
- la suppression forcée limitée à ces bases jetables.

### Nettoyage du schéma de test

Une fois la factory réparée, `schema.test.ts` prenait 401,333 s. La fonction de
nettoyage exécutait un `TRUNCATE ... CASCADE` par table, retronquant à chaque
fois le même graphe.

Décision : citer tous les identifiants issus de `pg_tables` et exécuter un seul
`TRUNCATE ... RESTART IDENTITY CASCADE`. Le comportement reste identique ; le
run ciblé des 32 tests est passé en 131,772 s et la gate complète en 328,173 s,
sous le timeout CI de 20 minutes.

## Résultat final local

```text
Test Suites: 13 passed, 13 total
Tests:       176 passed, 176 total
Snapshots:   0 total
Time:        328.173 s
```

Le test ciblé de migration passe également :

```text
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Time:        73.374 s
```

Il couvre le déploiement complet des 52 migrations sur une base fraîche et
l'upgrade depuis l'état antérieur avec conservation des lignes historiques et
canoniques.

## Fichiers modifiés

- `__tests__/setup/test-database.ts`
- `__tests__/db/test-database-factory.test.ts`
- `__tests__/db/aria-pgvector.test.ts`
- `__tests__/db/bilan-request-schema.test.ts`
- `prisma/seed.ts`

## Migration et rollback

Aucune migration et aucun champ Prisma ne sont modifiés. Le rollback
applicatif consiste à revenir sur les fichiers de test et le seed ; il ne
requiert aucune opération de données. Revenir au seed historique est toutefois
interdit sur un schéma courant, car la colonne `embedding` n'existe plus.

## Risques résiduels

Le harness reste un test local privilégié : il doit continuer à utiliser une
instance PostgreSQL jetable et ne doit jamais recevoir une URL de production.
Les validations de loopback, de base source et de nom jetable sont donc des
contrôles obligatoires.
