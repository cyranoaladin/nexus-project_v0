# Séries : conservation, audit et concurrence

2026-10-05. Base publiée `c76d372eb94e5bf31db796f82775b744ccfdea6d`.

## Causes et correction

Quatre tests rouges ont reproduit l’effacement des notes dans DELETE/PUT et l’acceptation de JSON ou motif invalides. Un cinquième test rouge a reproduit la rematérialisation d’une série CANCELLED. Les notes sont conservées ; validation avant transaction ; audit de chaque occurrence effectivement annulée dans la transaction appelante, avec motif et acteur serveur.

Les deux routes verrouillent la série en premier, puis les occurrences dans un ordre stable. PUT exige ACTIVE et la révision attendue. DELETE déjà CANCELLED est idempotent, ENDED est refusé. Une perte de CAS sur une occurrence encore active provoque un conflit/rollback, plutôt qu’une fausse annulation complète. Un état terminal concurrent est conservé sans événement inventé. Les erreurs inattendues de ces routes sont journalisées par un message structurel constant.

## Preuves

- 5 suites / 51 tests unitaires ciblés verts, contrats existants conservés avec fixtures adaptées au traitement occurrence par occurrence.
- PostgreSQL réel : 3 suites / 24 tests verts ; `stage-lead-decision-green-1791158398`, manifeste de source stable.
- Annulation bulk : notes conservées, un événement par occurrence, retry sans doublon, acteur Core-only sans miroir.
- Défaillance d’insertion au deuxième audit : première écriture et premier événement également annulés par rollback.
- Routes réelles : PUT nominal, PUT après DELETE refusé, DELETE/PUT simultanés sans résurrection.
- Restauration synthétique chiffrée, ancienne ligne conservée, interruption DDL avant COMMIT et relance réussies. Conteneur propre à la campagne arrêté.
- Une première fixture incorrecte utilisait CoachProfile.id pour CoachAvailability.coachId : 4 échecs de préparation, corrigés vers User.id ; ces échecs ne sont pas attribués au produit.

## Limites

Aucune qualification de production, backup réel, rollback staging ou preuve de tous les écrivains. Un nouvel écrivain de série doit prendre le même verrou. La frontière existante au jour Tunis n’est pas une règle d’annulation horaire commerciale. La nouvelle table append-only reste la seule migration du lot précédent ; aucun SQL production ni changement de crédit/remboursement.
