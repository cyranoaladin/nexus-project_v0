# Consolidation SVT — branche unique `feat/svt-integration-final-v2`

**Date :** 2026-07-23 · **Décision :** direction (GO consolidation)

## Branche d'intégration unique et figée

`feat/svt-integration-final-v2` est **la seule** branche d'intégration de la campagne
Pré-rentrée 2026 / SVT. Elle est créée depuis `feat/svt-integration-clean` (@ `7ac64715e`,
état le plus avancé), + 1 commit doc scellant l'arbitrage R1 (grille production 20/07).

Elle contient : intégration SVT complète, durcissement release PR#74, correctif anti-crash
5 matières (`MAX_SUBJECTS_PER_PACK = 4`), grille tarifaire production R1 conforme, gates
fail-closed.

## Branches déclarées MORTES (ne plus committer / merger / déployer)

| Branche | Raison |
|---|---|
| `feat/svt-integration-clean` | Figée dans final-v2. Ne plus avancer. |
| `main` (local) | Intégration SVT parallèle antérieure (+ merge `final`), superseded. |
| `feat/svt-integration-final` | Entièrement dans `main` (0 en avance), redondante. |
| `feat/svt-pre-rentree-2026` | Base commune historique (`e137009e8`). |

## Preuves de non-régression (final-v2)

- Validateur pricing canonique : **42/42** ✓ (grille R1 : Premium 3-5 480/900/1350/1800,
  acomptes 144/270/405/540 = 30 % ; Fondations 4-6 350/400, commercial_exception 20/07).
- Suite campagne : **208/208** ✓ (dont `publication-snapshot` = data/campaigns cohérent
  avec `owner.json → scheduleGridFinal`).
- Générateur PDF : test assert `[480, 900, 1350, 1800]` (grille production).
- `data/pricing.canonical.json` **inchangé** (scellement doc uniquement).

## Writers externes à neutraliser (fait côté direction)

- Session IA parallèle poussant sur `origin/feat/svt-integration-clean` (GitHub) — à arrêter.
- Hub local `canonical` (`/home/alaeddine/Documents/Nexus_Reussite/canonical-repo-a1192c8d`,
  « dossier d'origine ») — geler les pushes SVT pendant la consolidation.
- Aucun bot CI (pas de `git push` dans `.github/workflows/`).

## Verrous maintenus

Aucun merge vers `main`, aucun déploiement, aucune diffusion sans **GO écrit du
propriétaire rattaché au SHA exact** (gate D-5). Voir `GO_LIVE_CHECKLIST.md`.
