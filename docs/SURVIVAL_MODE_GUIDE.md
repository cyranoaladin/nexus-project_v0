# Guide coach — Mode Survie STMG

Statut : module tactique pour eleve de Premiere STMG en tres grande difficulte. Activation humaine uniquement.

## Quand l'activer

Activer seulement apres decision pedagogique explicite d'un coach, admin ou assistante, idealement apres echange avec la famille.

Signaux possibles :

- copie blanche ou risque de copie blanche en mathematiques STMG ;
- non-maitrise des calculs tres simples ;
- absence d'acquis de seconde sur pourcentages, equations simples, fonctions affines ;
- anxiete forte face a l'epreuve anticipee.

## Ce que le mode fait

- remplace le programme STMG complet par un dashboard tactique Maths ;
- affiche 7 reflexes, 8 phrases a recopier, un QCM Trainer et une regle d'or ;
- conserve sessions et ARIA, sans relance intrusive ;
- persiste chaque tentative et chaque copie de phrase.

## Ce que le mode ne fait pas

- aucune activation automatique ;
- aucune notification push ou relance email ;
- aucune extension aux autres matieres ;
- aucune promesse de comprehension complete du programme.

## Comment l'annoncer

Formulation recommandee :

> On met en place un mode court et tactique. Le but est de grappiller des points fiables, pas de tout reprendre d'un coup. Chaque jour, une seule action de moins de 12 minutes.

Eviter :

- toute comparaison avec les autres eleves ;
- les messages culpabilisants ;
- les objectifs irrealisables.

## Activation technique

Route :

```http
POST /api/coach/students/{studentUserId}/survival-mode
Content-Type: application/json

{ "enabled": true, "reason": "Objectif tactique 8/20" }
```

Roles autorises : `COACH`, `ADMIN`, `ASSISTANTE`.

Chaque activation/desactivation cree une entree `CoachNote`.

## Desactivation

La desactivation conserve la progression `SurvivalProgress`.

```http
POST /api/coach/students/{studentUserId}/survival-mode
Content-Type: application/json

{ "enabled": false, "reason": "Retour au parcours STMG standard" }
```
