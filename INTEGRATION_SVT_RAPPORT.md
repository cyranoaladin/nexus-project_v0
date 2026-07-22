# INTEGRATION SVT — Pré-rentrée 2026 · Rapport

- **Branche** : `feat/svt-integration-final` (clone isolé `/tmp/nexus-svt-work`, hors dossier indexé).
- **Base** : `e137009e8` (production `d0ce2241` + SVT + CI).
- **Décisions appliquées** : D1–D5 scellées ; SVT en DRAFT tant que D2 non levée ; aucun envoi famille ; aucun merge/déploiement.

## Grille finale (D4-final)

Blocs A 08:30–10:30 · B 10:45–12:45 · C 13:30–15:30 · D 15:45–17:45 (**pas de bloc E / soir**).

**Semaine 2**

| Bloc | salle-1 | salle-2 |
|--|--|--|
| A | 2nde NSI | 1ère Physique-Chimie |
| B | **Terminale SVT** | 2nde Physique-Chimie |
| C | Terminale NSI | **Première SVT** |
| D | 1ère NSI *(permuté B→D)* | Terminale Physique-Chimie |

Semaine 1 inchangée. Contrainte Maths/NSI même enseignant respectée (Maths S1, NSI S2).

## Matrice de preuves (relancée depuis le clone isolé)

| # | Preuve | Résultat |
|---|---|---|
| P1 | Suite `pre-rentree-2026` (jest) | **228/229 verts** (1 rouge = provenance origin/main, dette N-2) |
| P2 | 4 gates sur données réelles (`pre-rentree-2026-gates-audit`) | ✅ noRoom / noTeacher / noLevel / dailyLoad |
| P3 | `tsc --noEmit` | ✅ 0 erreur |
| P4 | Régression cap 4 matières (`pre-rentree-2026-configurator`) | ✅ 5→4 sans « Missing canonical campaign pack », transitions, 0 matière |
| P5 | Snapshot régénéré (`pre-rentree:snapshot`) | ✅ 4 blocs, 80 séances, FAQ 17 |
| P6 | SVT dans fiches parents régénérées | ✅ 5× (fiche-premiere, fiche-terminale) |
| P7 | Textes/SEO : SVT + « au choix parmi 5 » | ✅ communication, whatsapp, parent-documents, FAQ manifeste |
| P8 | Cross-check horaires PDF↔JSON | Fiches parents sans grille horaire (rien à vérifier) ; Planning (5a) non généré — dette B-5 |

## Diff textes/SEO (résumé)
- `communication.fr.json` : énumérations Première/Terminale +SVT, slides « Cinq matières au choix », « 1 à 4 au choix parmi 5 ».
- `whatsapp.fr.json` : tarifs Première/Terminale +SVT +« au choix parmi 5 ».
- `parent-documents.fr.json` : descriptions de packs +SVT +« parmi les cinq ».
- `data/campaigns/pre-rentree-2026.json` : nouvelle FAQ SVT (17 entrées) ; `roomRoles.salle-1` inclut SVT ; grille D4-final.
- **Hors périmètre jpo-2026** (codex) → `content/pre-rentree-2026/COORDINATION_JPO.md`.

## Inventaire documentaire (avant/après)
- **Régénérés avec SVT** (WeasyPrint) : 14 documents parents (fiches Première/Terminale, brochure, tarifs/justification, guide-parent/dossier, comparatif, inclusions…). Anciennes versions en git @ `44b50059c`.
- **Non générés (dettes)** : Planning_InfosPratiques (B-5), programmes SVT (B-3, + DRAFT D2), programmes Français/PC (B-4, source `.md` absente).
- **Renderers corrigés** : `render_parent_document_kit.py`, `render_economic_simulation.py` (ajout label SVT).

## Historique (propre, consolidé)
```
fb6ab5cae feat: régénère les documents parents avec SVT (WeasyPrint)
44b50059c feat: textes/SEO SVT — énumérations + FAQ (D3)
ba358c341 docs: audit planning SVT
53f529bd9 fix: plafonne la sélection à 4 matières (D3)
91e14d404 feat: grille SVT en journée + 4 gates (D4-final)
5a48a70df chore: scelle les décisions direction D1-D5
```
3 commits fantômes (auto-commit Windsurf/Devin) audités puis **réauthorés proprement** via soft-reset. Travail réalisé dans un **clone isolé** hors dossier indexé.

## Dettes bloquantes restantes
Voir `DEBTS.md` : **B-1** noms SVT · **B-2** DRAFT programmes SVT · **B-3** générateur PDF programmes · **B-4** source `.md` Français/PC (5f) · **B-5** Planning (5a). Coordination codex : `COORDINATION_JPO.md`. Runbook : `DEPLOY_RUNBOOK.md`. Notifications : `NOTIFICATIONS_FAMILLES.md`.
