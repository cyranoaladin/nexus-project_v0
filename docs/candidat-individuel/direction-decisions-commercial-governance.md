# Registre des décisions de direction — Commercial & Governance (Candidat Individuel)

**Base** : dossier d'arbitrage committé au commit `130629282`
(`docs/candidat-individuel/dossier-arbitrage-direction-commercial-governance.md`), lui-même construit sur
le lot de fermeture P11/P3 (`14c54b979`). **Étape strictement documentaire — aucun fichier de code, aucune
configuration runtime, aucun `directionApprovalStatus`, aucun `pricingRuleId`, aucun `deliveryMode`, aucun
`inclusionPolicy`, aucun `quotes.costPolicy`, aucun `DEFAULT_COST_POLICY`, aucun mapping legacy n'est
modifié par ce document. Aucun nouveau chemin de pricing n'est raccordé.**

**Invariant fondamental de ce registre** : une décision commerciale (`BUSINESS_APPROVAL`/`PRICE_APPROVAL`)
**n'autorise jamais implicitement** une activation technique (`TECHNICAL_ACTIVATION`). Les deux natures de
décision sont enregistrées séparément pour chaque élément, systématiquement.

---

## 1. Statuts du registre

| Statut | Signification |
|---|---|
| `APPROVED` | Décision de direction actée, sans réserve supplémentaire au niveau commercial/gouvernance. Ne vaut jamais activation technique. |
| `APPROVED_IN_PRINCIPLE` | Le principe commercial est acté, mais un élément dépendant (prix, donnée externe, ou activation) reste explicitement en suspens. |
| `CONDITIONALLY_APPROVED` | Approuvé sous réserve du respect continu d'une condition opérationnelle (ex. gates de marge) — l'approbation ne dispense jamais du contrôle. |
| `DEFERRED_PENDING_EXTERNAL_INPUT` | Décision volontairement non prise — une donnée externe au dépôt (RH, réglementaire) est requise avant qu'une décision éclairée soit possible. |
| `TECHNICAL_ACTIVATION_BLOCKED` | Le chemin technique nécessaire à la vente réelle n'existe pas ou est incomplet — indépendant de l'état de la décision commerciale, qui peut être `APPROVED` en parallèle. |

---

## 2. Décisions coût / gouvernance

### Coût horaire enseignant agrégé
**Statut : `DEFERRED_PENDING_EXTERNAL_INPUT`**
Le placeholder 70 TND/h (fourchette 65-85) n'est **pas** approuvé comme coût réel.
**Donnée requise** : coût RH réel de la catégorie professeur agrégé.

### Coût horaire enseignant certifié
**Décision : `APPROVED = 50 TND/h`**
Composante du futur modèle de coût décomposé. **N'est pas encore appliquée au runtime dans ce lot
documentaire** — aucune écriture dans `quotes.costPolicy`, aucune modification de `DEFAULT_COST_POLICY`.

### Coût horaire tuteur
**Statut : `DEFERRED_PENDING_EXTERNAL_INPUT`**
Le placeholder 35 TND/h n'est **pas** approuvé. Le statut opérationnel du « tuteur » doit être défini
d'abord (salarié junior / vacataire / étudiant / autre modèle contractuel) — le coût réel sera décidé
ensuite, pas avant.

### Coût de structure horaire
**Décision : `APPROVED = 15 TND/h`**
Pour le futur modèle économique décomposé. Non appliqué au runtime dans ce lot.

### Coût fixe de dossier
**Décision : `APPROVED = 120 TND / dossier`**
Sémantique : coût économique interne, one-off, **jamais présenté au client comme une ligne séparée « frais
de dossier »**, intégré à l'analyse de rentabilité globale uniquement.

### Plancher horaire
**Décision : approuvé en principe — ne pas réutiliser durablement la catégorie `college`.**
Créer ultérieurement une catégorie dédiée candidat-individuel : groupe/multi = 45 TND/h, individuel/solo =
50 TND/h. **Implémentation différée au prochain lot technique** — aucune catégorie n'est créée par ce
document.

### Fallback blended réellement actif
**État constaté : 100 TND/h (`DEFAULT_COST_POLICY.teacherCostPerHourTnd`, inchangé)**
**Décision : `CONDITIONALLY_APPROVED_AS_TEMPORARY_FALLBACK`**
Reste temporairement actif jusqu'à l'implémentation et la validation d'un modèle de coût décomposé
suffisamment complet. **Le fallback blended 100 TND/h et le futur modèle décomposé (enseignant + structure +
dossier) sont mutuellement exclusifs dans un même calcul de coût** — jamais additionnés (ex. interdit :
`100 + 50 + 15`). Voir Invariant 6.

### Marge bloquante
**Décision : `30 %`** — règle : `margin < 30 % ⇒ BLOCKED`.

### Marge cible / seuil de revue
**Décision : `40 %`** — règle complète à trois zones :
- `margin < 30 %` → `BLOCKED`
- `30 % ≤ margin < 40 %` → `HUMAN_REVIEW_REQUIRED`
- `margin ≥ 40 %` → `MARGIN_OK`

Les seuils codés-morts 45 %/55 % (`pricing-engine.ts::MARGIN_BLOCKING_THRESHOLD_PCT`/
`MARGIN_TARGET_THRESHOLD_PCT`) **ne sont pas retenus**.

### Plafond de remise
**Décision : `20 % maximum`** (comportement déjà actif, `rules.discounts.global_cap_pct`, inchangé).
**Invariant obligatoire pour le prochain lot technique** : toute remise doit provoquer un recalcul de marge
sur le prix net après remise — le système ne doit jamais valider la marge avant remise puis émettre le
devis sans nouveau contrôle. Voir Invariant 4.

### Cumul de remises
**Décision : `NON_CUMULABLE`** — comportement actuel conservé, inchangé.

### Seuil DUO / SOLO / GROUPE
**Décision** : effectif réel = 1 → `SOLO` ; effectif réel = 2 → `DUO` ; effectif réel ≥ 3 → `GROUPE`. Le
seuil minimal groupe reste `3`. **Le mécanisme (`resolveGroupModality`, déjà correct mais non appelé) doit
être réellement raccordé avant activation des modules à effectif variable** — non fait par ce document.

### Comportement groupe en constitution
**Décision** : introduire conceptuellement deux états distincts, `GROUP_CONFIRMED` et `GROUP_PENDING`. Un
groupe non encore constitué ne doit pas produire silencieusement un engagement contractuel définitif au
tarif groupe basé sur un effectif supposé de 3. **La modalité UX/runtime exacte sera spécifiée dans le
prochain lot technique** — non spécifiée ici au niveau implémentation.

### Règle d'arrondi
**Décision : conserver le comportement actuel** (`rounding_tnd=10`, `Math.floor` sur la dernière
mensualité). Aucune modification fonctionnelle demandée à ce stade.

### Allocation du coût fixe dossier
**Décision : `ONE_OFF_INTERNAL`.** Le coût de 120 TND est comptabilisé une seule fois, n'est pas réparti
artificiellement sur les mensualités, n'est pas affiché comme frais client séparé.

---

## 3. Décisions sur les 13 éléments commerciaux

Pour chaque élément : `BUSINESS_APPROVAL` / `PRICE_APPROVAL` / `TECHNICAL_ACTIVATION`, systématiquement
séparés.

### `MOD_LVA`
`BUSINESS_APPROVAL = APPROVED` · Prix `250 / 470 / 680 TND = APPROVED` · `VOLUME = 4_HOURS_PER_MONTH`
(décision de direction explicite, T3A closeout — voir §3bis) · `TECHNICAL_ACTIVATION =
AUTHORIZED_SUBJECT_TO_T3A_PROOFS` — la logique 1→SOLO / 2→DUO / 3+→GROUPE (T2
`confirmedHeadcountBySubject`) est prouvée (T3A, workflow staff + tests) ; l'activation reste conditionnée
aux preuves du lot T3A (mapping prix/volume réel, non-régression, E2E) avant toute bascule de
`directionApprovalStatus`. **Ne pas considérer ce module comme activable par la seule modification de
`directionApprovalStatus` sans repasser ces preuves.**

### `MOD_LVB`
Même décision que `MOD_LVA`. `BUSINESS_APPROVAL = APPROVED` · Prix `250 / 470 / 680 TND = APPROVED` ·
`VOLUME = 4_HOURS_PER_MONTH` (T3A closeout — voir §3bis) · `TECHNICAL_ACTIVATION =
AUTHORIZED_SUBJECT_TO_T3A_PROOFS`.

### `MOD_SPECIALITE_ABANDONNEE`
`BUSINESS_APPROVAL = APPROVED` · Prix `250 / 470 / 680 TND = APPROVED` · `VOLUME = 4_HOURS_PER_MONTH` (T3A
closeout — voir §3bis) · `TECHNICAL_ACTIVATION = AUTHORIZED_SUBJECT_TO_T3A_PROOFS`.
Conditions : raccordement DUO/SOLO/GROUPE (prouvé, T2/T3A) ; avertissement métier/réglementaire obligatoire
et non contournable côté affichage famille (« ne prépare aucune épreuve du bac ») — implémenté
(`lib/quotes/pricing.ts::SPECIALITE_ABANDONNEE_WARNING`, surfacé sur le PDF via le bloc "Avertissements"
existant, `lib/quotes/pdf-adapter.server.ts`).

### 3bis. Décision de direction — volume mensuel MOD_LVA / MOD_LVB / MOD_SPECIALITE_ABANDONNEE (T3A closeout)

**Décision explicite** (levant le blocker `PETIT_GROUPE_4H_GOVERNANCE = UNAPPROVED_BUSINESS_ASSUMPTION`
identifié au closeout T3A précédent, commit `2974438ac`) :

- **Volume contractuel : 4 heures par mois**, identique pour les trois éléments. C'est la SEULE décision
  prise ici — un volume mensuel, rien d'autre.
- **Cadence pédagogique : flexible, non contractuelle.** 1 h/semaine, 2×2 h/mois, ou toute organisation
  équivalente totalisant 4 h/mois sont toutes conformes. **Aucune cadence n'est ni n'a jamais été codée en
  dur** — le moteur (`lib/quotes/pricing.ts::buildIdealRecommendation`) ne connaît que des heures/mois
  agrégées, jamais une répartition hebdomadaire ; rien dans le catalogue ni le pipeline n'impose 4
  séances/mois, 4 h/semaine ou 2×2 h obligatoires (voir T3A closeout Phase E pour la preuve automatisée).
- **Aucun nouveau prix.** Les seules valeurs commerciales autorisées restent `250 / 470 / 680 TND`
  (`candidat_individuel_modules.petit_groupe`, déjà approuvées). Cette décision de volume ne vaut PAS
  permission de choisir un palier de prix différent de celui déjà déterminé par le mécanisme existant
  (§ pricing réel, T3A closeout Phase B).
- **`volumePolicy.hoursPerMonth = 4` est désormais une décision de direction**, pas une hypothèse
  technique. `PETIT_GROUPE_4H` peut être utilisé comme encodage canonique de cette décision dans
  `data/pricing.canonical.json` si le schéma structurel l'exige (`catalogue-schema.ts` impose un
  `pricingRuleId` non nul et un `volumePolicy.kind` résolu pour tout module `APPROVED`).
- **`pricingRuleId`/`volumePolicy` sur un module catalogue ne sont PAS runtime-autoritatifs.** Le pipeline
  candidat-individuel réel (`buildCandidateQuoteRecommendation` → `buildIdealRecommendation`,
  `lib/quotes/pricing.ts`) ne les lit jamais — il calcule les heures effectivement livrées à un candidat
  dynamiquement, à partir du tiers de priorité diagnostiqué (`A_RECTIFIER`/`A_INSTALLER`/…), puis
  recherche directement le tarif correspondant dans `candidat_individuel_modules.petit_groupe`. Seule la
  fonction `priceSelectedModule`/`priceSelection` (`lib/quotes/pricing-engine.ts`) lit ces champs, et elle
  n'est appelée par aucun chemin du pipeline réel (`pipeline.ts`) — confirmé par recherche exhaustive des
  appelants. Ces champs restent donc de la métadonnée de gouvernance/documentation (citant la décision de
  direction), jamais un déterminant de prix en exécution réelle.

### `MOD_HG_ARIA`
`BUSINESS_APPROVAL = APPROVED_IN_PRINCIPLE` · `PRICE_APPROVAL = DEFERRED_PENDING_EXTERNAL_INPUT` — 20/40/80
TND **n'est pas** approuvé comme grille définitive. Raisons : statut tuteur non défini ; coût tuteur non
établi ; pricing ARIA non raccordé ; `deliveryMode` actuellement ignoré par le moteur réel ; risque de
silent mispricing (priced au tarif `petit_groupe` standard si jamais sélectionné). `TECHNICAL_ACTIVATION =
BLOCKED`.

### `MOD_ES_ARIA`
Même décision que `MOD_HG_ARIA`. `BUSINESS_APPROVAL = APPROVED_IN_PRINCIPLE` · `PRICE_APPROVAL =
DEFERRED_PENDING_EXTERNAL_INPUT` · `TECHNICAL_ACTIVATION = BLOCKED`.

### `MOD_EMC_ARIA`
Même politique commerciale ARIA. `BUSINESS_APPROVAL = APPROVED_IN_PRINCIPLE` · `PRICE_APPROVAL =
DEFERRED_PENDING_EXTERNAL_INPUT` · `TECHNICAL_ACTIVATION = BLOCKED`, avec dette supplémentaire : mapping
legacy/représentation runtime absente (`MODULE_LEGACY_MAPPING` ne le couvre pas — hériterait de
`modulesNonRepresentables` si jamais sélectionné).

### `MOD_EAF_DESCRIPTIF`
`BUSINESS_APPROVAL = APPROVED` · Prix `180 / 360 / 540 TND = APPROVED` (valeurs historiques conservées,
documentées, mais leur **unité commerciale n'est pas décidée** — `PRICE_UNIT_SEMANTICS = DEFERRED`, T3C).
`TECHNICAL_ACTIVATION = BLOCKED` (actuellement non représentable dans le moteur subject-priority —
`modulesNonRepresentables` — et de toute façon sans objet tant que l'unité n'est pas tranchée). Libellé
utilisateur fixé (T3C, `9cd0e970d`) : « Aide au récapitulatif des activités EAF » — `moduleId` interne
inchangé.

**`RELEASE_SCOPE = DEFERRED_FROM_V1_GO_LIVE`** (décision de direction, T3C closeout) : `BUSINESS_INTEREST =
CONFIRMED`, mais exclu explicitement de la release V1. `180/360/540 TND` ne doivent être présentés **ni**
comme prix par séance, **ni** comme nombre de séances, **ni** comme nombre de descriptifs, **ni** comme tier
Essentiel/Recommandé/Intensif, **ni** comme package, tant qu'une future décision explicite ne le tranche pas.
`PRICE_UNIT_SEMANTICS = DEFERRED` · `V1_PUBLIC_ACTIVATION = DEFERRED`. Cette décision lève
`ACTION_REQUIRED` pour le périmètre V1 : l'exclusion d'EAF de cette release est un choix explicite, pas un
blocage résiduel.

### `MOD_MATHS_EXPERTES`
`BUSINESS_APPROVAL = APPROVED_IN_PRINCIPLE` · Prix `250 / 470 / 680 TND = APPROVED`. Mais
`REGULATORY_ACTIVATION = BLOCKED` tant que la donnée réglementaire (coefficient non sourcé) n'est pas
établie par une source fiable. Également `TECHNICAL_ACTIVATION = BLOCKED` jusqu'au mapping requis.
**L'approbation commerciale ne vaut pas validation réglementaire — les deux blocages sont indépendants et
cumulatifs.**

### `MOD_MATHS_COMPLEMENTAIRES`
`BUSINESS_APPROVAL = APPROVED` · Prix `250 / 470 / 680 TND = APPROVED` · `TECHNICAL_ACTIVATION = BLOCKED`
(mapping technique fermé, T3B1, `35841bd3c` — reste `TECHNICAL_ACTIVATION = BLOCKED` par un
`REGULATORY_MODEL_BLOCKER` préexistant, coefficient non sourcé côté `lib/exams`, et par un écart de
couverture diagnostique, voir T3B1). **`RELEASE_SCOPE = DEFERRED_FROM_V1_GO_LIVE`** (décision de direction,
T3B closeout — voir §3ter) : approuvé en principe, non activé techniquement pour la V1 publique.

### `MOD_DGEMC`
`BUSINESS_APPROVAL = APPROVED` · Prix `250 / 470 / 680 TND = APPROVED` · `TECHNICAL_ACTIVATION = BLOCKED`
(mapping technique fermé, T3B1, `35841bd3c` — mêmes blocages que `MOD_MATHS_COMPLEMENTAIRES` ci-dessus).
**`RELEASE_SCOPE = DEFERRED_FROM_V1_GO_LIVE`** (voir §3ter).

### `MOD_LCA`
`BUSINESS_APPROVAL = APPROVED` · Prix `250 / 470 / 680 TND = APPROVED` · `TECHNICAL_ACTIVATION = BLOCKED`
(mapping technique fermé, T3B1, `35841bd3c` ; traitement des faibles effectifs prouvé générique via le
mécanisme T2/T3A — mêmes blocages réglementaire/diagnostique que ci-dessus). **`RELEASE_SCOPE =
DEFERRED_FROM_V1_GO_LIVE`** (voir §3ter).

### 3ter. Décision de direction — périmètre V1 des options (MOD_MATHS_COMPLEMENTAIRES / MOD_DGEMC / MOD_LCA) et faits réglementaires sourcés (T3B closeout)

**Décision de release** (direction, postérieure à T3B1 `35841bd3c`) :

```
MOD_MATHS_COMPLEMENTAIRES = DEFERRED_FROM_V1_GO_LIVE
MOD_DGEMC                 = DEFERRED_FROM_V1_GO_LIVE
MOD_LCA                   = DEFERRED_FROM_V1_GO_LIVE
```

Les trois modules restent `BUSINESS_APPROVAL = APPROVED` (prix `250/470/680 TND` inchangé, §3
ci-dessus) mais sont explicitement **non activés techniquement pour la V1 publique**. Le commit
préparatoire T3B1 (`35841bd3c`, branche `feat/t3b-options-mapping`) reste sur sa branche dédiée et
**n'est pas intégré à la ligne de release V1** — ni mergé, ni rebasé sur `main`, ni poussé. Il constitue un
travail technique préparatoire réutilisable pour une release ultérieure, une fois §C ci-dessous résolu.

**Faits réglementaires sourcés** (à reprendre lors d'un futur lot d'activation — non exploités par ce
document, aucun fichier `lib/exams` modifié ici) :

Sources officielles :
- Note de service du 10 décembre 2025, BO n°1 du 1er janvier 2026, NOR MENE2533572N, « Évaluations
  ponctuelles des enseignements optionnels pour les candidats individuels ».
- Page Éduscol 2026, « Candidats individuels au baccalauréat général et au baccalauréat technologique ».

| Option | Niveau couvert | Coefficient | Particularité |
|---|---|---|---|
| Mathématiques complémentaires | Terminale uniquement | 2 | Inaccessible au candidat présentant la spécialité Mathématiques dans ses épreuves terminales |
| DGEMC | Terminale uniquement | 2 | — |
| LCA (Latin/Grec) | Première + Terminale | 2 si l'évaluation porte sur une seule année ; 4 si elle porte sur les deux années du cycle terminal | Le coefficient dépend du scope d'évaluation réellement retenu pour le candidat — **ne jamais fixer un coefficient unique sans connaître ce scope** |

**Ce que ces faits ne sont pas** : ils ne constituent ni une décision de volume horaire mensuel, ni une
résolution du `REGULATORY_MODEL_BLOCKER` établi par T3B1 (coefficient d'évaluation ≠ coefficient
d'admissibilité au moteur `buildIdealRecommendation` ; le blocage T3B1 porte sur l'absence de coefficient
dans `lib/exams`, qui reste entier tant que ces faits n'y sont pas effectivement sourcés). Un futur lot
d'activation devra : (1) sourcer ces coefficients dans `lib/exams` (hors périmètre commercial, cf. §6
invariant 1) ; (2) déterminer et enregistrer le scope d'évaluation LCA (une année vs cycle terminal) avant
tout coefficient LCA codé en dur ; (3) résoudre séparément l'écart de couverture diagnostique identifié par
T3B1 (aucun domaine diagnostique existant pour ces trois options).

### `SVC_BACS_BLANCS`
`BUSINESS_APPROVAL = APPROVED` · Prix `95 / 190 / 285 TND = APPROVED` (valeurs numériques uniquement — voir
`RELEASE_SCOPE` ci-dessous, T3D, pour ce que cette approbation ne couvre pas) · `TECHNICAL_ACTIVATION =
BLOCKED`.

**`RELEASE_SCOPE = DEFERRED_FROM_V1_GO_LIVE`** (audit T3D, `PRICE_SEMANTICS = AMBIGUOUS` ET
`COST_SEMANTICS = AMBIGUOUS`, tracés dans les sources internes déjà présentes, aucune supposition) :

- **Prix** : la seule proposition documentée d'une sémantique « 1/2/3 bacs blancs/an » vit dans
  `docs/candidat-individuel/matrice-commerciale-detaillee-lot-fermeture-p11-p3.md` (§12), qui annote
  **elle-même** les chiffres 95/190/285 `[hypothèse Claude — jamais approuvée]` et conclut par « **Décision
  attendue** : approuver 95/190/285 TND + la fréquence recommandée » — une demande, pas un enregistrement de
  décision. Un document distinct et plus tardif
  (`docs/candidat-individuel/recablage-matrice-14-arbitrages.md`, ligne « Bacs blancs ») contredit
  explicitement la prétention « déjà clarifié » du dossier d'arbitrage : « Non défini... ni fréquence ni
  volume connus... Décision de direction requise ». Aucune trace d'une décision de direction réellement
  actée sur l'unité (séance/copie/matière/pack) n'existe dans le dépôt — seule l'approbation des 3 nombres
  TND eux-mêmes (registre ci-dessus) est confirmée, exactement comme `MOD_EAF_DESCRIPTIF`.
- **Coût** : `lib/quotes/margin.server.ts::computeMargin` calcule un coût strictement horaire
  (`teacherCostPerHourTnd × hoursPerMonth`, divisé par la taille de groupe pour GROUPE/DUO) — aucune notion
  de « correction discrète » (30 min enseignant certifié + 15 min tuteur/structure, le modèle du §12
  ci-dessus) n'existe dans ce moteur. Le taux blended (100 TND/h, `DEFAULT_COST_POLICY`) et le coût
  décomposé par intervenant du §12 (41,25 TND/bac) sont deux modèles non interchangeables ; la marge
  indicative de 56,6 % du dossier n'est donc pas runtime-vérifiable en l'état.
- **Reachability** (confirmé contre le code réel, pas seulement contre la doc) : `resolveCatalogueModules`
  (`lib/quotes/catalogue.ts`) itère exclusivement `catalogue.modules` — `catalogue.services` n'est consulté
  qu'à exactement deux endroits câblés en dur (`SVC_PILOTAGE` dans `coverageItemsForSelection`,
  `SVC_SECOND_GROUPE` dans la branche P11 de `pipeline.ts`) ; `SVC_BACS_BLANCS` n'est donc structurellement
  jamais sélectionnable aujourd'hui. `inclusionPolicy` est stocké mais jamais lu par la résolution réelle
  (seule la fonction morte `priceSelectedModule` la consulte) — un raccordement naïf qui traiterait
  `pricingRuleId: null` comme « inclus gratuitement » produirait une ligne à `unitPrice = 0`, risque
  explicitement identifié, non construit dans ce lot.
- **Risque produit distinct signalé** (`lot5-fiches-arbitrage-volumes.md` §"Services non pédagogiques") :
  les bacs blancs sont absents des `included[]` des 6 offres réellement commercialisées — créer une ligne
  facturable séparée pose une question produit indépendante (double-facturation potentielle d'un élément
  déjà perçu comme inclus, ou clarification que ce n'est pas encore un produit réellement livré).

Aucun chemin technique dédié n'est construit tant que ces deux sémantiques (prix, coût) ne sont pas
explicitement tranchées par une décision de direction distincte, actée (pas seulement proposée).

### `SVC_SECOND_GROUPE` (P11)
`BUSINESS_APPROVAL = APPROVED` · Prix `1080 / 1800 / 2880 TND = CONDITIONALLY_APPROVED`. L'élément est
techniquement raccordé (branche pipeline dédiée, câblage prouvé RED→GREEN, lot `14c54b979`). Chaque
scénario réel reste soumis aux règles de marge : `margin < 30 %` → `BLOCKED` ; `30 % ≤ margin < 40 %` →
`HUMAN_REVIEW_REQUIRED` ; `margin ≥ 40 %` → `MARGIN_OK`. **L'approbation commerciale ne transforme jamais
ces gates en contournement.**

---

## 4. Décisions encore explicitement différées — `EXTERNAL_INPUTS_STILL_REQUIRED`

### A. `AGRÉGÉ_ACTUAL_COST`
Statut : `DEFERRED_PENDING_HR_DATA`

### B. `TUTOR_STATUS_AND_COST`
Statut : `DEFERRED_PENDING_BUSINESS_AND_HR_DEFINITION`

### C. `MATHS_EXPERTES_REGULATORY_SOURCE`
Statut : `DEFERRED_PENDING_REGULATORY_SOURCE`

**Ces trois éléments n'empêchent pas la formalisation des autres décisions** — ils ne bloquent que ce qui en
dépend directement (respectivement : le taux agrégé lui-même ; les 3 modules ARIA et leur prix définitif ;
l'activation réglementaire de `MOD_MATHS_EXPERTES`, indépendamment de son approbation commerciale).

---

## 5. Clarification de la nomenclature « 14/15 »

Le tableau du dossier committé au commit `130629282` (§6) contient réellement **15 lignes**, alors que sa
propre prose parle de « 14 paramètres » et « 10 YES + 4 NO » (soit 14, pas 15). **L'historique n'est pas
modifié silencieusement** — cette divergence reste visible dans le dossier tel que committé.

Convention retenue pour ce registre et les documents futurs :

- **14 lignes** représentent des paramètres/politiques de gouvernance à décider (coûts, seuils, remises,
  arrondi, allocation, bascule DUO/SOLO, comportement sous effectif minimal).
- La ligne **« Taux blended actif = 100 TND/h »** est traitée comme un **fait runtime / fallback
  opérationnel existant**, pas comme un quinzième paramètre homogène au même titre que les 14 décisions de
  gouvernance — c'est un constat d'état, pas un choix à faire (le choix associé est couvert par les
  décisions « coût agrégé/certifié/tuteur » ci-dessus, §2). D'où le statut dédié
  `CONDITIONALLY_APPROVED_AS_TEMPORARY_FALLBACK`, distinct des statuts `APPROVED`/`DEFERRED_...` utilisés
  pour les 14 vrais paramètres.

---

## 6. Invariants de gouvernance

1. **`BUSINESS_APPROVAL != TECHNICAL_ACTIVATION`.**
2. Une décision commerciale ne modifie jamais implicitement `directionApprovalStatus`.
3. Tout module présentant un risque connu de silent mispricing reste techniquement bloqué.
4. Toute remise doit être suivie d'un recalcul de marge sur le prix réellement facturé.
5. Aucun service nouvellement rendu reachable ne peut être activé sans preuve que son pricing est non nul,
   correct et gouverné.
6. Le fallback blended 100 TND/h et le futur modèle décomposé sont mutuellement exclusifs dans un même
   calcul de coût.
7. Un prix groupe définitif ne peut pas reposer silencieusement sur `effectif=3` lorsque l'effectif réel ou
   confirmé est inférieur.
8. `PUBLIC_RELEASE = NO_GO` reste inconditionnel tant que le lot technique, la recette humaine et le
   dernier gate public n'ont pas été explicitement franchis.

---

## 7. `TECHNICAL_IMPLEMENTATION_BACKLOG` — descriptif uniquement, rien exécuté

| # | Item | Décision de direction source | Fichiers/zones probablement concernés | Invariant à préserver | Précondition | Tests attendus | Activation permise après réalisation |
|---|---|---|---|---|---|---|---|
| 1 | Persistance explicite de la future `quotes.costPolicy` | Coût certifié (§2, 50 TND/h), structure (15 TND/h), coût fixe dossier (120 TND), fallback blended (`CONDITIONALLY_APPROVED_AS_TEMPORARY_FALLBACK`) | `lib/quotes/margin.server.ts`, `lib/config/schemas.ts` (namespace déjà gouverné), `BusinessConfig` | Invariant 6 | Aucune — les valeurs agrégé/tuteur restent différées sans bloquer la structure certifié/structure/dossier | Tests unitaires sur la nouvelle politique de coût décomposée ; test garantissant qu'aucun calcul n'additionne blended + décomposé | **NO** |
| 2 | Gestion sûre de la transition depuis `DEFAULT_COST_POLICY = 100 TND/h` | Fallback blended (§2) | `lib/quotes/margin.server.ts` | Invariant 6 | Item 1 réalisé | Test de non-régression garantissant qu'aucun devis existant n'est réévalué rétroactivement de façon incohérente ; test que le fallback reste isolé | **NO** |
| 3 | Gates 30/40 (3 zones explicites) | Marge bloquante (30 %), marge cible/seuil de revue (40 %, 3 zones) | `lib/quotes/margin.server.ts` | Cohérent avec Invariants 1/8 | Aucune — 30/40 déjà les valeurs codées ; travail = formaliser explicitement la zone `HUMAN_REVIEW_REQUIRED` distincte | Test confirmant les 3 zones exactes (`BLOCKED` <30, `HUMAN_REVIEW_REQUIRED` [30,40), `MARGIN_OK` ≥40) | **NO** |
| 4 | Recalcul de marge post-remise | Plafond de remise (20 %, invariant obligatoire) | `lib/quotes/pricing-engine.ts` (`applyDiscounts`), `app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts` | Invariant 4 | Aucune | Test garantissant qu'une remise à 20 % appliquée à un scénario proche du seuil fait bien rebasculer le gate de marge | **NO** |
| 5 | Raccordement SOLO/DUO/GROUPE | Seuil DUO/SOLO/GROUPE (§2) | `lib/quotes/pricing-engine.ts` (`resolveGroupModality`), `lib/quotes/pipeline.ts`, `lib/quotes/catalogue.ts` | Invariant 7 | Aucune techniquement, mais dépend de l'item 6 pour être utile | Tests d'intégration prouvant qu'un profil à effectif réel 1/2 bascule bien SOLO/DUO | **NO** |
| 6 | Prise en compte de l'effectif réel dans le calcul de marge | Idem + comportement groupe en constitution | `lib/quotes/margin.server.ts` (`computeMargin`), modèle `Quote`/scénario | Invariant 7 | Item 5 | Test que `computeMargin` reçoit l'effectif réel, jamais une constante fixe | **NO** |
| 7 | `GROUP_PENDING` / `GROUP_CONFIRMED` | Comportement groupe en constitution (§2) | `prisma/schema.prisma` (champ potentiel), `lib/quotes/schemas.ts`, wizard/PDF | Invariant 7 | Items 5/6 | Tests que le statut du groupe est explicite dans le devis/PDF, jamais implicite | **NO** |
| 8 | Allocation one-off du coût dossier | Allocation du coût fixe dossier (`ONE_OFF_INTERNAL`) | Aucun chemin réel aujourd'hui — `lib/quotes/persistence.server.ts` si jamais facturé | Cohérent avec Invariant 1 | Décision de facturer ou non ce coût au client — non encore prise (c'est un coût interne, pas un prix aujourd'hui) | Test garantissant l'absence de double facturation si jamais implémenté | **NO** |
| 9 | Chemin ARIA dédié (`MOD_HG_ARIA`/`MOD_ES_ARIA`/`MOD_EMC_ARIA`) | §3, `APPROVED_IN_PRINCIPLE` + `PRICE_APPROVAL` différé | `data/pricing.canonical.json` (nouveau tier), `lib/quotes/pricing-engine.ts` (`resolveRate`, nouveau cas), `lib/quotes/pipeline.ts` (branche dédiée, modèle P11), `lib/quotes/catalogue.ts` (mapping) | Invariants 3, 5 | Coût tuteur validé (`TUTOR_STATUS_AND_COST`, §4, encore différé) | Tests unitaires + intégration prouvant le prix ARIA correct, jamais le tarif `petit_groupe` | **NO** |
| 10 | Mapping des modules non représentés (`MOD_EMC_ARIA`, options Maths/DGEMC/LCA) | §3 | `lib/quotes/catalogue.ts` (`MODULE_LEGACY_MAPPING`) | Invariant 5 | Décision business déjà prise (`APPROVED` ou `APPROVED_IN_PRINCIPLE`) | Test que chaque module approuvé produit une ligne `SELECTED` priced, jamais `modulesNonRepresentables` | **NO**, sauf `MOD_MATHS_EXPERTES` qui reste bloqué séparément par l'item 13 même après ce travail |
| 11 | Chemin dédié EAF descriptif | `MOD_EAF_DESCRIPTIF` (§3) | `lib/quotes/pipeline.ts` (branche dédiée), `lib/quotes/pricing-engine.ts` | Invariant 5 | Aucune | Tests unitaires + DB + PDF (modèle P11 : preuve RED→GREEN) | **NO** tant que non réalisé ; **YES** une fois la preuve RED→GREEN + DB/PDF apportée |
| 12 | Chemin dédié Bacs blancs avec protection contre la gratuité implicite | `SVC_BACS_BLANCS` (§3, double gap) | `lib/quotes/catalogue.ts` (traitement `catalogue.services`), `lib/quotes/pipeline.ts`, `data/pricing.canonical.json` (`inclusionPolicy`/`pricingRuleId`) | Invariants 3, 5 | Aucune | Test explicite que le prix n'est jamais 0/gratuit une fois reachable ; test que le service reste bloqué tant que non approuvé | **NO** |
| 13 | Traitement réglementaire Maths expertes | `MOD_MATHS_EXPERTES` (`REGULATORY_ACTIVATION = BLOCKED`) | `lib/exams/` (sourcing du coefficient) — hors périmètre commercial | Principe « approbation commerciale ≠ validation réglementaire » | `MATHS_EXPERTES_REGULATORY_SOURCE` (§4, external input C) | Test de non-régression garantissant que ce module reste bloqué tant que le coefficient n'est pas sourcé, même si business+technique sont prêts | **NO**, indépendamment de l'état technique |
| 14 | Preuve automatisée route-level du gate `BLOCKED` | Gap de couverture déjà signalé (dossier `130629282`, §7) | `__tests__/database/candidat-individuel-quote-creation.test.ts` | Invariant 3 | Aucune | Le backlog item **est** le test à écrire | **N/A** — amélioration de couverture de test, pas une activation commerciale |
| 15 | Tests persistance / devis / PDF / lien signé / E2E nécessaires | Ensemble des éléments `TECHNICAL_ACTIVATION_BLOCKED` (§3) | `__tests__/database/*`, `e2e/auth/candidat-individuel-pipeline.spec.ts` | Invariant 5 | Chaque chemin dédié (items 9-12) doit exister avant que son test correspondant ait un sens | Le backlog item **est** le test | **NO** tant que non réalisé |
| 16 | Aucune activation des éléments différés avant satisfaction de leurs préconditions | Transversal — Invariants 1, 2, 3, 5 | N/A — règle de gouvernance du backlog lui-même, pas un item technique isolé | Invariants 1, 2, 3, 5 | N/A | Revue de gouvernance avant chaque activation, pas un test automatisé unique | **N/A** — c'est la règle qui gouverne l'activation des 15 items précédents |

**Ce backlog est descriptif. Aucun item n'est entrepris par ce document.**

---

## 8. Gates finaux

**`DIRECTION_ARBITRATION = SUBSTANTIALLY_COMPLETED`**

`SUBSTANTIALLY_COMPLETED` signifie : toutes les décisions actuellement arbitrables ont été prises ; seules
les décisions nécessitant réellement une donnée externe (§4 — coût agrégé, statut/coût tuteur, source
réglementaire Maths Expertes) restent différées, et leur absence ne bloque aucune des autres décisions déjà
formalisées ci-dessus.

**`TECHNICAL_ACTIVATION = NOT_STARTED`**

**`INTERNAL_HUMAN_RECETTE = NOT_READY`**

**`PUBLIC_RELEASE = NO_GO`**
