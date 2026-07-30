# Runbook — correction manuelle des bilans canoniques

## Préconditions

- module approuvé humainement et hash inchangé ;
- tentative `PENDING_MANUAL_REVIEW` ;
- correcteur connecté avec rôle `COACH` affecté ou `ADMIN` ;
- flag canonique activé uniquement dans l'environnement autorisé ;
- PostgreSQL et rate limiting distribué disponibles.

## Procédure

1. Ouvrir `/dashboard/bilans-canoniques`.
2. Contrôler définition, version, hash, item et réponse.
3. Prendre en charge la tâche. La lease est bornée à 30–1 800 secondes.
4. Appliquer le barème humain indiqué par sa version.
5. Saisir séparément :
   - points ;
   - commentaire interne ;
   - commentaire explicitement publiable.
6. Enregistrer la décision.
7. Vérifier l'événement `MANUAL_REVIEW_COMPLETED` et le job
   `SCORE_ATTEMPT`.
8. Ne finaliser le score que lorsque la file de la tentative est vide.

## Concurrence

Une seule réclamation concurrente réussit. Une lease expirée peut être reprise
et incrémente `claimVersion`. Une décision avec une ancienne version de lease
est refusée. Ne jamais contourner le conflit en modifiant directement la base.

## Révision

Une révision est append-only :

1. si une publication est active pour une audience, révoquer d'abord toutes
   les publications actives ;
2. enregistrer la nouvelle décision avec motif et barème ;
3. vérifier la nouvelle version et le job de rescoring ;
4. recalculer un score final ;
5. régénérer, faire revoir puis republier chaque audience nécessaire.

`ACTIVE_PUBLICATION_REQUIRES_REVOCATION` est un verrou de sécurité, pas une
erreur à contourner.

## Incidents

| Symptôme | Action sûre |
|---|---|
| tâche déjà réclamée | attendre la fin ou l'expiration de lease |
| lease expirée | reprendre la tâche ; ne pas rejouer l'ancienne décision |
| score final refusé | vérifier les tâches `PENDING`/`CLAIMED` |
| publication active | appliquer la procédure de révocation |
| hash inconnu/incohérent | arrêter la correction et escalader au propriétaire pédagogique |
| Redis indisponible en production | ne pas relâcher le fail-closed |

## Audit

Ne copier ni réponse, ni nom, ni email dans les logs. Les preuves attendues
sont les IDs techniques, versions, rôle, événements et timestamps. Les
commentaires restent dans les tables dédiées.
