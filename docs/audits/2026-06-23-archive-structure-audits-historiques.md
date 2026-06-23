# Archivage structurel des audits historiques

## Date

2026-06-23

## Contexte

Après le nettoyage documentaire initial, plusieurs audits et rapports datés restaient dispersés dans `docs/`, `docs/audits/` et `docs/security/`. Ils ne devaient pas être supprimés, car ils constituent des preuves historiques, mais leur présence au premier niveau entretenait une confusion entre documentation active et archives.

## Problèmes observés

- Les audits d'avril 2026 étaient visibles au même niveau que les guides actifs.
- Les rapports sécurité P0/P1 de mai 2026 occupaient `docs/security/`, alors que les documents vivants sont `SECURITY_HARDENING_PLAN.md`, `API_GUARD_INVENTORY.md` et `rate-limiting.md`.
- Des documents actifs pointaient encore vers les anciens chemins.

## Décisions prises

- Déplacer les audits et rapports historiques vers `docs/archive/`.
- Conserver toutes les preuves suivies par Git : aucun fichier d'audit suivi n'a été supprimé.
- Maintenir les documents actifs et mettre à jour leurs références vers l'archive.
- Créer `docs/archive/README.md` comme index d'entrée.
- Archiver aussi les snapshots production d'avril qui étaient présents dans le workspace.

## Fichiers déplacés

- Le dossier d'audit senior du 2026-04-19 vers `docs/archive/audits/2026-04-senior/`.
- Audits et rapports racine avril 2026 vers `docs/archive/audits/2026-04-root/`.
- L'audit complet du 2026-05-01 vers `docs/archive/audits/2026-05/`.
- Snapshots d'arborescence production avril 2026 vers `docs/archive/audits/prod-snapshots-2026-04/`.
- Rapports sécurité P0/P1 et go-live mai 2026 vers `docs/archive/security/2026-05/`.

## Fichiers modifiés

- `docs/archive/README.md`
- `docs/00_INDEX.md`
- `docs/README.md`
- `docs/RAG_ARCHITECTURE.md`
- `docs/DEPLOYMENT_ASSESSMENT_MODULE.md`
- `scripts/README_TEST_PIPELINE.md`
- `docs/features/NPC_IMPLEMENTATION_PLAN.md`
- `docs/security/SECURITY_HARDENING_PLAN.md`
- `docs/audits/2026-06-23-documentation-inventory-cleanup.md`

## Tests exécutés

- `rg -n "docs/(AUDIT_|P0_|P1_|GO_LIVE|FINAL_AUDIT|PRODREADY|ROLLBACK|CLEANUP|RAPPORT_AUDIT|audit-automatismes|audits/AUDIT_|audits/NEXUS_|security/(GO_LIVE|P0_|P1_|PROJECT_STATE))" docs scripts --glob '!docs/archive/**' --glob '!node_modules/**'`
- `find docs/archive -maxdepth 3 -type f | sort | wc -l`
- `find docs/archive/audits docs/archive/security -type f | sort | wc -l`
- `git diff --check`
- `npm run typecheck`

## Résultats

- Aucun ancien chemin actif détecté hors `docs/archive/` par la recherche ciblée.
- `docs/archive/` contient 83 fichiers après création de l'index.
- `docs/archive/audits` et `docs/archive/security` contiennent 78 preuves historiques.
- `docs/security/` ne conserve que les documents vivants : `API_GUARD_INVENTORY.md`, `SECURITY_HARDENING_PLAN.md`, `rate-limiting.md`.
- `git diff --check` : exit 0, aucune sortie.
- `npm run typecheck` : `tsc --noEmit`, exit 0.

## Risques restants

- Des rapports historiques peuvent encore exister dans des dossiers spécialisés (`docs/incidents/`, `docs/deployments/`, `docs/pedagogy/`) lorsqu'ils restent utiles dans leur contexte métier.
- `audit/ai_llm_inventory.md` contient des extraits d'anciens chemins comme inventaire historique généré; il n'a pas été modifié dans cette passe.

## Rollback

Restaurer les déplacements via Git :

```bash
git restore --staged .
git restore .
```
