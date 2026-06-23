# Archives documentaires Nexus Réussite

## Statut

Ce dossier conserve les preuves historiques, audits, rapports de durcissement, cahiers des charges et snapshots documentaires qui ne sont plus des consignes actives.

Ces fichiers ne doivent pas être supprimés sans décision explicite : ils servent à comprendre les audits passés, les arbitrages go-live, les lots sécurité P0/P1 et les anciennes spécifications pédagogiques.

## Structure

| Dossier | Contenu | Statut |
|---|---|---|
| `audits/2026-04-root/` | Audits et rapports racine d'avril 2026. | Preuves historiques. |
| `audits/2026-04-senior/` | Audit senior complet du 2026-04-19. | Preuves historiques. |
| `audits/2026-05/` | Audit complet du 2026-05-01. | Preuve historique. |
| `audits/prod-snapshots-2026-04/` | Snapshots d'arborescence production d'avril 2026. | Preuves historiques. |
| `security/2026-05/` | Rapports sécurité P0/P1 et go-live de mai 2026. | Preuves historiques. |
| fichiers `cahier_charges_*` | Cahiers des charges pédagogiques ou questionnaires anciens. | Archives métier. |

## Règles

- Ne pas utiliser un fichier archivé comme source opérationnelle sans vérifier le code et les documents actifs.
- Toute règle tarifaire active doit venir de `data/pricing.canonical.json` via `lib/pricing.ts`.
- Les documents actifs d'entrée restent `docs/00_INDEX.md`, `docs/README.md`, `AGENTS.md` et les guides `docs/10_*` à `docs/60_*`.
- Si un audit archivé redevient utile, créer un nouveau document actif daté qui cite l'archive au lieu de déplacer l'ancien fichier hors archive.

## Index rapide

- Audit RAG initial : `audits/2026-04-senior/07_RAG_LLM_ARCHITECTURE.md`
- Architecture bilan pipeline : `audits/2026-04-root/AUDIT_BILAN_PIPELINE.md`
- Plan de déploiement P0 : `audits/2026-04-root/P0_DEPLOYMENT_PLAN_2026-04-29.md`
- Snapshots production avril : `audits/prod-snapshots-2026-04/`
- Clôture API/IDOR P0 : `security/2026-05/P0_API_CLOSURE_AUDIT_2026-05-29.md`
- Go-live readiness sécurité : `security/2026-05/GO_LIVE_READINESS_AUDIT_2026-05-29.md`
