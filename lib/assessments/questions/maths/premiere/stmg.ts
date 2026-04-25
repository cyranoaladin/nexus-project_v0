/**
 * Maths Première STMG — Banque initiale.
 * 30 questions, 5 par domaine du skill graph maths_premiere_stmg.
 */

import { Subject } from '../../../core/types';
import type { Question, QuestionModule } from '../../types';

function q(
  id: string,
  category: string,
  weight: 1 | 2 | 3,
  competencies: string[],
  questionText: string,
  correct: string,
  distractors: string[],
  explanation: string
): Question {
  return {
    id,
    subject: Subject.MATHS,
    category,
    weight,
    competencies,
    questionText,
    options: [
      { id: 'a', text: correct, isCorrect: true },
      { id: 'b', text: distractors[0], isCorrect: false },
      { id: 'c', text: distractors[1], isCorrect: false },
      { id: 'd', text: distractors[2], isCorrect: false },
    ],
    explanation,
  };
}

const questions: Question[] = [
  q('stmg-math-suites-01', 'Suites et finance', 1, ['STMG_MATH_SUITES_ARITH'], 'Une entreprise gagne 120 clients par mois. Si elle en a 1 500 en janvier, combien en aura-t-elle en avril ?', '1 860', ['1 620', '1 740', '1 980'], 'On ajoute 120 pendant trois mois : 1500 + 3 x 120 = 1860.'),
  q('stmg-math-suites-02', 'Suites et finance', 1, ['STMG_MATH_SUITES_GEO'], 'Un chiffre d’affaires augmente de 4 % par an. Quel est le coefficient multiplicateur annuel ?', '1,04', ['0,96', '1,4', '4'], 'Une hausse de 4 % correspond à multiplier par 1 + 4/100 = 1,04.'),
  q('stmg-math-suites-03', 'Suites et finance', 2, ['STMG_MATH_SUITES_GEO'], 'Un capital de 2 000 DT est placé à 5 % par an. Quel modèle convient le mieux ?', 'u(n)=2000 x 1,05^n', ['u(n)=2000+5n', 'u(n)=2000 x 0,05^n', 'u(n)=2000+1,05n'], 'Un taux constant se modélise par une suite géométrique de raison 1,05.'),
  q('stmg-math-suites-04', 'Suites et finance', 2, ['STMG_MATH_CAPITALISATION'], 'Un capital passe de 10 000 à 10 300 en un an. Quel est le taux annuel ?', '3 %', ['0,3 %', '30 %', '103 %'], 'Le gain est 300 sur 10000, soit 300/10000 = 0,03 = 3 %.'),
  q('stmg-math-suites-05', 'Suites et finance', 3, ['STMG_MATH_SUITES_GEO', 'STMG_MATH_CAPITALISATION'], 'Après deux hausses successives de 10 %, le taux global est :', '21 %', ['20 %', '11 %', '120 %'], 'Le coefficient global est 1,10 x 1,10 = 1,21, donc +21 %.'),

  q('stmg-math-fonc-01', 'Fonctions utiles en gestion', 1, ['STMG_MATH_FONC_LECTURE'], 'Sur une courbe de bénéfice, le maximum correspond à :', 'la valeur la plus élevée du bénéfice', ['la plus grande quantité produite', 'le coût nul', 'la recette minimale'], 'Le maximum d’une fonction bénéfice donne le bénéfice le plus élevé.'),
  q('stmg-math-fonc-02', 'Fonctions utiles en gestion', 1, ['STMG_MATH_FONC_SECOND_DEGRE'], 'La fonction B(x)= -2x^2+40x-50 est une fonction :', 'du second degré', ['affine', 'inverse', 'constante'], 'La présence du terme x^2 caractérise une fonction polynomiale du second degré.'),
  q('stmg-math-fonc-03', 'Fonctions utiles en gestion', 2, ['STMG_MATH_FONC_SECOND_DEGRE'], 'Pour B(x)= -x^2+12x, le bénéfice est nul pour x=0 et :', 'x=12', ['x=6', 'x=-12', 'x=1'], 'On factorise B(x)=x(12-x), donc les zéros sont 0 et 12.'),
  q('stmg-math-fonc-04', 'Fonctions utiles en gestion', 2, ['STMG_MATH_FONC_INVERSE'], 'Si le coût unitaire diminue quand la quantité augmente, le modèle peut évoquer :', 'une relation inverse', ['une relation constante', 'une hausse linéaire', 'une suite arithmétique'], 'Une grandeur qui diminue quand l’autre augmente peut être modélisée par une fonction inverse.'),
  q('stmg-math-fonc-05', 'Fonctions utiles en gestion', 3, ['STMG_MATH_FONC_LECTURE', 'STMG_MATH_FONC_SECOND_DEGRE'], 'Si le sommet d’une parabole de bénéfice est (8 ; 120), cela signifie :', 'le bénéfice maximal est 120 pour 8 unités', ['le bénéfice est 8 pour 120 unités', 'la production minimale est 120', 'le coût fixe vaut 8'], 'Le sommet donne l’extremum : ici un maximum de 120 atteint pour x=8.'),

  q('stmg-math-evo-01', 'Pourcentages, évolutions et indices', 1, ['STMG_MATH_TAUX_GLOBAL'], 'Une baisse de 15 % correspond au coefficient :', '0,85', ['1,15', '0,15', '85'], 'On multiplie par 1 - 15/100 = 0,85.'),
  q('stmg-math-evo-02', 'Pourcentages, évolutions et indices', 1, ['STMG_MATH_INDICES'], 'Un indice base 100 vaut 112. L’évolution depuis la base est :', '+12 %', ['+112 %', '-12 %', '+1,12 %'], 'Passer de 100 à 112 correspond à une hausse de 12 %.'),
  q('stmg-math-evo-03', 'Pourcentages, évolutions et indices', 2, ['STMG_MATH_TAUX_GLOBAL'], 'Une hausse de 20 % puis une baisse de 20 % donnent globalement :', 'une baisse de 4 %', ['aucune évolution', 'une hausse de 4 %', 'une baisse de 40 %'], '1,20 x 0,80 = 0,96, soit -4 %.'),
  q('stmg-math-evo-04', 'Pourcentages, évolutions et indices', 2, ['STMG_MATH_TAUX_MOYEN'], 'Un CA double en 4 ans. Le coefficient annuel moyen c vérifie :', 'c^4=2', ['4c=2', 'c/4=2', 'c^2=4'], 'Le même coefficient appliqué 4 fois doit donner le coefficient global 2.'),
  q('stmg-math-evo-05', 'Pourcentages, évolutions et indices', 3, ['STMG_MATH_INDICES', 'STMG_MATH_TAUX_GLOBAL'], 'Un indice passe de 125 à 150. Le taux d’évolution est :', '20 %', ['25 %', '15 %', '30 %'], 'Le taux vaut (150-125)/125 = 25/125 = 0,20.'),

  q('stmg-math-stats-01', 'Statistiques à deux variables', 1, ['STMG_MATH_NUAGE'], 'Dans un nuage de points, une tendance croissante signifie que :', 'les deux variables augmentent souvent ensemble', ['les points sont toujours alignés', 'la variable x baisse', 'la moyenne est nulle'], 'Une tendance croissante indique une association positive.'),
  q('stmg-math-stats-02', 'Statistiques à deux variables', 1, ['STMG_MATH_AJUSTEMENT'], 'Une droite d’ajustement sert surtout à :', 'estimer ou prévoir une valeur', ['prouver une causalité', 'supprimer les données', 'remplacer toutes les observations'], 'L’ajustement donne une approximation utile pour prévoir.'),
  q('stmg-math-stats-03', 'Statistiques à deux variables', 2, ['STMG_MATH_AJUSTEMENT'], 'Pour la droite y=3x+20, si x=10 alors y vaut :', '50', ['33', '230', '30'], 'On calcule y=3 x 10 + 20 = 50.'),
  q('stmg-math-stats-04', 'Statistiques à deux variables', 2, ['STMG_MATH_MAYER'], 'La méthode de Mayer consiste à utiliser :', 'deux points moyens de deux groupes de données', ['le point le plus haut', 'la médiane seulement', 'une courbe exponentielle'], 'La droite de Mayer passe par les points moyens de deux sous-séries.'),
  q('stmg-math-stats-05', 'Statistiques à deux variables', 3, ['STMG_MATH_AJUSTEMENT', 'STMG_MATH_NUAGE'], 'Un ajustement affine est peu pertinent si :', 'les points sont très dispersés sans tendance linéaire', ['les points sont presque alignés', 'la pente est positive', 'x et y sont numériques'], 'Plus la dispersion est forte sans tendance, moins la prévision linéaire est fiable.'),

  q('stmg-math-proba-01', 'Probabilités et loi binomiale', 1, ['STMG_MATH_PROBA_CONDITIONNELLE'], 'Dans un arbre pondéré, la probabilité d’un chemin se calcule en :', 'multipliant les probabilités des branches', ['additionnant toutes les branches', 'soustrayant les branches', 'prenant la plus grande branche'], 'Un chemin correspond à des événements successifs : on multiplie.'),
  q('stmg-math-proba-02', 'Probabilités et loi binomiale', 1, ['STMG_MATH_BINOMIALE'], 'Une loi binomiale suppose notamment :', 'des répétitions indépendantes avec deux issues', ['une infinité d’issues', 'des tirages toujours dépendants', 'aucune probabilité fixe'], 'La binomiale repose sur n répétitions indépendantes de même probabilité de succès.'),
  q('stmg-math-proba-03', 'Probabilités et loi binomiale', 2, ['STMG_MATH_BINOMIALE'], 'Si X suit B(10 ; 0,3), que représente 10 ?', 'le nombre de répétitions', ['la probabilité de succès', 'le nombre de succès certain', 'le taux d’erreur'], 'Dans B(n;p), n est le nombre d’épreuves.'),
  q('stmg-math-proba-04', 'Probabilités et loi binomiale', 2, ['STMG_MATH_PROBA_CONDITIONNELLE'], 'Si P(A)=0,4 et P_A(B)=0,5, alors P(A et B)=', '0,20', ['0,90', '0,10', '0,45'], 'P(A et B)=P(A) x P_A(B)=0,4 x 0,5=0,20.'),
  q('stmg-math-proba-05', 'Probabilités et loi binomiale', 3, ['STMG_MATH_FLUCTUATION'], 'Un intervalle de fluctuation sert à :', 'juger si une fréquence observée est compatible avec un modèle', ['calculer une moyenne exacte', 'remplacer un sondage', 'garantir une décision vraie'], 'Il aide à décider si l’écart observé est plausible au regard du modèle.'),

  q('stmg-math-algo-01', 'Algorithmique appliquée et tableur', 1, ['STMG_MATH_TABLEUR_FORMULES'], 'Dans un tableur, $A$1 désigne :', 'une référence absolue', ['une référence relative', 'une cellule vide', 'une formule invalide'], 'Les signes $ figent la colonne et la ligne.'),
  q('stmg-math-algo-02', 'Algorithmique appliquée et tableur', 1, ['STMG_MATH_TABLEUR_FORMULES'], 'La formule =B2*1,05 permet de :', 'augmenter B2 de 5 %', ['baisser B2 de 5 %', 'ajouter 1,05 à B2', 'diviser B2 par 5'], 'Multiplier par 1,05 correspond à une hausse de 5 %.'),
  q('stmg-math-algo-03', 'Algorithmique appliquée et tableur', 2, ['STMG_MATH_ALGO_SEUIL'], 'Un algorithme de seuil répond à une question du type :', 'à partir de quand dépasse-t-on une valeur ?', ['quelle est la moyenne ?', 'combien vaut la première donnée ?', 'quel est le plus petit diviseur ?'], 'Un seuil cherche le premier rang ou moment où une condition devient vraie.'),
  q('stmg-math-algo-04', 'Algorithmique appliquée et tableur', 2, ['STMG_MATH_ALGO_SEUIL'], 'Dans une boucle "tant que capital < 5000", la boucle s’arrête quand :', 'capital est au moins égal à 5000', ['capital vaut toujours 0', 'capital est inférieur à 5000', 'la condition reste vraie'], 'Une boucle tant que continue tant que la condition est vraie et s’arrête quand elle devient fausse.'),
  q('stmg-math-algo-05', 'Algorithmique appliquée et tableur', 3, ['STMG_MATH_TABLEUR_FORMULES', 'STMG_MATH_ALGO_SEUIL'], 'Pour recopier un taux fixe placé en C1 dans une formule, il faut utiliser :', '$C$1', ['C1 seulement', 'C$ sans ligne', 'la cellule de gauche'], 'La référence absolue $C$1 garde le taux fixe lors de la recopie.'),
];

const questionModule: QuestionModule = {
  id: 'stmg',
  title: 'Mathématiques Première STMG',
  subject: Subject.MATHS,
  grade: 'PREMIERE',
  category: 'Mathématiques STMG',
  questions,
};

export default questionModule;
