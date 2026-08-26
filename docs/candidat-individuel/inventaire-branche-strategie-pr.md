# Inventaire de branche et stratégie de revue — `feat/candidat-individuel-pricing-devis-v2` (mission "vers un produit complet" §8)

**Portée de ce document** : purement informatif — aucun push, aucune réécriture d'historique (rebase/squash/
cherry-pick), aucun déploiement. `git fetch origin` exécuté, aucune action destructive prise.

## 1. État réel vs remote — la branche n'est PAS divergée de `main`

```
git fetch origin
git rev-list --left-right --count origin/feat/candidat-individuel-pricing-devis-v2...HEAD → 0  98
git log --oneline origin/main..HEAD → 51 commits
git log --oneline HEAD..origin/main → 0 commits
```

Ces deux chiffres (98 vs 51) ne se contredisent pas — ils répondent à deux questions différentes :

- **98** = commits d'écart avec la référence distante de **cette branche de feature**
  (`origin/feat/candidat-individuel-pricing-devis-v2`), dont le dernier commit distant est `ceb0a4278`
  (`fix(security): patch deepmerge-ts CVE...`) — un instantané ancien, jamais mis à jour côté GitHub depuis.
- **51** = commits réellement nouveaux et propres au travail de cette mission, calculés contre
  `origin/main` (tip `561c9d66e`, "Merge pull request #171"). **La branche locale est à 0 commit de retard
  sur `origin/main` et 51 en avance — elle n'a jamais divergé, elle contient simplement `main` + le travail
  de mission.**

Les 47 commits d'écart entre 98 et 51 (`ceb0a4278..561c9d66e`) sont des Pull Requests **déjà mergées sur
`origin/main`** par d'autres contributeurs (maths complémentaires bilans, corrections marketing, retrait de
composant candidat-individuel mort — PR #160 à #171) — absorbées dans cette branche via un unique commit de
réconciliation (`dbb262550`, `merge: reconcile with origin/main (PR #160-171) before Lot 3`) avant de
reprendre le travail de mission (Lot 3). **Elles n'ont besoin d'aucune revue ici** — elles sont déjà en
production sur `main` par leur propre chemin de revue GitHub, indépendant de cette mission.

**Conclusion pratique** : la vraie unité de revue est **51 commits**, pas 98 — la stratégie de PR ci-dessous
porte sur ces 51 commits.

## 2. Inventaire chronologique — 51 commits, `origin/main..HEAD`

| # | SHA | Sujet | Catégorie |
|---|---|---|---|
| 1 | `ab48fe01b` | feat(exams): add A_VERIFIER sentinel for unconfirmed regulatory values | regulatory |
| 2 | `cea0f97e6` | feat(exams): add modalité A/B coefficients for tronc commun ponctuel, flag unconfirmed matières | regulatory |
| 3 | `ff87a4d46` | feat(exams): encode practical-part exam dispensation for NSI/PC/SI/SVT individual candidates | regulatory |
| 4 | `22f1a0581` | feat(exams): encode mention loss on note conservation (D. 334-13 / D. 336-13) | regulatory |
| 5 | `0bfa618d6` | feat(exams): encode terminale-option exclusion rules and DGMEC->DGEMC alias | regulatory |
| 6 | `0d0309832` | feat(exams): add declarative structures for bascule scolaire, dispenses titulaire bac, second groupe | regulatory |
| 7 | `522cc2651` | feat(exams): add multi-session resolver — 2026 historical read-only, 2028 unconfirmed skeleton | regulatory |
| 8 | `913f8a099` | feat(exams): fail-closed resolution for conserved-note coefficients across sessions | regulatory |
| 9 | `224fa0b05` | feat(exams): add structured verifieLe date to tunisiaSpecific for back-office freshness alert | regulatory |
| 10 | `abadad312` | feat(exams): add client-safe exam-policy loader for real-time wizard validation | frontend |
| 11 | `eb71f4c85` | test(exams): narrow ConservedNoteCoefficientResult before accessing .reason | qa |
| 12 | `e2a59b44f` | fix(quotes,exams): close two gaps found by Lot 1 code review | backend/regulatory |
| 13 | `fe99881ba` | docs(quotes): commit Lot 1 audit and implementation plan, mark Lot 1 complete | docs |
| 14 | `d449d0f18` | fix(marketing): correct dispense-pratique list and disclose mention loss on note conservation | frontend |
| 15 | `2e9e67340` | feat(quotes): add ProfilCandidat model and extend Quote (Lot 2, scoped) | db |
| 16 | `1baacaa71` | docs(quotes): commit P1-P12 evidence reconstruction (draft, not direction-approved) | docs |
| 17 | `c4ad90a59` | docs(quotes): D4 final — 25% acompte + 10 mensualités (mission finale go-live) | docs |
| 18 | `92610afd5` | docs(quotes): ADR resolving P1-P12 taxonomy (direction decision, mission finale) | docs |
| 19 | `919ed56b3` | feat(quotes): add ParcoursType enum, unblocked by the P1-P12 ADR (Lot 2 complement) | backend |
| 20 | `ab7314118` | feat(quotes): implement D4 — 25% acompte + 10 mensualités everywhere | backend |
| 21 | `dbb262550` | merge: reconcile with origin/main (PR #160-171) before Lot 3 | merge (47 commits déjà publics, voir §1) |
| 22 | `026419ca0` | feat(exams): add resolveParcoursType — 11 principal ParcoursType + P9 modifier (Lot 3, part 1) | regulatory |
| 23 | `5872e6302` | feat(exams): add genererCarteExamen — épreuve-by-épreuve exam card (Lot 3, part 2) | regulatory |
| 24 | `4d6da05a2` | fix(exams): correct RECONDUITE from an unsourced absolute to fact-gated resolution, expose parcours conflicts (Lot 3 correction) | regulatory |
| 25 | `66325a38d` | feat(exams): Lot 4 — validateProfilCandidat + sources durables + mecanisme/dispensesDeclarees model | regulatory/backend |
| 26 | `9b0738e19` | fix(exams): Lot 4 completeness correctif — missing invariants, legacy proof, D.334-7-1 primary source, gate contract | regulatory |
| 27 | `848fb4070` | docs(exams): formalize RECONDUCTION_AUTOMATIQUE_CONFIRMEE and P3 exposure as blocking ADR gates | docs |
| 28 | `421e474a7` | docs(quotes): approve Lot 5 catalogue architecture — sequencing, legacy containment, volume/P11 gates | docs |
| 29 | `489ada007` | feat(quotes): confine legacy SituationInput quotes as provisional (Lot 5 Décision 1) | backend |
| 30 | `a259f57dc` | feat(quotes): candidat-individuel service/module catalogue — Lot 5 | backend |
| 31 | `34cd74915` | fix(quotes): Lot 5 security correctif — server-side fail-closed emission guard | backend/security |
| 32 | `82f29c42d` | feat(quotes): candidat-individuel pricing engine Phase A + Phase B costed dossier | backend |
| 33 | `13748c574` | feat(quotes): recâblage foundation — orchestrator, normalizer, feature flag, shadow mode | backend |
| 34 | `77304e477` | fix(exams): close both regulatory debts — reconduction audit trail + P3 states (ADR CLOSED) | regulatory |
| 35 | `06da75fb9` | feat(quotes): integrate diagnostic + budget into the pipeline, never a second optimizer (mission §1/§2) | backend |
| 36 | `d68644512` | docs(quotes): decisional dossier for the 14 elements + V1 cost calibration proposal (mission §7/§9) | docs |
| 37 | `1495eef65` | test(quotes): synthetic shadow corpus across 29 profiles, real path + honest gap finding (mission §10) | qa |
| 38 | `c4fed4fc9` | feat(quotes): internal assistante workspace for the candidat-individuel pipeline (mission §5) | frontend |
| 39 | `7b7f55856` | fix(quotes): bound shadow-log latency + document the real shadow-mode wiring (mission §4) | backend |
| 40 | `94695d6db` | docs(quotes): extend the 14-element dossier + costPolicy table, retire SVC_TUTORAT_COMPRESSION (§1/§2) | docs |
| 41 | `dc3e1d66d` | feat(quotes): create draft Quote from a validated simulation (mission §4) | backend/db |
| 42 | `e940fc931` | feat(quotes): preview of the future public wizard, ADMIN/ASSISTANTE-gated (mission §6/§7) | frontend |
| 43 | `3d58a4354` | fix(exams): P3 compressed-pace honesty warning — retirement never implied the need is covered (§3) | regulatory |
| 44 | `afea675ff` | fix(quotes): security hardening + wizard step-matrix gaps (mission §5/§9) | backend/security |
| 45 | `e3353632c` | fix(admin): pg_advisory_xact_lock deserialization crash — every BusinessConfig write was silently 500ing (§2) | backend |
| 46 | `812b4a73e` | fix(a11y): zero axe critical/serious violations on candidat-individuel surfaces (mission §6) | frontend/a11y |
| 47 | `27c0980f0` | docs(quotes): final report — mission "vers un produit complet" (16-point verification) | docs |
| 48 | `7cdb1ac77` | feat(quotes): wire the candidat-individuel pipeline into the existing PDF/signed-link infrastructure (§4) | backend |
| 49 | `6e7f7ca7f` | fix(quotes): three real PDF layout defects found via visual QA (mission §5) | frontend |
| 50 | `882702e36` | test(quotes): committed, real E2E suite for the candidat-individuel pipeline against the production build (§3) | qa |
| 51 | `9c86c6e48` | docs(quotes): close the technical closure lot — 320px/zoom checks, final report rewrite (§7/§10) | docs |

**Plus, non commité à ce stade** (lot de fermeture P11/P3 en cours, ce document) : la connexion réelle de
`computeSecondGroupePayment` au pipeline (P11), le gate commercial P3 (`blockingReasonCodes`), et l'ensemble
des preuves/tests associés — sera commité séparément une fois la vérification §7 terminée, catégorie
`backend/regulatory + qa` combinée.

## 3. Groupement logique par Lot

| Lot | Commits | Objet | Migrations DB associées |
|---|---|---|---|
| **Lot 1 — Fondations réglementaires** | 1-13 | Sentinelle `A_VERIFIER`, coefficients modalité A/B, dispenses pratiques, perte de mention, résolveur multi-session, dates de fraîcheur | Aucune (données statiques `data/exams/*.json`) |
| **Lot 2 — Modèle `ProfilCandidat` + D4** | 14-20 | Modèle `ProfilCandidat`, échéancier D4 (25 % acompte + 10 mensualités), taxonomie P1-P12 (ADR) | `add_profil_candidat`, `add_parcours_type` |
| **Réconciliation** | 21 | Fusion de `main` (PR #160-171, déjà publiques) | — |
| **Lot 3 — `resolveParcoursType` + `genererCarteExamen`** | 22-24 | Les deux fonctions choke-point de la classification réglementaire et de la carte d'examen | Aucune nouvelle (utilise Lot 2) |
| **Lot 4 — Validation + sources durables** | 25-27 | `validateProfilCandidat`, modèle `dispensesDeclarees`, ADR `RECONDUCTION_AUTOMATIQUE_CONFIRMEE`/P3 | `add_quote_deposit_columns`, `add_profil_lot3_fields` |
| **Lot 5 — Catalogue + moteur de pricing + recâblage** | 28-34 | Catalogue services/modules, moteur de pricing Phase A/B, orchestrateur shadow-mode, fermeture des dettes P3 | Aucune nouvelle |
| **Mission "vers un produit complet" — noyau pipeline** | 35-40 | Intégration diagnostic+budget, dossier décisionnel 14 éléments, corpus shadow 29 profils, workspace interne assistante | `add_dispenses_declarees`, `add_quote_regulatory_maturity`, `add_shadow_comparison_log` |
| **Mission "vers un produit complet" — Quote/PDF/sécurité/a11y** | 41-47 | Création de `Quote` réelle, aperçu wizard public, warning P3, durcissement sécurité, correctif crash admin, accessibilité, rapport final | `add_p3_eligibilite_audit`, `add_profil_candidat_review_revision` |
| **Lot de clôture technique** | 48-51 | Raccordement PDF/lien signé, correctifs QA visuelle, suite E2E réelle committée, rapport final réécrit | Aucune nouvelle |
| **Lot de fermeture P11/P3 (en cours, non commité)** | — | `computeSecondGroupePayment` raccordé au pipeline, gate commercial P3, preuve RED→GREEN, tests DB/PDF/E2E/architecture | `add_quote_payment_policy` (nouvelle, déjà appliquée sur la base disposable) |

## 4. Dépendances entre groupes

```
Lot 1 (réglementaire statique)
  └─▶ Lot 2 (ProfilCandidat + ParcoursType enum — a besoin des faits Lot 1 pour typer les champs)
        └─▶ Lot 3 (resolveParcoursType/genererCarteExamen — consomme Lot 1+2 directement)
              └─▶ Lot 4 (validateProfilCandidat — appelle Lot 3, ajoute dispensesDeclarees)
                    └─▶ Lot 5 (catalogue/pricing — carte-aware, a besoin de la carte de Lot 3/4)
                          └─▶ Mission produit complet — noyau (pipeline unique, orchestre Lot 3-5)
                                └─▶ Mission produit complet — Quote/PDF/sécurité (persiste ce que le pipeline produit)
                                      └─▶ Lot de clôture technique (raccorde Quote à l'infra PDF existante)
                                            └─▶ Lot de fermeture P11/P3 (ferme un trou trouvé dans le lot précédent)
```

Chaîne strictement linéaire — aucun Lot ultérieur n'a pu être développé avant que le précédent existe
(chacun importe des symboles du précédent). Aucune parallélisation rétroactive possible sans réécrire
l'historique (exclu par mandat).

## 5. Ordre des migrations (déjà appliqué, dans cet ordre, sur la base disposable de test)

```
1. 20260824090000_add_profil_candidat
2. 20260824093000_add_parcours_type
3. 20260825080000_add_quote_deposit_columns
4. 20260825100000_add_profil_lot3_fields
5. 20260826070000_add_dispenses_declarees
6. 20260826080000_add_quote_regulatory_maturity
7. 20260826090000_add_shadow_comparison_log
8. 20260826100000_add_p3_eligibilite_audit
9. 20260826110000_add_profil_candidat_review_revision
10. 20260826162643_add_quote_payment_policy   ← lot en cours, non commité, déjà appliqué et vérifié (prisma migrate status: up to date)
```

Toutes additives (`ADD COLUMN`/`CREATE TABLE`/`CREATE ENUM`), aucune non réversible, aucune perte de données
sur une table existante — vérifié par lecture de chaque `migration.sql`.

## 6. Catégorisation

| Catégorie | Nombre de commits (sur 51) |
|---|---|
| `regulatory` (lib/exams, data/exams) | 14 |
| `backend` (lib/quotes, app/api) | 15 |
| `db` (schema/migrations, souvent combiné à `backend`) | inclus ci-dessus |
| `frontend` (app/, components/) | 6 |
| `docs` | 9 |
| `qa` (tests dédiés, hors tests unitaires accompagnant chaque commit) | 3 |
| `security` | inclus dans `backend` (2 commits dédiés : Lot 5 correctif, mission §5/§9) |
| `a11y` | 1 |
| `merge` | 1 |

(Total > 51 impossible par construction — un commit peut porter plusieurs libellés informels ci-dessus, le
tableau les compte dans leur catégorie dominante uniquement.)

## 7. Proposition de stratégie de revue/PR

**Risque d'une seule PR à 51 commits (ou 98 avec la réconciliation)** : revue humaine peu réaliste en une
passe — mélange réglementaire (haute criticité légale), moteur de pricing (haute criticité commerciale),
sécurité (crash admin, guard d'émission), UI (assistante + aperçu public), et QA. Un reviewer unique ne peut
raisonnablement évaluer l'exhaustivité réglementaire ET l'architecture backend ET l'UX en une seule revue —
risque de revue superficielle qui donnerait un faux sentiment de couverture.

**Proposition (technique, pas engageante commercialement) — découpage en 4 PR séquentielles, dans l'ordre
des dépendances (§4), chacune mergeable indépendamment une fois la précédente acceptée** :

1. **PR "Fondations réglementaires"** (Lots 1-4, commits 1-27, hors réconciliation) — reviewer avec une
   compétence réglementaire (arrêtés/décrets bac) prioritaire ; migrations 1-4 incluses.
2. **PR "Catalogue, pricing, recâblage"** (Lot 5, commits 28-34) — reviewer backend, aucune migration.
3. **PR "Pipeline produit complet"** (commits 35-47, mission "vers un produit complet") — reviewer backend +
   sécurité (crash admin, guard) + a11y ; migrations 5-9 incluses.
4. **PR "Clôture technique + P11/P3"** (commits 48-51 + le lot en cours de ce document, une fois commité) —
   reviewer backend + QA (E2E), dernière migration incluse ; **doit rester bloquée en review jusqu'à
   l'approbation direction du §4/§5 (matrice commerciale, calibration des coûts)** — le code peut être
   mergé sans activer aucun prix (`directionApprovalStatus` reste `DIRECTION_A_VALIDER`), mais la PR doit
   documenter explicitement que le merge ne vaut pas approbation commerciale.

La réconciliation `main` (commit 21, PR #160-171) n'a besoin d'aucune revue séparée — déjà publique.

**Ce que ce découpage NE fait PAS** : il ne rejoue aucun commit, ne réécrit aucun message, ne réordonne rien
— chaque "PR" proposée est une plage contiguë de l'historique existant, ouvrable telle quelle avec
`git request-pull`/`gh pr create --base <PR précédente>` sans un seul rebase.

## 8. Ce que ce document ne fait pas

Aucune PR n'a été ouverte, aucun push n'a été effectué, aucune branche n'a été créée. Ceci est un document
d'aide à la décision, à exécuter uniquement sur instruction explicite ultérieure.
