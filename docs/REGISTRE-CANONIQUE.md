# Registre Canonique — Nexus Reussite

**Source unique :** `data/pricing.canonical.json` (v2026-2027.1)
**Audite :** 2026-06-20 | **Statut :** Phase A valide

## Prix de reference (formules annuelles)

| ID | Titre | Niveau | Prix campagne (TND) | Mensuel | Acompte | Echeances |
|----|-------|--------|---------------------|---------|---------|-----------|
| term-spe-simple | Terminale Specialite simple | Terminale | 3 900 | 390 | 1 170 | 9 |
| term-duo | Terminale Duo | Terminale | 7 175 | 720 | 2 150 | 9 |
| term-excellence | Terminale Excellence | Terminale | 9 594 | 960 | 2 880 | 9 |
| 1re-eaf | 1re EAF | Premiere | 3 000 | 300 | 900 | 9 |
| 1re-maths-antic | 1re Maths Anticipation | Premiere | 3 000 | 300 | 900 | 9 |
| 1re-double-secu | 1re Double Securite | Premiere | 5 400 | 540 | 1 620 | 9 |
| 1re-sciences | 1re Sciences | Premiere | 5 900 | 590 | 1 770 | 9 |
| 2nde-maths | 2nde Maths | Seconde | 2 700 | 270 | 810 | 9 |
| 2nde-sciences | 2nde Sciences | Seconde | 5 400 | 540 | 1 620 | 9 |
| brevet-maths | Brevet Maths | College | 2 400 | 240 | 720 | 9 |
| brevet-complet | Brevet Complet | College | 4 800 | 480 | 1 440 | 9 |

## Candidats libres

| ID | Titre | Prix (TND) | Mensuel |
|----|-------|-----------|---------|
| 1re-libre-essentiel | Essentiel | 1 900 | 190 |
| 1re-libre-accomp | Accompagnee | 4 900 | 490 |
| term-libre-online | Online | 2 900 | 290 |
| term-libre-mixte | Mixte | 7 900 | 790 |
| term-libre-premium | Premium | 9 900 | 990 |

## Plateforme ARIA

| ID | Titre | Prix (TND) | Mensuel |
|----|-------|-----------|---------|
| plateforme-autonomie | Autonomie | 590 | 69 |
| plateforme-suivi | Suivi | 1 490 | 160 |
| plateforme-accomp | Accompagnee | 2 900 | 290 |

## Stages

| Format | Heures | Prix (TND) | Acompte | Solde |
|--------|--------|-----------|---------|-------|
| Express (8h) | 8 | 490 | 150 | 340 |
| Solo (12h) | 12 | 580 | 170 | 410 |
| Renfort (16h) | 16 | 720 | 220 | 500 |
| Duo (20h) | 20 | 850 | 260 | 590 |
| Duo+ (20h) | 20 | 950 | 290 | 660 |
| Sprint Final (20h) | 20 | 950 | 290 | 660 |
| Sprint Final Max (30h) | 30 | 1 450 | 440 | 1 010 |
| Express Vacances (8h) | 8 | 420 | 126 | 294 |

## Calendrier stages 2026-2027

| Periode | Debut | Fin |
|---------|-------|-----|
| Pre-rentree | 2026-08-24 | 2026-08-30 |
| Toussaint | 2026-10-19 | 2026-11-01 |
| Noel | 2026-12-21 | 2027-01-03 |
| Fevrier | 2027-02-15 | 2027-02-28 |
| Printemps/Bac | 2027-04-26 | 2027-05-09 |

## Regles tarifaires

- **Groupes :** 5 max (garanti des 3 inscrits lycee, 4 college)
- **Acompte :** 30% (non remboursable sauf groupe non ouvert)
- **Echeancier :** 9 mensualites par defaut
- **Monnaie :** TND

## Points a trancher (Shark)

1. **3 offres avec prix public != prix campagne** (term-duo 8750/7175, term-excellence 10700/9594, term-libre-mixte 8750/7900) : le champ `price_annual_public` est un residu du prix barre supprime. Aligner sur `price_annual_campaign` ou garder en donnee interne ?
2. **6 packs avec `discount_pct` + `value`** : affichage client ou suivi interne ?
3. **`1re-libre-intensif`** : offre skeleton (prix null) — supprimer ou completer ?
4. **`stagesBase: "des 350 TND"`** vs minimum reel 420 TND — corriger a 420 ?
5. **`Remise -10% sur stages unitaires`** (Carte Nexus) : garder comme avantage produit ?
