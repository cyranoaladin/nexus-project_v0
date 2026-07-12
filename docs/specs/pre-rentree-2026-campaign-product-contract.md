# Contrat produit — Stages de pre-rentree 2026

> Version : 1.0.0
> Statut : DRAFT
> Derniere mise a jour : 2026-07-12

---

## 1. Periode et calendrier

| Champ | Valeur |
|-------|--------|
| Debut | Lundi 17 aout 2026 |
| Fin | Vendredi 28 aout 2026 |
| Jours sans cours | 22-23 aout 2026 (samedi-dimanche) |
| Fuseau horaire | Africa/Tunis (UTC+1) |
| Date limite de decision | 10 aout 2026 a 18:00 |

Duree effective : 10 jours ouvres (5 jours semaine 1 + 5 jours semaine 2).

---

## 2. Niveaux et matieres

### Niveaux

| ID | Label |
|----|-------|
| seconde | Seconde |
| premiere | Premiere |
| terminale | Terminale |

### Matieres

| ID | Label | Niveaux eligibles |
|----|-------|-------------------|
| maths | Mathematiques | Seconde, Premiere, Terminale |
| pc | Physique-Chimie | Seconde, Premiere, Terminale |
| nsi | NSI | Premiere, Terminale |
| francais | Francais | Seconde, Premiere (EAF), Terminale (Expression) |

Note : En Seconde, le creneau NSI correspond a Info/SNT.

---

## 3. Structure pedagogique

- 1 matiere = 5 seances x 2 h = **10 h**
- Choix possible : 1 a 4 matieres par eleve
- Groupe : **3 a 5 eleves** par cohorte
- Seuil d'ouverture : 3 eleves minimum
- Capacite maximale : 5 eleves par cohorte

---

## 4. Lieu

- **Mutuelleville, Tunis**
- Format : presentiel uniquement
- Salles :
  - Salle 1 : Mathematiques / NSI
  - Salle 2 : Francais / Physique-Chimie

Contrainte : le meme enseignant assure Maths et NSI, donc ces deux matieres ne peuvent pas etre simultanees.

---

## 5. Tarification

| Pack | Matieres | Heures | Prix TTC | Acompte (30%) | Solde |
|------|----------|--------|----------|---------------|-------|
| pre2026-pack-1 | 1 | 10 h | 480 TND | 140 TND | 340 TND |
| pre2026-pack-2 | 2 | 20 h | 900 TND | 270 TND | 630 TND |
| pre2026-pack-3 | 3 | 30 h | 1 350 TND | 410 TND | 940 TND |
| pre2026-pack-4 | 4 | 40 h | 1 800 TND | 540 TND | 1 260 TND |

Regle d'arrondi de l'acompte : 30 % du prix, arrondi au 10 TND superieur.

### Exclusions tarifaires

- Pas de reduction Carte Nexus applicable
- Pas de Pass applicable
- Pas de cumul de remises
- Pas de remise automatique

---

## 6. Emploi du temps complet

### Blocs horaires

| Bloc | Horaire |
|------|---------|
| A | 08:30 - 10:30 |
| B | 10:45 - 12:45 |
| C | 13:30 - 15:30 |
| D | 15:45 - 17:45 |

### Semaine 1 — 17 au 21 aout 2026

| Jour | Niveau | Matiere | Bloc | Salle |
|------|--------|---------|------|-------|
| Lun 17 - Ven 21 | Seconde | Mathematiques | A (08:30-10:30) | Salle 1 |
| Lun 17 - Ven 21 | Seconde | Francais | B (10:45-12:45) | Salle 2 |
| Lun 17 - Ven 21 | Premiere | Mathematiques | B (10:45-12:45) | Salle 1 |
| Lun 17 - Ven 21 | Premiere | Francais (EAF) | C (13:30-15:30) | Salle 2 |
| Lun 17 - Ven 21 | Terminale | Mathematiques | C (13:30-15:30) | Salle 1 |
| Lun 17 - Ven 21 | Terminale | Expression | D (15:45-17:45) | Salle 2 |

### Semaine 2 — 24 au 28 aout 2026

| Jour | Niveau | Matiere | Bloc | Salle |
|------|--------|---------|------|-------|
| Lun 24 - Ven 28 | Seconde | Info/SNT | A (08:30-10:30) | Salle 1 |
| Lun 24 - Ven 28 | Seconde | Physique-Chimie | B (10:45-12:45) | Salle 2 |
| Lun 24 - Ven 28 | Premiere | NSI | B (10:45-12:45) | Salle 1 |
| Lun 24 - Ven 28 | Premiere | Physique-Chimie | C (13:30-15:30) | Salle 2 |
| Lun 24 - Ven 28 | Terminale | NSI | C (13:30-15:30) | Salle 1 |
| Lun 24 - Ven 28 | Terminale | Physique-Chimie | D (15:45-17:45) | Salle 2 |

### Verification de coherence

- Salle 1 (Maths/NSI) : un seul creneau par bloc → pas de conflit enseignant.
- Salle 2 (Francais/PC) : un seul creneau par bloc → OK.
- Maths et NSI ne sont jamais sur le meme bloc → un seul enseignant peut assurer les deux.

---

## 7. Identifiants produit

| Product ID | Description |
|------------|-------------|
| `pre2026-pack-1` | Pre-rentree 2026 — 1 matiere (10 h) |
| `pre2026-pack-2` | Pre-rentree 2026 — 2 matieres (20 h) |
| `pre2026-pack-3` | Pre-rentree 2026 — 3 matieres (30 h) |
| `pre2026-pack-4` | Pre-rentree 2026 — 4 matieres (40 h) |

---

## 8. Regles metier

1. Un eleve ne peut s'inscrire qu'a des matieres compatibles avec son niveau.
2. L'inscription est confirmee apres validation admin + reception de l'acompte.
3. Une demande sans acompte ne reserve pas de place.
4. Le groupe s'ouvre a 3 eleves minimum ; en dessous, remboursement integral.
5. La date limite de decision (10 aout 18:00) s'applique aux familles ET a Nexus pour confirmer l'ouverture.
6. Aucune conversion automatique en cours particulier si le groupe n'ouvre pas.
7. Un rattrapage d'absence est soumis a disponibilite, sans garantie.
