/**
 * Maths Terminale - Combinatoire et Dénombrement
 * 
 * 6 questions covering:
 * - Coefficient binomial
 * - Triangle de Pascal
 * - Dénombrement (avec/sans ordre)
 * - k-uplets
 * - Permutations
 * - Chemins dans une grille
 */

import { Subject } from '../../../core/types';
import type { QuestionModule } from '../../types';

const questionModule: QuestionModule = {
  id: 'combinatoire',
  title: 'Combinatoire et Dénombrement',
  subject: Subject.MATHS,
  grade: 'TERMINALE',
  category: 'Combinatoire',
  questions: [
    {
      id: 'MATH-COMB-01',
      subject: Subject.MATHS,
      category: 'Combinatoire',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'Que vaut $\\binom{5}{2}$ ?',
      latexFormula: '\\binom{5}{2}',
      options: [
        { id: 'a', text: '10', isCorrect: true },
        { id: 'b', text: '20', isCorrect: false },
        { id: 'c', text: '25', isCorrect: false },
        { id: 'd', text: '5', isCorrect: false },
      ],
      explanation: '$\\binom{5}{2} = \\frac{5!}{2! \\times 3!} = \\frac{120}{2 \\times 6} = 10$. L\'erreur (b) vient de $5 \\times 4 = 20$ sans diviser par $2!$. L\'erreur (c) vient de $5^2$, confusion avec les k-uplets.',
    },
    {
      id: 'MATH-COMB-02',
      subject: Subject.MATHS,
      category: 'Combinatoire',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Dans le triangle de Pascal, on connaît $\\binom{7}{3} = 35$ et $\\binom{7}{4} = 35$. Que vaut $\\binom{8}{4}$ ?',
      latexFormula: '\\binom{8}{4} = \\binom{7}{3} + \\binom{7}{4}',
      options: [
        { id: 'a', text: '70', isCorrect: true },
        { id: 'b', text: '35', isCorrect: false },
        { id: 'c', text: '56', isCorrect: false },
        { id: 'd', text: '140', isCorrect: false },
      ],
      explanation: 'Formule de Pascal : $\\binom{8}{4} = \\binom{7}{3} + \\binom{7}{4} = 35 + 35 = 70$. L\'erreur (b) confond avec la ligne précédente. L\'erreur (d) multiplie au lieu d\'additionner.',
      hint: 'Chaque case du triangle est la somme des deux cases au-dessus.',
    },
    {
      id: 'MATH-COMB-03',
      subject: Subject.MATHS,
      category: 'Combinatoire',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'On choisit un comité de 3 personnes parmi 10. Combien de comités différents peut-on former ?',
      options: [
        { id: 'a', text: '120', isCorrect: true },
        { id: 'b', text: '720', isCorrect: false },
        { id: 'c', text: '1000', isCorrect: false },
        { id: 'd', text: '30', isCorrect: false },
      ],
      explanation: 'Un comité est un ensemble (sans ordre, sans remise) : $\\binom{10}{3} = \\frac{10!}{3! \\times 7!} = 120$. L\'erreur (b) = $10 \\times 9 \\times 8 = 720$ (arrangements, avec ordre). L\'erreur (c) = $10^3$ (k-uplets, avec remise et ordre). L\'erreur (d) = $10 \\times 3$.',
      hint: 'L\'ordre dans un comité n\'a pas d\'importance.',
    },
    {
      id: 'MATH-COMB-04',
      subject: Subject.MATHS,
      category: 'Combinatoire',
      weight: 2,
      competencies: ['Appliquer'],
      questionText: 'Combien de codes à 4 chiffres (0-9) peut-on former si les répétitions sont autorisées ?',
      options: [
        { id: 'a', text: '10 000', isCorrect: true },
        { id: 'b', text: '5 040', isCorrect: false },
        { id: 'c', text: '210', isCorrect: false },
        { id: 'd', text: '40', isCorrect: false },
      ],
      explanation: 'Avec remise et ordre : $10^4 = 10\\,000$ k-uplets. L\'erreur (b) = $10 \\times 9 \\times 8 \\times 7 = 5\\,040$ (arrangements sans remise). L\'erreur (c) = $\\binom{10}{4} = 210$ (combinaisons). L\'erreur (d) = $10 \\times 4$.',
    },
    {
      id: 'MATH-COMB-05',
      subject: Subject.MATHS,
      category: 'Combinatoire',
      weight: 1,
      competencies: ['Restituer'],
      questionText: 'De combien de façons peut-on ranger 4 livres différents sur une étagère ?',
      options: [
        { id: 'a', text: '24', isCorrect: true },
        { id: 'b', text: '16', isCorrect: false },
        { id: 'c', text: '4', isCorrect: false },
        { id: 'd', text: '12', isCorrect: false },
      ],
      explanation: 'C\'est le nombre de permutations de 4 éléments : $4! = 4 \\times 3 \\times 2 \\times 1 = 24$. L\'erreur (b) = $4^2 = 16$. L\'erreur (d) = $4 \\times 3 = 12$ (on oublie les deux derniers choix).',
    },
    {
      id: 'MATH-COMB-06',
      subject: Subject.MATHS,
      category: 'Combinatoire',
      weight: 3,
      competencies: ['Raisonner'],
      questionText: 'Dans un quadrillage, on va du point A (coin bas-gauche) au point B (coin haut-droit) en faisant exactement 3 pas vers la droite et 2 pas vers le haut. Combien de chemins différents existe-t-il ?',
      options: [
        { id: 'a', text: '10', isCorrect: true },
        { id: 'b', text: '6', isCorrect: false },
        { id: 'c', text: '12', isCorrect: false },
        { id: 'd', text: '5', isCorrect: false },
      ],
      explanation: 'On doit placer 2 pas "haut" parmi 5 pas au total : $\\binom{5}{2} = 10$. Ou de façon équivalente, 3 pas "droite" parmi 5 : $\\binom{5}{3} = 10$. L\'erreur (b) = $3! = 6$. L\'erreur (d) = $3 + 2$.',
      hint: 'Chaque chemin est un mot de 5 lettres avec 3 fois D et 2 fois H.',
    },
  ],
};

export default questionModule;
