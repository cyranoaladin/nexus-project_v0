# Dossier d'arbitrage chiffré — Phase B (moteur tarifaire, candidat individuel)

**STATUS = SIMULATION NON CONTRACTUELLE.** Aucun chiffre de ce document n'est actif dans le moteur —
`lib/quotes/pricing-engine.ts` ne consomme jamais automatiquement les hypothèses ci-dessous
(`PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES`, exportée mais jamais appelée par aucune fonction de
tarification réelle). Ce dossier sert à la décision de direction avant activation.

Hypothèses fournies par la mission (brief initial), reprises telles quelles :

```text
coût enseignant agrégé   : 70 TND/h
coût enseignant certifié : 50 TND/h
coût tuteur               : 35 TND/h
coût de structure         : 15 TND / heure de séance
coût fixe de dossier      : 120 TND
marge bloquante           : < 45 %
marge cible                : >= 55 %
plancher                   : 40 TND/h/élève (lorsqu'applicable)
remises maximales          : 20 %
```

Les nombres ci-dessous sont calculés par `computeMargin`/`checkFloor` (lib/quotes/pricing-engine.ts) —
mêmes fonctions que celles qui gateraient un vrai devis une fois ces hypothèses validées. Aucun calcul
manuel séparé, aucune divergence possible entre ce dossier et le moteur.

---

## Analyse de sensibilité — modules `petit_groupe` à 4h/mois (LVA, LVB, spécialité abandonnée)

Tarif existant (réel, `candidat_individuel_modules.petit_groupe[4h]`) : **250 TND/élève/mois**. Coût de
structure : 15 TND/h × 4h = 60 TND/mois. Coût enseignant : taux × 4h.

| Effectif | Enseignant | Revenu/mois | Coût/mois | Marge | Bloquée (<45%) | Signalée (<55%) | Plancher (45 TND/h/élève) |
|---:|---|---:|---:|---:|:---:|:---:|:---:|
| 1 | Agrégé | 250 | 340 | −36,0 % | ✅ oui | — | ✅ ok |
| 1 | Certifié | 250 | 260 | −4,0 % | ✅ oui | — | ✅ ok |
| 1 | Tuteur | 250 | 200 | 20,0 % | ✅ oui | — | ✅ ok |
| 2 | Agrégé | 500 | 340 | 32,0 % | ✅ oui | — | ✅ ok |
| 2 | Certifié | 500 | 260 | 48,0 % | non | ✅ oui | ✅ ok |
| 2 | Tuteur | 500 | 200 | 60,0 % | non | non | ✅ ok |
| 3 | Agrégé | 750 | 340 | 54,7 % | non | ✅ oui | ✅ ok |
| 3 | Certifié | 750 | 260 | 65,3 % | non | non | ✅ ok |
| 3 | Tuteur | 750 | 200 | 73,3 % | non | non | ✅ ok |
| 4 | Agrégé | 1000 | 340 | 66,0 % | non | non | ✅ ok |
| 5 | Agrégé | 1250 | 340 | 72,8 % | non | non | ✅ ok |
| 6 | Agrégé | 1500 | 340 | 77,3 % | non | non | ✅ ok |

**Lecture** : à 1 élève, seul un tuteur reste au-dessus du seuil bloquant (20 %, toujours sous la cible
55 %) — un agrégé ou certifié en solo à ce tarif est structurellement déficitaire. Le seuil de rentabilité
cible (55 %) n'est atteint qu'à partir de 3 élèves avec un enseignant agrégé, ou 2 élèves avec un
certifié/tuteur. **Ceci argumente pour une bascule DUO/SOLO à un tarif différent du tarif groupe** (déjà
modélisé structurellement par `resolveGroupModality`, `DUO_HOUR`/`INDIVIDUEL_HOUR_MIN`) plutôt que
d'ouvrir un groupe à effectif insuffisant au tarif groupe.

**Cohérence avec les 6 offres** : ce tarif 4h/mois est le même que celui déjà vendu dans Cap Anticipées
(Mathématiques anticipées) — aucune incohérence tarifaire introduite.

**Impact sur le prix annuel** : un module LVA ou LVB à 250 TND/mois × 10 mois = 2500 TND/an ajouté à un
parcours, si vendu en complément d'un pack existant (à die de la décision D5 anti-doublon : seulement si
ce module n'est pas déjà couvert par le pack choisi).

**Recommandation** : valider le tarif 4h/mois = 250 TND (identique à l'existant, aucune incohérence),
mais exiger une politique DUO/SOLO explicite à effectif < 3 avant toute ouverture, plutôt que de vendre au
tarif groupe standard à perte.

---

## Modules en autonomie guidée ARIA (HG, Enseignement scientifique, EMC)

Pas de tarif `petit_groupe` applicable (format non synchrone par défaut, D1). Coût dominé par la
supervision humaine ponctuelle (hypothèse recommandée §Fiche 1 : 0,5h/mois de suivi humain) plutôt que par
un enseignant dédié à temps plein sur la matière. Avec un coût de structure (plateforme ARIA) déjà amorti
par ailleurs (Pilotage inclut déjà `ARIA_ACCESS`), le coût marginal d'un module HG/ES/EMC autonomie guidée
supplémentaire est essentiellement le suivi humain :

```text
0,5 h/mois × coût tuteur (35 TND/h) = 17,5 TND/mois de coût marginal estimé
```

**Aucun prix résultant n'est proposé ici** — contrairement aux modules `petit_groupe`, il n'existe aucun
tarif de référence dans `candidat_individuel_modules` pour ce format (`autonomie_guidee_aria` n'a pas de
tier de prix dans la table existante). Une décision de direction est nécessaire avant tout chiffrage,
faute de quoi un prix serait inventé sans base — refusé par principe (fail-closed, cf. mission §8).

**Recommandation** : ajouter un tier de tarif `autonomie_guidee_aria` à `candidat_individuel_modules`
(décision de direction + migration de données, hors périmètre de ce lot) avant d'activer ces 3 modules.

---

## Options (Maths expertes, Maths complémentaires, DGEMC, LCA)

**Aucune simulation chiffrée possible** — le coefficient réglementaire de ces options n'est toujours pas
sourcé (`OPTION_COEFFICIENT_NON_SOURCE`, Lot 1/4), et sans coefficient confirmé, tout volume horaire serait
une pure supposition, tout comme tout prix qui en dériverait. Chiffrer ces 4 modules avant que la question
réglementaire (hors `lib/quotes/`, retour à `lib/exams/`) soit tranchée serait une double invention.

---

## Descriptif EAF

Non chiffré séparément — la fiche d'arbitrage (`lot5-fiches-arbitrage-volumes.md` Fiche 4) recommande de
ne PAS créer de ligne facturable distincte tant que le volume EAF combiné (8h/mois écrit+oral) n'est pas
démontré insuffisant. Chiffrer une ligne séparée maintenant serait une sur-ingénierie tarifaire sans
demande commerciale démontrée.

---

## Services non pédagogiques (Bacs blancs, Tutorat de compression, Second groupe)

- **Bacs blancs** : aucun volume/fréquence défini — pas de base de chiffrage.
- **Tutorat de compression** : concept jamais défini dans le dépôt (cf. fiches d'arbitrage) — brief produit
  nécessaire avant tout chiffrage.
- **Second groupe (P11)** : chiffrage différé au lot moteur tarifaire par décision explicite (mission Lot 5
  §6/Décision 3) — non traité ici, traité structurellement par `computeSecondGroupePayment` (paiement
  intégral, pas d'acompte/mensualité) sans montant fixé.

---

## Synthèse — ce qui peut être activé, ce qui ne peut pas

| Élément | Chiffrable dès maintenant | Bloquant avant activation |
|---|:---:|---|
| MOD_LVA, MOD_LVB, MOD_SPECIALITE_ABANDONNEE | ✅ (tarif 4h/mois existant réutilisable) | Politique DUO/SOLO à effectif <3, décision du taux enseignant (agrégé/certifié/tuteur) |
| MOD_HG_ARIA, MOD_ES_ARIA, MOD_EMC_ARIA | ❌ | Aucun tier de prix `autonomie_guidee_aria` dans la table existante — décision + migration requises |
| MOD_MATHS_EXPERTES/COMPLEMENTAIRES/DGEMC/LCA | ❌ | Coefficient réglementaire non sourcé (lib/exams/) |
| MOD_EAF_DESCRIPTIF | ❌ | Aucune demande commerciale démontrée pour une ligne séparée |
| SVC_BACS_BLANCS | ❌ | Aucun volume/fréquence défini |
| SVC_TUTORAT_COMPRESSION | ❌ | Concept non défini |
| SVC_SECOND_GROUPE | ❌ (différé) | Échéancier structurel en place, montant différé par décision explicite |
