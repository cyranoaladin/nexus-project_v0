# Déploiement — contrat public non sensible

Ce dépôt public ne contient ni cible d'infrastructure, ni identité SSH, ni chemin serveur, ni nom de processus, ni commande de bascule ou de rollback.

## Statut de la release Pré-rentrée 2026

- La PR finale est la PR #79 ; la PR #82 apporte les preuves CI empilées.
- Aucun déploiement n'est autorisé avant `PUBLIC_READY`, CI verte et GO lié au
  SHA exact.
- Les scripts publics de déploiement, de diagnostic SSH et de sauvegarde échouent volontairement.
- Le runbook opératoire doit rester dans l'espace privé contrôlé par le propriétaire.
- Le mécanisme privé a été identifié et son dry-run de bascule/rollback
  non destructif est validé.

```text
PRIVATE_RUNBOOK_AVAILABLE=true
PRIVATE_RUNBOOK_SHA256=b5b829f5b41b52e41a385cafbaf1d36831cef5e4428c616f52f0b5f9f21484b7
ROLLBACK_DRY_RUN_VALIDATED=true
PRE_DEPLOY_HEALTH_GREEN=true
```

## Preuves exigées dans le runbook privé

1. GO écrit du propriétaire pour la publication puis, séparément, pour le déploiement.
2. Identité exacte de l'artefact construit et vérification de son SHA.
3. Sauvegarde restaurable et preuve datée du dernier exercice de restauration.
4. Bascule atomique documentée sans commande destructive.
5. Smoke tests site, API, téléchargements, formulaires et télémétrie.
6. Rollback testé en staging sur le même type d'artefact et preuve jointe.
7. Responsables nommés, fenêtre de changement et critères d'arrêt.

Les preuves restent hors Git. Leur intake schema-validé ne fournit que des
booléens, références redacted et empreintes. Toute dérive du SHA ou du runbook
invalide le GO.
