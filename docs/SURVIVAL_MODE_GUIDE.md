# Guide coach — Mode Survie STMG

Statut : module tactique pour élève de Première STMG en très grande difficulté. Activation humaine uniquement.

## Quand l’activer

Activer seulement après décision pédagogique explicite d’un coach, admin ou assistante, idéalement après échange avec la famille.

Signaux possibles :

- copie blanche ou risque de copie blanche en mathématiques STMG ;
- non-maîtrise des calculs très simples ;
- absence d’acquis de seconde sur pourcentages, équations simples, fonctions affines ;
- anxiété forte face à l’épreuve anticipée.

## Ce que le mode fait

- remplace le programme STMG complet par un dashboard tactique Maths ;
- affiche 7 réflexes, 8 phrases à recopier, un QCM Trainer et une règle d’or ;
- conserve sessions et ARIA, sans relance intrusive ;
- persiste chaque tentative et chaque copie de phrase.

## Ce que le mode ne fait pas

- aucune activation automatique ;
- aucune notification push ou relance email ;
- aucune extension aux autres matières ;
- aucune promesse de compréhension complète du programme.

## Comment l’annoncer

Formulation recommandée :

> On met en place un mode court et tactique. Le but est de grappiller des points fiables, pas de tout reprendre d’un coup. Chaque jour, une seule action de moins de 12 minutes.

Éviter :

- toute comparaison avec les autres élèves ;
- les messages culpabilisants ;
- les objectifs irréalisables.

## Activation technique

Route :

```http
POST /api/coach/students/{studentUserId}/survival-mode
Content-Type: application/json

{ "enabled": true, "reason": "Objectif tactique 8/20" }
```

Rôles autorisés : `COACH`, `ADMIN`, `ASSISTANTE`.

Chaque activation/désactivation crée une entrée `CoachNote`.

## Désactivation

La désactivation conserve la progression `SurvivalProgress`.

```http
POST /api/coach/students/{studentUserId}/survival-mode
Content-Type: application/json

{ "enabled": false, "reason": "Retour au parcours STMG standard" }
```

## Ajouter les 30 QCM simulés

Quand Shark fournira la banque additionnelle, l’ajout se fait dans `lib/survival/qcm-bank.ts`.

1. Ajouter les questions avec `source: 'simule'`, un `id` stable et une catégorie `VERT`, `ORANGE` ou `ROUGE`.
2. Répartir les bonnes réponses entre A, B, C et D avant de lancer les tests d’équilibrage.
3. Pour toute question graphique, ajouter un SVG léger dans `public/survival/qcm/` et renseigner `graphicAsset`.
4. Relancer les tests `__tests__/lib/survival/qcm-bank.test.ts` et le parcours E2E survival.
