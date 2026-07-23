# Déploiement — handoff public neutralisé

Ce dépôt public ne contient ni cible d'infrastructure, ni identité SSH, ni chemin serveur, ni nom de processus, ni commande de bascule ou de rollback.

## Statut de la PR #74

- Aucun déploiement n'est autorisé depuis cette branche.
- Les scripts publics de déploiement, de diagnostic SSH et de sauvegarde échouent volontairement.
- Le runbook opératoire doit rester dans l'espace privé contrôlé par le propriétaire.
- Le rollback en staging n'a pas été exécuté dans cette mission : aucune autorité ni cible de staging n'a été fournie.

## Preuves exigées dans le runbook privé

1. GO écrit du propriétaire pour la publication puis, séparément, pour le déploiement.
2. Identité exacte de l'artefact construit et vérification de son SHA.
3. Sauvegarde restaurable et preuve datée du dernier exercice de restauration.
4. Bascule atomique documentée sans commande destructive.
5. Smoke tests site, API, téléchargements, formulaires et télémétrie.
6. Rollback testé en staging sur le même type d'artefact et preuve jointe.
7. Responsables nommés, fenêtre de changement et critères d'arrêt.

Tant que ces preuves privées ne sont pas jointes aux gates de release, le verdict demeure au plus `READY_FOR_REVIEW`.
