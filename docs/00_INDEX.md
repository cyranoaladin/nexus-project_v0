# Nexus Réussite — Index Documentation Ops

## Sommaire
- [10_CARTE_DU_SITE.md](./10_CARTE_DU_SITE.md)
- [20_GUIDE_NAVIGATION.md](./20_GUIDE_NAVIGATION.md)
- [21_GUIDE_DASHBOARDS.md](./21_GUIDE_DASHBOARDS.md)
- [22_GUIDE_QUESTIONNAIRES_ET_BILANS.md](./22_GUIDE_QUESTIONNAIRES_ET_BILANS.md)
- [23_GUIDE_COURS_RESSOURCES.md](./23_GUIDE_COURS_RESSOURCES.md)
- [30_AUTHENTIFICATION.md](./30_AUTHENTIFICATION.md)
- [31_RBAC_MATRICE.md](./31_RBAC_MATRICE.md)
- [32_ENTITLEMENTS_ET_ABONNEMENTS.md](./32_ENTITLEMENTS_ET_ABONNEMENTS.md)
- [33_SECURITE_ET_CONFORMITE.md](./33_SECURITE_ET_CONFORMITE.md)
- [40_LLM_RAG_PIPELINE.md](./40_LLM_RAG_PIPELINE.md)
- [50_QA_ET_TESTS.md](./50_QA_ET_TESTS.md)
- [60_DEPLOIEMENT_PROD.md](./60_DEPLOIEMENT_PROD.md)
- [README.md](./README.md)

## À qui s’adresse quoi
- **Humains métier (parent/élève/coach/assistante/admin)**: commencer par `docs/20_GUIDE_NAVIGATION.md` puis `docs/21_GUIDE_DASHBOARDS.md`.
- **Dev/ops/sécu**: commencer par `docs/10_CARTE_DU_SITE.md`, `docs/30_AUTHENTIFICATION.md`, `docs/31_RBAC_MATRICE.md`, `docs/40_LLM_RAG_PIPELINE.md`, `docs/60_DEPLOIEMENT_PROD.md`.
- **QA**: `docs/50_QA_ET_TESTS.md` + inventaires générés `docs/_generated/routes.json` et `docs/_generated/rbac_matrix.json`.

```mermaid
flowchart LR
  U[Guide Navigation] --> T[RBAC/Auth]
  T --> O[LLM-RAG/Deploy]
  O --> Q[QA]
```

## Inventaires générés
- `docs/_generated/routes.json`
- `docs/_generated/rbac_matrix.json`
- `docs/_generated/rbac_coverage.json`

> **NOTE**
> Ces inventaires sont régénérés par `scripts/docs/route_inventory.js` (voir `docs/README.md`).
