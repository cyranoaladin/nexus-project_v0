# Réservation publique historique : création sans autorité de modification

Date : 2026-10-04. Base du lot : 57da8a6d0ee3b00afad2cd7b817f544f0ef0ff71. Statut NOT_READY.

## Défauts et contrat

Trois tests rouges reproduisent une mise à jour d’une réservation existante sur simple connaissance de son email/academyId, la persistance d’un prix et d’un titre fournis par le client, et la création hors catalogue. Deux tests rouges supplémentaires reproduisent une taille de corps non bornée sans Content-Length et l’absence de cache privé sur un refus. Le scénario de conflit P2002 protège l’accusé uniforme sous concurrence.

Aucun consommateur actif du POST historique n’a été trouvé dans app/components/e2e lors de la recherche exacte du chemin. L’endpoint est néanmoins public : l’absence de consommateur UI ne prouve pas sa non-exploitabilité. Son contrat conservé est une demande initiale, jamais une confirmation, un règlement ni une preuve d’ownership. Aucun endpoint ne peut élargir les droits par une adresse e-mail déclarée.

## Correction

Le stage doit être visible, ouvert et non terminé dans le catalogue serveur ; la gate de campagne pré-rentrée est aussi appliquée. Identifiant de stage, titre et prix sont issus de ce catalogue, sans valeur commerciale nouvelle. L’e-mail est normalisé. Une ligne existante n’est jamais modifiée ni notifiée à nouveau. Les créations, doublons déjà présents et conflits uniques P2002 renvoient le même accusé 201, sans isUpdate ni identifiant privé. Les logs de création/notification n’exposent plus les erreurs du driver/provider. CSRF et throttling existants sont conservés ; le corps réellement lu est limité à 4096 octets et toutes les réponses du POST sont private/no-store. Le formulaire validé nominal conserve son succès ; ses fixtures rendent le catalogue explicite.

## Vérifications

Deux suites ciblées : neuf tests réussis. Typecheck réussi, ESLint ciblé sans erreur, diff-check réussi. PostgreSQL réel : une suite/deux tests réussis ; prix/titre/stage serveur et ligne complète inchangée au retry, nombre de jobs identique. 131 migrations appliquées puis relance sans migration en attente. Preuves privées : .artifacts/recovery/public-reservation-integrity-green-1791146373/. Instance tmpfs détenue par la mission arrêtée ; aucune notification réelle. Le test historique utilise désormais une vraie NextRequest et aucun any ajouté.

## Risques distincts

L’endpoint ne réserve pas une capacité confirmée et ne qualifie pas un moteur de planning. La création et les notifications historiques ne sont pas encore une transaction atomique ; le worker réel, la livraison et le rapprochement restent à qualifier. Le stockage monétaire V1 reste Float et ne vaut pas un ledger financier sûr ; aucune migration financière n’est ajoutée ici. GET/PATCH historiques, permissions finance, cache, audit et CAS de transitions restent une tranche indépendante. Le P2002 est testé au niveau HTTP par fixture ; PostgreSQL vérifie aussi deux premières soumissions exécutées par Promise.all : deux accusés 201, une ligne et un intent. Le test ne force pas les deux lectures à une barrière ; il prouve le résultat de requêtes concurrentes, pas tous leurs interleavings. Le catch P2002 est limité à la création, séparé des notifications. Aucun de ces résultats n’autorise le pilote.

## Rollback

Revert du commit via GitHub protégé ; aucune migration. Un rollback ne doit pas réexposer l’upsert public permissif à des clients.
