# Release candidats individuels V1

## Date

2026-08-29

## Contexte

Integration du runtime candidats individuels V1 sur le baseline de production securise PR180, avec remplacement de la console technique par un assistant staff en cinq etapes. Le pipeline public reste interdit; l'activation cible est `ACTIVE_INTERNAL`.

## Problemes observes

- Divergence d'historique entre `origin/main` et la provenance de production, malgre des arbres Git identiques.
- Runtime candidat individuel absent du baseline securise courant.
- Interface historique trop technique pour un usage quotidien Nexus.
- Plusieurs gates historiques fail-open ou incomplets ont ete fermes avant integration: sessions non vendables, couts PACK/Grand Oral, snapshots marge/effectif, publication et liens concurrents, projection famille et idempotence frontend.

## Decisions prises

- Baseline: `dc5a06b52595f91cf06838112820233c0a290fcc`, dont l'arbre est identique a `origin/main` observe (`9570ced0065dffbdbb27bb2060a3b4bc9647ad20`) et conserve la provenance PR180.
- Integration controlee depuis RC2 `e96fa67c2de28e836c0557240e73d6710c433962`; aucun merge massif de l'ancien RC.
- Exclusion maintenue de T3B1 `35841bd3c088c250f1062afb214f1283249e7680` et de tous les modules/services deferred.
- Dix migrations Prisma additives; aucune commande `db push` ni migration manuelle.
- Projection famille allowlistee et humanisee; token brut jamais persiste ni audite.
- Assistant staff interne uniquement, avec pricing et totaux exclusivement serveur.
- `origin/main` a avance pendant la session jusqu'a `d3ad2b066801408bbaa3f47017679e9fc416f3dc`. Ce delta est volontairement exclu de cette release: il contient les chantiers Curriculum SSoT/ARIA-A, deux migrations supplementaires et une suppression destructive de `students.specialties`, incompatible avec le rollback app-only exige. PR180 reste identique byte-for-byte entre production, ce nouveau `main` et la branche candidat.
- La route ARIA ajoutee dans ce delta doit faire l'objet d'une release separee apres validation explicite de l'entitlement commercial; elle ne doit pas etre transplantee partiellement ici.

## Fichiers modifies

- Runtime: `lib/exams/`, `lib/quotes/`, routes API candidat individuel et configuration admin.
- Donnees: catalogue candidat individuel dans `data/pricing.canonical.json` et catalogue examen 2027.
- Persistence: `prisma/schema.prisma` et dix migrations candidates V1.
- Frontend: page et workspace staff candidat individuel, navigation dashboard.
- Tests: unitaires, DB, E2E Playwright, contrats PR180 et freeze V1.

## Tests executes

- TypeScript: PASS.
- ESLint: PASS, aucune erreur bloquante.
- Unitaires: 919 suites, 10 144 tests, 29 snapshots, PASS.
- Integration PostgreSQL: 43 suites, 312 tests, PASS.
- DB: 12 suites, 202 tests, PASS.
- Courses PostgreSQL ciblees: PASS.
- E2E candidat individuel: 3 scenarios, PASS.
- Recettes R1/R2: PASS avec montants canoniques.
- Freeze V1, verrou public et scanners PR180 source: PASS.

## Resultats

- Runtime V1 et assistant staff integres.
- `ACTIVE_PUBLIC` et `ACTIVE_PUBLIC_PERCENTAGE` restent rejetes.
- Build de compilation Next PASS; gate de traces a relancer depuis un chemin hors `.worktrees` avant packaging.
- Mutation production non commencee au moment de ce document pre-deploiement.

## Risques restants

- Executer le build immuable hors du chemin `.worktrees` puis les audits d'artefact.
- Verifier le diff exact des migrations production avant backup/migration.
- Activer `ACTIVE_INTERNAL` uniquement via l'API admin auditee apres smoke tests.
- Reconciler ulterieurement la branche candidat avec Curriculum/ARIA dans un chantier dedie incluant migration, rollback et controle d'entitlement; ne pas fusionner ce delta dans la presente release.

## Rollback

- Conserver la release courante intacte et enregistrer `OLD_RELEASE` avant cutover.
- Repointage atomique de `<APP_SYMLINK>` vers `OLD_RELEASE` puis redemarrage du seul processus PM2 `<APP_PM2_PROCESS>`.
- Les migrations candidates sont additives; restauration DB uniquement en cas d'incompatibilite reelle, apres controle explicite de `users_household_name_key_idx` et `nexus_household_name_key()`.
