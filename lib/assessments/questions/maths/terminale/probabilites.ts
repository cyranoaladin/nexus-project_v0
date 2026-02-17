/**
 * Maths Terminale - Probabilités
 *
 * 12 questions covering:
 * - Probabilités conditionnelles
 * - Loi binomiale
 * - Loi normale
 * - Espérance et variance
 * - Succession d'épreuves indépendantes
 * - Intervalle de fluctuation
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'probabilites',
  title: 'Probabilités - Succession d\'épreuves',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Probabilités',
  questions: [
    {
      id: 'MATH-PROB-01',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Soit $X$ suivant une loi binomiale $\\mathcal{B}(n, p)$. L\'espérance $E(X)$ vaut :',
      options: [
        { id: 'a', text: '$np$', isCorrect: true },
        { id: 'b', text: '$n + p$', isCorrect: false },
        { id: 'c', text: '$np(1-p)$', isCorrect: false },
        { id: 'd', text: '$\\frac{n}{p}$', isCorrect: false },
      ],
      explanation: 'Pour $X \\sim \\mathcal{B}(n,p)$ : $E(X) = np$, $V(X) = np(1-p)$.',
    },
    {
      id: 'MATH-PROB-02',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'On lance 10 fois une pièce équilibrée. La probabilité d\'obtenir exactement 3 piles est :',
      options: [
        { id: 'a', text: '$\\binom{10}{3} \\left(\\frac{1}{2}\\right)^{10}$', isCorrect: true },
        { id: 'b', text: '$\\frac{3}{10}$', isCorrect: false },
        { id: 'c', text: '$\\left(\\frac{1}{2}\\right)^3$', isCorrect: false },
        { id: 'd', text: '$10 \\times \\left(\\frac{1}{2}\\right)^3$', isCorrect: false },
      ],
      explanation: '$X \\sim \\mathcal{B}(10, 0{,}5)$. $P(X=3) = \\binom{10}{3} (0{,}5)^3 (0{,}5)^7 = \\binom{10}{3} (0{,}5)^{10}$.',
    },
    {
      id: 'MATH-PROB-03',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'La formule des probabilités totales s\'écrit :',
      options: [
        { id: 'a', text: '$P(B) = P(A) \\cdot P_A(B) + P(\\bar{A}) \\cdot P_{\\bar{A}}(B)$', isCorrect: true },
        { id: 'b', text: '$P(B) = P(A) + P(B) - P(A \\cap B)$', isCorrect: false },
        { id: 'c', text: '$P(B) = P(A) \\cdot P(B)$', isCorrect: false },
        { id: 'd', text: '$P(B) = \\frac{P(A \\cap B)}{P(A)}$', isCorrect: false },
      ],
      explanation: 'Si $(A, \\bar{A})$ forme une partition, $P(B) = P(A)P_A(B) + P(\\bar{A})P_{\\bar{A}}(B)$.',
    },
    {
      id: 'MATH-PROB-04',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Un test médical a une sensibilité de 95% et une spécificité de 90%. Si 1% de la population est malade, quelle est (approximativement) la probabilité d\'être malade sachant que le test est positif ?',
      options: [
        { id: 'a', text: 'Environ 9%', isCorrect: true },
        { id: 'b', text: 'Environ 95%', isCorrect: false },
        { id: 'c', text: 'Environ 50%', isCorrect: false },
        { id: 'd', text: 'Environ 1%', isCorrect: false },
      ],
      explanation: 'Bayes : $P(M|+) = \\frac{0{,}01 \\times 0{,}95}{0{,}01 \\times 0{,}95 + 0{,}99 \\times 0{,}10} \\approx \\frac{0{,}0095}{0{,}1085} \\approx 8{,}8\\%$.',
      hint: 'Utiliser la formule de Bayes avec la formule des probabilités totales au dénominateur.',
    },
    {
      id: 'MATH-PROB-05',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Si $X \\sim \\mathcal{N}(\\mu, \\sigma^2)$, alors $P(\\mu - \\sigma \\leq X \\leq \\mu + \\sigma) \\approx$ :',
      options: [
        { id: 'a', text: '$68\\%$', isCorrect: true },
        { id: 'b', text: '$95\\%$', isCorrect: false },
        { id: 'c', text: '$50\\%$', isCorrect: false },
        { id: 'd', text: '$99{,}7\\%$', isCorrect: false },
      ],
      explanation: 'Règle empirique : $\\pm 1\\sigma \\approx 68\\%$, $\\pm 2\\sigma \\approx 95\\%$, $\\pm 3\\sigma \\approx 99{,}7\\%$.',
    },
    {
      id: 'MATH-PROB-06',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Soit $X \\sim \\mathcal{N}(100, 15^2)$. La probabilité $P(X > 130)$ est environ :',
      options: [
        { id: 'a', text: '$2{,}3\\%$', isCorrect: true },
        { id: 'b', text: '$16\\%$', isCorrect: false },
        { id: 'c', text: '$5\\%$', isCorrect: false },
        { id: 'd', text: '$0{,}1\\%$', isCorrect: false },
      ],
      explanation: '$Z = \\frac{130 - 100}{15} = 2$. $P(Z > 2) \\approx 2{,}3\\%$.',
    },
    {
      id: 'MATH-PROB-07',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Deux événements $A$ et $B$ sont indépendants si et seulement si :',
      options: [
        { id: 'a', text: '$P(A \\cap B) = P(A) \\times P(B)$', isCorrect: true },
        { id: 'b', text: '$P(A \\cup B) = P(A) + P(B)$', isCorrect: false },
        { id: 'c', text: '$P(A|B) = P(B|A)$', isCorrect: false },
        { id: 'd', text: '$A \\cap B = \\emptyset$', isCorrect: false },
      ],
      explanation: 'L\'indépendance se traduit par $P(A \\cap B) = P(A) \\cdot P(B)$. Ne pas confondre avec l\'incompatibilité ($A \\cap B = \\emptyset$).',
    },
    {
      id: 'MATH-PROB-08',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'On tire 5 cartes dans un jeu de 32. La probabilité d\'avoir exactement 2 as est :',
      options: [
        { id: 'a', text: '$\\frac{\\binom{4}{2} \\binom{28}{3}}{\\binom{32}{5}}$', isCorrect: true },
        { id: 'b', text: '$\\frac{4^2 \\times 28^3}{32^5}$', isCorrect: false },
        { id: 'c', text: '$\\binom{5}{2} \\times \\left(\\frac{4}{32}\\right)^2$', isCorrect: false },
        { id: 'd', text: '$\\frac{2}{32}$', isCorrect: false },
      ],
      explanation: 'Loi hypergéométrique : choisir 2 as parmi 4 ET 3 non-as parmi 28, divisé par le nombre total de mains de 5.',
      hint: 'C\'est un tirage sans remise : utiliser les combinaisons.',
    },
    {
      id: 'MATH-PROB-09',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'La variance de $X \\sim \\mathcal{B}(n, p)$ est :',
      options: [
        { id: 'a', text: '$np(1-p)$', isCorrect: true },
        { id: 'b', text: '$np$', isCorrect: false },
        { id: 'c', text: '$n^2 p$', isCorrect: false },
        { id: 'd', text: '$\\sqrt{np}$', isCorrect: false },
      ],
      explanation: 'Pour la loi binomiale : $V(X) = np(1-p)$ et $\\sigma(X) = \\sqrt{np(1-p)}$.',
    },
    {
      id: 'MATH-PROB-10',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Un sondage sur 1000 personnes donne 52% de "oui". L\'intervalle de confiance à 95% pour la proportion est environ :',
      options: [
        { id: 'a', text: '$[0{,}489 \\; ; \\; 0{,}551]$', isCorrect: true },
        { id: 'b', text: '$[0{,}50 \\; ; \\; 0{,}54]$', isCorrect: false },
        { id: 'c', text: '$[0{,}47 \\; ; \\; 0{,}57]$', isCorrect: false },
        { id: 'd', text: '$[0{,}52 \\; ; \\; 0{,}52]$', isCorrect: false },
      ],
      explanation: '$IC = \\hat{p} \\pm 1{,}96 \\sqrt{\\frac{\\hat{p}(1-\\hat{p})}{n}} = 0{,}52 \\pm 1{,}96 \\times 0{,}0158 \\approx 0{,}52 \\pm 0{,}031$.',
    },
    {
      id: 'MATH-PROB-11',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'On répète 4 fois une épreuve de Bernoulli de paramètre $p = 0{,}3$. $P(X \\geq 1)$ vaut :',
      options: [
        { id: 'a', text: '$1 - 0{,}7^4$', isCorrect: true },
        { id: 'b', text: '$4 \\times 0{,}3$', isCorrect: false },
        { id: 'c', text: '$0{,}3^4$', isCorrect: false },
        { id: 'd', text: '$1 - 0{,}3^4$', isCorrect: false },
      ],
      explanation: '$P(X \\geq 1) = 1 - P(X = 0) = 1 - \\binom{4}{0}(0{,}3)^0(0{,}7)^4 = 1 - 0{,}7^4 \\approx 0{,}76$.',
    },
    {
      id: 'MATH-PROB-12',
      subject: Subject.MATHS,
      category: 'Probabilités',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Soit $X$ une variable aléatoire telle que $E(X) = 5$ et $V(X) = 4$. Par l\'inégalité de Bienaymé-Tchebychev, $P(|X - 5| \\geq 4)$ est majorée par :',
      options: [
        { id: 'a', text: '$\\frac{1}{4}$', isCorrect: true },
        { id: 'b', text: '$\\frac{1}{2}$', isCorrect: false },
        { id: 'c', text: '$\\frac{1}{16}$', isCorrect: false },
        { id: 'd', text: '$4$', isCorrect: false },
      ],
      explanation: 'Bienaymé-Tchebychev : $P(|X - \\mu| \\geq k) \\leq \\frac{V(X)}{k^2} = \\frac{4}{16} = \\frac{1}{4}$.',
    },
  ],
};

export default questionModule;
