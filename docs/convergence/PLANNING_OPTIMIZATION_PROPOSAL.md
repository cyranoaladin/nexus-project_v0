# PLANNING_OPTIMIZATION_PROPOSAL — constat de faisabilite, non applique

Statut : **NON APPLIQUE**. Ce document est un constat de faisabilite soumis a
l'arbitrage de la direction. Le planning en production reste inchange, et ce
changement n'est pas embarque dans le deploiement en cours.

## Pourquoi ce document existe

Une attente de 150 minutes entre deux seances avait ete presentee comme une
« exception operationnelle incompressible ». Cette affirmation n'etait pas
prouvee : elle constatait seulement qu'aucune amelioration n'avait ete
cherchee. Le solveur a ete ecrit pour trancher la question au lieu de la
supposer, et il l'a tranchee dans l'autre sens.

## Methode

Recherche de voisinage bornee, a objectif lexicographique. L'ordre des
objectifs est un choix de direction, pas un reglage technique :

    errors, overlaps, warnings, maxDays, maxWait, totalWait, late, exceptionalRoom

Les avertissements sont classes AVANT le confort : sans cela, le solveur
echangeait de la conformite aux regles pedagogiques contre de l'attente en
moins, et proposait des etats plus confortables mais moins conformes.
`maxDays` remplace la somme des jours de presence : reduire un total en
concentrant un seul enseignant sur davantage de jours n'est pas une
amelioration pour lui.

## Resultat

    SEARCH_MAX_ROUNDS=6
    STATES_EXAMINED=542
    OBJECTIVE_ORDER=errors, overlaps, warnings, maxDays, maxWait, totalWait, late, exceptionalRoom
    CURRENT_OBJECTIVE_VECTOR=[0, 0, 7, 3, 150, 2055, 4, 0]
    BEST_OBJECTIVE_VECTOR=[0, 0, 6, 3, 135, 1260, 4, 0]
    CURRENT_FEASIBLE=true
    CURRENT_WARNINGS=7
    BEST_WARNINGS=6
    CURRENT_MAX_DAYS=3
    BEST_FEASIBLE_MAX_DAYS=3
    CURRENT_MAX_WAIT=150
    BEST_FEASIBLE_MAX_WAIT=135
    CURRENT_TOTAL_WAIT=2055
    BEST_FEASIBLE_TOTAL_WAIT=1260
    CURRENT_PATHWAY_OVERLAPS=0
    NO_BETTER_MAX_WAIT_FOUND_IN_SEARCH_SPACE=false
    TOTAL_WAIT_IMPROVEMENT_FOUND=true
    PARETO_IMPROVEMENT_FOUND_IN_SEARCH_SPACE=true
    
    PROPOSITION — NON APPLIQUEE, a arbitrer par la direction
    Gain cumule d'attente eleve : 2055 -> 1260 min (795 min, 39 %).
    Attente maximale : 150 -> 135 min (15 min de moins).
    
    | Seance                     | Creneau actuel             | Creneau propose            |
    |----------------------------|----------------------------|----------------------------|
    | MON-1730-P1-EAM            | MON 17:30-19:30 room-1     | FRI 19:00-21:00 room-1     |
    | MON-1730-T-HG              | MON 17:30-19:30 room-2     | FRI 14:30-16:30 room-2     |
    | TUE-1730-P1-LV             | TUE 17:30-19:30 room-1     | FRI 14:30-16:30 room-1     |
    | THU-1700-P1-M              | THU 17:00-19:00 room-1     | MON 17:30-19:30 room-1     |
    | THU-1700-T-SES             | THU 17:00-19:00 room-2     | MON 17:30-19:30 room-2     |
    | FRI-1430-P1-PC             | FRI 14:30-16:30 room-1     | TUE 17:30-19:30 room-1     |
    | FRI-1430-T-M               | FRI 14:30-16:30 room-2     | THU 17:00-19:00 room-2     |
    | FRI-1900-P1-SES            | FRI 19:00-21:00 room-1     | SAT 19:15-21:15 room-1     |
    | SAT-1915-P1CL-F            | SAT 19:15-21:15 room-1     | THU 17:00-19:00 room-1     |
    
    Effets : aucune contrainte dure degradee, couverture metier et
    politique salles inchangees, aucun chevauchement de specialites cree.
    Reserve : les horaires peuvent avoir ete communiques aux familles et
    aux enseignants. Ce tableau est un constat de faisabilite, pas une
    decision, et le planning live reste inchange.

## Lecture

Aucune contrainte dure n'est degradee : zero erreur, zero chevauchement de
parcours, couverture metier et politique de salles inchangees. Le gain porte
sur l'attente cumulee des eleves (39 %) et, contrairement a ce qui avait ete
avance, sur l'attente maximale elle-meme (150 -> 135 min).

## Reserve, et pourquoi elle prime ici

Les horaires ont pu etre communiques aux familles et aux enseignants. Un gain
d'attente ne justifie pas a lui seul de deplacer neuf seances deja annoncees.
C'est une decision de direction, pas une decision technique — et c'est la
raison pour laquelle ce tableau est publie sans etre applique.
