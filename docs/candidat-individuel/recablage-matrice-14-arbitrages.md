# Matrice des 14 arbitrages — recâblage mission §8

Table de décision complète pour les 11 modules pédagogiques + 3 services `DIRECTION_A_VALIDER`. Les
chiffres de coût/marge sont calculés via `computeMargin`/`checkFloor` (lib/quotes/pricing-engine.ts) —
mêmes fonctions que celles qui gateraient un vrai devis, jamais un calcul séparé qui pourrait diverger.
Hypothèses internes du brief clairement étiquetées `[hypothèse brief]`, jamais confondues avec une donnée
sourcée.

## Modules pédagogiques (11)

### MOD_LVA / MOD_LVB — Langue vivante A/B (petit groupe live)

| Contenu | Format | Volume proposé | Coût `[hypothèse brief]` | Prix proposé | Marge selon effectif | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| Préparation écrite + orale | petit_groupe | Minimale : 2h/mois · Recommandée : 4h/mois · Renforcée : 8h/mois | 4h/mois : agrégé 340, certifié 260, tuteur 200 TND/mois (structure incluse) | Prix canonique existant réutilisé : 250 TND/élève/mois (tier 4h) — aucun nouveau prix inventé | eff.1 : −36 % (agrégé) à +20 % (tuteur) — bloquant · eff.2 : +32 à +60 % · eff.3+ : ≥55 % (cible atteinte) | Cohérent avec Cap Anticipées (même tier 4h/mois) | Valider le tarif 4h existant ; exiger une politique DUO/SOLO explicite (§10) sous effectif 3 plutôt que d'ouvrir à perte |

### MOD_SPECIALITE_ABANDONNEE — Spécialité de première non poursuivie

| Contenu | Format | Volume proposé | Coût | Prix proposé | Marge selon effectif | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| Remise à niveau ciblée, mono-discipline uniquement (D1 — aucune mutualisation transdisciplinaire) | petit_groupe | Minimale : 2h/mois · Recommandée : 4h/mois · Renforcée : 8h/mois | Identique à LVA/LVB (même tier) | 250 TND/élève/mois (tier 4h existant) | Identique à LVA/LVB | Concept absent des 6 offres — le plus proche est "selon besoin" (Intégrale) | Même tarif que LVA/LVB ; risque commercial spécifique : discipline rare → seuil `group_min_open` difficile à atteindre, arbitrer DUO/SOLO systématique |

### MOD_HG_ARIA / MOD_ES_ARIA / MOD_EMC_ARIA — Autonomie guidée ARIA

| Contenu | Format | Volume proposé | Coût `[hypothèse brief]` | Prix proposé | Marge selon effectif | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| Parcours structuré (ressources, jalons, exercices, bacs blancs, suivi humain ponctuel) — jamais un cours en groupe (D1) | autonomie_guidee_aria | Minimale : 0h synchrone + 2h autonomie/mois · Recommandée : 0,5h synchrone + 3h autonomie/mois · Renforcée : 1h synchrone + 4h autonomie/mois | Suivi ponctuel seul chiffrable : 0,5h × tuteur 35 TND/h ≈ 17,5 TND/mois de coût marginal | **Non chiffrable** — aucun tier de tarif `autonomie_guidee_aria` n'existe dans `candidat_individuel_modules` | Non calculable sans prix de référence | Intégrale cite "selon besoin" sans détail | **Bloquant** : ajouter un tier de tarif `autonomie_guidee_aria` à la table canonique (décision de direction + migration additive) avant tout chiffrage définitif |

### MOD_EAF_DESCRIPTIF — Accompagnement du descriptif EAF

| Contenu | Format | Volume proposé | Coût | Prix proposé | Marge selon effectif | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| Aide à la constitution du descriptif des textes/œuvres | individuel_presentiel | Minimale : 1 séance (1h) · Recommandée : 2 séances (2h) · Renforcée : 3 séances (3h) | Non chiffré séparément — actuellement absorbé dans MOD_EAF_ECRIT_ORAL (8h/mois combiné) | Aucun — pas de ligne séparée proposée | N/A | Implicite dans Cap Anticipées ("Français / EAF : 8 h/mois écrit et oral") | Ne pas créer de ligne séparée tant que le volume EAF combiné n'est pas démontré insuffisant — sur-ingénierie sinon |

### MOD_MATHS_EXPERTES / MOD_MATHS_COMPLEMENTAIRES / MOD_DGEMC / MOD_LCA — Options

| Contenu | Format | Volume proposé | Coût | Prix proposé | Marge selon effectif | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| Préparation spécifique à l'option | petit_groupe (proposé, effectif probablement faible) | **Non proposable** | **Non chiffrable** | **Non chiffrable** | N/A | Aucune option ne figure dans les 6 offres actuelles | **Bloquant réglementaire, pas seulement commercial** : le coefficient de ces options n'est sourcé nulle part (`OPTION_COEFFICIENT_NON_SOURCE`, Lot 1/4) — chiffrer un volume avant la recherche réglementaire serait une double invention, refusé par principe |

## Services (3)

### SVC_BACS_BLANCS

| Contenu | Format | Volume proposé | Coût | Prix proposé | Marge | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| Bacs blancs | Non défini | **Aucun** — ni fréquence ni volume connus | Non chiffrable | Non chiffrable | N/A | Absent des `included[]` des 6 offres réels (contrairement au brief initial) | Décision de direction requise : le créer comme ligne visible (et à quelle fréquence) ou le laisser implicite dans le Pilotage |

### SVC_TUTORAT_COMPRESSION

| Contenu | Format | Volume proposé | Coût | Prix proposé | Marge | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| **Concept jamais défini dans le dépôt** | Inconnu | Inconnu | Non chiffrable | Non chiffrable | N/A | Aucun | Brief produit nécessaire avant toute fiche d'arbitrage utile — rien à proposer sans définition du besoin |

### SVC_SECOND_GROUPE (P11)

| Contenu | Format | Volume proposé | Coût | Prix proposé | Marge | Impact offres | Recommandation |
|---|---|---:|---:|---:|---|---|---|
| 2 disciplines, rattrapage | synchrone, fenêtre contrainte | Court, aligné sur la fenêtre de rattrapage — non chiffré | Variable selon disciplines | **Différé** (Décision 3, mission recâblage §6) | Dépend du prix | Aucune (produit autonome, hors packs annuels) | Paiement structurellement implémenté (100 % à la réservation, `computeSecondGroupePayment`) ; montant/échéancier restent `DIRECTION_A_VALIDER` par décision explicite — ne pas inventer |

## Synthèse

| Statut | Éléments |
|---|---|
| **Chiffrables dès maintenant** (tarif existant réutilisable) | MOD_LVA, MOD_LVB, MOD_SPECIALITE_ABANDONNEE (3) |
| **Bloqués par absence de tier de tarif** (décision + migration requises) | MOD_HG_ARIA, MOD_ES_ARIA, MOD_EMC_ARIA (3) |
| **Bloqués par absence de coefficient réglementaire** (retour à `lib/exams/`) | MOD_MATHS_EXPERTES, MOD_MATHS_COMPLEMENTAIRES, MOD_DGEMC, MOD_LCA (4) |
| **Non recommandé de chiffrer** (pas de demande démontrée) | MOD_EAF_DESCRIPTIF (1) |
| **Bloqués par absence totale de définition produit** | SVC_BACS_BLANCS, SVC_TUTORAT_COMPRESSION (2) |
| **Structurellement implémenté, montant différé par décision explicite** | SVC_SECOND_GROUPE (1) |

**Total : 11 + 3 = 14.** 3 chiffrables immédiatement (tarif déjà existant), 11 bloqués pour des raisons
explicites et distinctes (aucune n'est un simple "non chiffrable" sans justification).
