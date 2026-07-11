# Pré-rentrée 2026 M0–M3 Test Execution Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prouver sécurité, capacité DB, migrations additives, intégrité et coexistence V1/V2 sur PostgreSQL réel.

**Architecture:** Les suites sont séparées par lot et niveau. Les migrations passent deux lanes, DB vide et snapshot V1 synthétique, puis les tests de concurrence utilisent plusieurs connexions ; aucun mock ne prouve un lock ou une exclusion.

**Tech Stack:** Jest, Prisma 6.19.2, PostgreSQL 15, Docker Compose, TypeScript node.

---

## Commandes futures

```bash
npm ci
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
./node_modules/.bin/prisma format --schema prisma/schema.prisma
./node_modules/.bin/prisma generate --schema prisma/schema.prisma
npm test -- --runInBand <suite-ciblee>
npm run typecheck
docker compose -f docker-compose.pre-rentree-test.yml up -d
./node_modules/.bin/jest --config jest.pre-rentree-db.config.js --runInBand
docker compose -f docker-compose.pre-rentree-test.yml down -v
```

`format` modifie le fichier : vérifier ensuite que le diff correspond uniquement au schéma prévu.

## M0A sécurité

| ID | Test | Résultat |
|---|---|---|
| M0A-01 | auth absent/lève/session invalide | 401 fail-closed, aucune stack/PII |
| M0A-02 | rôle incorrect/action inconnue | 403 deny-by-default |
| M0A-03 | ressource inexistante/hors scope | 404 identique, aucun oracle |
| M0A-04 | parent relation pending/expired/revoked | refus |
| M0A-05 | coach non affecté/finance | refus, champ absent DTO |
| M0A-06 | admin sensible sans permission/confirmation | refus/audit |
| M0A-07 | facture/document IDOR/path/symlink | 404, aucun localPath |
| M0A-08 | webhook secret/signature/replay | aucune mutation |
| M0A-09 | logs refus | requestId/code seulement, PII redacted |
| M0A-10 | inventaire route | aucune route mutante non classée |

Suites : guards/RBAC existants, `__tests__/security/idor*.test.ts`, factures/documents/webhook et futures policies V2.

## M0B base

- PostgreSQL major 15, UTF8/collation/timezone enregistrés ;
- `btree_gist` disponible/installé, exclusion temporaire ;
- `[)` : overlap refusé, adjacency autorisée ;
- `FOR UPDATE`, SERIALIZABLE, deadlock et lock timeout ;
- backup custom, checksum, restore isolé, migrations/extensions/constraints/counts identiques ;
- rôle runtime sans DDL, rôle migrateur identifié.

## M0C Prisma

- CLI/Client 6.19.2, Node 20 CI/Docker ;
- validate, format, generate ;
- migrate deploy DB vide et snapshot V1 rempli ;
- migrate diff vide ;
- scripts refusent db push, DB/shadow non isolées et Prisma téléchargé implicitement.

## M1 noyau

- 19 enums/21 tables exacts ;
- defaults/uniques/FKs/Restrict/SetNull ;
- dates civiles vs instants timestamptz ;
- application sans compte, 1–4 sélections au service ;
- snapshot argent millimes ;
- enrollment write bloqué avant M3 ;
- archivage logique ; matérialisation idempotente ;
- aucun modèle différé/table V1 touché.

## M2 intégrité

- teacher/room/cohort/student overlaps identiques, partiels, englobants et concurrents ;
- bornes adjacentes autorisées par DB, 15 minutes vérifiées service ;
- statuts actifs seulement, annulation/remplacement ;
- périodes enseignant primaire ; hold unique et expiry ;
- dates/archive/capacité 3–5 ;
- TND, nonnegative, total=deposit+balance, 1–4 ;
- indexes utilisés via EXPLAIN ;
- rebuild claims idempotent et écart détecté.

## M3 identité

- parent plusieurs enfants ; élève plusieurs responsables ; droits différents ;
- VERIFIED active autorise, PENDING/REVOKED/EXPIRED refuse ;
- une primaire vérifiée ; périodes ;
- Student.parentId inchangé ;
- catégories backfill clean/probable/conflict/missing/duplicate/multiple/invalid ;
- dry-run zéro write ; apply répété no-op ; interruption/reprise ;
- aucune association/fusion email ;
- IDOR parent et non-régression V1.

## Deux lanes migrations

### Lane A — zéro

Créer PostgreSQL vide, appliquer toutes migrations V1 puis M1–M3, generate, introspection/constraints/tests et rollback applicatif.

### Lane B — snapshot V1 synthétique

Créer rôles/profils/stages formats 9/12/15/18/20/30/intensif, réservations/paiements/factures/documents, prendre manifest table/count/hash de clés non-PII, appliquer M1–M3 et comparer strictement. Les nouvelles tables restent vides sauf backfill M3 explicitement lancé.

## Performance raisonnable

- durée migration mesurée sur staging/snapshot ;
- lock waits zéro ou sous fenêtre approuvée ;
- allocation 20 concurrents/dernière place répétée ;
- query scope parent/coach avec EXPLAIN, pagination ;
- les seuils de temps sont observés puis approuvés au GO, jamais inventés ici.

## Matrice rollback

Chaque suite ferme les flags et vérifie V1. M1/M2/M3 sur DB jetable ont un down de test ; production conserve les tables. Une erreur de backfill rollback le lot, puis verify/reprise. Une erreur sécurité ferme toutes surfaces V2.

## Critères de sortie

- zéro P0/P1 rouge ou skippé ;
- PostgreSQL réel pour DB/concurrence ;
- SHA, versions et commandes dans preuve ;
- fresh + snapshot V1 ;
- comptes/lignes V1 identiques ;
- logs sans PII ;
- diff check, typecheck et tests ciblés verts.
