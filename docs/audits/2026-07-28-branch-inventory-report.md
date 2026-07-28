# Inventaire des branches non fusionnées — rapport de base

Date : 2026-07-28
Produit par : `scripts/check-work-delivered.sh` exécuté sur les 145 branches distantes (`origin/*`), seuil de péremption par défaut (14 jours).

Commande exacte :

```
git fetch origin --prune
for ref in $(git branch -r | grep -v ' -> ' | sed 's/^ *origin\///'); do
  # équivalent, branche par branche, à scripts/check-work-delivered.sh "$ref"
done
```

## Résumé

- 145 branches distantes au total.
- **72 fusionnées** dans `origin/main` (ancêtres directs — rien à signaler).
- **73 non fusionnées**, dont :
  - **65 STALE** (non fusionnées depuis plus de 14 jours) ;
  - **8 OPEN** (moins de 14 jours — pas encore un problème, à resurveiller).

C'est exactement la même mécanique que celle qui a produit le bug d'énumération de comptes documenté dans `docs/audits/2026-07-28-bilan-gratuit-cemetery-and-account-creation-bug.md` — reproduite ici à l'échelle du dépôt entier. Aucune de ces branches n'a été fusionnée, cherry-pickée ou supprimée par cet audit.

## Branches STALE les plus anciennes (top 15 sur 65)

| Âge (j) | Branche | Commits en avance | Commits en retard | SHA |
|---|---|---|---|---|
| 342 | `front+back+aria` | 6 | 1750 | `ad546663` |
| 337 | `adam-branch` | 7 | 1750 | `71fa9c64` |
| 333 | `stabilisation/e2e-chromium-vert` | 21 | 1750 | `6dabff0b` |
| 332 | `stabilisation/e2e-chromium-vert2` | 7 | 1750 | `76183557` |
| 331 | `ci/e2e-stub-lane` | 40 | 1750 | `758af614` |
| 326 | `ops/e2e-stability-and-local-stack` | 45 | 1750 | `f05651f4` |
| 282 | `ops/e2e-stability-stack-v2` | 31 | 1750 | `a3281f0d` |
| 269 | `chore/ci-e2e` | 53 | 1750 | `913670ad` |
| 265 | `feat/py-api-integration` | 56 | 1750 | `a028c09d` |
| 265 | `copilot/fix-docs-cleanup-errors` | 58 | 1750 | `0f0579dd` |
| 265 | `chore/cleanup-docs-robustesse` | 57 | 1750 | `86fa2b64` |
| 169 | `ci-cd-4a3c` | 335 | 1750 | `d4d99020` |
| 162 | `split/programme-maths1ere` | 480 | 1750 | `92612e1d` |
| 162 | `split/audit-diagnostics` | 466 | 1750 | `a638582e` |
| 162 | `fix-cubic` | 483 | 1750 | `1c469052` |

## Branches STALE les plus volumineuses (top 10 par nombre de commits d'avance)

| Commits en avance | Âge (j) | Branche |
|---|---|---|
| 1049 | 84 | `copilot/audit-complet-coherences-dashboards` |
| 931 | 87 | `fix/recharts-and-documents` |
| 917 | 88 | `docs/finalize-invoice-smoke-status` |
| 912 | 88 | `feat/normalize-grade-levels` |
| 905 | 89 | `fix/invoice-pdf-font-assets` |
| 904 | 89 | `fix/invoice-package-discount-option-b` |
| 904 | 89 | `feat/eaf-questionnaire` |
| 903 | 89 | `fix/invoice-pdf-font-assets-clean` |
| 898 | 90 | `feat/go-live-premium-100-p1-cleanup` |
| 892 | 90 | `feat/programme-shared-extraction-and-terminale-parity` |

Aucune de ces branches n'a été ouverte dans le cadre de cet audit — seul leur statut de fusion a été vérifié. Une revue de contenu (comme celles menées sur `pr58-archive` et `release/pre-rentree-2026-final-rc` dans l'audit bilan-gratuit) serait nécessaire avant toute conclusion sur leur valeur.

## Branches déjà connues de cette mission (pour mémoire)

| Âge (j) | Branche | Statut dans ce rapport | Traité dans |
|---|---|---|---|
| 21 | `pr58-archive` | STALE | tagué `archive/pr58-20260706`, triage complet en Section 3 |
| 15 | `release/pre-rentree-2026-final-rc` | STALE | tagué `archive/pre-rentree-2026-final-rc-20260713`, triage complet en Section 2 |
| 16 | `fix/pre-rentree-2026-finalize-preview` | STALE | ancêtre confirmé de la RC, rien d'unique |
| 15 | `fix/pre-rentree-2026-planning-ui` | STALE | ancêtre confirmé de la RC, rien d'unique |
| 15 | `fix/pre-rentree-2026-homepage-spotlight` | STALE | ancêtre confirmé de la RC, rien d'unique |
| 0 | `fix/bilan-gratuit-account-enumeration` | OPEN | PR #86, ce jour — le hotfix H1-H5 |

## Branches OPEN à surveiller — chevauchement potentiel avec le chantier pré-rentrée en cours

Deux branches actives (moins de 14 jours) touchent directement le périmètre pré-rentrée 2026 actuellement en Lot 2 et n'ont pas été auditées dans le cadre de cette mission — signalées ici, non ouvertes en détail :

| Âge (j) | Branche | Commits en avance |
|---|---|---|
| 6 | `assistant/pre-rentree-2026-production-v1` | 5 |
| 5 | `feat/svt-integration-p0-corrections` | 2 |
| 5 | `feat/svt-integration-final` | 7 |

`feat/svt-integration-final` correspond très probablement à la branche SVT déjà identifiée comme un des deux chantiers concurrents dans `project_pre_rentree_concurrent_agents` (mémoire) — à réconcilier avec `content/pre-rentree-2026/publication-decisions.owner.json` avant toute reprise du Lot 2, comme déjà noté.

## Limite de méthode

Ce rapport ne mesure que la fusion dans `origin/main`, pas la valeur du contenu. Une branche STALE avec 900 commits d'avance n'est pas nécessairement précieuse (elle peut être une divergence ancienne, un fork abandonné, ou un doublon d'un travail déjà refait autrement) — c'est le même risque de sur-classement que celui corrigé en A1.0.5 pour `release/pre-rentree-2026-final-rc`. Ce rapport identifie où regarder, il ne remplace pas un triage par unité fonctionnelle.
