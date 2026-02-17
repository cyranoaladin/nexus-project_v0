/**
 * Maths Terminale - Géométrie dans l'espace
 *
 * 10 questions covering:
 * - Vecteurs dans l'espace
 * - Produit scalaire
 * - Équations de droites et plans
 * - Orthogonalité
 * - Distances et angles
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'geometrie',
  title: 'Géométrie dans l\'espace',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Géométrie',
  questions: [
    {
      id: 'MATH-GEO-01',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Le produit scalaire $\\vec{u} \\cdot \\vec{v}$ avec $\\vec{u}(1, 2, 3)$ et $\\vec{v}(4, -1, 2)$ vaut :',
      options: [
        { id: 'a', text: '$8$', isCorrect: true },
        { id: 'b', text: '$10$', isCorrect: false },
        { id: 'c', text: '$6$', isCorrect: false },
        { id: 'd', text: '$-2$', isCorrect: false },
      ],
      explanation: '$\\vec{u} \\cdot \\vec{v} = 1 \\times 4 + 2 \\times (-1) + 3 \\times 2 = 4 - 2 + 6 = 8$.',
    },
    {
      id: 'MATH-GEO-02',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Un vecteur normal au plan $2x - 3y + z = 5$ est :',
      options: [
        { id: 'a', text: '$\\vec{n}(2, -3, 1)$', isCorrect: true },
        { id: 'b', text: '$\\vec{n}(2, 3, 1)$', isCorrect: false },
        { id: 'c', text: '$\\vec{n}(5, -3, 1)$', isCorrect: false },
        { id: 'd', text: '$\\vec{n}(2, -3, 5)$', isCorrect: false },
      ],
      explanation: 'Pour $ax + by + cz = d$, le vecteur normal est $(a, b, c)$. Ici $(2, -3, 1)$.',
    },
    {
      id: 'MATH-GEO-03',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Deux plans sont parallèles si et seulement si leurs vecteurs normaux sont :',
      options: [
        { id: 'a', text: 'Colinéaires', isCorrect: true },
        { id: 'b', text: 'Orthogonaux', isCorrect: false },
        { id: 'c', text: 'De même norme', isCorrect: false },
        { id: 'd', text: 'Opposés', isCorrect: false },
      ],
      explanation: 'Deux plans sont parallèles ssi $\\vec{n_1} = k \\vec{n_2}$ pour un réel $k \\neq 0$.',
    },
    {
      id: 'MATH-GEO-04',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'La distance du point $A(1, 0, 2)$ au plan $x + y + z = 6$ est :',
      options: [
        { id: 'a', text: '$\\frac{3}{\\sqrt{3}} = \\sqrt{3}$', isCorrect: true },
        { id: 'b', text: '$3$', isCorrect: false },
        { id: 'c', text: '$\\frac{3}{3} = 1$', isCorrect: false },
        { id: 'd', text: '$6$', isCorrect: false },
      ],
      explanation: '$d = \\frac{|1 + 0 + 2 - 6|}{\\sqrt{1^2 + 1^2 + 1^2}} = \\frac{3}{\\sqrt{3}} = \\sqrt{3}$.',
      hint: 'Formule : $d(A, \\pi) = \\frac{|ax_0 + by_0 + cz_0 - d|}{\\sqrt{a^2 + b^2 + c^2}}$.',
    },
    {
      id: 'MATH-GEO-05',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'La norme du vecteur $\\vec{u}(3, -4, 0)$ est :',
      options: [
        { id: 'a', text: '$5$', isCorrect: true },
        { id: 'b', text: '$7$', isCorrect: false },
        { id: 'c', text: '$\\sqrt{7}$', isCorrect: false },
        { id: 'd', text: '$25$', isCorrect: false },
      ],
      explanation: '$\\|\\vec{u}\\| = \\sqrt{9 + 16 + 0} = \\sqrt{25} = 5$.',
    },
    {
      id: 'MATH-GEO-06',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'L\'angle entre $\\vec{u}(1, 0, 0)$ et $\\vec{v}(1, 1, 0)$ vaut :',
      options: [
        { id: 'a', text: '$\\frac{\\pi}{4}$', isCorrect: true },
        { id: 'b', text: '$\\frac{\\pi}{2}$', isCorrect: false },
        { id: 'c', text: '$\\frac{\\pi}{3}$', isCorrect: false },
        { id: 'd', text: '$\\frac{\\pi}{6}$', isCorrect: false },
      ],
      explanation: '$\\cos \\theta = \\frac{\\vec{u} \\cdot \\vec{v}}{\\|\\vec{u}\\| \\|\\vec{v}\\|} = \\frac{1}{1 \\times \\sqrt{2}} = \\frac{\\sqrt{2}}{2}$. Donc $\\theta = \\pi/4$.',
    },
    {
      id: 'MATH-GEO-07',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Une représentation paramétrique de la droite passant par $A(1, 2, 3)$ de vecteur directeur $\\vec{d}(2, -1, 4)$ est :',
      options: [
        { id: 'a', text: '$\\begin{cases} x = 1 + 2t \\\\ y = 2 - t \\\\ z = 3 + 4t \\end{cases}$', isCorrect: true },
        { id: 'b', text: '$2x - y + 4z = 12$', isCorrect: false },
        { id: 'c', text: '$\\begin{cases} x = 2 + t \\\\ y = -1 + 2t \\\\ z = 4 + 3t \\end{cases}$', isCorrect: false },
        { id: 'd', text: '$\\frac{x}{2} = \\frac{y}{-1} = \\frac{z}{4}$', isCorrect: false },
      ],
      explanation: 'Forme paramétrique : $M = A + t\\vec{d}$, soit $x = 1 + 2t$, $y = 2 - t$, $z = 3 + 4t$.',
    },
    {
      id: 'MATH-GEO-08',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Le plan passant par $A(1, 0, 0)$, $B(0, 1, 0)$ et $C(0, 0, 1)$ a pour équation :',
      options: [
        { id: 'a', text: '$x + y + z = 1$', isCorrect: true },
        { id: 'b', text: '$x + y + z = 0$', isCorrect: false },
        { id: 'c', text: '$x - y + z = 1$', isCorrect: false },
        { id: 'd', text: '$x + y + z = 3$', isCorrect: false },
      ],
      explanation: 'On vérifie : $A(1,0,0) \\to 1+0+0=1$ ✓, $B(0,1,0) \\to 0+1+0=1$ ✓, $C(0,0,1) \\to 0+0+1=1$ ✓.',
    },
    {
      id: 'MATH-GEO-09',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Deux vecteurs sont orthogonaux si et seulement si :',
      options: [
        { id: 'a', text: 'Leur produit scalaire est nul', isCorrect: true },
        { id: 'b', text: 'Leur produit vectoriel est nul', isCorrect: false },
        { id: 'c', text: 'Ils sont colinéaires', isCorrect: false },
        { id: 'd', text: 'Leurs normes sont égales', isCorrect: false },
      ],
      explanation: 'Par définition, $\\vec{u} \\perp \\vec{v} \\Leftrightarrow \\vec{u} \\cdot \\vec{v} = 0$.',
    },
    {
      id: 'MATH-GEO-10',
      subject: Subject.MATHS,
      category: 'Géométrie',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'L\'intersection de la droite $\\begin{cases} x = t \\\\ y = 1 + t \\\\ z = 2t \\end{cases}$ et du plan $x + y + z = 4$ est :',
      options: [
        { id: 'a', text: '$(\\frac{3}{4}, \\frac{7}{4}, \\frac{3}{2})$', isCorrect: true },
        { id: 'b', text: '$(1, 2, 2)$', isCorrect: false },
        { id: 'c', text: 'L\'ensemble vide (pas d\'intersection)', isCorrect: false },
        { id: 'd', text: '$(0, 1, 0)$', isCorrect: false },
      ],
      explanation: 'Substitution : $t + (1+t) + 2t = 4 \\Rightarrow 4t + 1 = 4 \\Rightarrow t = 3/4$. D\'où $(3/4, 7/4, 3/2)$.',
    },
  ],
};

export default questionModule;
