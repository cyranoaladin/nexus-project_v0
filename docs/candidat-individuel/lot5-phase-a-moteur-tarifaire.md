# Moteur tarifaire — Phase A structurelle (Lot 5 §7)

`lib/quotes/pricing-engine.ts` (nouveau). Consomme `CatalogueSelection` (Lot 5,
`lib/quotes/catalogue.ts`) et `candidat_individuel_modules`/`rules` (existants, `lib/pricing.ts`) — aucune
donnée dupliquée, aucun second système de prix.

## Fonctions et règles

| Fonction | Règle |
|---|---|
| `resolveRate(pricingRuleId)` | Résout un `pricingRuleId` (référence stable) vers le taux réel dans `candidat_individuel_modules` |
| `priceSelectedModule(m)` | Refuse structurellement tout module non `SELECTED` ou non `APPROVED` (`UnapprovedCatalogueElementError`) — jamais de prix pour un élément `DIRECTION_A_VALIDER` |
| `pricePilotage()` | Ligne Pilotage, tarif `PILOTAGE_MONTHLY` |
| `priceSelection(selection)` | Assemble toutes les lignes, appelle `detectDoubleBilling` (Lot 5, réutilisé) avant de renvoyer un total — lève `DoubleBillingDetectedError` si collision, jamais silencieux |
| `computeCandidatLibreSchedule` | **Réutilisée telle quelle** (D4, `lib/quotes/pricing.ts`) — acompte 25 % + 10 mensualités, dernière absorbe l'arrondi |
| `computeSecondGroupePayment(total)` | P11 : 100 % à la réservation, aucun acompte/mensualité (Décision 3) |
| `checkFloor(taux, floorType)` | Plancher par type (`price_floor_per_student_hour_tnd`, existant) |
| `applyDiscounts(base, remises[])` | Plafond 20 % (`discounts.global_cap_pct`, existant), non cumulables (`discounts.cumulable=false`, existant) — lève `DiscountRejectedError` |
| `computeMargin(prix, coût)` / `assertMarginAcceptable` | Bloquante <45 %, signalée <55 % — jamais appelée avec un coût inventé pour un devis réel |
| `resolveGroupModality(effectif, ...)` | Bascule GROUPE → DUO (2) → SOLO (1) selon `group_min_open`/`group_max` existants |
| `compareSelectionToCanonicalPacks` | Étend `matchCanonicalPack` (réutilisé, non dupliqué) — limite documentée : comparaison par volume horaire, pas encore par `coverageKeys` structurés côté offres (gap déjà noté dans `lot5-catalogue-architecture.md`) |
| `buildPricingEngineSnapshot` | Structure figée (lignes, totaux, échéancier, horodatage) |

## Garde-fous

- Aucun élément `DIRECTION_A_VALIDER` ne peut jamais atteindre `priceSelection` sans lever une exception —
  vérifié par test (`priceSelectedModule` refuse tout module non `APPROVED`).
- Aucune fuite publique : tests dédiés confirment l'absence de clés `teacherCost`/`grossMargin`/etc. dans
  toute sortie du moteur (lignes, snapshot).
- `computeMargin`/`assertMarginAcceptable` sont des fonctions pures, jamais appelées avec les hypothèses
  Phase B (`PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES`) dans un chemin de devis réel — uniquement dans le
  dossier de simulation (`lot5-phase-b-dossier-arbitrage-chiffre.md`).

## Hypothèses reprises telles quelles (non activées)

Voir `lot5-phase-b-dossier-arbitrage-chiffre.md` — coûts enseignants (70/50/35 TND/h), coût de structure
(15 TND/h), coût fixe (120 TND), seuils de marge (45/55 %), plancher (40 TND/h/élève), remise max (20 %).

## Ce que cette phase NE fait PAS

- Ne wire aucune route/composant public ou staff (architecture testée, `lot5-catalogue-adapter-boundary.test.ts`
  étendu à `pricing-engine.ts`).
- N'active aucun des 14 éléments `DIRECTION_A_VALIDER` — `priceSelectedModule` les refuse tous par
  construction, prouvé par test.
- Ne construit pas de namespace `BusinessConfig` pour le catalogue (mécanisme existant, déféré comme noté
  dans `lot5-catalogue-architecture.md`).
- Ne recâble pas `matchCanonicalPack`/le flux public — `compareSelectionToCanonicalPacks` est une nouvelle
  fonction additive, non substituée dans le moteur existant.
