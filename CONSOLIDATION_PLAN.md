# PLAN DE CONSOLIDATION — Fin de la guerre de branches (à valider avant merge)

> **NE PAS EXÉCUTER sans GO direction.** Ce document est le plan ; aucun merge n'est fait.

## 1. État réel des branches (vs `origin-github/main` = `a0db57a7b`)

| Branche | Tip | Commits/main | Dernier commit | Rôle |
|---|---|---|---|---|
| `main` | `a0db57a7b` | 0 | 22/07 19:14 | Cible du merge |
| `feat/svt-integration-clean` | `7ac64715e` | **40** | 23/07 **12:05** | La plus avancée. Contient mon travail SVT (jusqu'à `f952f8a4f`) **+ ~23 commits d'un agent concurrent** de durcissement release. |
| `feat/svt-integration-p0-corrections` (moi) | `2b0e74037` | 17 | 23/07 13:28 | Mes corrections P0 (R2, R4, revert R1) + scellement R1. |

**Qui pousse sur `clean`** : flux continu 08:21→12:05 le 23/07, même utilisateur git, thèmes release-gating cohérents (`fix(release): fail closed until owner go`, `fix(security): neutralize public topology`, `fix(pedagogy): align review modules with official programmes`, `fix(pricing): annual payment summaries`, `test(e2e)…`). **→ Agent autonome / pipeline de durcissement release concurrent** (pas moi, pas un CI trivial). **À désactiver** (voir §4).

## 2. Branche d'intégration unique proposée : `feat/svt-integration-final-v2` (depuis `clean` @ `7ac64715e`)

`clean` est la base (la plus avancée). On y ajoute **uniquement** ce qui lui manque de mes corrections P0.

### À APPLIQUER (fresh edits, pas cherry-pick du commit P0 groupé — évite les conflits binaires)
| # | Correction | Pourquoi (clean a quoi) |
|---|---|---|
| 1 | **R2** — `getters.ts` salle-1 → `Mathématiques / NSI / SNT / SVT` + 2 tests (landing-dto, sections) | clean a **ma version erronée** `Mathématiques, NSI et SVT` (SNT manquant) |
| 2 | **R4** — restaurer « certifié ou agrégé » dans le générateur (2 endroits) + `essentiel.html` | clean a la version **retirée** (0 occurrence) |
| 3 | **R1** — ajouter `commercialGridFinal` à `publication-decisions.owner.json` + DEBTS B-7 RÉSOLU + `P0_REGRESSIONS.md` | clean **n'a pas** `commercialGridFinal` |
| 4 | Régénérer une seule fois : générateur PDF + flyer + parent-docs → `documents-final/` + `public/documents/` | après R4 (agrégé dans les PDF) |

### À NE PAS FAIRE (doublons détectés)
| Doublon | Décision |
|---|---|
| R1 `group_max` 6 | clean a déjà **6** → SKIP |
| R1 textes « 4 à 6 » | clean a déjà **0** « 4 à 5 » → SKIP |
| Acomptes 144/405 | clean = production ✓ → SKIP |
| Conformité maths (A) | clean a **`fix(pedagogy)` plus avancé** (modules.json 197 l. + `programme-conformity.test.ts`) → **garder celui de clean**, ne pas réappliquer mes propositions. Réconcilier `CONFORMITE_PROGRAMMES.md` : garder la version de clean. |
| `fix(pricing)` annual summaries | à clean, pas à moi → garder |

### Conflits attendus
- **Binaire** : `documents-final/`, `parent-documents/`, `public/documents/` régénérés des deux côtés → résolus en **régénérant une fois sur v2** (étape 4), pas de merge binaire.
- **`modules.json`** : ne PAS toucher (clean a la version pédagogie concurrente). Mon R2 ne touche pas modules.json (seul le libellé salle dans getters.ts). ✓ Pas de conflit.
- **`publication-decisions.owner.json`** : clean a mes D1-D5 + mathsProgramConformity2026 ; j'ajoute `commercialGridFinal` (clé nouvelle) → **pas de conflit de clé**.
- **À VÉRIFIER au moment T** : `seconde-informatique-snt` toujours présent dans le `modules.json` de clean (R2 module) ; les tests passent après régénération.

## 3. Ordre d'exécution (après GO)
1. `git fetch` + créer `feat/svt-integration-final-v2` depuis `origin-github/feat/svt-integration-clean` (fetch frais, re-vérifier le tip).
2. Appliquer corrections 1→3 (R2, R4, R1-scellement).
3. Régénérer PDF (étape 4), copier vers `documents-final/` + `public/documents/`.
4. `jest` pré-rentrée + `tsc` + cross-check horaires + interdits (agrégé désormais AUTORISÉ).
5. Push `feat/svt-integration-final-v2`. Mettre à jour / rouvrir la PR sur cette branche.
6. **Déclarer mortes** : `feat/svt-integration-clean`, `feat/svt-integration-p0-corrections`, et toutes les branches SVT antérieures (documenter dans ce fichier).

## 4. Agents/CI à désactiver (à confirmer par la direction)
- L'**agent de durcissement release** qui pousse sur `clean` (flux 08:21→12:05 le 23/07) — probablement une session autonome type Codex/agent, à identifier et couper.
- L'automatisation qui fait avancer le **dossier d'origine** `/home/alaeddine/Bureau/nexus-project_v0` (Windsurf/Devin indexation + commits).
- Une fois ces sources coupées et `final-v2` figée, plus aucune branche SVT ne doit recevoir de push.
