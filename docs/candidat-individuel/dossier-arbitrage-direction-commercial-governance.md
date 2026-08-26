# Dossier d'arbitrage direction — Commercial & Governance Approval

**État exact du dépôt** : commit `14c54b979` (branche `feat/candidat-individuel-pricing-devis-v2`), vérifié à
nouveau par `git log --oneline -1` au moment de cette revue. **Aucune ligne de code, aucune configuration
n'a été modifiée pendant la préparation ni la revue de ce dossier.**

**Révision de ce document (revue de readiness)** : suite à un examen plus approfondi du chemin de pricing
réellement exécuté, plusieurs faits techniques de la version précédente de ce dossier se sont révélés
**incomplets ou inexacts** — corrigés explicitement ci-dessous (§1.4, marquée « CORRECTION »). Cette revue
applique aussi la définition demandée de `READY_FOR_DIRECTION_ARBITRATION` : *le dossier contient-il assez
de faits, valeurs, impacts, risques, alternatives et recommandations pour permettre à la direction de
décider* — pas « tout est-il déjà vendable », pas « la recette a-t-elle eu lieu », pas « le système est-il
prêt pour le public ». Ces trois notions restent strictement distinctes (§10).

**Ce document ne décide rien.** Toute case « Recommandation » reste une opinion technique, jamais une
décision. Aucune décision non prise n'est automatiquement traitée comme un motif de `NOT_READY` — si le
dossier contient l'information nécessaire pour trancher, la décision non prise est précisément *l'objet* de
l'arbitrage, pas un obstacle à celui-ci.

---

## 0. Classification des blocages — quatre catégories explicites

Chaque blocage identifié dans ce document est étiqueté avec une ou plusieurs des catégories suivantes :

- **D — DECISION** : décision humaine de direction encore nécessaire.
- **T — TECHNICAL** : correction ou raccordement technique nécessaire, *après* décision.
- **R — RECETTE** : validation humaine à réaliser, *après* application des décisions et des correctifs.
- **P — PUBLIC** : empêche actuellement une mise à disposition publique (indépendamment de l'état de
  l'arbitrage direction).

---

## 1. Faits techniques (vérifiés par lecture directe du dépôt au commit `14c54b979`)

### 1.1 — Deux moteurs de marge distincts coexistent, un seul est réellement branché [T]

| | `lib/quotes/margin.server.ts` | `lib/quotes/pricing-engine.ts` |
|---|---|---|
| Fonction | `computeMargin(lines, policy)` | `computeMargin(priceTnd, costTnd)` — même nom, signature différente |
| Seuils | `DEFAULT_COST_POLICY.marginGates` = `{ greenPct: 40, warningPct: 30 }` | `MARGIN_BLOCKING_THRESHOLD_PCT = 45`, `MARGIN_TARGET_THRESHOLD_PCT = 55` |
| Coût enseignant | `teacherCostPerHourTnd = 100` (taux unique) | Aucun défaut — prend un coût déjà calculé en paramètre |
| Appelants réels (grep, tout le dépôt) | `app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts` | **Aucun**, hors son propre fichier |
| Statut | **Seul chemin réellement exécuté à chaque devis créé aujourd'hui** | Code mort |

### 1.2 — Le mécanisme DUO/SOLO et le gate "effectif minimal" sont eux aussi du code mort [T]

`resolveGroupModality` (`pricing-engine.ts:127-145`) implémente correctement la bascule GROUPE→DUO→SOLO
sous `group_min_open=3`. Zéro appelant en dehors de sa propre définition (grep exhaustif). `computeMargin`
réellement actif assume toujours effectif=3 (`CONSERVATIVE_GROUP_SIZE`), jamais l'effectif réel.

### 1.3 — Le namespace `quotes.costPolicy` est gouverné, mais rien n'y est écrit [T]

`lib/config/schemas.ts` (152-224) enregistre `quotes.costPolicy` dans le `NamespaceId` fermé et valide sa
clé `default`. Un ADMIN peut donc écrire une politique de coût via la route d'admin générique — **ce chemin
existe, mais aucune valeur n'y a jamais été écrite** (aucun seed, aucune donnée ailleurs dans le dépôt n'y
insère de valeur). `DEFAULT_COST_POLICY` reste la valeur opérante. Détail complet en §7.

### 1.4 — CORRECTION du dossier précédent : le vrai chemin de pricing pour 11 des 13 éléments n'utilise
jamais `pricingRuleId` — le gap réel est ailleurs

La version précédente affirmait que `pricingRuleId: null` empêcherait le pricing de 11 éléments via
`resolveRate()`/`priceSelectedModule()`. **Vérification plus poussée : cette affirmation était incomplète.**
`priceSelectedModule`/`priceSelection` (`pricing-engine.ts:165-260`, les fonctions qui consultent
`pricingRuleId` pour un `catalogue.modules`) **n'ont, elles aussi, aucun appelant en dehors de leur propre
fichier et des tests** — confirmé par grep exhaustif sur tout le dépôt. C'est du code mort, comme
`resolveGroupModality` et l'ancien `computeSecondGroupePayment`.

**Le chemin réellement exécuté pour un module `catalogue.modules` sélectionné** (vérifié ligne à ligne dans
`pipeline.ts:410-441`) :

```
resolveCatalogueModules(carte, profil)          [lib/quotes/catalogue.ts:166]
  → resolveModule() par module                   [pipeline.ts consomme SELECTED/NEEDS_HUMAN_REVIEW/EXCLUDED]
  → adaptCatalogueSelectionToExamProfile()        [catalogue.ts:263 — mappe vers un subjectId LEGACY]
  → scoreSubjects() → buildIdealRecommendation()  [priority.ts / pricing.ts — moteur legacy réel]
  → optimizeForBudget()                           [le VRAI prix vient d'ici, jamais de resolveRate()]
```

`adaptCatalogueSelectionToExamProfile` traduit chaque module `SELECTED` vers un `subjectId` legacy via
`MODULE_LEGACY_MAPPING` (`catalogue.ts:234-245`), puis le prix vient de `buildIdealRecommendation` (qui lit
`getCandidatIndividuelModules().petit_groupe` — le même barème `PETIT_GROUPE_4H/8H/12H` = 250/470/680 TND
déjà utilisé par les modules approuvés) — **`pricingRuleId` n'est consulté à aucune étape de ce chemin.**

**Conséquence corrigée, module par module** (`MODULE_LEGACY_MAPPING` ne couvre que 5 des 11) :

- **`MOD_LVA`, `MOD_LVB`, `MOD_SPECIALITE_ABANDONNEE`** : ont un mapping legacy (`lva`, `lvb`,
  `specialite-abandonnee`), format `petit_groupe`. Si un jour approuvés ET matchés sur une carte réelle avec
  un besoin diagnostiqué, ils seraient **correctement priced** par le moteur existant, exactement au tarif
  250/470/680 TND déjà annoncé dans la matrice commerciale. **Aucun correctif technique n'est nécessaire pour
  ces 3 éléments au-delà de l'approbation direction.** `pricingRuleId: null` n'a ici aucun effet (jamais
  consulté).
- **`MOD_HG_ARIA`, `MOD_ES_ARIA`** : ont un mapping legacy (`histoire-geographie`,
  `enseignement-scientifique`) — **mais le moteur legacy ne connaît pas `deliveryMode:
  "autonomie_guidee_aria"`** : si jamais sélectionnés, ils seraient priced au tarif **`petit_groupe`
  standard (250/470/680 TND pour 4/8/12h)**, pas au tarif ARIA annoncé (20/40/80 TND). **Écart architectural
  réel, nouvellement découvert** : le produit "autonomie guidée" décrit dans la matrice commerciale n'a
  aujourd'hui aucun chemin de pricing qui le distingue d'un cours de groupe classique.
- **`MOD_EMC_ARIA`** : **aucun mapping legacy** (absent de `MODULE_LEGACY_MAPPING`). Si jamais sélectionné,
  tomberait dans `modulesNonRepresentables` (`catalogue.ts:271-275`) — bloque `emissionAutomatiqueAutorisee`
  même après approbation, avec un avertissement générique, jamais un prix.
- **`MOD_EAF_DESCRIPTIF`** : **aucun mapping legacy**. Correction supplémentaire : `inclusionPolicy:
  "inclus_uniquement"` n'est **jamais consultée par `resolveModule`/`adaptCatalogueSelectionToExamProfile`**
  (seule la fonction morte `priceSelectedModule` la lit) — l'affirmation précédente « configuré pour être
  silencieusement inclus gratuitement » était donc elle-même incorrecte. Le comportement réel si jamais
  sélectionné : `modulesNonRepresentables`, comme `MOD_EMC_ARIA`.
- **`MOD_MATHS_EXPERTES`, `MOD_MATHS_COMPLEMENTAIRES`, `MOD_DGEMC`, `MOD_LCA`** (options, `epreuveCodes: []`)
  : **aucun mapping legacy**. Même conséquence : `modulesNonRepresentables` si jamais sélectionnés (en plus
  du blocage réglementaire séparé sur `MOD_MATHS_EXPERTES`, coefficient non sourcé).

**Ce que `pricingRuleId: null` signifie donc réellement aujourd'hui** : il ne joue **aucun rôle de
"safe default"** empêchant une vente non approuvée — cette protection est entièrement assurée, en amont,
par `directionApprovalStatus === 'DIRECTION_A_VALIDER'` dans `resolveModule` (vérifié : ce contrôle
s'exécute et retourne `NEEDS_HUMAN_REVIEW` **avant** que `pricingRuleId` ne soit jamais consulté, quel que
soit son chemin). `pricingRuleId` sur une entrée `catalogue.modules` est aujourd'hui une métadonnée inerte
pour le chemin réel de pricing (elle n'a de sens que dans le code mort `priceSelectedModule`/`priceSelection`,
et dans la branche P11 dédiée, qui l'utilise via `resolveRate()` directement, pas via ce chemin générique).

### 1.5 — Aucune valeur de la matrice commerciale n'est `APPROVED`

Vérifié directement : `directionApprovalStatus = "DIRECTION_A_VALIDER"` pour les 13 éléments, sans
exception.

---

## 2. Matrice de reachability — 13 éléments (tableau demandé, colonnes complètes)

| Catalogue ID | Business purpose | Current price / placeholder | `pricingRuleId` actuel | Reachable by `resolveCatalogueModules` | Reachable by pricing pipeline (serait effectivement priced si `SELECTED`) | Technically sellable today | Commercial approval required | Technical work required after approval | Exact technical gap | Public blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| `MOD_LVA` | Renforcement LVA candidat libre | 250/470/680 TND (placeholder, non `APPROVED`) | `null` (inerte, non consulté — §1.4) | **YES** | **YES** — via moteur legacy, `petit_groupe`, prix correct | **NO** (approbation manquante) | **YES** | **NO** | Aucun — approbation seule suffit | **YES** |
| `MOD_LVB` | Renforcement LVB candidat libre | idem | idem | **YES** | **YES** | **NO** | **YES** | **NO** | Aucun | **YES** |
| `MOD_SPECIALITE_ABANDONNEE` | Socle spécialité 1ère abandonnée | idem | idem | **YES** | **YES** | **NO** | **YES** | **NO** | Aucun (+ avertissement obligatoire non technique à afficher) | **YES** |
| `MOD_HG_ARIA` | Autonomie guidée histoire-géo | 20/40/80 TND (placeholder) | `null` (inerte) | **YES** | **YES, mais MAL PRICED** — priced au tarif `petit_groupe` standard, pas ARIA | **NO** | **YES** | **YES** — deliveryMode ARIA jamais consulté par le moteur, pas de tier ARIA | Aucun tier `autonomie_guidee_aria` dans le barème ; aucun branchement dédié (contrairement à P11) | **YES** |
| `MOD_ES_ARIA` | Autonomie guidée enseignement scientifique | idem | idem | **YES** | **YES, mal priced** | **NO** | **YES** | **YES** | idem | **YES** |
| `MOD_EMC_ARIA` | Autonomie guidée EMC | idem | idem | **YES** | **NO** — aucun mapping legacy, `modulesNonRepresentables` | **NO** | **YES** | **YES** | Mapping legacy absent + gap ARIA ci-dessus | **YES** |
| `MOD_EAF_DESCRIPTIF` | Aide descriptif EAF (obligation admin.) | 180/360/540 TND (placeholder) | `null` (inerte) | **YES** | **NO** — aucun mapping legacy, `modulesNonRepresentables` | **NO** | **YES** | **YES** | Format ponctuel non représentable dans le moteur subject-priority — nécessite un chemin dédié (comme P11) | **YES** |
| `MOD_MATHS_EXPERTES` | Option Maths Expertes | 250/470/680 TND (placeholder) | `null` (inerte) | **YES** | **NO** — aucun mapping legacy | **NO** | **YES** | **YES** (+ blocage réglementaire séparé, coefficient non sourcé) | Mapping legacy absent | **YES** |
| `MOD_MATHS_COMPLEMENTAIRES` | Option Maths Complémentaires | idem | idem | **YES** | **NO** | **NO** | **YES** | **YES** | Mapping legacy absent | **YES** |
| `MOD_DGEMC` | Option DGEMC | idem | idem | **YES** | **NO** | **NO** | **YES** | **YES** | Mapping legacy absent | **YES** |
| `MOD_LCA` | Option LCA | idem | idem | **YES** | **NO** | **NO** | **YES** | **YES** | Mapping legacy absent | **YES** |
| `SVC_BACS_BLANCS` | Bacs blancs + correction individualisée | 95/190/285 TND (placeholder) | `null` | **NO** — entrée `catalogue.services`, jamais itérée | **NO** | **NO** | **YES** | **YES** — voir §6 (double gap confirmé) | `catalogue.services` non traité génériquement (seuls `SVC_PILOTAGE`/`SVC_SECOND_GROUPE` sont spécialement câblés) | **YES** |
| `SVC_SECOND_GROUPE` (P11) | Rattrapage 2nd groupe, 2 disciplines | 1080/1800/2880 TND (placeholder) | `INDIVIDUEL_HOUR_MIN` (corrigé, lot précédent) | **NO** (services), **mais branche dédiée** dans `pipeline.ts` | **YES** — via `buildSecondGroupeScenarios`/`resolveRate` (câblage prouvé RED→GREEN) | **NO** (approbation manquante) | **YES** | **NO** | Aucun — seul élément où l'approbation seule suffit techniquement | **YES** |

**Lecture** : sur 13 éléments, **3 (`MOD_LVA`/`MOD_LVB`/`MOD_SPECIALITE_ABANDONNEE`) + 1 (`SVC_SECOND_GROUPE`)
= 4 sont techniquement prêts après une simple approbation.** 9 nécessitent un travail technique
supplémentaire (2 « mal pricés », 7 totalement non représentés dans le moteur actuel).

---

## 3. Recommandation — distinction stricte entre les deux natures de décision

Pour chacun des 13 éléments, deux décisions **distinctes et jamais fusionnées** :

- **`APPROVE_BUSINESS_ELEMENT`** : approuver le principe commercial et le prix affiché — une décision de
  direction, indépendante de l'état technique.
- **`ENABLE_TECHNICALLY_AFTER_APPROVAL`** : entreprendre le travail technique nécessaire pour que
  l'approbation se traduise en devis vendable — une décision d'exécution technique, **jamais automatique**,
  jamais déclenchée implicitement par une `APPROVE_BUSINESS_ELEMENT`.

| Élément | `APPROVE_BUSINESS_ELEMENT` (recommandation) | `ENABLE_TECHNICALLY_AFTER_APPROVAL` (recommandation) |
|---|---|---|
| `MOD_LVA`/`MOD_LVB`/`MOD_SPECIALITE_ABANDONNEE` | Recommandé — prix cohérent avec l'existant, tarif déjà utilisé ailleurs | Aucun travail nécessaire — l'approbation seule active la vente (sous réserve §1.1, politique de marge) |
| `MOD_HG_ARIA`/`MOD_ES_ARIA`/`MOD_EMC_ARIA` | Recommandé sous réserve du prix minimal (12,5 % de marge, mécaniquement bloqué sous 45/55, voir dossier précédent §4) | **Nécessaire et non trivial** — créer un tier de barème dédié + un branchement pipeline dédié (modèle : la branche P11 de ce lot) ; **ne pas activer la commercialisation avant ce travail, sous peine de vendre au mauvais tarif (petit_groupe au lieu d'ARIA) ou de bloquer silencieusement l'émission** |
| `MOD_EAF_DESCRIPTIF` | Recommandé — marge saine (63,9 %), principe opt-in cohérent | Nécessaire — chemin dédié (comme P11), le moteur subject-priority ne représente pas ce format ponctuel |
| `MOD_MATHS_EXPERTES` | Recommandé « par anticipation » **uniquement si distingué explicitement** du blocage réglementaire séparé (coefficient non sourcé) | Nécessaire (mapping legacy) — **et bloqué indépendamment tant que le coefficient réglementaire n'est pas sourcé, quel que soit l'état technique de pricing** |
| `MOD_MATHS_COMPLEMENTAIRES`/`MOD_DGEMC` | Recommandé | Nécessaire (mapping legacy) |
| `MOD_LCA` | Recommandé, avec avertissement sur le risque d'effectif très faible | Nécessaire (mapping legacy) |
| `SVC_BACS_BLANCS` | Recommandé — marge saine (56,6 %), déjà clarifié (ambiguïté unité/package résolue dans le dossier précédent) | Nécessaire — double gap (§6), le plus proche architecturalement du travail déjà fait pour P11 |
| `SVC_SECOND_GROUPE` (P11) | Recommandé sous réserve de la politique de coût (marge palier reco sensible, §1.1) | **Aucun** — seul élément déjà techniquement prêt |

---

## 4. `SVC_BACS_BLANCS` — traitement séparé, confirmation précise du double gap

Vérifié précisément (pas une supposition) :

1. **Gap n°1 — jamais reachable via `resolveCatalogueModules`** : cette fonction (`catalogue.ts:169`) exécute
   `catalogue.modules.map(...)` exclusivement — `catalogue.services` n'est jamais itéré ici, sous aucune
   condition. `SVC_BACS_BLANCS` vit dans `catalogue.services` (confirmé, `data/pricing.canonical.json`).
   **Conséquence : ce service n'apparaît jamais dans `selection.modules`, jamais dans `pendingModuleIds`,
   jamais dans aucun avertissement — il est simplement absent de tout calcul, silencieusement.**
2. **Gap n°2 — même après un hypothétique branchement générique de `catalogue.services`, `pricingRuleId:
   null` + `inclusionPolicy: "inclus_uniquement"` produirait un comportement incohérent avec l'intention
   commerciale** : si un jour câblé de façon générique (comme `SVC_PILOTAGE`), la logique la plus proche
   existante (`priceSelectedModule`, elle-même du code mort) traiterait `inclusionPolicy: "inclus_uniquement"`
   + `pricingRuleId: null` comme "inclus gratuitement dans un forfait" (retourne `monthlyAmountTnd: 0`) — un
   comportement opposé à l'intention documentée (vente à l'unité ou en package, 95/190/285 TND). **Ce n'est
   pas seulement l'absence d'un chemin — la configuration actuelle de l'entrée elle-même, si elle devenait
   un jour atteignable, produirait le mauvais comportement commercial sans un second correctif.**

**Confirmation demandée** : oui, il existe bien un second gap architectural distinct du premier — pas
seulement `pricingRuleId = null`. Aucun correctif n'a été appliqué (mandat de cette phase). Ce service
suit exactement le même schéma que `SVC_SECOND_GROUPE` avant le lot précédent — la même méthode de
correction (branche pipeline dédiée + correction de `inclusionPolicy`/`pricingRuleId`) est directement
transposable, mais non entreprise ici.

---

## 5. `quotes.costPolicy` — état exact

| Question | Réponse vérifiée |
|---|---|
| Namespace gouverné ? | **Oui** — enregistré dans le `NamespaceId` fermé (`lib/config/schemas.ts:152-224`), validé par un schéma Zod strict, écriture possible via la route d'admin générique |
| Valeur persistée actuellement ? | **Non** — aucun seed, aucune écriture, aucune donnée dans le dépôt n'y insère de valeur |
| Fallback effectif | `DEFAULT_COST_POLICY` (`margin.server.ts:38-42`), codé en dur, utilisé systématiquement tant qu'aucune ligne `BusinessConfig` n'existe |
| Coût horaire effectif actuel | **100 TND/h**, taux unique blended, aucune distinction agrégé/certifié/tuteur |
| Seuils effectifs actuels | Bloquant **30 %**, cible **40 %** (`marginGates.warningPct`/`greenPct`) |
| Quels devis réels utilisent ces valeurs ? | **Tout devis créé via `POST /api/assistante/candidat-individuel/profils/[id]/quote`** — c'est le seul appelant de `getCommercialCostPolicy()`/`computeMargin` réel dans tout le dépôt |
| Risque d'une validation tacite du `DEFAULT_COST_POLICY` | Si la direction approuve des prix sans se prononcer explicitement sur la politique de coût, **c'est 100 TND/h et 30 %/40 % qui continueront de gouverner chaque devis réel**, potentiellement en contradiction avec l'intention (ex. les seuils 45 %/55 % déjà codés ailleurs mais jamais raccordés, §1.1) — une approbation de prix sans décision de politique de coût produit un système dont le comportement réel diverge silencieusement de ce que la direction croit avoir approuvé |
| Décision exacte attendue de la direction | (a) confirmer ou remplacer le taux horaire 100 TND/h (et, si remplacé, par quelle(s) valeur(s) — un taux unique ou différencié par qualification, §3.1 du dossier précédent) ; (b) confirmer ou remplacer les seuils 30 %/40 % (garder l'existant, ou activer 45 %/55 % — ce qui nécessite en plus un raccordement technique séparé, §1.1) ; (c) si une valeur est décidée, une écriture technique dans `BusinessConfig` namespace `quotes.costPolicy` (chemin déjà gouverné, §1.3) sera nécessaire pour qu'elle devienne réellement active — **ce n'est pas automatique** |

---

## 6. Les 14 paramètres coûts/gouvernance dédupliqués — avec `DIRECTION_DECISION_READY`

Reprise du tableau du dossier précédent (§3), colonne `DIRECTION_DECISION_READY` ajoutée. `YES` signifie
« la direction dispose de suffisamment d'information dans ce dossier pour trancher » — pas que la valeur
est décidée.

| Paramètre | Valeur actuelle | Valeur proposée/placeholder | `DIRECTION_DECISION_READY` | Si `NO`, information manquante |
|---|---|---|---|---|
| Coût horaire enseignant agrégé | Aucune (inactif) | 70 TND/h, fourchette 65-85 | **NO** | Coût de paie réel de la catégorie « agrégé » — donnée RH, hors du dépôt, jamais fournie ; aucune décision raisonnable de calibration fine sans elle |
| Coût horaire enseignant certifié | Aucune (inactif) | 50 TND/h | **YES** | — Sensibilité documentée (±0,8 pt/5 TND/h), fourchette resserrée, la direction peut trancher entre approuver 50 TND/h tel quel ou demander une confrontation RH, en connaissance du risque |
| Coût horaire tuteur | Aucune (inactif) | 35 TND/h | **NO** | Le statut « tuteur » lui-même n'est pas défini (junior salarié ? vacataire ? étudiant ?) — sans cette définition, aucun taux ne peut être validé de façon éclairée, quel que soit le chiffre |
| Coût de structure horaire | Aucune (inactif) | 15 TND/h | **YES** | — Sensibilité documentée, hypothèse cohérente avec le format distanciel/hybride, impact limité et dégressif |
| Coût fixe de dossier | Aucune (aucun chemin réel) | 120 TND one-off | **YES** | — Impact marginal démontré (<3 % même à ±20 %), le principe (une seule fois, jamais reconduit) est clair, aucune donnée externe manquante pour cette décision |
| Plancher horaire | `college`=40 TND/h (catégorie existante réutilisée) | 45 (`multi`) ou 50 (`single`) TND/h | **YES** | — Aucun prix actuel n'est affecté par le choix (tous au-dessus), c'est une décision de choix de catégorie, pas de calibration — l'information est complète |
| Taux blended actif (fait, pas une hypothèse) | **100 TND/h**, réellement actif | N/A | **YES** | — C'est un fait, pas une décision — la décision associée (le remplacer ou non) est couverte par « coût agrégé/certifié/tuteur » ci-dessus |
| Marge bloquante | 30 % actif | 45 % (codé mort) | **YES** | — Écart clairement documenté, impact démontré sur des cas concrets (`MOD_LVA` eff.3, `SVC_SECOND_GROUPE` palier reco), la direction peut choisir entre les deux valeurs (ou une troisième) en connaissance de cause |
| Marge cible | 40 % actif | 55 % (codé mort) | **YES** | — Idem |
| Plafond de remise | 20 % actif | 20 % (inchangé) | **YES** | — Déjà actif, aucune information manquante ; le risque associé (remise × marge non revérifiée) est documenté séparément et n'affecte pas la lisibilité de cette décision spécifique |
| Règles de cumul de remise | Non cumulable, actif | Inchangé | **YES** | — Déjà actif, comportement clair |
| Seuil de bascule DUO/SOLO | `group_min_open=3`, mécanisme correct mais non appelé | Inchangé | **YES** | — La donnée et le mécanisme existent et sont corrects ; la décision porte sur la priorité de raccordement (un travail technique, §T), pas sur la valeur du seuil elle-même, qui est déjà connue et cohérente |
| Comportement sous effectif minimal | Aucun — n'existe pas | À définir | **NO** | Aucune option concrète n'a été formulée dans ce dossier (blocage ? bascule automatique ? avertissement ?) — la direction ne peut pas choisir entre des options qui n'ont pas été présentées ; un prochain lot devrait proposer 2-3 options concrètes avant que cette ligne devienne `YES` |
| Règle d'arrondi | `rounding_tnd=10`, `Math.floor` dernière mensualité, actif pour le legacy | Inchangé | **YES** | — Déjà actif, comportement conservateur documenté et clair |
| Allocation du coût fixe (dossier) | Aucune — n'existe dans aucun chemin réel | Un seul frais, jamais réparti | **NO** | Les deux méthodes d'allocation possibles (facturé à part / amorti dans le Pilotage) ne sont pas chiffrées ni comparées dans ce dossier — et ce paramètre n'a d'utilité que si la direction décide d'abord de facturer ce coût au client (ce qui n'est même pas encore tranché) ; prématuré tant que cette décision-mère n'existe pas |

**Sur 14 paramètres : 10 sont `DIRECTION_DECISION_READY = YES`, 4 nécessitent une information
supplémentaire non disponible dans ce dépôt** (coût agrégé et tuteur : données RH externes ; comportement
sous effectif minimal et allocation du coût fixe : options non encore formulées).

---

## 7. Recette marge BLOCKED — preuve technique vs recette humaine

Distinction stricte, comme demandé :

- **Preuve technique du comportement `BLOCKED`** : au niveau unitaire, prouvée — `__tests__/lib/quotes/
  margin.test.ts:51-56` (« gate thresholds are exactly the configured policy values (30/40), not hardcoded
  elsewhere ») vérifie explicitement `result.gate === 'BLOCKED'` avec les seuils réels. Au niveau de la
  route `POST .../quote` : **correction, pas de test automatisé existant** — vérifié par grep, aucun test
  dans `__tests__/database/candidat-individuel-quote-creation.test.ts` ni ailleurs n'exerce le chemin
  `margin.gate === 'BLOCKED'` de cette route. Le comportement (`422 Marge insuffisante — override requis`,
  aucun `Quote` créé) est vérifié par **lecture directe du code source** de la route
  (`app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts:97-104`), pas par un test rejoué.
  **La preuve technique complète (formule + gate au niveau route, avec assertion automatisée) n'existe donc
  qu'à moitié — le niveau route mériterait un test dédié dans un futur lot technique, signalé ici comme un
  gap de couverture, pas corrigé (mandat de cette phase).**
- **Recette humaine sur catalogue réellement approuvé** : vérifié dans cette revue — les seuls modules
  aujourd'hui `APPROVED` (`MOD_EAF_ECRIT_ORAL`, `MOD_EDS1`, `MOD_EDS2`, `MOD_PHILOSOPHIE`, `MOD_EAM`, plus
  `SVC_PILOTAGE` sans coût) produisent, combinés dans un scénario réel, une marge blended comprise entre
  ~41 % et ~45 % selon la combinaison — **au-dessus du seuil bloquant réel (30 %) dans tous les cas
  observés**, notamment parce que `SVC_PILOTAGE` (150 TND/mois, coût nul dans `computeMargin`, aucune heure)
  tire mécaniquement la marge blended vers le haut dans tout devis réel. **Aucune combinaison du catalogue
  actuellement `APPROVED` ne produit naturellement un cas `BLOCKED` sous la politique active (30 %/40 %,
  100 TND/h)** — vérifié par calcul, pas supposé.

**Conclusion pour ce scénario de recette (§6.5 du dossier précédent)** :
**`NOT_APPLICABLE_WITH_CURRENT_APPROVED_CATALOGUE`** pour la recette humaine — le gate est déjà prouvé
techniquement, et fabriquer un prix ou une configuration commerciale fictive pour forcer un cas `BLOCKED` en
recette produirait une preuve artificielle, refusée par principe. **Si de nouveaux éléments (§2/§3) sont un
jour approuvés et techniquement activés à des marges plus faibles (ex. `MOD_HG_ARIA` au palier minimal,
12,5 % de marge), un cas `BLOCKED` réel apparaîtra naturellement à ce moment — la recette humaine sur ce
point devient pertinente seulement après cette activation, pas avant.**

---

## 8. Ordre d'exécution recommandé

**A. Décisions direction à prendre maintenant** (informations suffisantes dans ce dossier, §6 —
`DIRECTION_DECISION_READY = YES`) :
1. Politique de coût horaire — au minimum statuer sur le taux « certifié » (50 TND/h, information complète)
   et sur le taux blended actif (100 TND/h, à garder ou remplacer) ; les taux agrégé/tuteur restent en
   attente de données RH (non bloquant pour les autres décisions).
2. Seuils de marge candidat-individuel (30 %/40 % actif vs 45 %/55 % codé-mort, ou une troisième valeur).
3. Prix par élément (§2/§3) — approbation `APPROVE_BUSINESS_ELEMENT`, élément par élément ou par lot,
   **explicitement distincte** de toute décision d'activation technique.
4. Plancher horaire (catégorie dédiée vs réutilisation de `college`).
5. Principe du coût fixe de dossier (120 TND, si/quand facturé).

**B. Travaux techniques conditionnels à ces décisions** (aucun entrepris avant une décision A
correspondante — mandat de cette phase = documentation uniquement, aucun travail engagé ici) :
1. Raccordement de la politique de coût choisie dans `BusinessConfig` (`quotes.costPolicy`, chemin déjà
   gouverné, §5).
2. Raccordement des seuils de marge choisis (si 45 %/55 % ou une autre valeur que 30 %/40 %).
3. Pour `MOD_LVA`/`MOD_LVB`/`MOD_SPECIALITE_ABANDONNEE` : aucun travail (§2) — activables dès l'approbation.
4. Pour `MOD_HG_ARIA`/`MOD_ES_ARIA`/`MOD_EMC_ARIA` : création d'un tier de barème dédié + branchement
   pipeline spécifique (modèle : la branche P11).
5. Pour `MOD_EAF_DESCRIPTIF`, les 4 options, `SVC_BACS_BLANCS` : chemin dédié par élément (même modèle).
6. Raccordement de `resolveGroupModality` (bascule DUO/SOLO) et définition d'un comportement sous effectif
   minimal — prérequis avant toute activation de `MOD_*` à effectif variable.
7. Vérification/correction du risque remise × marge non revérifiée après remise.

**C. Recette humaine** (après B, jamais avant) :
1. Exécuter le corpus proposé dans le dossier précédent (§6, scénarios 6.1-6.4 et 6.6 — directement
   exécutables aujourd'hui sur un environnement jetable, indépendamment des décisions A/B, puisqu'ils testent
   des comportements déjà en place).
2. Scénario marge `BLOCKED` (§7 ci-dessus) : `NOT_APPLICABLE` tant que B.3/B.4/B.5 n'ont pas activé des
   éléments à marge plus faible — à réévaluer après.
3. Toute nouvelle recette spécifique aux éléments activés en B (ex. `MOD_HG_ARIA` une fois son tier créé).

**D. Dernier gate public** :
Après A, B et C — jamais avant, et jamais automatiquement. Un `PUBLIC_RELEASE: GO` nécessite en plus des
étapes ci-dessus une décision de direction séparée et explicite sur la mise à disposition publique
elle-même, hors du périmètre technique de ce dossier.

---

## 9. Verdicts — trois notions indépendantes

### DIRECTION_ARBITRATION : **READY**

Le dossier contient, pour au moins 10 des 14 paramètres de gouvernance/coût (§6) et pour les 13 éléments
commerciaux (§2/§3, avec la distinction stricte `APPROVE_BUSINESS_ELEMENT` vs
`ENABLE_TECHNICALLY_AFTER_APPROVAL`), les faits, valeurs actuelles, impacts chiffrés, risques et
alternatives nécessaires pour que la direction tranche. Les décisions non prises listées en §8.A sont
précisément l'objet de l'arbitrage, pas un obstacle à celui-ci — conformément à la définition demandée.

Les seules informations réellement manquantes (§6, lignes `NO`) sont des données RH externes (coût agrégé,
statut « tuteur ») et deux options non encore formulées (comportement sous effectif minimal, allocation du
coût fixe) — **aucune de ces quatre lacunes n'empêche la direction de trancher les 10 autres paramètres et
les 13 éléments commerciaux dès maintenant** ; elles peuvent être traitées dans un arbitrage complémentaire
ultérieur sans bloquer celui-ci.

### INTERNAL_HUMAN_RECETTE : **NOT_READY**

Aucune recette humaine effective n'a eu lieu (le corpus §6 du dossier précédent est une proposition, non
exécutée). Logiquement postérieure à l'arbitrage et aux travaux techniques conditionnels (§8.B) — ce statut
est attendu à ce stade, pas un signal d'alerte sur la qualité de ce dossier.

### PUBLIC_RELEASE : **NO_GO**

Aucun élément n'est activable pour le public : 9 des 13 éléments commerciaux nécessitent un travail
technique non entrepris, la politique de coût/marge réelle n'est pas tranchée, et aucune recette humaine
n'a eu lieu. `NO_GO` reste la seule position possible tant que A, B et C (§8) ne sont pas complétés — ce
verdict ne dépend pas de l'état de `DIRECTION_ARBITRATION`.
