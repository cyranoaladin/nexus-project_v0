# Durable SMTP delivery

## Date

2026-08-04

## Contexte

SMTP ne permet pas de prouver une livraison exactement une fois. Une coupure
après `DATA` peut laisser l'application sans réponse alors que le serveur a
accepté le message.

## Décision

Les emails de sécurité utilisent `canonical_job_outbox` avec le type
`SEND_EMAIL`. Le contenu, y compris destinataire et lien opaque, est chiffré
en AES-256-GCM avec une clé dédiée. Un retry technique conserve le contenu et
le `Message-ID`; une réémission utilisateur crée un nouveau token et une
nouvelle intention.

Le drainer prend un lease avec `FOR UPDATE SKIP LOCKED`, applique un backoff
borné, récupère les leases expirées et classe les coupures post-`DATA` comme
`AMBIGUOUS`. Le scheduler Node est activé explicitement et le démarrage
production échoue si cette activation manque.

## Rollback

Revenir au code précédent en conservant les valeurs additives des enums. Ne
pas supprimer les intentions avant analyse; l'ancien code les ignore.

## Limite

Un doublon SMTP est possible après acceptation ambiguë. Il reste sans danger
car le même lien et le même `Message-ID` sont réutilisés.
