# Audit commercial — Pré-rentrée 2026

> Date : 2026-07-12
> Branche : `feat/pre-rentree-2026-landing`

## Contexte

L'ancien calendrier de stages référençait une entrée `pre-rentree-2026` utilisant le format
`intensif-renfort` (15 h, 720 TND, 1 semaine du 24 au 28 août). Ce format est incompatible
avec le produit définitif approuvé.

## Produit Pré-rentrée 2026 définitif

| Caractéristique | Ancien format | Nouveau produit |
|-----------------|---------------|-----------------|
| Durée | 1 semaine | 2 semaines (17-28 août) |
| Volume | 15 h total | 10 h par matière (10-40 h total) |
| Structure | 1 matière, format unique | 1-4 matières, packs dégressifs |
| Prix | 720 TND | 480-1800 TND selon pack |
| Prix/heure | 48 TND | 45-48 TND |

## Packs tarifaires

| Pack | Matières | Heures | Prix | Acompte (30%) | Solde | Prix/h |
|------|----------|--------|------|---------------|-------|--------|
| pre2026-pack-1 | 1 | 10 | 480 TND | 140 TND | 340 TND | 48 |
| pre2026-pack-2 | 2 | 20 | 900 TND | 270 TND | 630 TND | 45 |
| pre2026-pack-3 | 3 | 30 | 1 350 TND | 410 TND | 940 TND | 45 |
| pre2026-pack-4 | 4 | 40 | 1 800 TND | 540 TND | 1 260 TND | 45 |

## Contraintes commerciales

- Plancher de prix : 45 TND/h (respecté pour tous les packs)
- Exclusion des remises automatiques (Carte Nexus, fratrie, ancien élève, parrainage)
- Tarifs non cumulables
- Seuil d'ouverture : 3 élèves minimum
- Capacité maximale : 5 élèves par cohorte
- Décision d'ouverture : 10 août 2026 à 18:00

## Risques de cannibalisation

- Les packs 1-2 matières (480-900 TND) sont comparables au `intensif-solo` (580 TND/12h) et
  `intensif-duo` (850 TND/18h) mais offrent un rapport heures/matière différent (2h×5j vs 3h variable)
- La tarification à 45 TND/h au plancher pour les packs 2-4 maintient la cohérence mais réduit
  la marge relative aux stages intensifs classiques (47-48 TND/h)
- Positionnement distinct : préparation de rentrée (fondamentaux + méthode) vs rattrapage/renforcement

## Coûts — OWNER_INPUT_REQUIRED

Les éléments suivants restent à renseigner par le responsable :
- Coût horaire enseignant
- Coût de préparation pédagogique
- Coût salle (Mutuelleville)
- Coût matériel et supports
- Coût administratif (inscription, suivi, bilan)
- Commissions éventuelles
- CAC (coût d'acquisition client)
- Marge cible

## Publication

- Mode autorisé : PRE_REGISTRATION_OPEN (pré-inscription sans paiement)
- Paiement en ligne : FERMÉ (gate GATE-PAY-002)
- Confirmation automatique : FERMÉE
- Affichage disponibilité temps réel : INTERDIT
