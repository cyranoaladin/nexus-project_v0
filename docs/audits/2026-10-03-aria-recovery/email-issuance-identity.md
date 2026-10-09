# Identité durable des émissions e-mail Core

Date : 4 octobre 2026. Base : 48f9d6755. Statut global : NOT_READY.

## Cause et threat model

L'alerte CodeQL élevée 101 suit un credential dérivé jusque dans le HMAC de déduplication de l'outbox. Les preuves Core sont des jetons opaques CSPRNG de 256 bits, vérifiés par HMAC dédié/versionné ; les mots de passe restent traités par leur KDF. Un digest d'authentification n'est toutefois pas l'identité métier d'une émission et n'a pas besoin de franchir cette frontière.

Le reset retourne maintenant resetId, identité persistée et auditée de l'Invitation, au lieu de tokenHash. Les deux routes d'invitation transmettent invitationId. Les adaptateurs mail utilisent ces identités pour une clé d'événement dédiée. Le HMAC de vérification du proof reste en base, inchangé. Les tokens nécessaires au message restent uniquement dans son enveloppe AES-GCM, jamais dans la clé de déduplication ou les logs.

## Idempotence et preuves

Trois tests rouges ont précédé la nouvelle primitive. PostgreSQL réel a ensuite reproduit P2002 sur huit retries simultanés avec l'upsert vide : Prisma faisait read-then-create. L'update de la même clé permet l'upsert PostgreSQL atomique. Le payload chiffré, le Message-ID stocké, le statut et les compteurs existants restent conservés ; seule la métadonnée updatedAt peut refléter un retry. Le retour contient désormais le vrai Message-ID stocké.

- Sept suites unitaires/architecture : 19 tests réussis.
- Quatre suites Core sur PostgreSQL réel isolé : 29 tests réussis, dont HMAC indépendant, révocation, séparation des usages, erreurs de configuration et non-énumération.
- Une suite outbox PostgreSQL réel : un scénario réussi couvrant huit transactions concurrentes, retry après completion sans réouverture, conservation exacte du payload et nouvelle émission distincte.
- Migrations V1 complètes et relance réussies ; migrations Core appliquées dans une base séparée. Les deux conteneurs de qualification finaux sont arrêtés.
- Typecheck, lint strict des fichiers sélectionnés et diff-check réussis. Revue indépendante lecture seule : aucun nouveau P0/P1 démontré.

## Compatibilité et limites

Aucune migration ou réécriture des anciennes outbox : leur format AES et le worker restent inchangés. Ne pas ré-enqueuer d'anciennes émissions sous la nouvelle clé lors du cutover, car cela créerait une deuxième intention. Une rotation de clé outbox change encore la déduplication ; le retry inter-rotation n'est pas qualifié. L'émission Core et l'enqueue V1 restent deux transactions dans des stores distincts. Les producers V1 utilisant encore des dérivés de proof ne sont pas corrigés par ce lot.

Deux premiers essais PostgreSQL ont échoué : mock global de Prisma oublié dans le nouveau test, puis course réelle P2002 ; tous deux sont conservés dans les preuves privées. Le fixture d'origine applicative du test d'adaptateur a été explicité sans affaiblir la validation produit.

L'alerte CodeQL reste ouverte jusqu'au résultat distant sur le nouveau SHA. Aucune annotation, exclusion, clôture d'alerte ou déploiement effectué. Rollback applicatif compatible avec les payloads déjà créés, sans rejouer les émissions.
