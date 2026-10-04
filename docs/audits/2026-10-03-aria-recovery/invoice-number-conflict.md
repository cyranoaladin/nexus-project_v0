# Conflit concurrent de numérotation manuelle

Date : 4 octobre 2026. Base : 2b0a516cd. Statut global : NOT_READY.

## Défaut reproduit

Deux créations concurrentes portant le même numéro passent potentiellement la lecture préalable. PostgreSQL impose déjà l’unicité, mais le perdant recevait une erreur interne 500. Le test réel a reproduit [201, 500] au lieu de [201, 409] ; le test ciblé Prisma P2002 reproduit également 500 au lieu de 409.

## Correction

Reconnaître uniquement une PrismaClientKnownRequestError P2002 du modèle Invoice et de la cible simple number. Retourner le même 409 privé que la lecture préalable. Aucun autre index unique n’est assimilé au conflit de numéro ; aucune métadonnée d’erreur n’est exposée. Le rollback transactionnel et l’audit immuable restent garantis.

## Preuves

- Rouge API : 1 échec, 9 réussites ; rouge PostgreSQL : 1 échec, 21 réussites.
- Vert ciblé : 29 suites / 394 tests.
- Vert PostgreSQL réel : 4 suites / 22 tests, 131 migrations et replay. Une facture, une ligne et un audit après les requêtes concurrentes.
- Lint ciblé et contrôle de diff réussis ; revue indépendante en lecture seule : aucun nouveau P0/P1 démontré.
- Preuves privées : .artifacts/recovery/invoice-number-*-private.log et invoice-status-green-1791137923/. Instance tmpfs arrêtée.

## Limites et rollback

Aucune migration nouvelle. Ce correctif ne fournit pas l’idempotence de création ni la reprise PDF. Le revert applicatif réintroduirait seulement le 500 du conflit ; aucun rollback de schéma n’est nécessaire. Aucun déploiement effectué ; qualification CI du prochain SHA encore requise.
