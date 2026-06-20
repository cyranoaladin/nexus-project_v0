# Registre Canonique — Nexus Reussite

**Source unique :** `data/pricing.canonical.json` (v2026-2027.1)
**Audite :** 2026-06-20 | **Statut :** Phase A — en attente decisions Shark (#1-#5)

---

## 1. Formules annuelles scolarises (`offers[]`)

| Cle JSON | Titre | Niveau | Prix campagne | Public | Mensuel | Acompte | x9 |
|----------|-------|--------|---------------|--------|---------|---------|-----|
| `term-spe-simple` | Terminale Spe simple | Terminale | 3 900 | 3 900 | 390 | 1 170 | 300+330 |
| `term-duo` | Terminale Duo | Terminale | 7 175 | **8 750** | 720 | 2 150 | 560+545 |
| `term-excellence` | Terminale Excellence | Terminale | 9 594 | **10 700** | 960 | 2 880 | 750+714 |
| `1re-eaf` | 1re EAF | Premiere | 3 000 | 3 000 | 300 | 900 | 233+236 |
| `1re-maths-antic` | 1re Maths Anticipation | Premiere | 3 000 | 3 000 | 300 | 900 | 233+236 |
| `1re-double-secu` | 1re Double Securite | Premiere | 5 400 | 5 400 | 540 | 1 620 | 420 |
| `1re-sciences` | 1re Sciences | Premiere | 5 900 | 5 900 | 590 | 1 770 | 460+450 |
| `2nde-maths` | 2nde Maths | Seconde | 2 700 | 2 700 | 270 | 810 | 210 |
| `2nde-sciences` | 2nde Sciences | Seconde | 5 400 | 5 400 | 540 | 1 620 | 420 |
| `2nde-coaching` | 2nde Coaching | Seconde | 450 | 450 | - | - | - |
| `brevet-maths` | Brevet Maths | College | 2 400 | 2 400 | 240 | 720 | 186+192 |
| `brevet-complet` | Brevet Complet | College | 4 800 | 4 800 | 480 | 1 440 | 373+376 |

> **EN ATTENTE #1 :** 3 offres ont `price_annual_public != price_annual_campaign` (gras ci-dessus). Residu du prix barre supprime. Aligner `public` sur `campaign` ou conserver en donnee interne ?

## 2. Candidats libres (`offers[]`, track=libre)

| Cle JSON | Titre | Prix campagne | Public | Mensuel | Acompte |
|----------|-------|---------------|--------|---------|---------|
| `1re-libre-essentiel` | Essentiel | 1 900 | 1 900 | 190 | 570 |
| `1re-libre-accomp` | Accompagnee | 4 900 | 4 900 | 490 | 1 470 |
| `1re-libre-intensif` | Intensif | **null** | **null** | - | - |
| `term-libre-online` | Online | 2 900 | 2 900 | 290 | 870 |
| `term-libre-mixte` | Mixte | 7 900 | **8 750** | 790 | 2 370 |
| `term-libre-premium` | Premium | 9 900 | 9 900 | 990 | 2 970 |

> **EN ATTENTE #3 :** `1re-libre-intensif` a tous les prix a null (skeleton). Non rendu (getEffectivePrice retourne null). Supprimer ou completer ?

## 3. Plateforme ARIA (`offers[]`, track=plateforme)

| Cle JSON | Titre | Prix/an | Mensuel | Note |
|----------|-------|---------|---------|------|
| `plateforme-autonomie` | Autonomie | 590 | 69 | /8.5 mois |
| `plateforme-suivi` | Suivi | 1 490 | 160 | /8.5 mois |
| `plateforme-accomp` | Accompagnee | 2 900 | 290 | /10 mois |

## 4. Stages (`stage_formats[]`)

| Cle JSON | Titre | Heures | Prix | Acompte | Solde | Prix/h |
|----------|-------|--------|------|---------|-------|--------|
| `intensif-express` | Express | 10 | 490 | 150 | 340 | 49 |
| `intensif-solo` | Solo | 12 | 580 | 170 | 410 | 48 |
| `intensif-renfort` | Renfort | 15 | 720 | 220 | 500 | 48 |
| `intensif-duo` | Duo | 18 | 850 | 260 | 590 | 47 |
| `intensif-duo-plus` | Duo+ | 20 | 950 | 290 | 660 | 48 |
| `sprint-final` | Sprint Final | 20 | 950 | 290 | 660 | 48 |
| `sprint-final-max` | Sprint Final Max | 30 | 1 450 | 440 | 1 010 | 48 |
| `express-vacances` | Express Vacances | 9 | 420 | 126 | 294 | 47 |

## 5. Ponctuels (`ponctuel_offers[]`)

| Cle JSON | Titre | Public | Heures | Prix | Acompte | Solde |
|----------|-------|--------|--------|------|---------|-------|
| `cap-eaf` | Cap EAF | Premiere | 15 | 720 | 220 | 500 |
| `cap-maths-1re` | Cap Maths Premiere | Premiere | 12 | 580 | 170 | 410 |
| `studio-grand-oral` | Studio Grand Oral | Terminale | 10 | 490 | 150 | 340 |
| `epreuve-blanche` | Epreuve Blanche | Tous | - | 150 | 150 | 0 |

## 6. Coaching (`coaching[]`)

| Cle JSON | Titre | Prix | Format |
|----------|-------|------|--------|
| `diagnostic` | Diagnostic Strategique | 100 | Individuel (gratuit en campagne) |
| `boussole-methode` | Boussole Methode | 390 | 3 seances groupe |
| `boussole-orientation` | Boussole Orientation | 540 | 3 RDV mixte |
| `boussole-individuel` | Boussole Individuel | 190/h | 1:1 a la seance |
| `boussole-individuel-pack3` | Pack 3 seances | 540 | 3x 1:1 |
| `boussole-individuel-pack5` | Pack 5 seances | 900 | 5x 1:1 |

## 7. Packs (`packs[]`)

| Cle JSON | Titre | Valeur | Prix pack | Acompte | Note |
|----------|-------|--------|-----------|---------|------|
| `pass-intensifs-1re` | Pass Intensifs 1re | 2 320 | 1 990 | 250 | EN ATTENTE #2 |
| `pass-intensifs-term` | Pass Intensifs Term | 2 880 | 2 490 | 290 | EN ATTENTE #2 |
| `pass-cap-bac-1re` | Cap Bac 1re | 1 600 | 1 390 | 200 | EN ATTENTE #2 |
| `pass-go-sprint` | Grand Oral & Sprint | 1 440 | 1 290 | 200 | EN ATTENTE #2 |
| `pass-excellence-ponctuel` | Excellence Ponctuel | 2 880 | 2 390 | 290 | EN ATTENTE #2 |
| `pass-candidat-libre` | Candidat Libre | 1 990 | 1 690 | 290 | EN ATTENTE #2 |

> **EN ATTENTE #2 :** Chaque pack a `value` (somme composants) et `discount_pct` (economie pack). Affichage client (forme de prix barre) ou suivi interne uniquement ?

## 8. Carte Nexus (`carte_nexus`)

| Champ | Valeur |
|-------|--------|
| Prix annuel | 290 TND |
| Inclus | ARIA Autonomie, Remise -10% stages/coaching (hors Pass), Reservation prioritaire, 1 Diagnostic offert |
| Reduction | 10% sur stages, ponctuels, coaching |
| Non cumulable | oui |

> **EN ATTENTE #5 :** "Remise -10%" est un avantage produit de la carte, pas un prix barre. Garder ?

## 9. Urgence (`urgence`)

| Service | Prix |
|---------|------|
| Heure urgence membre | 150 TND/h |
| Heure urgence non-membre | 200 TND/h |
| Pack 5h membre | 650 TND |
| Pack 10h membre | 1 200 TND |

## 10. Calendrier stages 2026-2027 (`stage_calendar[]`)

| ID | Periode | Debut | Fin | Formats |
|----|---------|-------|-----|---------|
| `pre-rentree-2026` | Pre-rentree | 2026-08-24 | 2026-08-30 | Express, Solo, Renfort |
| `toussaint-2026` | Toussaint | 2026-10-19 | 2026-11-01 | Solo, Renfort, Duo |
| `noel-2026` | Noel | 2026-12-21 | 2027-01-03 | Solo, Renfort |
| `fevrier-2027` | Fevrier | 2027-02-15 | 2027-02-28 | Solo, Renfort, Duo |
| `printemps-prepa-bac-2027` | Printemps/Bac | 2027-04-26 | 2027-05-09 | Sprint Final, Sprint Max |

## 11. Regles tarifaires (`rules`)

- Groupes : **5 max** (garanti des 3 lycee, 4 college)
- Acompte : **30%** (non remboursable sauf groupe non ouvert)
- Echeancier : **9 mensualites** par defaut
- Monnaie : **TND**
- Remises : comptant 5%, fratrie 10%, ancien 10-18%, parrainage 150-300 TND, Carte 10%
- Plafond global remises : **20%** (non cumulables sauf exception direction)

## 12. Reperes tarifaires (`reperes_tarifaires`)

| Cle | Valeur affichee | Verifie |
|-----|-----------------|---------|
| `brevetMois` | "a partir de 240 TND / mois" | OK (brevet-maths: 240) |
| `secondeMois` | "a partir de 270 TND / mois" | OK (2nde-maths: 270) |
| `premiereMois` | "a partir de 300 TND / mois" | OK (1re-eaf: 300) |
| `terminaleSimpleMois` | "a partir de 390 TND / mois" | OK (term-spe: 390) |
| `terminaleDuoMois` | "~ 720 TND / mois (tarif campagne)" | OK (term-duo: 720) |
| `plateformeAn` | "a partir de 590 TND / an" | OK (plateforme-autonomie: 590) |
| `stagesBase` | "des 420 TND" | OK (express-vacances: 420) -- CORRIGE de 350 |
| `parrainage` | "150 a 300 TND" | OK (rules.discounts) |

---

## Decisions EN ATTENTE (Shark)

| # | Sujet | Champs concernes | Statut |
|---|-------|------------------|--------|
| 1 | Prix public != prix campagne (3 offres) | `price_annual_public` sur term-duo/excellence/libre-mixte | EN ATTENTE |
| 2 | Packs `discount_pct` + `value` (6 packs) | `discount_pct`, `value` sur chaque pack | EN ATTENTE |
| 3 | Offre skeleton `1re-libre-intensif` | Tous les champs prix = null | EN ATTENTE |
| 4 | ~~stagesBase "350 TND"~~ | ~~Corrige a 420 TND~~ | **FAIT** |
| 5 | Carte Nexus "Remise -10%" | `carte_nexus.includes[1]`, `discount_pct` | EN ATTENTE |
