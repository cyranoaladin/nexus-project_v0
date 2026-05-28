# Rapport dashboard — Sujet blanc premium

## Changements de contenu
- Remplacement complet de l'ancien sujet blanc proche du Sujet A.
- Suppression de l'ancien contexte NexusFlix, de la suite `u_{n+1}=0,8u_n+2`, du seuil 9500, des rappels logarithmiques et de l'analyse avec `f(x)=(2x-1)e^{-x}+2`.
- Nouveau sujet blanc inédit du dashboard : première spécialité mathématiques, 2 heures, calculatrice interdite, 20 points.

## Ancienne structure / nouvelle structure
- Ancienne structure : QCM 6 points + 2 exercices longs de 7 points.
- Nouvelle structure : QCM 6 points + 3 exercices indépendants : probabilités conditionnelles 4 points, suites et algorithmique 5 points, analyse et exponentielle 5 points.

## Grille QCM finale
1. b
2. a
3. b
4. a
5. b
6. a
7. b
8. c
9. b
10. b
11. b
12. b

La grille est stockée dans `correctAnswer` côté données, mais elle n'est pas rendue dans le composant élève.

## Résultats clés des exercices
- Exercice 1 : `P(P ∩ C)=0,21`, `P(C)=0,49`, `P_C(P)=3/7`.
- Exercice 2 : `u_1=7`, `u_2=8,2`, `v_n=-5×0,6^n`, `u_n=10-5×0,6^n`, seuil atteint pour `n=5`.
- Exercice 3 : `f'(x)=(2-x)e^x`, croissance sur `[0 ; 2]`, décroissance sur `[2 ; 5]`, tangente `y=2x+4`, intersection avec `y=1` en `x=3`.

## Durée estimée
- 0-20 min : QCM et automatismes.
- 20-45 min : Exercice 1.
- 45-80 min : Exercice 2.
- 80-112 min : Exercice 3.
- 112-120 min : relecture, unités, cohérence et questions laissées.

## Rendu mathématique
- Les fractions, puissances, probabilités conditionnelles, suites et exponentielles sont stockées en LaTeX propre.
- Le rendu utilise le composant KaTeX `MathFormula`.
- La virgule décimale française est utilisée dans les formules via `0{,}6`, `9{,}5`, `0{,}49`.

## Mise en page écran
- Ajout d'une frise temporelle lisible.
- QCM en cartes avec quatre choix identifiés a, b, c, d.
- Exercices séparés par blocs visuels, avec barème visible.
- Aucun corrigé n'est affiché côté élève.

## Mise en page impression
- Ajout des classes `qcm-section` et `print-page-break`.
- La partie 2 commence sur une nouvelle page à l'impression.
- Les éléments de dashboard inutiles sont masqués via les règles `.eam-no-print`.
- Les cartes et questions évitent les coupures internes quand le navigateur le permet.

## Contrôles
- Total : 20 points.
- QCM : 12 questions, une seule réponse correcte stockée par question.
- Trois exercices rédigés indépendants.
- Aucun logarithme utilisé.
- Aucun ancien contenu NexusFlix, seuil 9500, `0,8u_n+2` ou `f(x)=(2x-1)e^{-x}+2` ne subsiste dans les données du sujet.
- Sujet distinct des sujets A et B.
- Partie 2 forcée sur une nouvelle page à l'impression.

## Correction d'intitulé
- Ancien titre affiché : intitulé interne avec lettre de version et mention de plateforme.
- Nouveau titre affiché : `Sujet blanc`.
- Les mentions de lettre de version interne ont été supprimées des textes visibles côté élève.
- Les tests unitaires et E2E ont été mis à jour.
- Le sujet reste distinct des sujets A et B produits en LaTeX, mais cette distinction n'est pas affichée aux élèves.
