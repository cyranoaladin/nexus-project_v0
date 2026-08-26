# Gouvernance vs hypothèses de coûts — deux tables séparées (mission "vers un produit complet" §5)

**Rôle de ce document** : sépare explicitement, comme demandé par la direction, (A) les **décisions de
gouvernance** (règles de fonctionnement du moteur — seuils, plafonds, règles de cumul, bascule, arrondi,
allocation) de (B) les **hypothèses de coût opérationnel** (valeurs en TND/h ou en TND, sujettes à
vérification RH). Reprend et réorganise les valeurs déjà établies dans
`proposition-calibration-couts-v1.md` (authored 2026-08-25, gardé tel quel, non remplacé) — aucune valeur
n'est réinventée ici, seule la structure change pour répondre exactement au format demandé.

**Statut global : `À_APPROUVER` pour toutes les lignes des deux tables**, sauf mention contraire explicite
(plafond de remise, déjà actif).

---

## Table A — Décisions de gouvernance

| Décision | Valeur proposée | Valeur réellement active en production | Où c'est codé (si codé) | Statut de câblage |
|---|---|---|---|---|
| Marge bloquante | 45 % | **30 %** (`quotes.costPolicy.marginGates.warningPct`, `margin.server.ts::DEFAULT_COST_POLICY`) | `pricing-engine.ts::MARGIN_BLOCKING_THRESHOLD_PCT=45` existe déjà mais **0 appelant** en dehors de son propre fichier | Décidé (session antérieure) mais **jamais raccordé** — le chemin réel de création de devis utilise l'autre seuil (30 %) |
| Marge cible | 55 % | **40 %** (`quotes.costPolicy.marginGates.greenPct`) | `pricing-engine.ts::MARGIN_TARGET_THRESHOLD_PCT=55` — même défaut, 0 appelant | Idem — code mort |
| Plafond de remise | 20 % | **20 %**, déjà actif | `rules.discounts.global_cap_pct` (namespace `pricing.rules`), appliqué par `applyDiscounts` | **Déjà actif, aucune décision requise** — mais voir risque signalé ci-dessous |
| Règles de cumul de remise | Non cumulable par défaut (`cumulable=false`) | Identique — déjà la règle réelle | `applyDiscounts` (`lib/quotes/pricing-engine.ts:356-368`), lève `DiscountRejectedError` si plusieurs remises simultanées et `cumulable=false` | **Déjà actif** |
| **Risque non résolu (remise × marge)** | — | — | `applyDiscounts` et `computeMargin`/`assertMarginAcceptable` sont des fonctions **indépendantes** — aucun appel vérifié ne rechaîne le contrôle de marge après application d'une remise dans le chemin réel de la route de création de devis | **Finding technique ouvert, hors périmètre de ce lot** — une remise à 20 % validée peut faire passer un devis par ailleurs sain sous le seuil de marge réel sans qu'aucun gate ne s'en aperçoive |
| Seuil de bascule DUO/SOLO | Effectif < 3 → DUO (2) ou SOLO (1) | `group_min_open=3` (donnée déjà présente dans `data/pricing.canonical.json`, tous les tiers `petit_groupe`) | `resolveGroupModality` (`pricing-engine.ts:127-145`) implémente déjà exactement cette logique | **Mécanisme complet et correct, 0 appelant en dehors de sa propre définition** — même défaut que P11 avant ce lot, jamais corrigé (hors mandat de cette session) |
| Comportement sous effectif minimal | Devrait bloquer/rebasculer automatiquement | **Aucun comportement défini** — `computeMargin` (le vrai, appelé) assume toujours un effectif fixe de 3 (`CONSERVATIVE_GROUP_SIZE`), qu'un groupe ouvre à 1, 3 ou 8 élèves | `margin.server.ts:74` | **Lacune confirmée** — un devis à effectif réel 1 peut aujourd'hui être créé au tarif `petit_groupe` plein sans qu'aucun gate ne le détecte (le moteur ne connaît pas l'effectif réel constaté) |
| Règle d'arrondi | Acompte arrondi au multiple de `rounding_tnd` le plus proche ; dernière mensualité **arrondie par défaut vers le bas** (`Math.floor`), jamais vers le haut — le client ne paie jamais un centime de plus que le total exact | `rounding_tnd = 10` TND (`data/pricing.canonical.json`, `rules.payment`) | `lib/quotes/pricing.ts:157` (acompte), `:159` (mensualité, `Math.floor(remaining / CANDIDAT_LIBRE_N_INSTALLMENTS)`) | **Déjà actif** pour le moteur legacy (`CANDIDAT_LIBRE_*`) — P11 (`computeSecondGroupePayment`) n'a pas besoin d'arrondi (paiement unique, montant déjà entier par construction : heures entières × 180 TND/h) |
| Allocation du coût fixe (dossier) | Un seul frais d'ouverture, jamais reconduit, jamais réparti sur les mensualités | Aucune — le coût fixe dossier (120 TND, Table B) n'existe dans **aucun** chemin de calcul réel aujourd'hui | Aucun | **Non câblé** — c'est une hypothèse de coût interne (Table B), pas un prix facturé ; si la direction décide un jour de le facturer, il faudra une décision explicite sur la méthode d'allocation (facturé une fois à part, ou amorti dans le Pilotage du premier mois) — aucune des deux n'est câblée aujourd'hui |

**Constat transversal de la Table A** : sur 8 lignes, **5 mécanismes existent déjà en code correct et testé
mais ne sont raccordés à aucun chemin réel** (seuils 45/55, bascule DUO/SOLO, comportement sous effectif
minimal — celui-ci n'existe même pas). C'est le même schéma que P11 avant cette session — la différence est
que P11 a été traité dans ce lot ; les autres restent des dettes ouvertes, explicitement signalées, hors
mandat de cette session (P11/P3 uniquement).

---

## Table B — Hypothèses de coût opérationnel

Toutes les valeurs ci-dessous sont `[hypothèse Claude — proposition-calibration-couts-v1.md, 2026-08-25]`,
**jamais vérifiées contre une donnée RH/paie réelle**, **jamais injectées dans un chemin de calcul réel**
(seul `margin.server.ts::DEFAULT_COST_POLICY` est réellement actif, avec un taux unique blended de 100
TND/h — voir ligne "Taux blended actif" en bas de table, seule valeur véritablement en production).

| Coût | Valeur exacte V1 | Fourchette | Source | Date source | Charges incluses | Charges exclues | Temps prépa/correction inclus ? | Hypothèse conservatrice | Sensibilité ±10 % | Sensibilité ±20 % | Conséquence d'une sous-estimation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Enseignant agrégé | 70 TND/h | 65-85 TND/h | Hypothèse brief interne, non confrontée à la paie réelle | 2026-08-25 | Salaire horaire brut estimé | Charges patronales, préparation de séance, correction de copies | **Non** — coût horaire de séance uniquement | Non — c'est la valeur la plus optimiste des 3 qualifications (la moins chère), donc la moins conservatrice si le vrai coût agrégé est plus proche de 85 | +7 TND/h à 85 → marge tier 8h/eff.3 chute d'environ 7 pts | +14 TND/h à 84 (borne haute) → marge tier 8h/eff.3 chute d'environ 14 pts, peut faire basculer un scénario jugé sain aujourd'hui en zone bloquante sous 45 % | Un module vendu comme rentable à 70 TND/h peut être déficitaire réel si le coût agrégé réel est proche de 85 — **recommandation : ne pas approuver le prix `MOD_*` avant confrontation à la paie réelle** |
| Enseignant certifié | 50 TND/h | 45-55 TND/h (non testée formellement, extrapolée proportionnellement) | Idem, hypothèse brief | 2026-08-25 | Salaire horaire brut estimé | Charges patronales, prépa, correction | **Non** | **Oui** — point d'équilibre entre agrégé et tuteur, le moins risqué des 3 | ±5 TND/h → ±0,8 pt de marge (tier 8h) | ±10 TND/h → ±1,6 pt | Impact limité — c'est la valeur retenue comme "coût certifié" dans toutes les fiches §4, la moins sensible des 3 qualifications |
| Tuteur | 35 TND/h | Non chiffrée — statut RH non défini dans le dépôt | Idem, hypothèse brief, **la plus fragile des 3** (aucun référentiel RH trouvé pour le statut "tuteur") | 2026-08-25 | Rémunération horaire estimée d'un profil non-enseignant-certifié | Charges patronales, statut contractuel réel (junior salarié ? vacataire ? étudiant ?) | **Non** | Non explicitement — dépend d'un référentiel RH non documenté | +3,5 TND/h (10 %) → modules ARIA (§4 éléments 4-6) perdent ~5 pts de marge | +7 TND/h (20 %, à 42 TND/h) → palier ARIA recommandé (40 TND) tombe de 56,3 % à ~48,1 %, toujours PASS_BELOW_TARGET mais proche du seuil 45 % | Les 3 modules ARIA sont **entièrement dimensionnés sur ce seul taux** — une erreur ici affecte 3 des 13 éléments d'un coup |
| Structure (par heure de séance) | 15 TND/h | Non testée formellement | Hypothèse brief, cohérente avec un format distanciel/hybride sans loyer dédié | 2026-08-25 | Plateforme, support technique, amortissement outils | Loyer de salle physique (non applicable — format distanciel/hybride majoritaire) | N/A (coût de structure, pas de temps humain) | Oui — cohérent avec l'absence de coût immobilier dédié au format candidat-individuel | ±1,5 TND/h → ±2 pts sur le tier 4h (le plus court, où la structure pèse relativement le plus) | ±3 TND/h → ±4 pts sur le tier 4h, moins sur 8h/12h (le coût enseignant y domine davantage) | Impact modéré, dégressif avec la durée du module — le tier 4h (minimal) est le plus exposé |
| Coût fixe de dossier | 120 TND (one-off) | Non testée — dépend du temps administratif réel constaté | Hypothèse brief | 2026-08-25 | Vérification des pièces, création du dossier administratif initial | Tout suivi récurrent (déjà couvert par le Pilotage, 150 TND/mois — aucun chevauchement identifié, vérifié par lecture du catalogue) | **Oui** — c'est un temps administratif, pas un temps de séance | Oui — le principe "jamais reconduit" est la garantie conservatrice, doit être techniquement contrôlé si ce coût est un jour facturé (non câblé aujourd'hui, Table A) | Sur un parcours annuel typique, <3 % du total — impact marginal même à ±20 % | Toujours <6 % même à ±20 % | Impact marginal sur la marge globale d'un parcours complet ; risque opérationnel (facturé plusieurs fois par erreur) plus important que risque de calibration |
| Plancher horaire | 40 TND/h/élève (catégorie `college`, réutilisée par défaut faute de catégorie dédiée) | 40-50 TND/h selon catégorie retenue (`college`=40, `multi`=45, `single`=50 — barème `price_floor_per_student_hour_tnd` déjà existant) | Barème legacy déjà en production, catégories existantes | Barème pré-existant (date de création non déterminée dans ce lot) | Prix plancher toutes charges confondues (garde-fou anti-remise, pas un coût réel) | N/A — ce n'est pas un coût, c'est un plancher de prix | N/A | Non applicable — c'est un plancher de prix, pas une hypothèse de coût | Aucun prix `petit_groupe` existant (250-680 TND, soit 56,7-62,5 TND/h/élève) n'est affecté par un choix 40 vs 50 TND/h — tous restent largement au-dessus | Idem — impact nul sur les prix déjà proposés, quel que soit le choix dans 40-50 | Aucune conséquence sur les prix actuels ; sert uniquement à contraindre une remise future excessive — recommandation : créer une catégorie `petit_groupe_candidat_individuel` dédiée plutôt que réutiliser `college` (sémantique différente : public collège vs lycée candidat-libre) |
| **Taux blended — SEULE valeur réellement active en production** | **100 TND/h** | N/A — valeur unique, pas de fourchette documentée | `margin.server.ts::DEFAULT_COST_POLICY.teacherCostPerHourTnd`, code déjà en production | Antérieur à cette mission (non daté dans ce lot) | Taux unique, aucune distinction agrégé/certifié/tuteur | Toute décomposition par qualification | Non documenté | N/A — c'est la valeur actuellement subie par défaut (fail-closed, aucun override BusinessConfig n'existe) | Directement responsable du blocage constaté en §4 pour `MOD_*` jusqu'à effectif 3 sous les seuils 45/55 (le taux blended 100 TND/h est presque **le double** du taux "certifié" 50 TND/h) | — | **C'est la valeur qui gouverne réellement chaque devis créé aujourd'hui** — tant que la direction n'a pas tranché la Table A/B ci-dessus, c'est celle-ci, et aucune autre, qui détermine si un devis passe ou non le gate de marge réel (30 %/40 %, pas 45 %/55 %) |

---

## Synthèse — ce qui doit être tranché avant toute approbation de prix (§4)

1. **Unifier ou séparer** les deux moteurs de coût/marge (`margin.server.ts` actif vs `pricing-engine.ts`
   dormant) — recommandation déjà documentée (`proposition-calibration-couts-v1.md`) : **Option B, séparer
   explicitement**, moindre risque de régression sur le moteur historique.
2. **Trancher la valeur horaire enseignante réelle** à charger dans la politique candidat-individuel — écart
   du simple au double entre le taux actif (100 TND/h blended) et l'hypothèse "certifié" (50 TND/h), avec un
   impact direct et déjà démontré (§4) sur le verdict PASS/BLOCK de `MOD_*` et `SVC_SECOND_GROUPE`.
3. **Confirmer 45 %/55 %** (déjà codés, jamais raccordés) comme seuils candidat-individuel, distincts du
   30 %/40 % legacy — décision commerciale explicite requise, pas un oubli à corriger silencieusement.
4. **Statuer sur le statut "tuteur"** (référentiel RH non documenté) avant d'approuver les 3 modules ARIA,
   qui en dépendent entièrement.
5. **Décider si `resolveGroupModality` et la Table A "comportement sous effectif minimal" sont câblés** avant
   toute activation commerciale de `MOD_*` à effectif variable — sans ce câblage, un groupe à 1 élève reste
   aujourd'hui facturable au tarif plein sans aucune protection de marge.

**Aucune de ces cinq décisions n'est prise par ce document.** Chacune reste `À_APPROUVER`.
