# Runbook — observabilité du moteur de bilans

## Événements sans PII

Suivre les nombres et issues de :

- affectations créées/refusées ;
- tentatives commencées/reprises ;
- autosaves réussis, conflits et refus après scellement ;
- soumissions et rejeux idempotents ;
- corrections `PENDING`, `CLAIMED`, expirées et `COMPLETED` ;
- scores provisoires/finals réussis ou échoués ;
- générations, approbations, publications et révocations ;
- réponses HTTP 401, 403, 404, 409, 429, 503 et 5xx ;
- profondeur des outbox et échecs SMTP ;
- latence et indisponibilité Redis.

Les IDs techniques peuvent être utilisés pour corrélation. Exclure emails,
noms, téléphone, réponse libre, commentaire, token magique et payload SMTP.

## Seuils proposés, non installés

| Signal | Seuil proposé | Action |
|---|---:|---|
| 5xx moteur | > 1 % sur 5 min | désactiver le flag, enquêter |
| 503 rate limit | > 0,5 % sur 5 min | vérifier Redis ; conserver fail-closed |
| corrections en attente | plus ancienne > 24 h | alerte équipe pédagogique |
| outbox non traitée | plus ancienne > 10 min | vérifier workers/SMTP |
| conflits autosave | > 5 % sur 15 min | vérifier latence et versions client |
| publication sans revue | toute occurrence | incident P0 sécurité |
| erreur de provenance/hash | toute occurrence | suspendre affectations concernées |

Ces alertes sont des critères de configuration future. Aucun connecteur
externe n'est déclaré installé par ce document.

## Diagnostic

1. confirmer le SHA, les flags et la migration ;
2. vérifier PostgreSQL puis Redis, sans afficher les secrets ;
3. inspecter la profondeur des outbox ;
4. corréler audit et idempotence par IDs ;
5. révoquer un bilan incorrect plutôt que supprimer l'historique ;
6. consigner l'incident et la décision de reprise.
