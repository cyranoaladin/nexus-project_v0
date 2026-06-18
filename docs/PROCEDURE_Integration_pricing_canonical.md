# PROCÉDURE D'INTÉGRATION — `pricing.canonical.json`
### À lire par Claude Opus avant et pendant l'implémentation

> Ce document explique **quoi faire** du fichier `pricing.canonical.json` (livré à côté). Ce fichier est désormais **LA source de vérité unique** des prix, effectifs, acomptes et échéanciers de Nexus Réussite. Il a été généré et **validé automatiquement** (tous les invariants passent). Il accompagne et complète :
> - `PROMPT_Claude_Opus_Refonte_Nexus.md` (refonte tarifaire & marketing),
> - `CDC_Offres_Ponctuelles_Pass_Nexus.md` (offres ponctuelles, Pass, Carte Nexus).
>
> En cas de divergence entre le code existant et ce JSON, **le JSON fait foi**.

---

## 1. CE QUE CONTIENT LE FICHIER (structure)

| Clé racine | Contenu |
|---|---|
| `campaign` | Libellés + date limite campagne (`2026-08-31`) ; pilote la bascule auto vers tarif public. |
| `rules` | Effectifs (5 max), seuils d'ouverture, planchers de marge, plafond remise, modèle de paiement, remises. **Toute la logique métier se paramètre ici.** |
| `annual_offers` | 11 parcours présentiel (Terminale, Première, Seconde, Brevet) — prix repricés, prix/h, équivalent séance, mensualité, échéancier 30 % + 9. |
| `libre_offers` | Parcours candidats libres / mixtes (échéanciers spécifiques conservés). |
| `plateforme_offers` | 3 abonnements plateforme (live plafonné à 5). |
| `stage_formats` | 7 formats de stage (prix, prix/h, acompte 30 %, solde). |
| `stage_editions` | 6 éditions calendaires (Cap Rentrée → Sprint), avec formats proposés. |
| `ponctuel_offers` | Cap EAF, Cap Maths Première, Studio Grand Oral, Épreuve Blanche. |
| `coaching` | Gamme Boussole (Diagnostic, Méthode, Orientation, Individuel + packs 3/5). |
| `packs` | 6 Pass : composition par références, `value` (somme unitaires), `price`, remise, acompte, échéancier solde. |
| `carte_nexus` | Adhésion 290/an, remise −10 % **unités uniquement, jamais sur Pass**. |

**Champs dérivés déjà calculés et vérifiés** : `price_per_student_hour`, `equiv_per_2h_session`, `monthly_display`, `payment.deposit/installments/solde`, `packs[].value/discount_pct`. Tu peux soit les consommer tels quels, soit les recalculer via des fonctions pures **dont les sorties doivent être identiques** (test de non-divergence).

---

## 2. PROCÉDURE D'INTÉGRATION (ordre impératif)

1. **Découverte** (cf. refonte §1) : cartographie, repère le fichier de prix existant éventuel, liste tous les montants codés en dur.
2. **Poser la source** : place `pricing.canonical.json` à l'emplacement canonique du projet (ex. `data/pricing.canonical.json`). S'il existe déjà un JSON de prix, **fusionne** vers ce schéma (ne crée pas de doublon ; réconcilie les `id`).
3. **Loader typé unique** : crée un module unique d'accès (ex. `lib/pricing.ts`) qui charge le JSON, expose des accesseurs typés (`getAnnualOffer(id)`, `getStage(formatId)`, `getPack(id)`, `getCarte()`, `getRules()`), et les fonctions pures dérivées (`computeSchedule`, `applyDiscount`, `resolvePackValue`). **Aucun autre fichier ne lit le JSON directement.**
4. **Migration des surfaces** : fais consommer ce loader par la page d'accueil, le catalogue, le sélecteur, et tous composants tarifaires. Supprime **tous** les montants en dur (ils deviennent des lectures du loader).
5. **Validateur = test** : réimplémente le validateur (cf. §3) en test automatisé qui **fait échouer le build** si un invariant casse. C'est le garde-fou anti-régression permanent.
6. **Affichage** : applique les gabarits imposés (refonte §5 ; CDC §5) — cartes parcours, cartes stage, cartes Pass avec « au lieu de `value` » + badge remise + mention déductibilité, bloc Carte Nexus.
7. **Flux réservation/acompte** : paramètre le flux « Réserver » par `id` ; pré-remplis acompte + échéancier depuis le loader.
8. **Portes qualité** : tests verts (≥ 72/72 + nouveaux), build OK, Lighthouse non régressé, liens/ancres OK, aucun `TODO` orphelin.
9. **Rapport d'itération** : à chaque passe, mets à jour les matrices de vérification (refonte §9 / CDC §9) et reporte le statut des tests.

---

## 3. VALIDATEUR À REPRODUIRE EN TESTS (invariants — build rouge si violé)

Réimplémente exactement ces contrôles (ils sont déjà satisfaits par le JSON livré ; ils doivent le rester) :

1. **Effectif** : aucune offre (parcours, libre, stage, ponctuel, coaching de groupe) avec `group_max > 5` ; `plateforme_offers[].live_group_max ≤ 5`.
2. **Planchers prix/élève/heure** selon `floor_type` : `single ≥ 50`, `multi ≥ 45`, `college ≥ 40`, `stage ≥ 45` ; coaching `coaching_1to1` → `price_per_hour ≥ 180`. (`floor_type: "na"` = exempté : online, plateforme, Épreuve Blanche, Diagnostic.)
3. **Échéancier parcours annuel** : `deposit + Σ installments == price_annual_campaign`.
4. **Échéancier stage/ponctuel** : `deposit + solde == price_per_student` (ou `full_at_booking` ⇒ `deposit == price`).
5. **Packs — intégrité référentielle** : chaque composant `stage` référence un `format_id` ∈ `stage_formats` **et** un `edition_id` ∈ `stage_editions` ; chaque `ponctuel`/`coaching` référence un `id` existant.
6. **Packs — valeur** : `value == Σ qty × prix_unitaire_résolu` (les `value_override` font foi pour Diagnostic/service).
7. **Packs — plancher** : `price ≥ 0,80 × value` (remise ≤ 20 %).
8. **Packs — échéancier** : `deposit + Σ solde_schedule == price`.
9. **Carte Nexus** : remise appliquée **uniquement** aux unités (stages/coaching), **jamais** à un Pass ; unité remisée Carte `≥ 40 TND/h` (plancher membre).
10. **Anti-hardcode** : aucun montant TND présent dans le code rendu hors du JSON canonique (hors fixtures de test).
11. **Anti-fuite** : aucune occurrence de `à confirmer par la direction` ni `X TND les 2 h` dans le HTML rendu.

---

## 4. RÈGLES DE MODIFICATION FUTURE (anti-dette)

- Toute évolution de prix/offre se fait **dans le JSON**, jamais dans une page/composant.
- Après toute modification du JSON, **relancer le validateur** : s'il passe au rouge, la modif viole un invariant business (plancher, plafond remise, intégrité Pass…) → corriger les chiffres, pas le validateur.
- Le validateur est volontairement strict : il empêche une future baisse de prix qui rendrait une heure déficitaire, ou un Pass dont la remise dépasserait 20 %.
- Ne jamais relâcher `group_max` au-dessus de 5.

---

## 5. NOTES BUSINESS (corrections actées lors de la génération)

Trois ajustements d'arithmétique ont été faits pour garder les « au lieu de » des Pass **honnêtes** et conformes au plafond de remise (les valeurs annoncées en réflexion contenaient des sommes approximatives) :

- **Cap Bac Première** : valeur réelle des composants = **1 600** (Cap EAF 720 + Cap Maths 580 + 2 × Épreuve Blanche 150) ; prix Pass ajusté à **1 390** (−13 %) pour offrir une remise réellement attractive (au lieu de 1 490 / −7 %).
- **Pass Excellence Ponctuel** : valeur réelle = **2 880** (et non 2 780) ; prix **2 390** inchangé (−17 %).
- **Pass Candidat Libre** : valeur des composants chiffrables = **1 990** ; prix **1 690** inchangé (−15 %).
- **Boussole Individuel Pack 5** : porté à **900** (au lieu de 850) pour respecter le plancher 1:1 de 180 TND/h.

Tous les autres prix correspondent exactement aux décisions validées. Le détail des packs après validation :

| Pass | value | price | remise | acompte | solde |
|---|--:|--:|--:|--:|---|
| Pass Intensifs Année — Première | 2 320 | 1 990 | −14,2 % | 250 | 4 × 435 |
| Pass Intensifs Année — Terminale | 2 880 | 2 490 | −13,5 % | 290 | 4 × 550 |
| Cap Bac Première | 1 600 | 1 390 | −13,1 % | 200 | 300+300+300+290 |
| Pass Grand Oral & Sprint | 1 440 | 1 290 | −10,4 % | 200 | 2 × 545 |
| Pass Excellence Ponctuel | 2 880 | 2 390 | −17,0 % | 290 | 4 × 525 |
| Pass Candidat Libre | 1 990 | 1 690 | −15,1 % | 290 | 4 × 350 |

---

## 6. ORDRE DE LECTURE DES TROIS DOCUMENTS

1. `PROMPT_Claude_Opus_Refonte_Nexus.md` — socle (règles, refonte, suppressions, gabarits, qualité).
2. `CDC_Offres_Ponctuelles_Pass_Nexus.md` — couche ponctuelle + matrice de vérification itérative.
3. **Ce document + `pricing.canonical.json`** — la donnée concrète et la procédure pour la brancher partout.

La « définition of done » globale = matrices §9 des deux premiers documents **toutes cochées** + validateur §3 **vert** + portes qualité **vertes**.
