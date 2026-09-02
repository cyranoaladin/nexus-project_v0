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
8. Résultat frais de `npm run aria:manifest:runtime-check` contre le runtime
   RAG effectivement ciblé par cette release Nexus — aucun GO privé de
   déploiement ne peut être délivré sans cette preuve, décrite ci-dessous.

Les preuves restent hors Git. Leur intake schema-validé ne fournit que des
booléens, références redacted et empreintes. Toute dérive du SHA ou du runbook
invalide le GO.

## Contrat de compatibilité RAG (gate obligatoire avant bascule)

Avant toute bascule atomique, exécuter le garde public de compatibilité RAG
contre le runtime RAG effectivement ciblé par ce déploiement :

```bash
npm run aria:manifest:runtime-check
```

Ce garde interroge l'index RAG servable réel (`/corpora/servable/v1`), vérifie
son auto-empreinte, l'alignement `resourceRegistrySha256` avec le registre de
ressources Nexus, la fenêtre de manifestes supportés (N/N-1) et l'empreinte de
chaque manifeste supporté annoncé. Un échec — endpoint injoignable, désaccord
d'empreinte, manifeste retiré de la fenêtre supportée ou registre désaligné —
arrête la procédure avant toute bascule. Le garde ne modifie rien et ne code
en dur aucune cible ; il lit `ARIA_RAG_ENGINE_BASE_URL` et
`RAG_BFF_SERVICE_TOKEN` depuis la configuration de déploiement du runbook
privé, la même source que le client RAG applicatif utilise en production.

Ce dépôt public ne peut pas exécuter ni bloquer mécaniquement la bascule
elle-même : elle appartient entièrement au runbook privé décrit ci-dessus.
Le contrat public est donc une exigence de preuve, au même titre que les
sept preuves listées plus haut : **aucun GO privé de déploiement Nexus ne
peut être délivré sans un résultat frais et réussi de ce garde** contre le
runtime RAG effectivement ciblé par la release. Cette preuve suit le même
intake schema-validé, redacted, hors Git, avec au minimum :

```text
NEXUS_RELEASE_SHA=<sha>
RAG_COMPATIBILITY_PASS=true
RAG_MANIFEST_SHA256=<active_manifest_sha256>
RAG_RESOURCE_REGISTRY_SHA256=<resource_registry_sha256>
RAG_CONTRACT_VERSION=<protocol_version>
CHECKED_AT=<horodatage ISO 8601>
PRIVATE_RUNBOOK_REFERENCE_OR_HASH=<référence ou empreinte du runbook privé>
```

Aucune IP, identité SSH, chemin serveur, jeton ou secret n'entre dans cette
preuve — uniquement des empreintes et booléens, exactement comme les preuves
1 à 7.

## Contrat générique du pointeur de release

Le runbook privé désigne un unique `<CANONICAL_POINTER>` mutable. Le pointeur
historique `<COMPAT_ALIAS>` doit être un lien symbolique vers ce pointeur
canonique, jamais un second lien direct vers une release. Une bascule atomique
ne modifie donc que `<CANONICAL_POINTER>`.

Après la bascule et **avant le reload**, exécuter le garde public en lui
fournissant les valeurs du runbook privé :

```bash
scripts/release/verify-release-pointers.sh \
  --canonical <CANONICAL_POINTER> \
  --alias <COMPAT_ALIAS> \
  --release-root <RELEASE_ROOT> \
  --expected-release <NEW_RELEASE>
```

Un échec arrête la procédure avant toute action sur le processus. Exécuter
**après le reload** exactement le même garde, puis vérifier que le pointeur
canonique, les métadonnées du gestionnaire de processus et `/proc` désignent
tous `<NEW_RELEASE>`.

Le garde ne modifie rien. Il refuse notamment un alias direct même si les deux
pointeurs résolvent temporairement vers la même release : deux liens directs
resteraient indépendamment mutables et pourraient diverger plus tard.

La politique de conservation associée est documentée dans
`docs/runbooks/release-retention-policy.md`. Toute liste exacte de releases et
tout chemin concret restent dans le runbook privé root-only.
