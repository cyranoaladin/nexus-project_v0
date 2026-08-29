# Audit de Déploiement Live Governance, Ruleset et Rotation Deploy Key

## Date
2026-08-29T20:05:00Z

## Contexte
Suite à l'approbation et à la fusion de la PR #196 (`governance/github-governance-as-code-20260829`), les mutations d'infrastructure GitHub et de politique de sécurité ont été appliquées.

## Mutations Exécutées

### 1. Ruleset 12801316 (`main-protection`)
- Paramètre `allowed_merge_methods` mis à jour de `["merge", "squash", "rebase"]` à `["merge"]` exclusivement.
- Statut : **ACTIF & VÉRIFIÉ** (`RULESET_UPDATE_SUCCESS: 12801316 [ 'merge' ]`).

### 2. Paramètres du Dépôt (`Repository Settings`)
- `allow_auto_merge` : `true` (validé)
- `allow_update_branch` : `true` (validé)
- `allow_rebase_merge` : `false` (validé)
- `allow_squash_merge` : Reste temporairement `true` au niveau du dépôt en raison d'une contrainte interne de validation de l'API GitHub (`protected_branch_policy`) liée à une ancienne règle de protection classique latente (`requiresLinearHistory: true` sur le nœud `BPR_kwDOPXufyc4EGsZG`).
- **Garde-fou actif** : Même si le flag global du repo autorise le squash, le Ruleset actif 12801316 bloque tout squash ou rebase sur la branche `main` et n'autorise que `merge`.

### 3. Classic Branch Protection Rule (`BPR_kwDOPXufyc4EGsZG`)
- **Validation du restore payload** :
  Le payload de restauration a été validé et archivé dans `.artifacts/governance/classic-bpr-restore-payload.json` (`CLASSIC_BPR_RESTORE_PAYLOAD_VALIDATED=YES`).
- **Tentative de suppression** :
  L'API REST GitHub renvoie HTTP 404 (`Branch protection has been disabled on this repository`), et l'API GraphQL mutation renvoie FORBIDDEN (`Branch protection is disabled on this repository`).
- **Statut consigné** : `STALE_OR_LATENT_CLASSIC_BPR`. L'objet est dormant et non modifiable par API tant que les rulesets ont le contrôle exclusif.

### 4. Rotation Least-Privilege de la Deploy Key Serveur
- Ancienne clé : `id: 152864740`, titre `nexus-prod-server-20260528`, `read_only: false`.
- Action : Suppression atomique et réenregistrement avec les privilèges minimaux stricts.
- Nouvelle clé : `id: 161696882`, titre non-révélant `nexus-runtime-fetch`, `read_only: true`.
- Vérification live depuis `nexus-prod` :
  ```text
  Hi cyranoaladin/nexus-project_v0! You've successfully authenticated, but GitHub does not provide shell access.
  ```
  Authentification SSH GitHub en lecture seule opérationnelle avec succès.
