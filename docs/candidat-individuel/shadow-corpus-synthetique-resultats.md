# Corpus shadow synthétique — résultats (mission recâblage §10)

**STATUT : CORPUS SYNTHÉTIQUE, JAMAIS UNE OBSERVATION DE PRODUCTION.**
Aucun environnement réel n'est accessible à ce stade — tous les profils ci-dessous sont fabriqués, anonymes par construction (aucun champ nominatif dans SituationInput/PublicCandidateInputRaw), et générés le 2026-08-26 par __tests__/lib/quotes/shadow-corpus.synthetic.test.ts. Ce document ne doit jamais être cité comme une mesure réelle de conversion, de marge ou de comportement client.

## Section A — comparable via le vrai chemin `runShadowComparison` (8 profils)

Exécuté avec exactement la fonction appelée par `app/api/quotes/route.ts` en mode SHADOW — pas une réimplémentation. **Constat systématique et non fabriqué : les 8 profils, malgré des variations de diagnostic/budget/langues/spécialité abandonnée, classent tous `INSUFFICIENT_INPUT`.** Cause racine (documentée dans le code avant ce corpus, confirmée ici empiriquement) : `SituationInput` — la forme du moteur historique — ne porte aucun concept de modalité (A/B), un champ que le nouveau pipeline exige. `situationToPublicInput` n'infère jamais cette valeur (fail-closed, décision déjà prise) — donc aucune comparaison prix-à-prix legacy/nouveau n'est possible aujourd'hui via ce chemin réel, pour aucun profil, pas seulement les cas particuliers.

| Profil | Dimension | Catégorie | Détail |
|---|---|---|---|
| A1 — Terminale, modalité implicite dans SituationInput | Terminale | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A2 — Première | Première | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A3 — diagnostic absent | diagnostic absent | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A4 — diagnostic faible (20-25%, tier A_RECTIFIER attendu) | diagnostic faible | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A5 — budget bas (150 TND/mois) | budget bas | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A6 — budget élevé (5000 TND/mois) | budget élevé | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A7 — spécialité abandonnée renseignée | options / spécialité abandonnée | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |
| A8 — langues A/B renseignées (LVA/LVB) | options | INSUFFICIENT_INPUT | Le nouveau pipeline nécessite des données (ex. modalité) absentes de SituationInput. |

**Rapport agrégé (`buildAggregateDivergenceReport`)** :

```json
{
  "totalSimulations": 8,
  "identicalPct": 0,
  "pricingDifferences": 0,
  "coverageDifferences": 0,
  "unpricedModules": 0,
  "errors": 0,
  "needsReview": 0,
  "byCategory": {
    "EXPECTED_REGULATORY_CORRECTION": 0,
    "EXPECTED_CATALOGUE_CHANGE": 0,
    "PRICING_DIFFERENCE": 0,
    "COVERAGE_DIFFERENCE": 0,
    "LEGACY_BUG": 0,
    "NEW_ENGINE_BUG": 0,
    "UNPRICED_MODULE": 0,
    "INSUFFICIENT_INPUT": 8,
    "IDENTICAL": 0
  }
}
```

**Conséquence pour la mission** : tant que le nouveau pipeline reste en mode SHADOW, aucune preuve chiffrée de convergence/divergence prix legacy vs nouveau ne peut être produite via ce chemin — pas un défaut de ce corpus, un fait structurel du format historique. Pour obtenir une vraie comparaison prix-à-prix, `situationToPublicInput` devrait recevoir une source de modalité (ex. un champ ajouté au formulaire familial existant), ce qui est un changement de périmètre commercial (nouveau champ visible famille), pas un simple correctif technique — à signaler à la direction, pas à corriger silencieusement.

## Section B — nouveau périmètre, non comparable par construction (21 profils)

Ces dimensions (P3-P12 hors P1/P2/P10, conservation, reconduction, dispense, options, éléments non approuvés) n'ont aucune représentation dans `SituationInput` — les forcer dans `runShadowComparison` produirait un `INSUFFICIENT_INPUT` qui masquerait leur vrai comportement. Classées ici directement via `buildCandidateQuoteRecommendation` (nouveau pipeline seul), sans comparaison inventée.

| Profil | Dimension | Statut | Note |
|---|---|---|---|
| B1 — P1 libre 2 ans modalité A | P1 | DIRECTION_APPROVAL_REQUIRED | 5 module(s) en attente d'arbitrage direction |
| B2 — P2 libre 2 ans modalité B | P2 | HUMAN_REVIEW_REQUIRED | 9 avertissement(s) |
| B3 — P3 dérogation même session (motif confirmé) | P3 | DIRECTION_APPROVAL_REQUIRED | 6 module(s) en attente d'arbitrage direction |
| B4 — P4 redoublement première | P4 | DIRECTION_APPROVAL_REQUIRED | 1 module(s) en attente d'arbitrage direction |
| B5 — P5 redoublement terminale | P5 | HUMAN_REVIEW_REQUIRED | 4 avertissement(s) |
| B6 — P6 amélioration + terminale | P6 | HUMAN_REVIEW_REQUIRED | 4 avertissement(s) |
| B7 — P7 titulaire du bac | P7 / titulaire | DIRECTION_APPROVAL_REQUIRED | 5 module(s) en attente d'arbitrage direction |
| B8 — P8 bascule scolaire vers individuel | P8 / bascule | HUMAN_REVIEW_REQUIRED | 4 avertissement(s) |
| B9 — P9 combiné (changement de spécialité sur P1) | P9 combiné | DIRECTION_APPROVAL_REQUIRED | 6 module(s) en attente d'arbitrage direction |
| B10 — P10 épreuves anticipées seules (première, hors cycle complet) | P10 | DIRECTION_APPROVAL_REQUIRED | 1 module(s) en attente d'arbitrage direction |
| B11 — P11 second groupe (moyenne rattrapage 9/20) | P11 | DIRECTION_APPROVAL_REQUIRED | 5 module(s) en attente d'arbitrage direction |
| B12 — P12 étalement plurisessions déclaré | P12 | HUMAN_REVIEW_REQUIRED | 2 avertissement(s) |
| B13 — conservation (note conservée confirmée, D. 334-13) | conservation | DIRECTION_APPROVAL_REQUIRED | 5 module(s) en attente d'arbitrage direction |
| B14 — reconduction automatique confirmée (audit vérifié, D. 334-7-1, redoublement terminale) | reconduction | HUMAN_REVIEW_REQUIRED | 4 avertissement(s) |
| B15 — dispense confirmée (arrêté du 14 mai 2020) | dispense | DIRECTION_APPROVAL_REQUIRED | 5 module(s) en attente d'arbitrage direction |
| B16 — option déclarée, élément non approuvé (Maths expertes, coefficient non sourcé) | options / élément non approuvé | HUMAN_REVIEW_REQUIRED | 3 avertissement(s) |
| B17 — profil READY (P7 intégralement dispensé — Pilotage seul) | READY / pack ou sur-mesure | READY (diagnostic=ABSENT, budgetInsuffisant=false) | sur-mesure (aucun pack canonique apparié) |
| B18 — budget insuffisant pour le socle (1 TND/mois, même profil READY) | budget bas (nouveau périmètre) | READY (diagnostic=ABSENT, budgetInsuffisant=true) | sur-mesure (aucun pack canonique apparié) |
| B19 — dispense déclarée non confirmée (fail-closed attendu) | dispense (non confirmée) | HUMAN_REVIEW_REQUIRED | 3 avertissement(s) |
| B20 — note conservée mécanisme INDETERMINE (fail-closed attendu) | conservation (indéterminée) | HUMAN_REVIEW_REQUIRED | 3 avertissement(s) |
| B21 — nominal terminale sans aucune donnée incertaine (référence) | élément non approuvé (HG/ES/EMC/LVA/LVB structurels) | DIRECTION_APPROVAL_REQUIRED | 5 module(s) en attente d'arbitrage direction |

**Répartition des statuts (Section B, 21 profils)** :

| Statut | Nombre |
|---|---:|
| DIRECTION_APPROVAL_REQUIRED | 10 |
| HUMAN_REVIEW_REQUIRED | 9 |
| READY | 2 |

## Dimensions demandées par la mission §10 sans représentation dans le pipeline actuel

- **Format présentiel / distanciel / mixte** : aucune de ces valeurs n'existe comme champ candidat aujourd'hui — chaque module du catalogue déclare son propre format fixe (`petit_groupe`, `individuel_presentiel`, `autonomie_guidee_aria`), la famille ne choisit jamais un format de livraison indépendamment du module. Non testable comme dimension d'entrée séparée sans inventer un champ qui n'existe pas dans le produit actuel.
- **Pack / sur-mesure** : ce n'est pas une dimension d'entrée mais une observation de sortie (`matchedOfferId` sur chaque scénario). Reporté ci-dessus pour le seul profil B17 qui atteint READY (les autres profils Section B n'atteignent pas un statut produisant des scénarios).

