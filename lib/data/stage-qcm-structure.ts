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
  // ── Analyse ──────────────────────────────────────────────────────────────

  q({
    id: 'MATH-ANA-01',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Restituer',
    weight: 1,
    label: 'Dérivée de x²',
    questionText: 'Quelle est la dérivée de f(x) = x² ?',
    options: [
      { id: 'a', text: 'f\'(x) = 2x', isCorrect: true },
      { id: 'b', text: 'f\'(x) = x', isCorrect: false },
      { id: 'c', text: 'f\'(x) = 2x²', isCorrect: false },
      { id: 'd', text: 'f\'(x) = x²', isCorrect: false },
    ],
    explanation: 'La dérivée de xⁿ est n·xⁿ⁻¹. Donc pour x², on obtient 2·x¹ = 2x.',
  }),

  q({
    id: 'MATH-ANA-02',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Appliquer',
    weight: 2,
    label: 'Tableau de variation',
    questionText: 'Soit f(x) = x³ - 3x. Sur quel intervalle f est-elle décroissante ?',
    options: [
      { id: 'a', text: ']-∞ ; -1[', isCorrect: false },
      { id: 'b', text: '[-1 ; 1]', isCorrect: true },
      { id: 'c', text: ']1 ; +∞[', isCorrect: false },
      { id: 'd', text: ']-∞ ; 0[', isCorrect: false },
    ],
    explanation: 'f\'(x) = 3x² - 3 = 3(x² - 1) = 3(x-1)(x+1). f\'(x) < 0 sur ]-1 ; 1[, donc f est décroissante sur [-1 ; 1].',
    hint: 'Calculez f\'(x) et cherchez où elle est négative.',
  }),

  q({
    id: 'MATH-ANA-03',
    subject: 'MATHS',
    category: 'Analyse',
    competence: 'Raisonner',
    weight: 3,
    label: 'Théorème des valeurs intermédiaires',
    questionText: 'Soit f continue sur [0 ; 2] avec f(0) = -1 et f(2) = 3. Que peut-on affirmer ?',
    options: [
      { id: 'a', text: 'f admet un maximum sur [0 ; 2]', isCorrect: false },
      { id: 'b', text: 'Il existe c ∈ ]0 ; 2[ tel que f(c) = 0', isCorrect: true },
      { id: 'c', text: 'f est croissante sur [0 ; 2]', isCorrect: false },
      { id: 'd', text: 'f(1) = 1', isCorrect: false },
    ],
    explanation: 'Par le TVI, f continue sur [0;2] avec f(0)=-1 < 0 < 3=f(2), donc il existe c ∈ ]0;2[ tel que f(c)=0. On ne peut rien dire sur la monotonie ni la valeur exacte en x=1.',
  }),

  // ── Algèbre ──────────────────────────────────────────────────────────────

  q({
    id: 'MATH-ALG-01',
    subject: 'MATHS',
    category: 'Algèbre',
    competence: 'Restituer',
    weight: 1,
    label: 'Suite arithmétique — formule explicite',
    questionText: 'Soit (uₙ) une suite arithmétique de raison r = 3 et u₀ = 2. Que vaut u₁₀ ?',
    options: [
      { id: 'a', text: '32', isCorrect: true },
      { id: 'b', text: '30', isCorrect: false },
      { id: 'c', text: '33', isCorrect: false },
      { id: 'd', text: '35', isCorrect: false },
    ],
    explanation: 'uₙ = u₀ + n·r = 2 + 10×3 = 32.',
  }),

  q({
    id: 'MATH-ALG-02',
    subject: 'MATHS',
    category: 'Algèbre',
    competence: 'Appliquer',
    weight: 2,
    label: 'Suite géométrique — somme',
    questionText: 'Calculer S = 1 + 2 + 4 + 8 + ... + 2⁹ (somme des 10 premiers termes de la suite géométrique de raison 2).',
    options: [
      { id: 'a', text: '1023', isCorrect: true },
      { id: 'b', text: '1024', isCorrect: false },
      { id: 'c', text: '512', isCorrect: false },
      { id: 'd', text: '2046', isCorrect: false },
    ],
    explanation: 'S = (2¹⁰ - 1)/(2 - 1) = 1024 - 1 = 1023. Attention : 2¹⁰ = 1024 mais la somme est 1023.',
  }),

  q({
    id: 'MATH-ALG-03',
    subject: 'MATHS',
    category: 'Algèbre',
    competence: 'Raisonner',
    weight: 3,
    label: 'Récurrence',
    questionText: 'On veut montrer par récurrence que pour tout n ≥ 1, 1 + 2 + ... + n = n(n+1)/2. Quelle est l\'hypothèse de récurrence au rang k ?',
    options: [
      { id: 'a', text: '1 + 2 + ... + k = k(k+1)/2', isCorrect: true },
      { id: 'b', text: '1 + 2 + ... + (k+1) = (k+1)(k+2)/2', isCorrect: false },
      { id: 'c', text: 'k = k(k+1)/2', isCorrect: false },
      { id: 'd', text: '1 + 2 + ... + n = n(n+1)/2 pour tout n', isCorrect: false },
    ],
    explanation: 'L\'hypothèse de récurrence au rang k suppose que la propriété est vraie pour n=k. L\'option (b) est ce qu\'on veut démontrer (rang k+1), pas l\'hypothèse. L\'option (d) est la conclusion finale, pas l\'hypothèse.',
  }),

  // ── Probabilités ─────────────────────────────────────────────────────────

  q({
    id: 'MATH-PROB-01',
    subject: 'MATHS',
    category: 'Probabilités',
    competence: 'Restituer',
    weight: 1,
    label: 'Probabilité conditionnelle — définition',
    questionText: 'Quelle est la formule de P(A|B) ?',
    options: [
      { id: 'a', text: 'P(A∩B) / P(B)', isCorrect: true },
      { id: 'b', text: 'P(A) × P(B)', isCorrect: false },
      { id: 'c', text: 'P(A∪B) / P(B)', isCorrect: false },
      { id: 'd', text: 'P(A) / P(B)', isCorrect: false },
    ],
    explanation: 'P(A|B) = P(A∩B) / P(B), avec P(B) ≠ 0. C\'est la probabilité de A sachant que B est réalisé.',
  }),

  q({
    id: 'MATH-PROB-02',
    subject: 'MATHS',
    category: 'Probabilités',
    competence: 'Appliquer',
    weight: 2,
    label: 'Loi binomiale',
    questionText: 'X suit une loi binomiale B(10, 0.3). Que vaut E(X) ?',
    options: [
      { id: 'a', text: '3', isCorrect: true },
      { id: 'b', text: '0.3', isCorrect: false },
      { id: 'c', text: '7', isCorrect: false },
      { id: 'd', text: '2.1', isCorrect: false },
    ],
    explanation: 'Pour X ~ B(n, p), E(X) = n × p = 10 × 0.3 = 3.',
  }),

  // ── Géométrie ────────────────────────────────────────────────────────────

  q({
    id: 'MATH-GEO-01',
    subject: 'MATHS',
    category: 'Géométrie',
    competence: 'Appliquer',
    weight: 2,
    label: 'Produit scalaire',
    questionText: 'Soient u⃗(2, 3) et v⃗(1, -1). Que vaut u⃗ · v⃗ ?',
    options: [
      { id: 'a', text: '-1', isCorrect: true },
      { id: 'b', text: '5', isCorrect: false },
      { id: 'c', text: '1', isCorrect: false },
      { id: 'd', text: '-5', isCorrect: false },
    ],
    explanation: 'u⃗ · v⃗ = 2×1 + 3×(-1) = 2 - 3 = -1.',
  }),
];

// ─── NSI Questions ───────────────────────────────────────────────────────────

export const NSI_QUESTIONS: StageQuestion[] = [
  // ── Programmation ────────────────────────────────────────────────────────

  q({
    id: 'NSI-PROG-01',
    subject: 'NSI',
    category: 'Programmation',
    competence: 'Restituer',
    weight: 1,
    nsiErrorType: 'syntax',
    label: 'Syntaxe Python — boucle for',
    questionText: 'Quel code Python affiche les nombres de 0 à 4 ?',
    options: [
      { id: 'a', text: 'for i in range(5): print(i)', isCorrect: true },
      { id: 'b', text: 'for i in range(4): print(i)', isCorrect: false },
      { id: 'c', text: 'for i in range(1, 5): print(i)', isCorrect: false },
      { id: 'd', text: 'for i = 0 to 4: print(i)', isCorrect: false },
    ],
    explanation: 'range(5) génère [0, 1, 2, 3, 4]. range(4) s\'arrête à 3. range(1,5) commence à 1. La syntaxe "for i = 0 to 4" n\'existe pas en Python.',
  }),

  q({
    id: 'NSI-PROG-02',
    subject: 'NSI',
    category: 'Programmation',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'logic',
    label: 'Fonction récursive — factorielle',
    questionText: 'Quelle fonction Python calcule correctement la factorielle de n ?',
    options: [
      { id: 'a', text: 'def fact(n):\n  if n <= 1: return 1\n  return n * fact(n-1)', isCorrect: true },
      { id: 'b', text: 'def fact(n):\n  if n == 0: return 0\n  return n * fact(n-1)', isCorrect: false },
      { id: 'c', text: 'def fact(n):\n  return n * fact(n-1)', isCorrect: false },
      { id: 'd', text: 'def fact(n):\n  if n <= 1: return n\n  return n + fact(n-1)', isCorrect: false },
    ],
    explanation: '(a) est correct : cas de base n≤1 → 1, récurrence n × fact(n-1). (b) retourne 0 pour n=0 au lieu de 1. (c) n\'a pas de cas de base → récursion infinie. (d) fait une somme au lieu d\'un produit.',
    hint: 'Pensez au cas de base et à l\'opération récursive.',
  }),

  // ── Algorithmique ────────────────────────────────────────────────────────

  q({
    id: 'NSI-ALGO-01',
    subject: 'NSI',
    category: 'Algorithmique',
    competence: 'Raisonner',
    weight: 3,
    nsiErrorType: 'logic',
    label: 'Complexité — tri par insertion',
    questionText: 'Quelle est la complexité temporelle dans le pire cas du tri par insertion sur un tableau de n éléments ?',
    options: [
      { id: 'a', text: 'O(n²)', isCorrect: true },
      { id: 'b', text: 'O(n log n)', isCorrect: false },
      { id: 'c', text: 'O(n)', isCorrect: false },
      { id: 'd', text: 'O(log n)', isCorrect: false },
    ],
    explanation: 'Le tri par insertion a une complexité O(n²) dans le pire cas (tableau trié en ordre inverse). En revanche, il est O(n) dans le meilleur cas (tableau déjà trié). O(n log n) est la complexité du tri fusion ou du tri rapide en moyenne.',
  }),

  // ── Données ──────────────────────────────────────────────────────────────

  q({
    id: 'NSI-DATA-01',
    subject: 'NSI',
    category: 'Données',
    competence: 'Appliquer',
    weight: 2,
    nsiErrorType: 'conceptual',
    label: 'SQL — requête SELECT',
    questionText: 'Quelle requête SQL retourne les élèves de Terminale triés par nom ?',
    options: [
      { id: 'a', text: 'SELECT * FROM eleves WHERE classe = \'Terminale\' ORDER BY nom', isCorrect: true },
      { id: 'b', text: 'SELECT * FROM eleves WHERE classe = \'Terminale\' GROUP BY nom', isCorrect: false },
      { id: 'c', text: 'SELECT * FROM eleves ORDER BY nom WHERE classe = \'Terminale\'', isCorrect: false },
      { id: 'd', text: 'SELECT nom FROM eleves HAVING classe = \'Terminale\'', isCorrect: false },
    ],
    explanation: 'L\'ordre correct est SELECT → FROM → WHERE → ORDER BY. GROUP BY est pour l\'agrégation, pas le tri. HAVING s\'utilise après GROUP BY, pas pour filtrer des lignes.',
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
