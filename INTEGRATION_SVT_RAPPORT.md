# INTEGRATION SVT — Pré-rentrée 2026 · Rapport final

- **Branche** : `feat/svt-integration-final` (clone isolé `/tmp/nexus-svt-work`, hors dossier indexé).
- **Base** : `e137009e8` (production `d0ce2241` + SVT + CI).
- **Décisions** : D1–D5 scellées ; SVT DRAFT tant que D2 non levée ; aucun envoi famille ; aucun merge/déploiement.

## Grille finale (D4-final)

Blocs A 08:30–10:30 · B 10:45–12:45 · C 13:30–15:30 · D 15:45–17:45 (**pas de bloc E**).

**Semaine 2** — A : 2nde NSI / 1ère PC · **B : Term SVT (s1)** / 2nde PC · C : Term NSI / **1ère SVT (s2)** · D : 1ère NSI (permuté) / Term PC. Semaine 1 inchangée.

## Matrice de preuves (relancée intégralement)

| # | Preuve | Résultat |
|---|---|---|
| P1 | Suite `pre-rentree-2026` (jest) | **228/229** (1 rouge = provenance origin/main, dette N-2) |
| P2 | 4 gates données réelles | ✅ noRoom / noTeacher / noLevel / dailyLoad |
| P3 | `tsc --noEmit` | ✅ 0 erreur |
| P4 | Régression cap 4 matières | ✅ 5→4 sans « Missing canonical campaign pack » |
| P5 | Snapshot régénéré | ✅ 4 blocs, 80 séances, FAQ 17 |
| P6 | SVT dans docs parents régénérés | ✅ fiches Première/Terminale (5×) |
| P7 | Textes/SEO « au choix parmi 5 » + SVT | ✅ communication, whatsapp, parent-documents, FAQ |
| P8 | **Cross-check horaires PDF↔JSON (Planning)** | ✅ **PASS** — tous les créneaux du JSON présents, aucun horaire du soir, SVT Première C / Terminale B |
| P9 | Interdits sur 9 PDF (rémunération, « à valider », « formation », agrégé/certifié, 120) | ✅ AUCUN |
| P10 | Poids PDF < 2 Mo | ✅ (75–444 Ko) |

## Documents produits (charte v3, `assets/campaigns/pre-rentree-2026/documents-final/`)

| PDF | B- | Note |
|---|---|---|
| Programme_Seconde / Premiere / Terminale | B-4 | Français & PC inclus par niveau |
| Programme_SVT_Première_DRAFT / _Terminale_DRAFT | B-3 | Filigrane « DOCUMENT DE TRAVAIL » piloté par D2 |
| Planning_InfosPratiques | B-5 | Grilles par niveau + vue semaine×bloc×salle + rôles abstraits ; horaires ex-JSON |
| Tarifs · DossierAccueil_PRINT · FlyerEssentiel | 5c/5d/5e | « 1 à 4 au choix parmi 5 », SVT, effectifs à jour |

Générateur porté et adapté : `tools/pdf-generator/generate_all_pdfs.py` (horaires **exclusivement** ex-`data/campaigns/pre-rentree-2026.json`, labels SVT/Philo, réclames enseignant non prouvées retirées).

## Historique (propre, consolidé)
```
71a4acc61 chore: propage group_max Fondations 6->5 (suite cherry-pick)
16a931c5b feat(pdf): porte le générateur v3 et produit les documents SVT (B-3/B-4/B-5)
00204ac6c fix(codex): group_max 5 + RELEASE_SHA (cherry-pick -x c5f726fc0)
6cee21cbd docs: coordination codex, dettes, runbook, notifications, rapport
fb6ab5cae feat: régénère les documents parents avec SVT
44b50059c feat: textes/SEO SVT — énumérations + FAQ (D3)
ba358c341 docs: audit planning SVT
53f529bd9 fix: plafonne la sélection à 4 matières (D3)
91e14d404 feat: grille SVT en journée + 4 gates (D4-final)
5a48a70df chore: scelle les décisions direction D1-D5
```
Isolement respecté (clone hors dossier indexé) ; 3 commits fantômes Windsurf/Devin réauthorés proprement ; cherry-pick codex classé « touche donnée de campagne → cherry-pick » (règle appliquée).

## Audit direction (A–D) — corrections avant push

**A. Conformité programmes officiels** — `CONFORMITE_PROGRAMMES.md` produit (mapping notion par notion vs BO n°14 du 2/4/2026, vérifié sur le BO PDF officiel). Constats : Maths Seconde **manque le thème « Statistiques et probabilités »** (majeur 2026) + valeur absolue + second degré ; Maths Première : ajouter second degré/discriminant + exponentielle + **épreuve anticipée fin de Première**, sinus/cosinus non annoncés (✅). SVT alignée BO 25/7/2019 (3 thèmes) — « Corps humain et santé » sous-représenté. Français/NSI/PC : **aucun changement 2026** (vérifié) ; Français Première ne nomme **aucune œuvre** (✅). Toutes les corrections maths = **PROPOSITIONS scellées** (`mathsProgramConformity2026`), non publiées.

**B. Mention « certifiés/agrégés »** — `ARBITRAGE_ENSEIGNANTS.md` : 3 suppressions listées, formulation conservée en variante désactivée. **2 options en attente d'arbitrage.**

**C. Dépôt de destination** — cible `cyranoaladin/nexus-project_v0` **validée** (ancêtre commun `e137009e8`, `d0ce2241` dans son main). `canonical-repo-a1192c8d` est une mainline **divergente** (dette N-12). Push sur **branche neuve** `feat/svt-integration-clean`, zéro force.

**D. Plannings — complétude & accessibilité**
- D1 ✅ Les **3 grilles par niveau sont montées côté serveur** (masquées en CSS via `hidden`, plus via Radix qui démontait) — test dédié.
- D2 ✅ Liens de **téléchargement PDF** (Planning, 3 programmes, Tarifs, Flyer) dans les sections planning **et** programmes, libellés + poids ; servis depuis `/public` (SVT DRAFT exclu).
- D3 ✅ Test de **cohérence croisée automatisée** créneaux JSON ↔ PDF Planning (échec si divergence).
- D4 ✅ Grille ci-dessous ; Terminale NSI+PC+SVT = **6 h consécutives** (B+C+D, au plafond).
- D5 ✅ **Aucun nom réel** dans les données publiques (rôles abstraits, `educators=[]`).
- D6 → dette N-9 (politique d'affectations, position par défaut : conserver salles+créneaux+rôles abstraits).

### Grille finale complète (D4)
**Semaine 1** — A : 3e Maths (s1) / 2nde Français (s2) · B : 2nde Maths (s1) / 3e Français (s2) · C : 1ère Maths (s1) / Term Philo (s2) · D : Term Maths (s1) / 1ère Français (s2).
**Semaine 2** — A : 2nde NSI (s1) / 1ère PC (s2) · B : **Term SVT (s1)** / 2nde PC (s2) · C : Term NSI (s1) / **1ère SVT (s2)** · D : 1ère NSI (s1) / Term PC (s2).

## Dettes bloquantes restantes → `DEBTS.md`
**B-1** noms SVT · **B-2** levée DRAFT D2 (commande fournie) · **B-6** calculatrice SVT. Non bloquantes : N-2 test provenance (PR séparée), N-3 dette codex jpo, N-4 SNT Seconde, N-7 granularité programmes, N-8 group_max/Docker. Coordination : `COORDINATION_JPO.md` · Runbook : `DEPLOY_RUNBOOK.md` · Notifications : `NOTIFICATIONS_FAMILLES.md`.
