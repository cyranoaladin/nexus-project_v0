# Proposition de calibration des coûts V1 (candidat individuel) — mission §9

**Statut : proposition non activée.** Aucune valeur de ce document n'est lue par un chemin de calcul réel
de devis. `PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES` (`lib/quotes/pricing-engine.ts`) exporte ces mêmes
7 valeurs mais aucune fonction de tarification ne les consomme automatiquement — confirmé par lecture de
code, pas par affirmation.

Pour chacune des 7 valeurs demandées par la mission, ce document donne : l'hypothèse brief, sa cohérence
avec les offres/coûts déjà pratiqués ailleurs dans le dépôt, une analyse de sensibilité, ma recommandation,
l'effet sur la marge, et la décision attendue de la direction.

---

## Constat préalable — un système de coût existe déjà, et il diverge

Avant de calibrer un nouveau système, il faut vérifier qu'il n'y en a pas déjà un incohérent avec lui.
**Il y en a un.** `lib/quotes/margin.server.ts` (moteur historique, alimente `POST /api/quotes/margin`) lit
un `CommercialCostPolicy` depuis BusinessConfig namespace `quotes.costPolicy`, avec un défaut câblé :

```ts
DEFAULT_COST_POLICY = {
  teacherCostPerHourTnd: 100,           // taux unique, non différencié par qualification
  variableCostPerStudentMonthTnd: 10,
  marginGates: { greenPct: 40, warningPct: 30 },  // BLOCKED <30%, WARNING 30-40%, GREEN ≥40%
}
```

Comparé à l'hypothèse brief candidat-individuel (agrégé 70 / certifié 50 / tuteur 35 TND/h, marge
bloquante 45 %, cible 55 %) : **taux horaire de référence différent (100 TND/h blended vs 35-70 TND/h
scindé) et seuils de marge différents (30/40 % vs 45/55 %)**, pour des produits qui se recoupent largement
(cours en groupe/duo/individuel). De plus, `quotes.costPolicy` **n'est pas enregistré dans le
`NamespaceId` fermé** de `lib/config/schemas.ts` — il n'existe donc aucun chemin admin validé pour l'écrire
aujourd'hui ; `getCommercialCostPolicy()` retombe systématiquement sur le défaut, en pratique jamais
configuré via `/api/admin/config`. Ceci est une divergence architecturale réelle, pas une supposition —
vérifiée par grep, aucun autre appelant n'écrit cette clé.

**Recommandation transversale, avant les 7 valeurs individuelles** : ne pas créer un troisième modèle de
coût parallèle. Deux options s'offrent à la direction (décision commerciale, pas seulement technique,
car elle change des seuils déjà en usage sur le moteur historique) :

- **Option A — unifier** : étendre `quotes.costPolicy` pour accepter un taux par qualification
  (agrégé/certifié/tuteur) au lieu d'un taux unique, et aligner ses `marginGates` sur 45/55 % partout.
  Impact : change le comportement du moteur historique (`/api/quotes/margin`) pour tous les devis
  existants, pas seulement candidat-individuel.
- **Option B — séparer explicitement** : garder deux politiques nommées différemment
  (`quotes.costPolicy` pour le moteur historique, `pricing.candidatIndividuelCostPolicy` nouveau pour le
  candidat libre), avec un commentaire de code explicite justifiant pourquoi elles divergent (produits
  différents : forfaits établissement vs candidat libre à la carte).

Je recommande **Option B** (moindre risque — aucune régression sur le moteur historique déjà en
production) mais le signale explicitement car **Option A serait défendable aussi** et le choix a un impact
commercial réel (les seuils 30/40 vs 45/55 ne sont pas neutres). Ce que je peux faire sans nouvelle
validation (mission §8, pur technique) : enregistrer `quotes.costPolicy` dans le `NamespaceId` fermé pour
qu'il devienne enfin validable/audité comme tout le reste — indépendamment du choix A/B, c'est une dette de
sécurité (namespace non gouverné) qui mérite d'être fermée. Fait dans ce lot, voir section finale.

---

## 1 — Coût horaire enseignant agrégé (70 TND/h)

- **Hypothèse brief** : 70 TND/h.
- **Cohérence avec l'existant** : le moteur historique (`quotes.costPolicy`) utilise un taux **unique**
  blended de 100 TND/h, sans distinction de qualification — 70 TND/h pour un agrégé est donc **inférieur**
  au taux blended actuel, ce qui semble optimiste (un agrégé coûte typiquement plus cher qu'un tuteur, or
  le blended 100 TND/h mélange déjà les deux). Signal de cohérence faible : soit le blended 100 TND/h
  sous-estime le poids des profils qualifiés, soit 70 TND/h sous-estime le coût agrégé réel.
- **Sensibilité** : sur le tier `petit_groupe` 8h/mois (470 TND/élève), à 70 TND/h un agrégé coûte
  680 TND/mois ; à 85 TND/h (hypothèse haute), il coûterait 800 TND/mois — le seuil de rentabilité (marge
  cible atteinte) passerait de 3 élèves à un seuil proche de 4 élèves à ce tarif. Écart significatif sur
  la politique DUO/SOLO.
- **Recommandation** : ne pas valider 70 TND/h sans confronter au coût réel payé aux enseignants agrégés
  (donnée RH, hors périmètre technique) — recommander une fourchette 65-85 TND/h à trancher par la
  direction avec les chiffres de paie réels, plutôt que le nombre brief seul.
- **Effet sur la marge** : chaque +5 TND/h sur ce taux réduit la marge du tier 8h/agrégé/eff.3 d'environ
  1 point de pourcentage (base 51,8 % à 70 TND/h).
- **Décision attendue** : confirmer ou ajuster 70 TND/h à partir des coûts RH réels, pas d'une hypothèse
  brief seule.

## 2 — Coût horaire enseignant certifié (50 TND/h)

- **Hypothèse brief** : 50 TND/h.
- **Cohérence** : cohérent avec un taux intermédiaire entre agrégé (70) et tuteur (35) — écart proportionnel
  raisonnable (ratio 1,4/1 puis 1,43/1), pas de saut disproportionné.
- **Sensibilité** : tier 8h/mois, certifié : coût 520 TND/mois → marge cible (55 %) atteinte dès 3 élèves
  (63,1 %). Le taux certifié est donc le point d'équilibre le plus robuste des trois qualifications — peu
  sensible à une variation de ±5 TND/h (impact marge ≈0,8 pt/5 TND/h).
- **Recommandation** : valider tel quel — c'est la valeur la moins risquée des trois car elle n'est ni la
  plus optimiste (agrégé) ni la plus dépendante d'un statut particulier (tuteur, cf. point 3).
- **Effet sur la marge** : robuste, cible atteinte dès effectif 3 sur tous les tiers testés (4h/8h/12h).
- **Décision attendue** : validation directe recommandée, risque de calibration faible.

## 3 — Coût horaire tuteur (35 TND/h)

- **Hypothèse brief** : 35 TND/h.
- **Cohérence** : le statut « tuteur » n'est pas défini contractuellement dans le dépôt (pas de grille RH
  associée trouvée) — c'est l'hypothèse la moins vérifiable des trois, car on ne sait pas si elle recouvre
  un profil junior salarié, un vacataire, ou un étudiant-tuteur, chacun ayant un coût réel très différent.
- **Sensibilité** : c'est le taux qui rend rentable le module ARIA autonomie guidée (§7, éléments 4-6) —
  à 35 TND/h, le suivi ponctuel de 0,5h/mois coûte 17,5 TND et permet une marge cible à 40 TND/mois. Si le
  taux réel est en fait 45 TND/h (tuteur plus qualifié), le même prix tombe à 43,75 % de marge (signalé,
  pas bloquant, mais sous la cible).
- **Recommandation** : faire préciser par la direction ce que recouvre exactement le statut « tuteur »
  avant de figer ce taux — c'est la valeur la plus fragile des 3 qualifications, pas parce que le chiffre
  est mauvais mais parce que le référentiel RH sous-jacent n'est pas documenté dans le dépôt.
- **Effet sur la marge** : les modules ARIA (§7 éléments 4-6) sont les plus exposés à une variation de ce
  taux — ils sont dimensionnés uniquement sur le coût tuteur.
- **Décision attendue** : confirmer la définition du statut « tuteur » et le taux réel associé.

## 4 — Coût de structure (15 TND/h de séance)

- **Hypothèse brief** : 15 TND/h.
- **Cohérence** : appliqué uniquement aux heures de « séance » réservée (petit_groupe, individuel) — pas
  aux heures d'autonomie ARIA (déjà amorties par le forfait Pilotage, `ARIA_ACCESS`). Cette distinction est
  cohérente avec l'architecture existante (Pilotage = 150 TND/mois fixe incluant l'accès plateforme).
- **Sensibilité** : sur le tier 4h/mois, la structure représente 60 TND/mois soit 24 % du coût total
  agrégé (340 TND) — une variation de ±5 TND/h change la marge d'environ 2 points sur ce tier, moins sur
  les tiers plus longs (8h/12h) où le coût enseignant domine davantage.
- **Recommandation** : valider tel quel — 15 TND/h est cohérent avec un coût de structure modeste (pas de
  loyer de salle physique dédiée pour un format candidat-individuel majoritairement distanciel/hybride).
- **Effet sur la marge** : impact modéré, dégressif avec la durée du module.
- **Décision attendue** : validation directe recommandée.

## 5 — Coût fixe de dossier (120 TND)

- **Hypothèse brief** : 120 TND, one-off par famille candidat-individuel.
- **Cohérence / risque de double comptage (vérification explicite demandée par la mission)** : ce coût
  fixe couvre-t-il le même périmètre que le Pilotage (150 TND/mois, inclut déjà
  `PILOTAGE_REGLEMENTAIRE`, `DIAGNOSTIC_STRATEGIQUE`, `CARTE_EXAMEN`, `APPUI_CYCLADES`,
  `SUIVI_ECHEANCES`, `ARIA_ACCESS`, `BILANS_PERIODIQUES`, `SUIVI_FAMILLE`) ? **Vérifié par lecture du
  catalogue (`data/pricing.canonical.json → candidat_individuel_catalogue.services`)** : le Pilotage est un
  coût **récurrent mensuel** (constitution de la carte, suivi des échéances, appui Cyclades — travail
  continu tout au long de l'année), alors que le coût fixe de dossier au sens du brief est un coût
  **ponctuel d'ouverture** (création du dossier administratif initial, vérification des pièces). Ce ne sont
  pas les mêmes tâches dans le temps — **pas de double comptage identifié**, à condition que le coût fixe
  de dossier ne soit facturé qu'une fois à l'entrée et jamais reconduit mensuellement, et que le Pilotage
  continue de porter seul le suivi Cyclades récurrent (pas de ligne Cyclades séparée dans le catalogue —
  confirmé, `SVC_EPS_ADMINISTRATIF` est le seul autre service administratif et il est `inclus_uniquement`,
  jamais facturé séparément non plus).
- **Sensibilité** : sur un parcours annuel typique (Pilotage 150×10 + un module 8h/mois × 10), 120 TND
  représente <3 % du total annuel — impact marginal sur la marge globale du parcours, significatif
  seulement si facturé par erreur plusieurs fois (risque opérationnel, pas tarifaire).
- **Recommandation** : valider le principe (frais d'ouverture, une seule fois), garder le montant 120 TND
  comme hypothèse de départ à confirmer avec le temps administratif réel constaté (vérification pièces,
  saisie dossier).
- **Effet sur la marge** : marginal sur un parcours complet, mais **doit être techniquement garanti comme
  non répétable** (contrôle de facturation à ajouter si ce coût est un jour effectivement facturé au
  client, pas seulement un coût interne).
- **Décision attendue** : valider le principe « un seul frais d'ouverture, jamais reconduit » et le
  montant 120 TND (ou l'ajuster selon temps administratif réel).

## 6 — Marge bloquante (45 %) et 7 — Marge cible (55 %)

- **Hypothèse brief** : bloquante <45 %, cible ≥55 %.
- **Cohérence avec l'existant** : le moteur historique utilise 30 %/40 % (`quotes.costPolicy.marginGates`)
  — **15 points d'écart sur chaque seuil**. Si les deux moteurs coexistent sans que ce soit une décision
  explicite, un devis candidat-individuel à 50 % de marge serait "signalé" (sous la cible 55 %) alors que
  le même niveau de marge sur un devis du moteur historique serait "vert" (au-dessus de 40 %) — deux
  définitions de « marge saine » incohérentes pour la même entreprise. **C'est le point le plus important
  de ce document** : ce n'est pas une question de calibration fine, c'est une question de cohérence de
  politique commerciale globale.
- **Sensibilité** : sur le tier 8h/mois agrégé, passer le seuil bloquant de 45 % à 30 % (aligné legacy)
  changerait le statut de l'effectif 2 (27,7 %, actuellement bloquant) — resterait bloquant même à 30 %
  (27,7 % < 30 %) mais l'effectif 1 (-44,7 %) resterait bloquant dans tous les cas. Impact limité sur les
  cas déjà extrêmes, significatif sur les cas proches du seuil (effectif 2-3).
- **Recommandation** : trancher explicitement si le candidat-individuel doit avoir des seuils de marge
  différents du reste de l'activité (justifiable : produit plus consommateur de temps enseignant par élève,
  effectifs structurellement plus faibles) ou s'aligner sur 30/40 % pour une politique de marge unique. Je
  recommande de **garder 45/55 % pour candidat-individuel** avec une justification écrite explicite (produit
  structurellement plus cher à délivrer, effectif rarement optimal) plutôt que d'aligner mécaniquement sur
  le legacy — mais ceci est une décision commerciale, pas technique, à trancher par la direction.
- **Effet sur la marge** : détermine directement combien des 14 éléments (§7) sont vendables en solo/duo
  sans passer par une politique DUO/SOLO différenciée.
- **Décision attendue** : confirmer 45/55 % pour candidat-individuel ET confirmer explicitement que cette
  divergence avec le legacy (30/40 %) est assumée, pas un oubli.

## 8 — Plancher horaire (40 TND/h/élève)

- **Hypothèse brief** : 40 TND/h/élève.
- **Cohérence** : le plancher legacy existant (`price_floor_per_student_hour_tnd`) va de 40 (college/
  stage_college) à 180 (coaching_1to1) selon la catégorie — 40 TND/h correspondrait à la catégorie la
  plus basse du barème existant (collège), ce qui semble bas pour un format candidat-individuel terminale/
  première (public plus avancé, enjeu bac direct). Aucune catégorie `petit_groupe`/`candidat_individuel`
  n'existe dans ce barème aujourd'hui (constat transversal en tête de document).
- **Sensibilité** : tous les tarifs `petit_groupe` existants (250/470/680 TND pour 4h/8h/12h) sont
  largement au-dessus de ce plancher (56,7 à 62,5 TND/h/élève) — le plancher à 40 TND/h/élève ne
  contraindrait aucun prix actuellement proposé, il ne sert que de garde-fou contre une future remise
  excessive.
- **Recommandation** : plutôt que 40 TND/h/élève (catégorie « collège »), aligner sur la catégorie `multi`
  existante (45 TND/h) ou `single` (50 TND/h) — plus représentatif d'un public lycée candidat-libre que la
  catégorie collège. Ajouter un `floorType` `petit_groupe_candidat_individuel` dédié dans
  `price_floor_per_student_hour_tnd` (migration de données, pas de code bloquant) plutôt que réutiliser une
  catégorie existante à la sémantique différente.
- **Effet sur la marge** : aucun impact sur les prix déjà proposés (tous au-dessus du plancher envisagé,
  quel que soit le choix 40/45/50) — sert uniquement à contraindre les remises futures.
- **Décision attendue** : choisir la valeur (40/45/50 TND/h/élève) et confirmer la création d'une catégorie
  de plancher dédiée plutôt que la réutilisation d'une catégorie « collège » à la sémantique différente.

## 9 — Plafond de remise (20 %)

- **Hypothèse brief** : 20 % maximum, non cumulable (`discounts.cumulable=false` par défaut dans les
  règles existantes).
- **Cohérence** : correspond exactement au plafond déjà câblé dans `applyDiscounts`
  (`rules.discounts.global_cap_pct`) — **aucune divergence**, cette valeur est déjà la règle réelle du
  moteur legacy, pas une nouvelle hypothèse pour candidat-individuel.
- **Sensibilité** : à 20 % de remise sur le tier 8h/mois agrégé (470→376 TND), la marge à effectif 3 passe
  de 51,8 % à 39,7 % (repasse sous la cible 55 %, reste au-dessus du seuil bloquant 45 %... **non**, 39,7 %
  < 45 % = **bloquant**). Une remise maximale appliquée sur un effectif 3 avec enseignant agrégé ferait
  donc basculer un devis normalement rentable en zone bloquante — `applyDiscounts` et `computeMargin` sont
  deux fonctions indépendantes aujourd'hui, **rien ne garantit qu'une remise validée par `applyDiscounts`
  (≤20 %, techniquement acceptée) repasse ensuite par un contrôle de marge après remise** dans le chemin
  actuel du pipeline. Point à vérifier/durcir techniquement (mission §8, mission technique indépendante).
- **Recommandation** : valider 20 % (déjà la règle réelle), mais **corriger un risque technique réel** :
  s'assurer que `assertMarginAcceptable` est appelée sur le prix **après** remise, pas seulement sur le prix
  catalogue — à vérifier dans le pipeline actuel et corriger si ce n'est pas le cas (indépendant de toute
  décision commerciale).
- **Effet sur la marge** : peut faire basculer un scénario par ailleurs sain en zone bloquante si le
  contrôle de marge n'est pas re-exécuté après remise.
- **Décision attendue** : valider 20 % (déjà en vigueur) ; confirmer la priorité de vérifier/corriger
  l'ordre remise→marge dans le pipeline (technique, sans attendre d'arbitrage commercial).

---

## Synthèse des décisions attendues — 9 valeurs `quotes.costPolicy`/candidat-individuel

Format étendu (mission "vers un produit complet" §1) : valeur actuelle / ancienne valeur legacy / valeur
recommandée / justification / impact sur la marge / statut. **Statut par défaut `À_APPROUVER` pour les 8
premières valeurs — aucune n'est activée dans le moteur.** La 9ᵉ (remise max) est la seule déjà active en
production, sous un autre namespace existant (`pricing.rules.discounts.global_cap_pct`), signalé
explicitement pour ne pas être confondue avec une nouvelle décision.

| # | Valeur | Valeur actuelle | Ancienne valeur legacy | Valeur recommandée | Justification | Impact marge | Statut |
|---|---|---|---|---|---|---|---|
| 1 | Coût agrégé | Aucune (namespace jamais activé) | N/A — `quotes.costPolicy` n'a qu'un taux unique blended 100 TND/h, pas de distinction par qualification | Fourchette 65-85 TND/h, à confirmer avec la paie réelle | 70 TND/h est une hypothèse brief, non vérifiée contre un coût RH réel | Chaque +5 TND/h ≈ −1 pt de marge sur le tier 8h/agrégé/eff.3 (base 51,8 %) | À_APPROUVER |
| 2 | Coût certifié | Aucune | N/A (idem) | 50 TND/h | Point d'équilibre entre agrégé et tuteur, cible atteinte dès effectif 3 sur tous les tiers testés | Robuste — impact ≈0,8 pt/5 TND/h | À_APPROUVER |
| 3 | Coût tuteur | Aucune | N/A (idem) | 35 TND/h | Statut « tuteur » non défini contractuellement dans le dépôt — valeur la plus fragile des 3 | Détermine seul la viabilité des 3 modules ARIA | À_APPROUVER |
| 4 | Structure horaire | Aucune | N/A — `variableCostPerStudentMonthTnd`=10 TND/mois existe comme proxy différent (coût mensuel fixe, pas horaire) dans le legacy | 15 TND/h de séance | Cohérent avec un format majoritairement distanciel/hybride, pas de loyer dédié | Impact modéré, dégressif avec la durée du module | À_APPROUVER |
| 5 | Coût fixe dossier | Aucune | N/A | 120 TND (one-off, jamais reconduit) | Aucun chevauchement identifié avec Pilotage/Cyclades (tâches ponctuelles vs récurrentes distinctes) | Marginal sur un parcours annuel complet (<3 %) | À_APPROUVER |
| 6 | Marge bloquante | Aucune (candidat individuel) | **30 %** (`quotes.costPolicy.marginGates.warningPct`) | 45 % | Produit structurellement plus cher à délivrer (effectifs faibles) — divergence assumée, pas un oubli | Change le statut des cas proches du seuil (effectif 2-3) | À_APPROUVER — divergence avec le legacy à trancher explicitement |
| 7 | Marge cible | Aucune | **40 %** (`quotes.costPolicy.marginGates.greenPct`) | 55 % | Idem — cohérence de politique commerciale globale à confirmer | Détermine combien des 14 éléments sont vendables en solo/duo | À_APPROUVER — idem |
| 8 | Plancher horaire | Aucune pour candidat-individuel (aucune catégorie `petit_groupe` dans `price_floor_per_student_hour_tnd`) | Catégorie la plus proche : `college`=40 TND/h (sémantique différente — public collège, pas lycée candidat-libre) | 45-50 TND/h, catégorie dédiée | Tous les tarifs `petit_groupe` existants (56,7-62,5 TND/h/élève) restent au-dessus dans tous les cas | Aucun impact sur les prix déjà proposés — garde-fou contre une remise future | À_APPROUVER |
| 9 | Plafond de remise | **20 %** (`pricing.rules.discounts.global_cap_pct`) | Identique — même namespace, déjà actif | 20 % (inchangé) | Aucune divergence — la seule des 9 valeurs déjà en production | Peut faire basculer un devis sain en zone bloquante si la marge n'est pas revérifiée après remise (finding technique, corrigé séparément) | **Déjà actif — aucune nouvelle décision requise**, seule la correction technique (ordre remise→marge) reste à vérifier |

**Risque de double comptage vérifié explicitement (mission §9)** : coût fixe de dossier (ponctuel,
ouverture) vs prix du Pilotage (récurrent, suivi) vs services Cyclades (inclus dans le Pilotage, jamais
facturés séparément) vs structure horaire (appliquée aux heures de séance réservée uniquement, jamais aux
heures d'autonomie déjà couvertes par le Pilotage) — **aucun chevauchement identifié**, sous réserve que le
frais de dossier reste strictement non reconduit (point 5) et qu'aucune ligne Cyclades séparée ne soit
jamais introduite dans le catalogue (aucune ne l'est aujourd'hui, `APPUI_CYCLADES` est une `coverageKey` du
Pilotage, protégée par `detectDoubleBilling`).

**Finding le plus important de ce document** : il existe déjà un moteur de coût/marge en production
(`quotes.costPolicy`, `lib/quotes/margin.server.ts`) avec des taux et seuils différents de ceux proposés
ici. Toute activation de la calibration candidat-individuel doit trancher explicitement la relation entre
les deux (unifier ou séparer nommément) — ne pas laisser deux politiques de marge divergentes coexister
sans décision consciente.
