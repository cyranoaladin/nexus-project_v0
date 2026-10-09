# Annulation individuelle : notes, audit et reprise

Date : 2026-10-05. Base publiée : `05f425df37c1127b99cac764a3036d1d071db525`. Preuves de travail non commité : manifests de source et diff dans les répertoires privés indiqués ci-dessous.

## Défaut et correction

La route remplaçait les notes pédagogiques par le motif d’annulation. Elle ne conservait pas d’événement durable et rejetait la répétition d’une commande dont la réponse avait été perdue. La correction conserve les notes, utilise un identifiant UUID optionnel de commande, vérifie les participants au moment du CAS et écrit l’événement dans la même transaction. Une collision sur cette commande produit 409 ; les autres erreurs de base restent des échecs. Les erreurs inattendues sont expurgées dans cette route avant journalisation.

Les statuts historiques restent protégés. Les permissions et règles financières ne sont pas élargies. Le client doit conserver le même identifiant pour obtenir une réponse idempotente après perte réseau ; son adaptation reste à faire.

## Migration additive

`20261005010000_session_booking_cancellation_audit` crée uniquement la table d’événements, ses contraintes, index et protection append-only. Aucun événement historique n’est inventé. La réservation possède une FK restrictive. L’acteur provient exclusivement du guard serveur ; son identifiant peut être un sujet Core sans miroir User V1, donc aucune FK artificielle inter-autorités n’est créée. Les rôles, bornes, transitions et unicité de commande sont vérifiés en base. Cette décision ne prouve pas la compatibilité globale de suppression de compte ou des autres écrivains.

Empreinte SQL : `f163833ae6576d5e92345c2d741025d09700b8f706ef146398a5be9b006351e9`.

## Preuves

- Tests unitaires : quatre scénarios rouges initiaux ; cas de collision puis redaction des erreurs également reproduits avant correction.
- PostgreSQL réel : 3 suites, 19 tests verts, preuve privée `stage-lead-decision-green-1791157976`.
- Restauration d’une fixture synthétique chiffrée ; hash des anciennes lignes conservé ; interruption avant COMMIT de la nouvelle migration puis déploiement et relance réussis.
- Identité de source stable pendant la campagne ; conteneur tmpfs appartenant à la campagne arrêté.
- Couverture réelle : notes conservées, rollback sur échec d’audit, deux commandes identiques concurrentes sans double événement, conflit de paramètres, interdiction de mutation de l’audit, refus d’un autre élève.

## Limites et rollback

Ces preuves ne constituent pas une restauration de production, un test de journal Prisma interrompu, ni une qualification des annulations de séries. Les anciens écrivains restent compatibles avec le schéma additif mais ne garantissent pas cet audit ; revenir à une application qui efface les notes ne serait pas un rollback fonctionnel acceptable. La redaction générale du gestionnaire API et le client idempotent restent des lots distincts. Aucun déploiement ni SQL production exécuté.
