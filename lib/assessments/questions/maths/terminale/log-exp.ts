/**
 * Maths Terminale - Logarithme et Exponentielle
 *
 * 10 questions covering:
 * - Propriétés de ln et exp
 * - Équations logarithmiques et exponentielles
 * - Croissances comparées
 * - Études de fonctions composées
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'log-exp',
  title: 'Logarithme et Exponentielle',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Logarithme et Exponentielle',
  questions: [
    {
      id: 'MATH-LOG-01',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 1,
      competencies: ['Restituer'],
      questionText: '$\\ln(e^3)$ vaut :',
      options: [
        { id: 'a', text: '$3$', isCorrect: true },
        { id: 'b', text: '$e^3$', isCorrect: false },
        { id: 'c', text: '$3e$', isCorrect: false },
        { id: 'd', text: '$\\frac{1}{3}$', isCorrect: false },
      ],
      explanation: 'Par définition, $\\ln(e^x) = x$. Donc $\\ln(e^3) = 3$.',
    },
    {
      id: 'MATH-LOG-02',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 1,
      competencies: ['Restituer'],
      questionText: '$e^{\\ln 5}$ vaut :',
      options: [
        { id: 'a', text: '$5$', isCorrect: true },
        { id: 'b', text: '$\\ln 5$', isCorrect: false },
        { id: 'c', text: '$5e$', isCorrect: false },
        { id: 'd', text: '$e^5$', isCorrect: false },
      ],
      explanation: '$e^{\\ln x} = x$ pour tout $x > 0$.',
    },
    {
      id: 'MATH-LOG-03',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Résoudre $e^{2x} = 7$ :',
      options: [
        { id: 'a', text: '$x = \\frac{\\ln 7}{2}$', isCorrect: true },
        { id: 'b', text: '$x = \\ln(\\frac{7}{2})$', isCorrect: false },
        { id: 'c', text: '$x = 2\\ln 7$', isCorrect: false },
        { id: 'd', text: '$x = \\frac{7}{2e}$', isCorrect: false },
      ],
      explanation: '$e^{2x} = 7 \\Rightarrow 2x = \\ln 7 \\Rightarrow x = \\frac{\\ln 7}{2}$.',
    },
    {
      id: 'MATH-LOG-04',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: '$\\ln(a \\times b)$ est égal à :',
      options: [
        { id: 'a', text: '$\\ln a + \\ln b$', isCorrect: true },
        { id: 'b', text: '$\\ln a \\times \\ln b$', isCorrect: false },
        { id: 'c', text: '$\\ln(a + b)$', isCorrect: false },
        { id: 'd', text: '$\\frac{\\ln a}{\\ln b}$', isCorrect: false },
      ],
      explanation: 'Propriété fondamentale : le logarithme transforme un produit en somme.',
    },
    {
      id: 'MATH-LOG-05',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Résoudre $\\ln(x - 1) = 2$ :',
      options: [
        { id: 'a', text: '$x = e^2 + 1$', isCorrect: true },
        { id: 'b', text: '$x = e^2$', isCorrect: false },
        { id: 'c', text: '$x = 3$', isCorrect: false },
        { id: 'd', text: '$x = e^2 - 1$', isCorrect: false },
      ],
      explanation: '$\\ln(x-1) = 2 \\Rightarrow x - 1 = e^2 \\Rightarrow x = e^2 + 1$. Condition : $x > 1$ ✓.',
      hint: 'Passer à l\'exponentielle des deux côtés.',
    },
    {
      id: 'MATH-LOG-06',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: '$\\lim_{x \\to +\\infty} \\frac{\\ln x}{x}$ vaut :',
      options: [
        { id: 'a', text: '$0$', isCorrect: true },
        { id: 'b', text: '$1$', isCorrect: false },
        { id: 'c', text: '$+\\infty$', isCorrect: false },
        { id: 'd', text: '$-\\infty$', isCorrect: false },
      ],
      explanation: 'Croissances comparées : $\\ln x$ croît beaucoup moins vite que $x$. Le quotient tend vers $0$.',
    },
    {
      id: 'MATH-LOG-07',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'La fonction $x \\mapsto e^x$ est :',
      options: [
        { id: 'a', text: 'Strictement croissante sur $\\mathbb{R}$', isCorrect: true },
        { id: 'b', text: 'Strictement décroissante sur $\\mathbb{R}$', isCorrect: false },
        { id: 'c', text: 'Croissante puis décroissante', isCorrect: false },
        { id: 'd', text: 'Constante', isCorrect: false },
      ],
      explanation: '$(e^x)\\prime = e^x > 0$ pour tout $x \\in \\mathbb{R}$.',
    },
    {
      id: 'MATH-LOG-08',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Simplifier $\\ln(\\frac{a^3}{b^2})$ :',
      options: [
        { id: 'a', text: '$3\\ln a - 2\\ln b$', isCorrect: true },
        { id: 'b', text: '$\\frac{3\\ln a}{2\\ln b}$', isCorrect: false },
        { id: 'c', text: '$3\\ln a + 2\\ln b$', isCorrect: false },
        { id: 'd', text: '$\\ln 3a - \\ln 2b$', isCorrect: false },
      ],
      explanation: '$\\ln(\\frac{a^3}{b^2}) = \\ln(a^3) - \\ln(b^2) = 3\\ln a - 2\\ln b$.',
    },
    {
      id: 'MATH-LOG-09',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Le nombre de solutions de $e^x = x + 2$ est :',
      options: [
        { id: 'a', text: '$2$', isCorrect: true },
        { id: 'b', text: '$1$', isCorrect: false },
        { id: 'c', text: '$0$', isCorrect: false },
        { id: 'd', text: '$3$', isCorrect: false },
      ],
      explanation: 'Soit $f(x) = e^x - x - 2$. $f(0) = -1 < 0$, $f(-2) = e^{-2} > 0$, $f(2) = e^2 - 4 > 0$. Par le TVI, deux racines.',
      hint: 'Étudier $f(x) = e^x - x - 2$ et son signe en quelques points.',
    },
    {
      id: 'MATH-LOG-10',
      subject: Subject.MATHS,
      category: 'Logarithme et Exponentielle',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Soit $f(x) = xe^{-x}$. Le maximum de $f$ sur $[0, +\\infty[$ est atteint en :',
      options: [
        { id: 'a', text: '$x = 1$', isCorrect: true },
        { id: 'b', text: '$x = 0$', isCorrect: false },
        { id: 'c', text: '$x = e$', isCorrect: false },
        { id: 'd', text: '$x = \\frac{1}{e}$', isCorrect: false },
      ],
      explanation: '$f\\prime(x) = e^{-x} - xe^{-x} = e^{-x}(1-x)$. $f\\prime(x) = 0 \\Leftrightarrow x = 1$. $f\\prime\\prime(1) < 0$ : maximum.',
    },
  ],
};

export default questionModule;
