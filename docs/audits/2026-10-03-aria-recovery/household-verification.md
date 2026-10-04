# Qualification des rattachements familiaux Core-v2

## Contrat et critères avant implémentation

L'ADR canonique conserve `HouseholdParent` + `Student.householdId` comme autorité familiale et la co-visibilité des enfants d'un foyer. `ParentStudentLink` V1 reste le consentement au bilan, sans droit d'accès familial dérivé.

- Membership PENDING par défaut ; aucune lecture parent ou projection élève/destinataire sur une relation non VERIFIED.
- Vérification/révocation par staff disposant de HOUSEHOLD_EDIT, révision attendue et preuve opaque ; audit et changement dans la même transaction.
- Aucune reconnaissance par homonymie, numéro ou adresse e-mail.
- Aucun ancien rattachement promu automatiquement par une migration de schéma. Backfill séparé approuvé, idempotent et reprenable.
- Révocation retire le contact principal. Nouvelle vérification explicite requise pour rétablir les droits ; aucune relance de roster ne réactive ni déplace un membership existant.
- Invariants de dates/preuve/révision protégés en base ; un seul parent par foyer et un contact principal maximum restent les contraintes existantes.
- Tests négatifs pending/révoqué/tiers, concurrence CAS, audit rollback et contraintes PostgreSQL ; migration vide/ancien schéma/relance.
- Rollback vers un binaire ignorant ces états interdit : artefact de repli avec les mêmes gardes ou fermeture contrôlée des parcours parent avant bascule. Aucune down migration.

Cette tranche ne qualifie pas encore les invitations familiales, leur acceptation/refus, les parcours parent finance/ressources ni la compatibilité V1. Ces lignes restent ouvertes dans le cahier des charges.

## Preuves de migration du 4 octobre 2026

Sur PostgreSQL 16 isolé, le schéma versionné précédent (22 migrations) a été installé puis peuplé avec deux utilisateurs synthétiques, un foyer, un membership et un élève. L'exécution du SQL 0023 jusqu'avant COMMIT, suivie de la fermeture de connexion, a annulé l'ensemble de la transaction. La colonne nouvelle était absente et les colonnes historiques identiques au snapshot initial.

Le déploiement canonique des 23 migrations a ensuite conservé ces colonnes et laissé le membership `PENDING`, révision 0. Une deuxième exécution n'a appliqué aucune migration ni changé ce snapshot. Empreinte SHA-256 du SQL testé : `a3ccc875bbfcfdbcf91d2a6fc2a7740013b0dbd8cd382b0e0a72665bd4d13098`. Les preuves privées ne contiennent que données synthétiques et résultats, sans accès production.

Le test d'intégration de migrateur à deux bases compte 11 réussites : il inclut désormais une vérification puis une révocation explicites, suivies d'une relance approuvée du roster qui laisse l'état révoqué, la révision et l'absence de contact principal inchangés.

Qualification locale du lot : `npx jest --config jest.core-v2.config.js --runInBand --ci` en HYBRID sur PostgreSQL isolé, 71 suites / 686 tests réussis ; UI ciblée via `jest.config.js`, 1/1 ; typecheck et lint réussis (avertissements préexistants conservés) ; secret scan du diff et des dix fichiers nouveaux, zéro finding. Le test de concurrence observe explicitement un backend bloqué sur verrou PostgreSQL avant libération ; le test d'audit injecte un échec de trigger dans la base synthétique puis vérifie le rollback et supprime ce seul trigger de test dans `finally`.

`npm run build` a également terminé avec succès, contrôles standalone et extraction PDF compris, en mode vidéo DISABLED explicite. Il s'agit d'une qualification locale du contenu avant commit, et non d'un artefact fusionné/approuvé ni d'un déploiement. Les empreintes des diffs gelés principal et candidate restent identiques aux constats initiaux.

Échecs intermédiaires conservés : attente d'audit historique sans le nouvel événement ; nouveau test de révocation transmettant par erreur un champ de vérification rejeté par le schéma strict ; lancement UI sans configuration Jest explicite refusé par les deux configurations existantes. Corrections des fixtures/commandes, aucune assertion retirée ni règle serveur assouplie. Les nouvelles étapes E2E sont écrites mais pas encore exécutées sur l'artefact de ce lot.

## Limites bloquantes de publication

Les anciennes routes V1 utilisant `parentId` ne consultent pas encore toutes cette autorité : une révocation Core-v2 n'est donc pas une révocation globale. Le parcours public reste non qualifié jusqu'à fermeture de ce contournement, qualification des invitations et répétition E2E des parcours familiaux. Aucun backfill automatique ni application à la production n'a été exécuté. Le retour à un ancien binaire qui ignore l'état reste interdit.
