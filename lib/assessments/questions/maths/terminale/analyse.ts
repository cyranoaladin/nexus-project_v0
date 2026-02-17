/**
 * Maths Terminale - Analyse
 *
 * 12 questions covering:
 * - Limites et continuité
 * - Dérivation (composée, quotient)
 * - Convexité et point d'inflexion
 * - Intégrales et primitives
 * - Théorème des valeurs intermédiaires
 * - Suites et convergence
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'analyse',
  title: 'Analyse - Continuité, Dérivation, Convexité',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Analyse',
  questions: [
    {
      id: 'MATH-ANA-01',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Quelle est la dérivée de $f(x) = e^{2x}$ ?',
      latexFormula: 'f(x) = e^{2x}',
      options: [
        { id: 'a', text: '$2e^{2x}$', isCorrect: true },
        { id: 'b', text: '$e^{2x}$', isCorrect: false },
        { id: 'c', text: '$2xe^{2x}$', isCorrect: false },
        { id: 'd', text: '$e^{2x+1}$', isCorrect: false },
      ],
      explanation: 'Par la règle de la chaîne : $(e^{u})\\prime = u\\prime \\cdot e^{u}$, avec $u = 2x$, $u\\prime = 2$. Donc $f\\prime(x) = 2e^{2x}$.',
    },
    {
      id: 'MATH-ANA-02',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Soit $f(x) = x^3 - 3x + 1$. Combien de racines réelles possède $f$ ?',
      options: [
        { id: 'a', text: '3', isCorrect: true },
        { id: 'b', text: '1', isCorrect: false },
        { id: 'c', text: '2', isCorrect: false },
        { id: 'd', text: '0', isCorrect: false },
      ],
      explanation: '$f\\prime(x) = 3x^2 - 3 = 0 \\Rightarrow x = \\pm 1$. $f(-1) = 3 > 0$, $f(1) = -1 < 0$. Par le TVI, $f$ admet 3 racines réelles.',
      hint: 'Étudiez le signe de la dérivée et les valeurs aux extrema locaux.',
    },
    {
      id: 'MATH-ANA-03',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Quelle est une primitive de $f(x) = \\frac{1}{x}$ sur $]0, +\\infty[$ ?',
      options: [
        { id: 'a', text: '$\\ln(x)$', isCorrect: true },
        { id: 'b', text: '$\\frac{1}{x^2}$', isCorrect: false },
        { id: 'c', text: '$-\\frac{1}{x^2}$', isCorrect: false },
        { id: 'd', text: '$e^x$', isCorrect: false },
      ],
      explanation: 'Par définition, $(\\ln x)\\prime = \\frac{1}{x}$ pour $x > 0$.',
    },
    {
      id: 'MATH-ANA-04',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Calculer $\\int_0^1 2x \\, e^{x^2} \\, dx$.',
      latexFormula: '\\int_0^1 2x \\, e^{x^2} \\, dx',
      options: [
        { id: 'a', text: '$e - 1$', isCorrect: true },
        { id: 'b', text: '$e$', isCorrect: false },
        { id: 'c', text: '$e + 1$', isCorrect: false },
        { id: 'd', text: '$2e$', isCorrect: false },
      ],
      explanation: 'Posons $u = x^2$, $du = 2x\\,dx$. $\\int_0^1 e^u \\, du = [e^u]_0^1 = e - 1$.',
      hint: 'Reconnaître la forme $u\\prime \\cdot e^u$.',
    },
    {
      id: 'MATH-ANA-05',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Soit $f(x) = x\\ln(x) - x$. Quel est le minimum de $f$ sur $]0, +\\infty[$ ?',
      options: [
        { id: 'a', text: '$-1$', isCorrect: true },
        { id: 'b', text: '$0$', isCorrect: false },
        { id: 'c', text: '$-e$', isCorrect: false },
        { id: 'd', text: '$1$', isCorrect: false },
      ],
      explanation: '$f\\prime(x) = \\ln(x) + 1 - 1 = \\ln(x)$. $f\\prime(x) = 0 \\Leftrightarrow x = 1$. $f(1) = 0 - 1 = -1$. $f\\prime\\prime(x) = 1/x > 0$ : c\'est un minimum.',
    },
    {
      id: 'MATH-ANA-06',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'La fonction $f(x) = x^4 - 6x^2$ est convexe sur :',
      options: [
        { id: 'a', text: '$]-\\infty, -1[ \\cup ]1, +\\infty[$', isCorrect: true },
        { id: 'b', text: '$]-1, 1[$', isCorrect: false },
        { id: 'c', text: '$\\mathbb{R}$ tout entier', isCorrect: false },
        { id: 'd', text: '$]0, +\\infty[$', isCorrect: false },
      ],
      explanation: '$f\\prime\\prime(x) = 12x^2 - 12 = 12(x^2 - 1)$. $f\\prime\\prime(x) \\geq 0 \\Leftrightarrow |x| \\geq 1$.',
      hint: 'Convexe signifie $f\\prime\\prime(x) \\geq 0$.',
    },
    {
      id: 'MATH-ANA-07',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 1,
      competencies: ['Restituer'],
      questionText: '$\\lim_{x \\to +\\infty} \\frac{e^x}{x^2}$ vaut :',
      options: [
        { id: 'a', text: '$+\\infty$', isCorrect: true },
        { id: 'b', text: '$0$', isCorrect: false },
        { id: 'c', text: '$1$', isCorrect: false },
        { id: 'd', text: 'La limite n\'existe pas', isCorrect: false },
      ],
      explanation: 'Les croissances comparées : l\'exponentielle l\'emporte sur tout polynôme en $+\\infty$.',
    },
    {
      id: 'MATH-ANA-08',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Soit $u_n = \\left(1 + \\frac{1}{n}\\right)^n$. Quelle est $\\lim_{n \\to +\\infty} u_n$ ?',
      options: [
        { id: 'a', text: '$e$', isCorrect: true },
        { id: 'b', text: '$1$', isCorrect: false },
        { id: 'c', text: '$+\\infty$', isCorrect: false },
        { id: 'd', text: '$0$', isCorrect: false },
      ],
      explanation: 'C\'est la définition classique du nombre $e \\approx 2{,}718$.',
    },
    {
      id: 'MATH-ANA-09',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Soit $f$ continue sur $[0, 1]$ avec $f(0) = -2$ et $f(1) = 3$. Par le TVI, on peut affirmer que :',
      options: [
        { id: 'a', text: '$f$ s\'annule au moins une fois sur $]0, 1[$', isCorrect: true },
        { id: 'b', text: '$f$ s\'annule exactement une fois', isCorrect: false },
        { id: 'c', text: '$f$ est croissante sur $[0, 1]$', isCorrect: false },
        { id: 'd', text: '$f$ admet un maximum en $x = 1$', isCorrect: false },
      ],
      explanation: 'Le TVI garantit l\'existence d\'au moins un $c \\in ]0, 1[$ tel que $f(c) = 0$, car $0 \\in [-2, 3]$. Il ne dit rien sur l\'unicité.',
    },
    {
      id: 'MATH-ANA-10',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'La dérivée de $g(x) = \\ln(x^2 + 1)$ est :',
      options: [
        { id: 'a', text: '$\\frac{2x}{x^2 + 1}$', isCorrect: true },
        { id: 'b', text: '$\\frac{1}{x^2 + 1}$', isCorrect: false },
        { id: 'c', text: '$\\frac{2x}{x^2}$', isCorrect: false },
        { id: 'd', text: '$2x \\ln(x^2 + 1)$', isCorrect: false },
      ],
      explanation: 'Chaîne : $(\\ln u)\\prime = u\\prime / u$ avec $u = x^2 + 1$, $u\\prime = 2x$.',
    },
    {
      id: 'MATH-ANA-11',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Quelle est la dérivée de $\\sin(3x)$ ?',
      options: [
        { id: 'a', text: '$3\\cos(3x)$', isCorrect: true },
        { id: 'b', text: '$\\cos(3x)$', isCorrect: false },
        { id: 'c', text: '$-3\\cos(3x)$', isCorrect: false },
        { id: 'd', text: '$3\\sin(3x)$', isCorrect: false },
      ],
      explanation: 'Règle de la chaîne : $(\\sin u)\\prime = u\\prime \\cos u$, avec $u = 3x$.',
    },
    {
      id: 'MATH-ANA-12',
      subject: Subject.MATHS,
      category: 'Analyse',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'L\'aire sous la courbe de $f(x) = e^{-x}$ entre $x = 0$ et $x = +\\infty$ vaut :',
      options: [
        { id: 'a', text: '$1$', isCorrect: true },
        { id: 'b', text: '$+\\infty$', isCorrect: false },
        { id: 'c', text: '$e$', isCorrect: false },
        { id: 'd', text: '$0$', isCorrect: false },
      ],
      explanation: '$\\int_0^{+\\infty} e^{-x} dx = [-e^{-x}]_0^{+\\infty} = 0 - (-1) = 1$. L\'intégrale converge.',
    },
  ],
};

export default questionModule;
