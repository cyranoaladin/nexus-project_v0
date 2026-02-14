/**
 * Stage QCM Structure — Template & Question Bank
 *
 * Extends QuestionMetadata from scoring-engine.ts with actual question content.
 * This file serves as the data source for the Stage Février 2026 QCM.
 *
 * Usage:
 *   import { MATHS_QUESTIONS, NSI_QUESTIONS, ALL_STAGE_QUESTIONS } from '@/lib/data/stage-qcm-structure';
 *   const result = computeStageScore(studentAnswers, ALL_STAGE_QUESTIONS);
 */

import type { QuestionMetadata, ScoringSubject, CompetencyLevel, NSIErrorType } from '@/lib/scoring-engine';

// ─── Extended Question Interface ─────────────────────────────────────────────

/** Answer option for a QCM question */
export interface QuestionOption {
  /** Unique option identifier (e.g. "a", "b", "c", "d") */
  id: string;
  /** Display text for this option */
  text: string;
  /** Whether this option is the correct answer */
  isCorrect: boolean;
}

/**
 * Full stage question: extends QuestionMetadata with content for rendering.
 * QuestionMetadata fields are used by the scoring engine.
 * StageQuestion fields are used by the frontend QCM renderer.
 */
export interface StageQuestion extends QuestionMetadata {
  /** The question text displayed to the student */
  questionText: string;
  /** Answer options (includes "Je ne sais pas" automatically in the UI) */
  options: QuestionOption[];
  /** Explanation shown after the student answers (for feedback/learning) */
  explanation: string;
  /** Optional image URL for the question */
  imageUrl?: string;
  /** Optional hint text (shown on demand) */
  hint?: string;
}

// ─── Helper: Question Builder ────────────────────────────────────────────────

/**
 * Type-safe question builder to reduce boilerplate.
 */
function q(params: {
  id: string;
  subject: ScoringSubject;
  category: string;
  competence: CompetencyLevel;
  weight: 1 | 2 | 3;
  label: string;
  questionText: string;
  options: QuestionOption[];
  explanation: string;
  nsiErrorType?: NSIErrorType;
  hint?: string;
}): StageQuestion {
  return {
    id: params.id,
    subject: params.subject,
    category: params.category,
    competence: params.competence,
    weight: params.weight,
    label: params.label,
    questionText: params.questionText,
    options: params.options,
    explanation: params.explanation,
    nsiErrorType: params.nsiErrorType,
    hint: params.hint,
  };
}

// ─── MATHS Questions ─────────────────────────────────────────────────────────

export const MATHS_QUESTIONS: StageQuestion[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // A. COMBINATOIRE ET DÉNOMBREMENT (6 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'MATH-COMB-01',
    subject: 'MATHS',
    category: 'Combinatoire',
    competence: 'Restituer',
    weight: 1,
    label: 'Coefficient binomial — définition',
    questionText: 'Que vaut $\\binom{5}{2}$ ?',
    options: [
      { id: 'a', text: '10', isCorrect: true },
      { id: 'b', text: '20', isCorrect: false },
      { id: 'c', text: '25', isCorrect: false },
      { id: 'd', text: '5', isCorrect: false },
    ],
    explanation: '$\\binom{5}{2} = \\frac{5!}{2! \\times 3!} = \\frac{120}{2 \\times 6} = 10$. L\'erreur (b) vient de $5 \\times 4 = 20$ sans diviser par $2!$. L\'erreur (c) vient de $5^2$, confusion avec les k-uplets.',
  }),

  q({
    id: 'MATH-COMB-02',
    subject: 'MATHS',
    category: 'Combinatoire',
    competence: 'Appliquer',
    weight: 2,
    label: 'Triangle de Pascal',
    questionText: 'Dans le triangle de Pascal, on connaît $\\binom{7}{3} = 35$ et $\\binom{7}{4} = 35$. Que vaut $\\binom{8}{4}$ ?',
    options: [
      { id: 'a', text: '70', isCorrect: true },
      { id: 'b', text: '35', isCorrect: false },
      { id: 'c', text: '56', isCorrect: false },
      { id: 'd', text: '140', isCorrect: false },
    ],
    explanation: 'Formule de Pascal : $\\binom{8}{4} = \\binom{7}{3} + \\binom{7}{4} = 35 + 35 = 70$. L\'erreur (b) confond avec la ligne précédente. L\'erreur (d) multiplie au lieu d\'additionner.',
    hint: 'Chaque case du triangle est la somme des deux cases au-dessus.',
  }),

  q({
    id: 'MATH-COMB-03',
    subject: 'MATHS',
    category: 'Combinatoire',
    competence: 'Raisonner',
    weight: 3,
    label: 'Dénombrement — avec ou sans ordre',
    questionText: 'On choisit un comité de 3 personnes parmi 10. Combien de comités différents peut-on former ?',
    options: [
      { id: 'a', text: '120', isCorrect: true },
      { id: 'b', text: '720', isCorrect: false },
      { id: 'c', text: '1000', isCorrect: false },
      { id: 'd', text: '30', isCorrect: false },
    ],
    explanation: 'Un comité est un ensemble (sans ordre, sans remise) : $\\binom{10}{3} = \\frac{10!}{3! \\times 7!} = 120$. L\'erreur (b) = $10 \\times 9 \\times 8 = 720$ (arrangements, avec ordre). L\'erreur (c) = $10^3$ (k-uplets, avec remise et ordre). L\'erreur (d) = $10 \\times 3$.',
    hint: 'L\'ordre dans un comité n\'a pas d\'importance.',
  }),

  q({
    id: 'MATH-COMB-04',
    subject: 'MATHS',
    category: 'Combinatoire',
    competence: 'Appliquer',
    weight: 2,
    label: 'k-uplets — code à 4 chiffres',
    questionText: 'Combien de codes à 4 chiffres (0-9) peut-on former si les répétitions sont autorisées ?',
    options: [
      { id: 'a', text: '10 000', isCorrect: true },
      { id: 'b', text: '5 040', isCorrect: false },
      { id: 'c', text: '210', isCorrect: false },
      { id: 'd', text: '40', isCorrect: false },
    ],
    explanation: 'Avec remise et ordre : $10^4 = 10\\,000$ k-uplets. L\'erreur (b) = $10 \\times 9 \\times 8 \\times 7 = 5\\,040$ (arrangements sans remise). L\'erreur (c) = $\\binom{10}{4} = 210$ (combinaisons). L\'erreur (d) = $10 \\times 4$.',
  }),

  q({
    id: 'MATH-COMB-05',
    subject: 'MATHS',
    category: 'Combinatoire',
    competence: 'Restituer',
    weight: 1,
    label: 'Permutations',
    questionText: 'De combien de façons peut-on ranger 4 livres différents sur une étagère ?',
    options: [
      { id: 'a', text: '24', isCorrect: true },
      { id: 'b', text: '16', isCorrect: false },
      { id: 'c', text: '4', isCorrect: false },
      { id: 'd', text: '12', isCorrect: false },
    ],
    explanation: 'C\'est le nombre de permutations de 4 éléments : $4! = 4 \\times 3 \\times 2 \\times 1 = 24$. L\'erreur (b) = $4^2 = 16$. L\'erreur (d) = $4 \\times 3 = 12$ (on oublie les deux derniers choix).',
  }),

  q({
    id: 'MATH-COMB-06',
    subject: 'MATHS',
    category: 'Combinatoire',
    competence: 'Raisonner',
    weight: 3,
    label: 'Chemins dans une grille',
    questionText: 'Dans un quadrillage, on va du point A (coin bas-gauche) au point B (coin haut-droit) en faisant exactement 3 pas vers la droite et 2 pas vers le haut. Combien de chemins différents existe-t-il ?',
    options: [
      { id: 'a', text: '10', isCorrect: true },
      { id: 'b', text: '6', isCorrect: false },
      { id: 'c', text: '12', isCorrect: false },
      { id: 'd', text: '5', isCorrect: false },
    ],
    explanation: 'On doit placer 2 pas "haut" parmi 5 pas au total : $\\binom{5}{2} = 10$. Ou de façon équivalente, 3 pas "droite" parmi 5 : $\\binom{5}{3} = 10$. L\'erreur (b) = $3! = 6$. L\'erreur (d) = $3 + 2$.',
    hint: 'Chaque chemin est un mot de 5 lettres avec 3 fois D et 2 fois H.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // B. GÉOMÉTRIE DANS L'ESPACE (6 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'MATH-GEO-01',
    subject: 'MATHS',
    category: 'Géométrie dans l\'espace',
    competence: 'Restituer',
    weight: 1,
    label: 'Vecteur normal à un plan',
    questionText: 'Le plan $\\mathcal{P}$ a pour équation $2x - 3y + z - 5 = 0$. Quel est un vecteur normal à $\\mathcal{P}$ ?',
    options: [
      { id: 'a', text: '$\\vec{n}(2 ; -3 ; 1)$', isCorrect: true },
      { id: 'b', text: '$\\vec{n}(2 ; 3 ; 1)$', isCorrect: false },
      { id: 'c', text: '$\\vec{n}(2 ; -3 ; -5)$', isCorrect: false },
      { id: 'd', text: '$\\vec{n}(-2 ; 3 ; -1)$', isCorrect: false },
    ],
    explanation: 'Pour $ax + by + cz + d = 0$, le vecteur normal est $\\vec{n}(a ; b ; c) = (2 ; -3 ; 1)$. Le coefficient $d = -5$ n\'intervient pas dans le vecteur normal. L\'option (d) est $-\\vec{n}$, qui est aussi normal au plan, mais la question demande les coefficients directs.',
  }),

  q({
    id: 'MATH-GEO-02',
    subject: 'MATHS',
    category: 'Géométrie dans l\'espace',
    competence: 'Appliquer',
    weight: 2,
    label: 'Produit scalaire dans l\'espace',
    questionText: 'Soient $\\vec{u}(1 ; 2 ; -1)$ et $\\vec{v}(3 ; 0 ; 4)$. Que vaut $\\vec{u} \\cdot \\vec{v}$ ?',
    options: [
      { id: 'a', text: '$-1$', isCorrect: true },
      { id: 'b', text: '$7$', isCorrect: false },
      { id: 'c', text: '$1$', isCorrect: false },
      { id: 'd', text: '$-7$', isCorrect: false },
    ],
    explanation: '$\\vec{u} \\cdot \\vec{v} = 1 \\times 3 + 2 \\times 0 + (-1) \\times 4 = 3 + 0 - 4 = -1$. L\'erreur (b) vient de $3 + 0 + 4 = 7$ (oubli du signe). L\'erreur (c) vient d\'une erreur de signe $3 + 0 - 2 = 1$.',
  }),

  q({
    id: 'MATH-GEO-03',
    subject: 'MATHS',
    category: 'Géométrie dans l\'espace',
    competence: 'Appliquer',
    weight: 2,
    label: 'Représentation paramétrique de droite',
    questionText: 'La droite $d$ passe par $A(1 ; 0 ; 2)$ et a pour vecteur directeur $\\vec{u}(2 ; -1 ; 3)$. Quel point appartient à $d$ ?',
    options: [
      { id: 'a', text: '$B(3 ; -1 ; 5)$', isCorrect: true },
      { id: 'b', text: '$B(3 ; 1 ; 5)$', isCorrect: false },
      { id: 'c', text: '$B(2 ; -1 ; 3)$', isCorrect: false },
      { id: 'd', text: '$B(1 ; 2 ; -1)$', isCorrect: false },
    ],
    explanation: 'Pour $t = 1$ : $x = 1 + 2 = 3$, $y = 0 - 1 = -1$, $z = 2 + 3 = 5$. Donc $B(3 ; -1 ; 5) \\in d$. L\'erreur (b) oublie le signe de $y$. L\'erreur (c) confond le vecteur directeur avec un point de la droite.',
    hint: 'Remplacez le paramètre $t$ par une valeur simple comme $t = 1$.',
  }),

  q({
    id: 'MATH-GEO-04',
    subject: 'MATHS',
    category: 'Géométrie dans l\'espace',
    competence: 'Raisonner',
    weight: 3,
    label: 'Intersection droite/plan',
    questionText: 'Soit le plan $\\mathcal{P} : x + y + z = 6$ et la droite $d$ paramétrée par $(x ; y ; z) = (1 + t ; 2 - t ; 1 + 2t)$. Quel est le point d\'intersection ?',
    options: [
      { id: 'a', text: '$(2 ; 1 ; 3)$', isCorrect: true },
      { id: 'b', text: '$(1 ; 2 ; 1)$', isCorrect: false },
      { id: 'c', text: '$(3 ; 0 ; 5)$', isCorrect: false },
      { id: 'd', text: 'La droite est parallèle au plan', isCorrect: false },
    ],
    explanation: 'On substitue dans $\\mathcal{P}$ : $(1+t) + (2-t) + (1+2t) = 6 \\Rightarrow 4 + 2t = 6 \\Rightarrow t = 1$. Donc le point est $(2 ; 1 ; 3)$. L\'erreur (b) est le point pour $t = 0$ (point de départ de $d$). L\'erreur (d) est fausse car le coefficient de $t$ est $2 \\neq 0$.',
    hint: 'Substituez les expressions paramétriques dans l\'équation du plan.',
  }),

  q({
    id: 'MATH-GEO-05',
    subject: 'MATHS',
    category: 'Géométrie dans l\'espace',
    competence: 'Restituer',
    weight: 1,
    label: 'Orthogonalité de vecteurs',
    questionText: 'Deux vecteurs $\\vec{u}$ et $\\vec{v}$ sont orthogonaux si et seulement si :',
    options: [
      { id: 'a', text: '$\\vec{u} \\cdot \\vec{v} = 0$', isCorrect: true },
      { id: 'b', text: '$\\vec{u} \\cdot \\vec{v} = 1$', isCorrect: false },
      { id: 'c', text: '$\\|\\vec{u}\\| = \\|\\vec{v}\\|$', isCorrect: false },
      { id: 'd', text: '$\\vec{u} + \\vec{v} = \\vec{0}$', isCorrect: false },
    ],
    explanation: 'Deux vecteurs sont orthogonaux si et seulement si leur produit scalaire est nul. L\'erreur (c) signifie qu\'ils ont la même norme (pas de lien avec l\'orthogonalité). L\'erreur (d) signifie qu\'ils sont opposés.',
  }),

  q({
    id: 'MATH-GEO-06',
    subject: 'MATHS',
    category: 'Géométrie dans l\'espace',
    competence: 'Raisonner',
    weight: 3,
    label: 'Projection orthogonale',
    questionText: 'Soit $\\mathcal{P} : z = 0$ (plan $xOy$) et $M(3 ; -1 ; 5)$. Quelle est la distance de $M$ au plan $\\mathcal{P}$ ?',
    options: [
      { id: 'a', text: '$5$', isCorrect: true },
      { id: 'b', text: '$\\sqrt{35}$', isCorrect: false },
      { id: 'c', text: '$\\sqrt{10}$', isCorrect: false },
      { id: 'd', text: '$3$', isCorrect: false },
    ],
    explanation: 'Le plan $z = 0$ a pour vecteur normal $\\vec{n}(0 ; 0 ; 1)$. La distance de $M(3 ; -1 ; 5)$ au plan $z = 0$ est simplement $|z_M| = |5| = 5$. L\'erreur (b) = $\\sqrt{9 + 1 + 25}$ (distance à l\'origine, pas au plan). L\'erreur (c) = $\\sqrt{9 + 1}$ (projection partielle).',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // C. ANALYSE — Continuité, Dérivation, Convexité, Primitives, Éq. Diff. (8 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'MATH-ANA-01',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Restituer',
    weight: 1,
    label: 'Primitive de référence',
    questionText: 'Quelle est une primitive de $f(x) = \\frac{1}{x}$ sur $]0 ; +\\infty[$ ?',
    options: [
      { id: 'a', text: '$F(x) = \\ln(x)$', isCorrect: true },
      { id: 'b', text: '$F(x) = -\\frac{1}{x^2}$', isCorrect: false },
      { id: 'c', text: '$F(x) = \\frac{1}{x^2}$', isCorrect: false },
      { id: 'd', text: '$F(x) = e^x$', isCorrect: false },
    ],
    explanation: 'La primitive de $\\frac{1}{x}$ est $\\ln(x) + C$. L\'erreur (b) confond avec la dérivée de $\\frac{1}{x}$ (qui est $-\\frac{1}{x^2}$). Confusion classique primitive/dérivée.',
  }),

  q({
    id: 'MATH-ANA-02',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Appliquer',
    weight: 2,
    label: 'Dérivée composée — chaîne',
    questionText: 'Soit $f(x) = e^{3x+1}$. Que vaut $f\'(x)$ ?',
    options: [
      { id: 'a', text: '$3e^{3x+1}$', isCorrect: true },
      { id: 'b', text: '$e^{3x+1}$', isCorrect: false },
      { id: 'c', text: '$(3x+1)e^{3x+1}$', isCorrect: false },
      { id: 'd', text: '$e^{3}$', isCorrect: false },
    ],
    explanation: 'Si $f(x) = e^{u(x)}$, alors $f\'(x) = u\'(x) \\cdot e^{u(x)}$. Ici $u(x) = 3x + 1$, donc $u\'(x) = 3$ et $f\'(x) = 3e^{3x+1}$. L\'erreur (b) oublie de multiplier par $u\'$. L\'erreur (c) multiplie par $u$ au lieu de $u\'$.',
    hint: 'Appliquez la formule de dérivation de $e^{u}$ : $(e^u)\' = u\' \\cdot e^u$.',
  }),

  q({
    id: 'MATH-ANA-03',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Appliquer',
    weight: 2,
    label: 'Dérivée de ln(u)',
    questionText: 'Soit $g(x) = \\ln(x^2 + 1)$. Que vaut $g\'(x)$ ?',
    options: [
      { id: 'a', text: '$\\frac{2x}{x^2 + 1}$', isCorrect: true },
      { id: 'b', text: '$\\frac{1}{x^2 + 1}$', isCorrect: false },
      { id: 'c', text: '$\\frac{2x}{x^2}$', isCorrect: false },
      { id: 'd', text: '$2x \\cdot \\ln(x^2 + 1)$', isCorrect: false },
    ],
    explanation: 'Si $g = \\ln(u)$, alors $g\' = \\frac{u\'}{u}$. Ici $u = x^2 + 1$, $u\' = 2x$, donc $g\'(x) = \\frac{2x}{x^2 + 1}$. L\'erreur (b) oublie $u\'$ au numérateur. L\'erreur (d) confond avec un produit.',
  }),

  q({
    id: 'MATH-ANA-04',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Raisonner',
    weight: 3,
    label: 'Convexité — point d\'inflexion',
    questionText: 'Soit $f(x) = x^3 - 3x^2 + 2$. En quel point la courbe de $f$ admet-elle un point d\'inflexion ?',
    options: [
      { id: 'a', text: '$x = 1$', isCorrect: true },
      { id: 'b', text: '$x = 0$', isCorrect: false },
      { id: 'c', text: '$x = 2$', isCorrect: false },
      { id: 'd', text: '$x = -1$', isCorrect: false },
    ],
    explanation: '$f\'(x) = 3x^2 - 6x$, $f\'\'(x) = 6x - 6 = 6(x - 1)$. $f\'\'(x) = 0 \\Leftrightarrow x = 1$, et $f\'\'$ change de signe en $x = 1$ (négatif avant, positif après). Donc $x = 1$ est un point d\'inflexion. L\'erreur (b) et (c) sont les zéros de $f\'$, pas de $f\'\'$.',
    hint: 'Un point d\'inflexion correspond à un changement de signe de $f\'\'$.',
  }),

  q({
    id: 'MATH-ANA-05',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Restituer',
    weight: 1,
    label: 'Primitive de cos(x)',
    questionText: 'Quelle est une primitive de $f(x) = \\cos(x)$ ?',
    options: [
      { id: 'a', text: '$\\sin(x)$', isCorrect: true },
      { id: 'b', text: '$-\\sin(x)$', isCorrect: false },
      { id: 'c', text: '$\\cos(x)$', isCorrect: false },
      { id: 'd', text: '$-\\cos(x)$', isCorrect: false },
    ],
    explanation: '$(\\sin(x))\' = \\cos(x)$, donc $\\sin(x)$ est une primitive de $\\cos(x)$. L\'erreur (b) confond avec la primitive de $\\sin(x)$ qui est $-\\cos(x)$. Confusion classique des signes en trigonométrie.',
  }),

  q({
    id: 'MATH-ANA-06',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Raisonner',
    weight: 3,
    label: 'Théorème des valeurs intermédiaires',
    questionText: 'Soit $f$ continue et strictement croissante sur $[0 ; 3]$ avec $f(0) = -2$ et $f(3) = 4$. Que peut-on affirmer ?',
    options: [
      { id: 'a', text: 'L\'équation $f(x) = 0$ admet une unique solution sur $[0 ; 3]$', isCorrect: true },
      { id: 'b', text: 'L\'équation $f(x) = 0$ admet exactement deux solutions sur $[0 ; 3]$', isCorrect: false },
      { id: 'c', text: 'On ne peut rien conclure sans connaître $f$ explicitement', isCorrect: false },
      { id: 'd', text: '$f(1) = 0$', isCorrect: false },
    ],
    explanation: 'Par le TVI, $f$ continue avec $f(0) = -2 < 0 < 4 = f(3)$, donc il existe $c \\in ]0 ; 3[$ tel que $f(c) = 0$. La stricte croissance garantit l\'unicité. L\'erreur (d) suppose que la solution est en $x = 1$, ce qu\'on ne peut pas savoir.',
  }),

  q({
    id: 'MATH-ANA-07',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Appliquer',
    weight: 2,
    label: 'Équation différentielle y\' = ay',
    questionText: 'Quelle est la solution générale de l\'équation différentielle $y\' = -2y$ ?',
    options: [
      { id: 'a', text: '$y(x) = Ce^{-2x}$, $C \\in \\mathbb{R}$', isCorrect: true },
      { id: 'b', text: '$y(x) = Ce^{2x}$, $C \\in \\mathbb{R}$', isCorrect: false },
      { id: 'c', text: '$y(x) = -2e^{x}$', isCorrect: false },
      { id: 'd', text: '$y(x) = e^{-2x}$', isCorrect: false },
    ],
    explanation: 'Les solutions de $y\' = ay$ sont $y(x) = Ce^{ax}$. Ici $a = -2$, donc $y(x) = Ce^{-2x}$. L\'erreur (b) oublie le signe. L\'erreur (d) oublie la constante $C$ (ce n\'est qu\'une solution particulière pour $C = 1$).',
  }),

  q({
    id: 'MATH-ANA-08',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Raisonner',
    weight: 3,
    label: 'Lecture graphique de convexité',
    questionText: 'Sur un graphique, la courbe de $f$ est au-dessus de toutes ses tangentes sur $[a ; b]$. Que peut-on en déduire ?',
    options: [
      { id: 'a', text: '$f$ est convexe sur $[a ; b]$', isCorrect: true },
      { id: 'b', text: '$f$ est concave sur $[a ; b]$', isCorrect: false },
      { id: 'c', text: '$f$ est croissante sur $[a ; b]$', isCorrect: false },
      { id: 'd', text: '$f\'\'(x) < 0$ sur $[a ; b]$', isCorrect: false },
    ],
    explanation: 'Une fonction convexe est au-dessus de ses tangentes ($f\'\'(x) \\geq 0$). Une fonction concave est en-dessous de ses tangentes ($f\'\'(x) \\leq 0$). L\'erreur (c) confond convexité et croissance. L\'erreur (d) donne le critère de concavité.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // D. LOGARITHME ET EXPONENTIELLE (6 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'MATH-LOGEXP-01',
    subject: 'MATHS',
    category: 'Logarithme et Exponentielle',
    competence: 'Restituer',
    weight: 1,
    label: 'Propriété algébrique de ln',
    questionText: 'Simplifier $\\ln(a) + \\ln(b)$ :',
    options: [
      { id: 'a', text: '$\\ln(ab)$', isCorrect: true },
      { id: 'b', text: '$\\ln(a + b)$', isCorrect: false },
      { id: 'c', text: '$\\ln(a) \\cdot \\ln(b)$', isCorrect: false },
      { id: 'd', text: '$\\ln(a^b)$', isCorrect: false },
    ],
    explanation: '$\\ln(a) + \\ln(b) = \\ln(ab)$. C\'est la propriété fondamentale du logarithme. L\'erreur (b) est la confusion la plus fréquente : le log d\'une somme n\'est PAS la somme des logs. L\'erreur (d) confond avec $b \\cdot \\ln(a) = \\ln(a^b)$.',
  }),

  q({
    id: 'MATH-LOGEXP-02',
    subject: 'MATHS',
    category: 'Logarithme et Exponentielle',
    competence: 'Appliquer',
    weight: 2,
    label: 'Résolution d\'équation exponentielle',
    questionText: 'Résoudre $e^{2x} = e^5$ :',
    options: [
      { id: 'a', text: '$x = \\frac{5}{2}$', isCorrect: true },
      { id: 'b', text: '$x = 5$', isCorrect: false },
      { id: 'c', text: '$x = \\ln(5)$', isCorrect: false },
      { id: 'd', text: '$x = 2 - 5 = -3$', isCorrect: false },
    ],
    explanation: '$e^{2x} = e^5 \\Leftrightarrow 2x = 5 \\Leftrightarrow x = \\frac{5}{2}$. La fonction exponentielle est bijective, donc $e^a = e^b \\Leftrightarrow a = b$. L\'erreur (b) oublie de diviser par 2. L\'erreur (c) applique $\\ln$ inutilement et confond $\\ln(e^5) = 5$ avec $\\ln(5)$.',
  }),

  q({
    id: 'MATH-LOGEXP-03',
    subject: 'MATHS',
    category: 'Logarithme et Exponentielle',
    competence: 'Appliquer',
    weight: 2,
    label: 'Résolution d\'équation logarithmique',
    questionText: 'Résoudre $\\ln(x) = 3$ :',
    options: [
      { id: 'a', text: '$x = e^3$', isCorrect: true },
      { id: 'b', text: '$x = 3$', isCorrect: false },
      { id: 'c', text: '$x = \\ln(3)$', isCorrect: false },
      { id: 'd', text: '$x = 3e$', isCorrect: false },
    ],
    explanation: '$\\ln(x) = 3 \\Leftrightarrow x = e^3 \\approx 20{,}09$. L\'erreur (b) confond $\\ln(x) = 3$ avec $x = 3$. L\'erreur (c) applique $\\ln$ au lieu de $\\exp$.',
  }),

  q({
    id: 'MATH-LOGEXP-04',
    subject: 'MATHS',
    category: 'Logarithme et Exponentielle',
    competence: 'Raisonner',
    weight: 3,
    label: 'Limite avec forme indéterminée',
    questionText: 'Que vaut $\\lim_{x \\to +\\infty} \\frac{e^x}{x^2}$ ?',
    options: [
      { id: 'a', text: '$+\\infty$', isCorrect: true },
      { id: 'b', text: '$0$', isCorrect: false },
      { id: 'c', text: '$1$', isCorrect: false },
      { id: 'd', text: 'La limite n\'existe pas', isCorrect: false },
    ],
    explanation: 'C\'est un résultat de croissance comparée : l\'exponentielle l\'emporte toujours sur tout polynôme. $\\lim_{x \\to +\\infty} \\frac{e^x}{x^n} = +\\infty$ pour tout $n$. L\'erreur (b) inverserait le rapport de domination.',
    hint: 'Croissance comparée : l\'exponentielle croît plus vite que toute puissance de $x$.',
  }),

  q({
    id: 'MATH-LOGEXP-05',
    subject: 'MATHS',
    category: 'Logarithme et Exponentielle',
    competence: 'Raisonner',
    weight: 3,
    label: 'Limite ln(x)/x',
    questionText: 'Que vaut $\\lim_{x \\to +\\infty} \\frac{\\ln(x)}{x}$ ?',
    options: [
      { id: 'a', text: '$0$', isCorrect: true },
      { id: 'b', text: '$+\\infty$', isCorrect: false },
      { id: 'c', text: '$1$', isCorrect: false },
      { id: 'd', text: '$-\\infty$', isCorrect: false },
    ],
    explanation: 'Croissance comparée : $\\ln(x)$ croît beaucoup plus lentement que $x$. Donc $\\frac{\\ln(x)}{x} \\to 0$. L\'erreur (b) suppose que les deux tendent vers $+\\infty$ donc le quotient aussi, ce qui est faux (forme indéterminée $\\frac{\\infty}{\\infty}$).',
  }),

  q({
    id: 'MATH-LOGEXP-06',
    subject: 'MATHS',
    category: 'Logarithme et Exponentielle',
    competence: 'Restituer',
    weight: 1,
    label: 'Simplification exp/ln',
    questionText: 'Simplifier $e^{\\ln(7)}$ :',
    options: [
      { id: 'a', text: '$7$', isCorrect: true },
      { id: 'b', text: '$\\ln(7)$', isCorrect: false },
      { id: 'c', text: '$7e$', isCorrect: false },
      { id: 'd', text: '$e^7$', isCorrect: false },
    ],
    explanation: '$e^{\\ln(a)} = a$ pour tout $a > 0$. Les fonctions $\\exp$ et $\\ln$ sont réciproques l\'une de l\'autre. L\'erreur (d) confond $e^{\\ln(7)}$ avec $e^7$.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // E. PROBABILITÉS — Succession d'épreuves (4 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'MATH-PROB-01',
    subject: 'MATHS',
    category: 'Probabilités',
    competence: 'Restituer',
    weight: 1,
    label: 'Schéma de Bernoulli — identification',
    questionText: 'On lance un dé truqué 8 fois. À chaque lancer, la probabilité d\'obtenir 6 est $p = 0{,}2$. Quelle loi suit le nombre de 6 obtenus ?',
    options: [
      { id: 'a', text: 'Loi binomiale $\\mathcal{B}(8 ; 0{,}2)$', isCorrect: true },
      { id: 'b', text: 'Loi binomiale $\\mathcal{B}(6 ; 0{,}2)$', isCorrect: false },
      { id: 'c', text: 'Loi uniforme sur $\\{1 ; 2 ; ... ; 6\\}$', isCorrect: false },
      { id: 'd', text: 'Loi binomiale $\\mathcal{B}(8 ; \\frac{1}{6})$', isCorrect: false },
    ],
    explanation: 'On répète 8 fois une épreuve de Bernoulli de paramètre $p = 0{,}2$. Le nombre de succès suit $\\mathcal{B}(n ; p) = \\mathcal{B}(8 ; 0{,}2)$. L\'erreur (b) confond $n = 8$ (nombre de lancers) avec la face 6. L\'erreur (d) utilise $p = \\frac{1}{6}$ (dé non truqué).',
  }),

  q({
    id: 'MATH-PROB-02',
    subject: 'MATHS',
    category: 'Probabilités',
    competence: 'Appliquer',
    weight: 2,
    label: 'Calcul P(X = k) — loi binomiale',
    questionText: 'Soit $X \\sim \\mathcal{B}(5 ; 0{,}4)$. Que vaut $P(X = 2)$ ?',
    options: [
      { id: 'a', text: '$\\binom{5}{2} \\times 0{,}4^2 \\times 0{,}6^3$', isCorrect: true },
      { id: 'b', text: '$\\binom{5}{2} \\times 0{,}4^2 \\times 0{,}4^3$', isCorrect: false },
      { id: 'c', text: '$0{,}4^2 \\times 0{,}6^3$', isCorrect: false },
      { id: 'd', text: '$\\binom{5}{2} \\times 0{,}4^2$', isCorrect: false },
    ],
    explanation: '$P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}$. Ici : $\\binom{5}{2} \\times 0{,}4^2 \\times 0{,}6^3 = 10 \\times 0{,}16 \\times 0{,}216 = 0{,}3456$. L\'erreur (b) utilise $0{,}4^3$ au lieu de $0{,}6^3$ (oubli du complément). L\'erreur (c) oublie le coefficient binomial.',
    hint: 'Formule : $P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}$.',
  }),

  q({
    id: 'MATH-PROB-03',
    subject: 'MATHS',
    category: 'Probabilités',
    competence: 'Appliquer',
    weight: 2,
    label: 'Espérance et variance — loi binomiale',
    questionText: 'Soit $X \\sim \\mathcal{B}(20 ; 0{,}3)$. Que valent $E(X)$ et $V(X)$ ?',
    options: [
      { id: 'a', text: '$E(X) = 6$ et $V(X) = 4{,}2$', isCorrect: true },
      { id: 'b', text: '$E(X) = 6$ et $V(X) = 6$', isCorrect: false },
      { id: 'c', text: '$E(X) = 0{,}3$ et $V(X) = 0{,}21$', isCorrect: false },
      { id: 'd', text: '$E(X) = 14$ et $V(X) = 4{,}2$', isCorrect: false },
    ],
    explanation: '$E(X) = np = 20 \\times 0{,}3 = 6$. $V(X) = np(1-p) = 20 \\times 0{,}3 \\times 0{,}7 = 4{,}2$. L\'erreur (b) confond $V(X)$ avec $E(X)$. L\'erreur (d) utilise $n(1-p) = 14$ pour l\'espérance.',
  }),

  q({
    id: 'MATH-PROB-04',
    subject: 'MATHS',
    category: 'Probabilités',
    competence: 'Raisonner',
    weight: 3,
    label: 'Indépendance d\'événements',
    questionText: 'Deux événements $A$ et $B$ sont indépendants avec $P(A) = 0{,}5$ et $P(B) = 0{,}3$. Que vaut $P(A \\cup B)$ ?',
    options: [
      { id: 'a', text: '$0{,}65$', isCorrect: true },
      { id: 'b', text: '$0{,}8$', isCorrect: false },
      { id: 'c', text: '$0{,}15$', isCorrect: false },
      { id: 'd', text: '$0{,}5$', isCorrect: false },
    ],
    explanation: '$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$. Par indépendance, $P(A \\cap B) = P(A) \\times P(B) = 0{,}15$. Donc $P(A \\cup B) = 0{,}5 + 0{,}3 - 0{,}15 = 0{,}65$. L\'erreur (b) = $0{,}5 + 0{,}3$ (oubli de soustraire l\'intersection). L\'erreur (c) = $P(A \\cap B)$ seulement.',
    hint: 'Utilisez la formule $P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$ et l\'indépendance.',
  }),
];

// ─── NSI Questions ───────────────────────────────────────────────────────────

export const NSI_QUESTIONS: StageQuestion[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // A. STRUCTURES DE DONNÉES & POO (7 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'NSI-POO-01',
    subject: 'NSI',
    category: 'POO',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'syntax',
    label: 'Méthode __init__ en Python',
    questionText: 'Quel est le rôle de la méthode `__init__` dans une classe Python ?',
    options: [
      { id: 'a', text: 'C\'est le constructeur : elle initialise les attributs d\'une nouvelle instance', isCorrect: true },
      { id: 'b', text: 'Elle détruit l\'objet quand il n\'est plus utilisé', isCorrect: false },
      { id: 'c', text: 'Elle affiche l\'objet sous forme de chaîne de caractères', isCorrect: false },
      { id: 'd', text: 'Elle est appelée quand on compare deux objets', isCorrect: false },
    ],
    explanation: '`__init__` est le constructeur de la classe. Elle est automatiquement appelée lors de la création d\'un objet avec `MaClasse()`. L\'erreur (b) décrit `__del__`. L\'erreur (c) décrit `__str__` ou `__repr__`. L\'erreur (d) décrit `__eq__`.',
  }),

  q({
    id: 'NSI-POO-02',
    subject: 'NSI',
    category: 'POO',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'syntax',
    label: 'Création d\'instance — attributs',
    questionText: 'On a la classe suivante :\n```python\nclass Eleve:\n    def __init__(self, nom, moyenne):\n        self.nom = nom\n        self.moyenne = moyenne\n```\nQue vaut `e.moyenne` après `e = Eleve("Alice", 15.5)` ?',
    options: [
      { id: 'a', text: '15.5', isCorrect: true },
      { id: 'b', text: '"Alice"', isCorrect: false },
      { id: 'c', text: 'None', isCorrect: false },
      { id: 'd', text: 'Erreur : il manque self dans l\'appel', isCorrect: false },
    ],
    explanation: 'Lors de l\'appel `Eleve("Alice", 15.5)`, Python passe automatiquement l\'instance comme premier argument (`self`). Donc `self.nom = "Alice"` et `self.moyenne = 15.5`. L\'erreur (d) est fausse : `self` n\'est jamais passé explicitement à l\'appel.',
  }),

  q({
    id: 'NSI-POO-03',
    subject: 'NSI',
    category: 'POO',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'conceptual',
    label: 'Vocabulaire POO — encapsulation',
    questionText: 'En POO, l\'encapsulation consiste à :',
    options: [
      { id: 'a', text: 'Regrouper les données et les méthodes qui les manipulent dans un même objet, en contrôlant l\'accès', isCorrect: true },
      { id: 'b', text: 'Créer une classe enfant qui hérite d\'une classe parent', isCorrect: false },
      { id: 'c', text: 'Définir plusieurs méthodes avec le même nom mais des paramètres différents', isCorrect: false },
      { id: 'd', text: 'Transformer un objet en chaîne de caractères', isCorrect: false },
    ],
    explanation: 'L\'encapsulation regroupe données (attributs) et traitements (méthodes) dans un objet, en cachant les détails internes. L\'erreur (b) décrit l\'héritage. L\'erreur (c) décrit le polymorphisme (ou surcharge).',
  }),

  q({
    id: 'NSI-STRUCT-01',
    subject: 'NSI',
    category: 'Structures de données',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'conceptual',
    label: 'Pile vs File — LIFO/FIFO',
    questionText: 'On empile successivement 1, 2, 3 dans une Pile (LIFO). Quel élément est dépilé en premier ?',
    options: [
      { id: 'a', text: '3', isCorrect: true },
      { id: 'b', text: '1', isCorrect: false },
      { id: 'c', text: '2', isCorrect: false },
      { id: 'd', text: 'Cela dépend de l\'implémentation', isCorrect: false },
    ],
    explanation: 'LIFO = Last In, First Out. Le dernier élément empilé (3) est le premier dépilé. L\'erreur (b) correspond au comportement d\'une File (FIFO = First In, First Out). C\'est la confusion la plus fréquente entre Pile et File.',
  }),

  q({
    id: 'NSI-STRUCT-02',
    subject: 'NSI',
    category: 'Structures de données',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'logic',
    label: 'Parcours d\'arbre binaire — infixe',
    questionText: 'Soit l\'arbre binaire :\n```\n      5\n     / \\\n    3   7\n   / \\   \\\n  1   4   9\n```\nQuel est le parcours infixe (gauche, racine, droite) ?',
    options: [
      { id: 'a', text: '1, 3, 4, 5, 7, 9', isCorrect: true },
      { id: 'b', text: '5, 3, 1, 4, 7, 9', isCorrect: false },
      { id: 'c', text: '1, 4, 3, 9, 7, 5', isCorrect: false },
      { id: 'd', text: '5, 3, 7, 1, 4, 9', isCorrect: false },
    ],
    explanation: 'Parcours infixe (GRD) : on visite le sous-arbre gauche, puis la racine, puis le sous-arbre droit. Résultat : 1, 3, 4, 5, 7, 9 (trié car c\'est un ABR). L\'erreur (b) est le parcours préfixe (RGD). L\'erreur (c) est le parcours suffixe (GDR). L\'erreur (d) est le parcours en largeur.',
    hint: 'Infixe = Gauche → Racine → Droite. Appliquez récursivement.',
  }),

  q({
    id: 'NSI-STRUCT-03',
    subject: 'NSI',
    category: 'Structures de données',
    competence: 'Raisonner',
    weight: 3,
    nsiErrorType: 'conceptual',
    label: 'ABR — complexité de recherche',
    questionText: 'Quelle est la complexité de la recherche d\'un élément dans un Arbre Binaire de Recherche (ABR) équilibré de $n$ nœuds ?',
    options: [
      { id: 'a', text: '$O(\\log n)$', isCorrect: true },
      { id: 'b', text: '$O(n)$', isCorrect: false },
      { id: 'c', text: '$O(n \\log n)$', isCorrect: false },
      { id: 'd', text: '$O(1)$', isCorrect: false },
    ],
    explanation: 'Dans un ABR équilibré, la hauteur est $O(\\log n)$. À chaque étape, on élimine la moitié de l\'arbre (comme une dichotomie). L\'erreur (b) est la complexité dans le pire cas d\'un ABR dégénéré (liste chaînée). L\'erreur (d) serait un accès direct (table de hachage).',
  }),

  q({
    id: 'NSI-STRUCT-04',
    subject: 'NSI',
    category: 'Structures de données',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'logic',
    label: 'Arbre binaire — hauteur et taille',
    questionText: 'Un arbre binaire a 7 nœuds et est complet (tous les niveaux sont remplis). Quelle est sa hauteur (nombre de niveaux - 1) ?',
    options: [
      { id: 'a', text: '2', isCorrect: true },
      { id: 'b', text: '3', isCorrect: false },
      { id: 'c', text: '7', isCorrect: false },
      { id: 'd', text: '6', isCorrect: false },
    ],
    explanation: 'Un arbre binaire complet de hauteur $h$ a $2^{h+1} - 1$ nœuds. Pour 7 nœuds : $2^{h+1} - 1 = 7 \\Rightarrow 2^{h+1} = 8 \\Rightarrow h = 2$. Niveaux : racine (1 nœud) + niveau 1 (2 nœuds) + niveau 2 (4 nœuds) = 7. L\'erreur (c) confond taille et hauteur.',
    hint: 'Un arbre complet de hauteur $h$ contient $2^{h+1} - 1$ nœuds.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // B. BASES DE DONNÉES — SQL (5 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'NSI-SQL-01',
    subject: 'NSI',
    category: 'Données',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'conceptual',
    label: 'Clé primaire — définition',
    questionText: 'Dans une base de données relationnelle, une clé primaire est :',
    options: [
      { id: 'a', text: 'Un attribut (ou ensemble d\'attributs) qui identifie de manière unique chaque enregistrement d\'une table', isCorrect: true },
      { id: 'b', text: 'Un attribut qui fait référence à la clé primaire d\'une autre table', isCorrect: false },
      { id: 'c', text: 'Le premier attribut déclaré dans la table', isCorrect: false },
      { id: 'd', text: 'Un attribut qui ne peut jamais être modifié', isCorrect: false },
    ],
    explanation: 'La clé primaire identifie de manière unique chaque ligne. Elle est non nulle et unique. L\'erreur (b) décrit une clé étrangère. L\'erreur (c) est fausse : la position dans la déclaration n\'a aucun rapport avec la clé primaire.',
  }),

  q({
    id: 'NSI-SQL-02',
    subject: 'NSI',
    category: 'Données',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'syntax',
    label: 'Requête SELECT avec filtre',
    questionText: 'Quelle requête SQL retourne les élèves de Terminale triés par nom ?',
    options: [
      { id: 'a', text: 'SELECT * FROM eleves WHERE classe = \'Terminale\' ORDER BY nom', isCorrect: true },
      { id: 'b', text: 'SELECT * FROM eleves WHERE classe = \'Terminale\' GROUP BY nom', isCorrect: false },
      { id: 'c', text: 'SELECT * FROM eleves ORDER BY nom WHERE classe = \'Terminale\'', isCorrect: false },
      { id: 'd', text: 'SELECT nom FROM eleves HAVING classe = \'Terminale\'', isCorrect: false },
    ],
    explanation: 'L\'ordre correct est SELECT → FROM → WHERE → ORDER BY. L\'erreur (b) utilise GROUP BY qui sert à l\'agrégation, pas au tri. L\'erreur (c) inverse WHERE et ORDER BY (erreur de syntaxe). L\'erreur (d) utilise HAVING qui ne s\'emploie qu\'après GROUP BY.',
  }),

  q({
    id: 'NSI-SQL-03',
    subject: 'NSI',
    category: 'Données',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'syntax',
    label: 'Jointure SQL — JOIN',
    questionText: 'On a deux tables : `eleves(id, nom, classe_id)` et `classes(id, nom_classe)`. Quelle requête affiche le nom de chaque élève avec le nom de sa classe ?',
    options: [
      { id: 'a', text: 'SELECT eleves.nom, classes.nom_classe FROM eleves JOIN classes ON eleves.classe_id = classes.id', isCorrect: true },
      { id: 'b', text: 'SELECT eleves.nom, classes.nom_classe FROM eleves, classes', isCorrect: false },
      { id: 'c', text: 'SELECT eleves.nom, classes.nom_classe FROM eleves JOIN classes ON eleves.id = classes.id', isCorrect: false },
      { id: 'd', text: 'SELECT nom, nom_classe FROM eleves WHERE classe_id = classes.id', isCorrect: false },
    ],
    explanation: 'La jointure relie `eleves.classe_id` à `classes.id` (clé étrangère → clé primaire). L\'erreur (b) fait un produit cartésien (toutes les combinaisons). L\'erreur (c) joint sur `eleves.id = classes.id` (mauvaise colonne). L\'erreur (d) a une syntaxe invalide (classes non déclarée dans FROM).',
    hint: 'La condition de jointure relie la clé étrangère à la clé primaire.',
  }),

  q({
    id: 'NSI-SQL-04',
    subject: 'NSI',
    category: 'Données',
    competence: 'Raisonner',
    weight: 3,
    nsiErrorType: 'conceptual',
    label: 'Contrainte d\'intégrité référentielle',
    questionText: 'La table `notes` a une clé étrangère `eleve_id` qui référence `eleves(id)`. Que se passe-t-il si on essaie d\'insérer une note avec `eleve_id = 999` alors qu\'aucun élève n\'a l\'id 999 ?',
    options: [
      { id: 'a', text: 'L\'insertion est refusée : violation de la contrainte d\'intégrité référentielle', isCorrect: true },
      { id: 'b', text: 'L\'insertion réussit et un élève avec id 999 est automatiquement créé', isCorrect: false },
      { id: 'c', text: 'L\'insertion réussit mais `eleve_id` est mis à NULL', isCorrect: false },
      { id: 'd', text: 'L\'insertion réussit normalement', isCorrect: false },
    ],
    explanation: 'La contrainte d\'intégrité référentielle garantit que toute clé étrangère pointe vers un enregistrement existant. Si l\'élève 999 n\'existe pas, l\'insertion est refusée avec une erreur. La base de données ne crée jamais automatiquement l\'enregistrement référencé.',
  }),

  q({
    id: 'NSI-SQL-05',
    subject: 'NSI',
    category: 'Données',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'syntax',
    label: 'UPDATE — modification de données',
    questionText: 'Quelle requête SQL met à jour la moyenne de l\'élève dont l\'id est 42 à 16.5 ?',
    options: [
      { id: 'a', text: 'UPDATE eleves SET moyenne = 16.5 WHERE id = 42', isCorrect: true },
      { id: 'b', text: 'UPDATE eleves WHERE id = 42 SET moyenne = 16.5', isCorrect: false },
      { id: 'c', text: 'SET eleves.moyenne = 16.5 WHERE id = 42', isCorrect: false },
      { id: 'd', text: 'UPDATE eleves SET moyenne = 16.5', isCorrect: false },
    ],
    explanation: 'La syntaxe est UPDATE table SET colonne = valeur WHERE condition. L\'erreur (b) inverse SET et WHERE. L\'erreur (c) n\'est pas du SQL valide. L\'erreur (d) oublie le WHERE : elle modifierait TOUS les élèves (erreur très dangereuse en pratique).',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // C. ALGORITHMIQUE & PROGRAMMATION (5 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'NSI-ALGO-01',
    subject: 'NSI',
    category: 'Algorithmique',
    competence: 'Raisonner',
    weight: 3,
    nsiErrorType: 'logic',
    label: 'Complexité — tri par insertion',
    questionText: 'Quelle est la complexité temporelle dans le pire cas du tri par insertion sur un tableau de $n$ éléments ?',
    options: [
      { id: 'a', text: '$O(n^2)$', isCorrect: true },
      { id: 'b', text: '$O(n \\log n)$', isCorrect: false },
      { id: 'c', text: '$O(n)$', isCorrect: false },
      { id: 'd', text: '$O(\\log n)$', isCorrect: false },
    ],
    explanation: 'Le tri par insertion a une complexité $O(n^2)$ dans le pire cas (tableau trié en ordre inverse : chaque élément doit être déplacé jusqu\'au début). L\'erreur (c) est la complexité du meilleur cas (tableau déjà trié). L\'erreur (b) est la complexité du tri fusion.',
  }),

  q({
    id: 'NSI-ALGO-02',
    subject: 'NSI',
    category: 'Algorithmique',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'logic',
    label: 'Récursivité — trace d\'exécution',
    questionText: 'Que retourne `f(4)` pour la fonction suivante ?\n```python\ndef f(n):\n    if n <= 1:\n        return 1\n    return f(n-1) + f(n-2)\n```',
    options: [
      { id: 'a', text: '5', isCorrect: true },
      { id: 'b', text: '4', isCorrect: false },
      { id: 'c', text: '8', isCorrect: false },
      { id: 'd', text: '3', isCorrect: false },
    ],
    explanation: 'C\'est la suite de Fibonacci. f(1)=1, f(2)=f(1)+f(0)=1+1=2, f(3)=f(2)+f(1)=2+1=3, f(4)=f(3)+f(2)=3+2=5. L\'erreur (b) confond avec f(n) = n. L\'erreur (c) confond avec $2^n$. L\'erreur (d) = f(3), pas f(4).',
    hint: 'Déroulez les appels récursifs pas à pas en partant de f(1) et f(0).',
  }),

  q({
    id: 'NSI-ALGO-03',
    subject: 'NSI',
    category: 'Algorithmique',
    competence: 'Raisonner',
    weight: 3,
    nsiErrorType: 'logic',
    label: 'Récursivité — Stack Overflow',
    questionText: 'Quelle fonction Python provoque une erreur `RecursionError` (dépassement de la pile d\'appels) ?',
    options: [
      { id: 'a', text: 'def f(n): return f(n-1) + 1', isCorrect: true },
      { id: 'b', text: 'def f(n):\n  if n == 0: return 0\n  return f(n-1) + 1', isCorrect: false },
      { id: 'c', text: 'def f(n):\n  if n <= 0: return 0\n  return n + f(n-1)', isCorrect: false },
      { id: 'd', text: 'def f(n): return n * 2', isCorrect: false },
    ],
    explanation: '(a) n\'a pas de cas de base : f(n) appelle f(n-1) indéfiniment → RecursionError. (b) et (c) ont un cas de base qui arrête la récursion. (d) n\'est pas récursive du tout. L\'absence de cas de base est la cause n°1 de Stack Overflow en récursivité.',
  }),

  q({
    id: 'NSI-ALGO-04',
    subject: 'NSI',
    category: 'Algorithmique',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'logic',
    label: 'Diviser pour régner — dichotomie',
    questionText: 'On cherche la valeur 7 dans le tableau trié `[1, 3, 5, 7, 9, 11, 13]` par recherche dichotomique. Combien de comparaisons sont nécessaires au maximum ?',
    options: [
      { id: 'a', text: '3', isCorrect: true },
      { id: 'b', text: '7', isCorrect: false },
      { id: 'c', text: '4', isCorrect: false },
      { id: 'd', text: '1', isCorrect: false },
    ],
    explanation: 'Avec 7 éléments, la recherche dichotomique fait au maximum $\\lceil \\log_2(7) \\rceil = 3$ comparaisons. Étape 1 : milieu = 7 (trouvé !). Mais dans le pire cas, on divise 3 fois : 7→3→1. L\'erreur (b) = recherche linéaire (parcours complet). L\'erreur (d) suppose qu\'on tombe toujours sur le bon élément.',
    hint: 'À chaque étape, on divise l\'espace de recherche par 2.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // D. ARCHITECTURES & RÉSEAUX (4 questions)
  // ═══════════════════════════════════════════════════════════════════════════

  q({
    id: 'NSI-NET-01',
    subject: 'NSI',
    category: 'Architecture',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'conceptual',
    label: 'Routage — principe',
    questionText: 'Dans un réseau, le routage consiste à :',
    options: [
      { id: 'a', text: 'Déterminer le chemin que doivent emprunter les paquets pour aller d\'une source à une destination', isCorrect: true },
      { id: 'b', text: 'Chiffrer les données avant de les envoyer sur le réseau', isCorrect: false },
      { id: 'c', text: 'Attribuer une adresse IP à chaque machine du réseau', isCorrect: false },
      { id: 'd', text: 'Vérifier que les paquets arrivent sans erreur', isCorrect: false },
    ],
    explanation: 'Le routage détermine le meilleur chemin pour acheminer les paquets à travers le réseau. L\'erreur (b) décrit le chiffrement. L\'erreur (c) décrit le protocole DHCP. L\'erreur (d) décrit le contrôle d\'intégrité (checksum, TCP).',
  }),

  q({
    id: 'NSI-NET-02',
    subject: 'NSI',
    category: 'Architecture',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'conceptual',
    label: 'Protocoles de routage — RIP vs OSPF',
    questionText: 'Le protocole RIP choisit le meilleur chemin en se basant sur :',
    options: [
      { id: 'a', text: 'Le nombre de sauts (routeurs traversés)', isCorrect: true },
      { id: 'b', text: 'La bande passante des liens', isCorrect: false },
      { id: 'c', text: 'Le temps de réponse (latence)', isCorrect: false },
      { id: 'd', text: 'L\'adresse IP de destination', isCorrect: false },
    ],
    explanation: 'RIP (Routing Information Protocol) utilise le nombre de sauts comme métrique (max 15). L\'erreur (b) décrit OSPF qui utilise le coût basé sur la bande passante. RIP est plus simple mais moins optimal que OSPF pour les grands réseaux.',
    hint: 'RIP = distance en nombre de routeurs. OSPF = coût basé sur le débit.',
  }),

  q({
    id: 'NSI-NET-03',
    subject: 'NSI',
    category: 'Architecture',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'conceptual',
    label: 'Chiffrement — clé publique/privée',
    questionText: 'Dans le chiffrement asymétrique, pour envoyer un message confidentiel à Alice :',
    options: [
      { id: 'a', text: 'On chiffre avec la clé publique d\'Alice, elle déchiffre avec sa clé privée', isCorrect: true },
      { id: 'b', text: 'On chiffre avec la clé privée d\'Alice, elle déchiffre avec sa clé publique', isCorrect: false },
      { id: 'c', text: 'On chiffre avec sa propre clé privée, Alice déchiffre avec sa propre clé privée', isCorrect: false },
      { id: 'd', text: 'On utilise la même clé partagée pour chiffrer et déchiffrer', isCorrect: false },
    ],
    explanation: 'En chiffrement asymétrique : la clé publique chiffre, la clé privée déchiffre. Pour envoyer à Alice, on utilise sa clé publique (connue de tous). Seule Alice peut déchiffrer avec sa clé privée (secrète). L\'erreur (b) inverse les rôles (c\'est le principe de la signature, pas du chiffrement). L\'erreur (d) décrit le chiffrement symétrique.',
  }),

  q({
    id: 'NSI-NET-04',
    subject: 'NSI',
    category: 'Architecture',
    competence: 'Raisonner',
    weight: 3,
    nsiErrorType: 'conceptual',
    label: 'Processus — interblocage (deadlock)',
    questionText: 'Deux processus P1 et P2 sont en interblocage (deadlock). Quelle situation décrit le mieux ce phénomène ?',
    options: [
      { id: 'a', text: 'P1 attend une ressource détenue par P2, et P2 attend une ressource détenue par P1 : aucun ne peut avancer', isCorrect: true },
      { id: 'b', text: 'P1 et P2 s\'exécutent en parallèle sans problème', isCorrect: false },
      { id: 'c', text: 'P1 termine avant P2 car il a une priorité plus élevée', isCorrect: false },
      { id: 'd', text: 'P1 et P2 accèdent à la même ressource en même temps sans conflit', isCorrect: false },
    ],
    explanation: 'L\'interblocage (deadlock) survient quand deux processus s\'attendent mutuellement : chacun détient une ressource dont l\'autre a besoin. Aucun ne peut progresser. Les 4 conditions de Coffman doivent être réunies : exclusion mutuelle, détention et attente, non-préemption, attente circulaire.',
  }),
];

// ─── Combined Question Bank ──────────────────────────────────────────────────

/** All stage questions (Maths + NSI) — ready for computeStageScore() */
export const ALL_STAGE_QUESTIONS: StageQuestion[] = [
  ...MATHS_QUESTIONS,
  ...NSI_QUESTIONS,
];

/** Question count summary */
export const QUESTION_STATS = {
  total: ALL_STAGE_QUESTIONS.length,
  maths: MATHS_QUESTIONS.length,
  nsi: NSI_QUESTIONS.length,
  byCategory: Object.entries(
    ALL_STAGE_QUESTIONS.reduce<Record<string, number>>((acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([category, count]) => ({ category, count })),
  byWeight: {
    basic: ALL_STAGE_QUESTIONS.filter((q) => q.weight === 1).length,
    intermediate: ALL_STAGE_QUESTIONS.filter((q) => q.weight === 2).length,
    expert: ALL_STAGE_QUESTIONS.filter((q) => q.weight === 3).length,
  },
} as const;
