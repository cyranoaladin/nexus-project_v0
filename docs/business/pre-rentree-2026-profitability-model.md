# Modele de rentabilite — Stages de pre-rentree 2026

> Version : 1.0.0
> Statut : DRAFT
> Derniere mise a jour : 2026-07-12

---

## 1. Revenus par pack et par taille de groupe

### Pack 1 — 1 matiere (10 h, 480 TND/eleve)

| Eleves | CA total | Heures enseignant | CA / h enseignant |
|--------|----------|-------------------|-------------------|
| 3 | 1 440 TND | 10 h | 144 TND/h |
| 4 | 1 920 TND | 10 h | 192 TND/h |
| 5 | 2 400 TND | 10 h | 240 TND/h |

### Pack 2 — 2 matieres (20 h, 900 TND/eleve)

| Eleves | CA total | Heures enseignant | CA / h enseignant |
|--------|----------|-------------------|-------------------|
| 3 | 2 700 TND | 20 h | 135 TND/h |
| 4 | 3 600 TND | 20 h | 180 TND/h |
| 5 | 4 500 TND | 20 h | 225 TND/h |

### Pack 3 — 3 matieres (30 h, 1 350 TND/eleve)

| Eleves | CA total | Heures enseignant | CA / h enseignant |
|--------|----------|-------------------|-------------------|
| 3 | 4 050 TND | 30 h | 135 TND/h |
| 4 | 5 400 TND | 30 h | 180 TND/h |
| 5 | 6 750 TND | 30 h | 225 TND/h |

### Pack 4 — 4 matieres (40 h, 1 800 TND/eleve)

| Eleves | CA total | Heures enseignant | CA / h enseignant |
|--------|----------|-------------------|-------------------|
| 3 | 5 400 TND | 40 h | 135 TND/h |
| 4 | 7 200 TND | 40 h | 180 TND/h |
| 5 | 9 000 TND | 40 h | 225 TND/h |

---

## 2. Couts maximaux admissibles par marge cible

Formule : `Cout max = CA total x (1 - marge cible)`

### Pack 1 (10 h) — Cout max total

| Eleves | Marge 40 % | Marge 50 % | Marge 60 % |
|--------|-----------|-----------|-----------|
| 3 | 864 TND | 720 TND | 576 TND |
| 4 | 1 152 TND | 960 TND | 768 TND |
| 5 | 1 440 TND | 1 200 TND | 960 TND |

### Pack 2 (20 h) — Cout max total

| Eleves | Marge 40 % | Marge 50 % | Marge 60 % |
|--------|-----------|-----------|-----------|
| 3 | 1 620 TND | 1 350 TND | 1 080 TND |
| 4 | 2 160 TND | 1 800 TND | 1 440 TND |
| 5 | 2 700 TND | 2 250 TND | 1 800 TND |

### Pack 3 (30 h) — Cout max total

| Eleves | Marge 40 % | Marge 50 % | Marge 60 % |
|--------|-----------|-----------|-----------|
| 3 | 2 430 TND | 2 025 TND | 1 620 TND |
| 4 | 3 240 TND | 2 700 TND | 2 160 TND |
| 5 | 4 050 TND | 3 375 TND | 2 700 TND |

### Pack 4 (40 h) — Cout max total

| Eleves | Marge 40 % | Marge 50 % | Marge 60 % |
|--------|-----------|-----------|-----------|
| 3 | 3 240 TND | 2 700 TND | 2 160 TND |
| 4 | 4 320 TND | 3 600 TND | 2 880 TND |
| 5 | 5 400 TND | 4 500 TND | 3 600 TND |

---

## 3. Structure des couts — OWNER_INPUT_REQUIRED

Les postes suivants necessitent une saisie du proprietaire pour finaliser le modele :

| Poste de cout | Unite | Valeur | Statut |
|---------------|-------|--------|--------|
| Cout enseignant (par heure) | TND/h | `___` | OWNER_INPUT_REQUIRED |
| Cout de preparation (par heure de cours) | TND/h | `___` | OWNER_INPUT_REQUIRED |
| Cout salle (par jour) | TND/jour | `___` | OWNER_INPUT_REQUIRED |
| Cout materiel (par eleve) | TND/eleve | `___` | OWNER_INPUT_REQUIRED |
| Cout administratif (forfait campagne) | TND | `___` | OWNER_INPUT_REQUIRED |
| Commissions (paiement en ligne, si applicable) | % du CA | `___` | OWNER_INPUT_REQUIRED |
| Cout d'acquisition client (CAC) | TND/eleve | `___` | OWNER_INPUT_REQUIRED |
| Marge cible | % | `___` | OWNER_INPUT_REQUIRED |

---

## 4. Exemple de calcul (a completer)

Hypothese illustrative (valeurs fictives a remplacer) :

```
Cout enseignant          : 60 TND/h (hypothese)
Cout preparation         : 15 TND/h de cours (hypothese)
Cout salle               : 50 TND/jour (hypothese)
Cout materiel            : 10 TND/eleve (hypothese)
Cout admin               : 200 TND forfait (hypothese)
Commissions              : 0 % (paiement direct)
CAC                      : 30 TND/eleve (hypothese)

--- Scenario : Pack 2, 4 eleves ---

CA                       : 3 600 TND
Enseignant (20h x 60)   : 1 200 TND
Preparation (20h x 15)  :   300 TND
Salle (10 jours x 50)   :   500 TND
Materiel (4 x 10)       :    40 TND
Admin                    :   200 TND
CAC (4 x 30)            :   120 TND
---------------------------------
Total couts              : 2 360 TND
Marge brute              : 1 240 TND (34,4 %)
```

> **ATTENTION** : ces chiffres sont purement illustratifs. Le modele reel doit etre renseigne par le proprietaire.

---

## 5. Seuil de rentabilite

Le seuil de rentabilite par groupe depend directement du cout enseignant :

```
Seuil = Couts fixes du groupe / (Prix par eleve - Cout variable par eleve)
```

A 3 eleves (seuil minimal d'ouverture), la contrainte est :
```
Prix x 3 > Couts fixes + (Cout variable x 3)
```

Si cette inegalite n'est pas verifiee pour un pack donne, le prix ou le seuil d'ouverture doit etre revu.

---

## 6. Scenarios de CA global

Hypothese : 1 groupe par creneau (6 creneaux/semaine x 2 semaines = 12 groupes potentiels).

| Scenario | Remplissage moyen | CA global estime |
|----------|-------------------|------------------|
| Pessimiste | 3 eleves/groupe, 50 % groupes ouverts | Variable selon mix de packs |
| Realiste | 4 eleves/groupe, 75 % groupes ouverts | Variable selon mix de packs |
| Optimiste | 5 eleves/groupe, 100 % groupes ouverts | Variable selon mix de packs |

> Le CA global depend du mix de packs achetes. Un eleve achetant le pack 4 occupe 4 creneaux mais ne "consomme" qu'une seule place par groupe.

---

## 7. Prochaines etapes

1. Proprietaire renseigne les couts reels (section 3).
2. Calcul de la marge reelle par pack et par scenario.
3. Decision go/no-go sur la campagne.
4. Si go : fixer la marge cible et ajuster les prix si necessaire avant publication.
