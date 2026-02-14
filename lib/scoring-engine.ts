/**
 * Scoring Engine V3 — Moteur de score pédagogique avancé
 *
 * Supporte Maths + NSI avec distinction lucidité (NSP) vs erreur (confusion).
 * Calcule un ConfidenceIndex, des tags automatiques, et un radarData par thème.
 *
 * Règles clés :
 *   - "Je ne sais pas" (NSP) = 0 point, JAMAIS pénalisé
 *   - Erreur = -0 point mais comptée comme confusion
 *   - ConfidenceIndex = % questions tentées / questions totales
 *   - Tags automatiques : "Bases Fragiles", "Notion non abordée", "Confusions"
 */

// ─── Question Metadata ───────────────────────────────────────────────────────

/** Subject supported by the scoring engine */
export type ScoringSubject = 'MATHS' | 'NSI';

/** Competency level (Bloom's taxonomy simplified) */
export type CompetencyLevel = 'Restituer' | 'Appliquer' | 'Raisonner';

/** Answer status for a single question */
export type AnswerStatus = 'correct' | 'incorrect' | 'nsp'; // nsp = "Je ne sais pas"

/** Maths categories (piliers) */
export type MathsCategory =
  | 'Analyse'
  | 'Algèbre'
  | 'Géométrie'
  | 'Probabilités'
  | 'Python';

/** NSI categories */
export type NSICategory =
  | 'Programmation'
  | 'Architecture'
  | 'Données'
  | 'Algorithmique';

/** NSI error type classification */
export type NSIErrorType = 'syntax' | 'logic' | 'conceptual';

/** Rich metadata for each question in the QCM */
export interface QuestionMetadata {
  /** Unique question identifier */
  id: string;
  /** Subject: MATHS or NSI */
  subject: ScoringSubject;
  /** Category within the subject */
  category: string;
  /** Competency level tested */
  competence: CompetencyLevel;
  /** Difficulty weight: 1=Basique, 2=Intermédiaire, 3=Expert */
  weight: 1 | 2 | 3;
  /** For NSI: type of error if incorrect */
  nsiErrorType?: NSIErrorType;
  /** Human-readable label */
  label: string;
}

// ─── Answer Data ─────────────────────────────────────────────────────────────

/** A single student answer */
export interface StudentAnswer {
  /** Question ID (matches QuestionMetadata.id) */
  questionId: string;
  /** What the student answered */
  status: AnswerStatus;
  /** Time spent on this question (seconds), if tracked */
  timeSpentSeconds?: number;
}

// ─── Scoring Output ──────────────────────────────────────────────────────────

/** Score breakdown for a single category/theme */
export interface CategoryScore {
  /** Category name (e.g. "Analyse", "Programmation") */
  category: string;
  /** Subject this category belongs to */
  subject: ScoringSubject;
  /** Raw score: correct answers / attempted answers (0-100) */
  precision: number;
  /** Confidence: attempted answers / total questions (0-100) */
  confidence: number;
  /** Total questions in this category */
  totalQuestions: number;
  /** Questions attempted (not NSP) */
  attemptedQuestions: number;
  /** Correct answers */
  correctAnswers: number;
  /** Incorrect answers (errors, not NSP) */
  incorrectAnswers: number;
  /** NSP answers ("Je ne sais pas") */
  nspAnswers: number;
  /** Weighted score (accounts for question difficulty) */
  weightedScore: number;
  /** Weighted max possible */
  weightedMax: number;
  /** Auto-generated diagnostic tag */
  tag: CategoryTag;
}

/** Automatic diagnostic tag for a category */
export type CategoryTag =
  | 'Maîtrisé'           // precision >= 80% AND confidence >= 60%
  | 'En progression'     // precision >= 50% AND confidence >= 40%
  | 'Bases Fragiles'     // fails weight=1 but passes weight=3
  | 'Confusions'         // errors > 40% on attempted
  | 'Notion non abordée' // NSP > 40%
  | 'À découvrir'        // NSP > 60%
  | 'Insuffisant';       // precision < 30%

/** Radar data point for visualization */
export interface RadarDataPoint {
  /** Category/theme label */
  subject: string;
  /** Score (0-100) */
  score: number;
  /** Confidence (0-100) */
  confidence: number;
}

/** NSI-specific error breakdown */
export interface NSIErrorBreakdown {
  /** Syntax errors (less severe) */
  syntaxErrors: number;
  /** Logic/algorithmic errors (severe) */
  logicErrors: number;
  /** Conceptual errors */
  conceptualErrors: number;
  /** Total errors */
  totalErrors: number;
}

/** Inconsistency flag for the "Bases Fragiles" detection */
export interface BasesFragilesFlag {
  /** Category where this was detected */
  category: string;
  /** Weight=1 questions failed */
  basicsFailed: number;
  /** Weight=3 questions passed */
  expertPassed: number;
  /** Diagnostic message */
  message: string;
}

/** Complete scoring result stored in StageReservation.scoringResult */
export interface StageScoringResult {
  /** Global score (0-100), weighted average across all categories */
  globalScore: number;

  /** Confidence Index: % of questions attempted vs total (0-100) */
  confidenceIndex: number;

  /** Precision: % correct among attempted questions (0-100) */
  precisionIndex: number;

  /** Radar data for visualization (one point per category) */
  radarData: RadarDataPoint[];

  /** Identified strengths (category labels) */
  strengths: string[];

  /** Identified weaknesses (category labels) */
  weaknesses: string[];

  /** Detailed scores per category */
  categoryScores: CategoryScore[];

  /** NSI-specific error breakdown (null if Maths-only) */
  nsiErrors: NSIErrorBreakdown | null;

  /** "Bases Fragiles" flags (weight=1 failed but weight=3 passed) */
  basesFragiles: BasesFragilesFlag[];

  /** Auto-generated diagnostic text */
  diagnosticText: string;

  /** Lucidity assessment text */
  lucidityText: string;

  /** Total questions */
  totalQuestions: number;

  /** Total attempted (not NSP) */
  totalAttempted: number;

  /** Total correct */
  totalCorrect: number;

  /** Total NSP */
  totalNSP: number;

  /** Timestamp */
  scoredAt: string;
}

// ─── Scoring Functions ───────────────────────────────────────────────────────

/**
 * Determine the diagnostic tag for a category based on precision, confidence,
 * and the "Bases Fragiles" pattern.
 */
export function computeCategoryTag(
  precision: number,
  confidence: number,
  nspRate: number,
  hasBasesFragiles: boolean
): CategoryTag {
  if (hasBasesFragiles) return 'Bases Fragiles';
  if (nspRate > 60) return 'À découvrir';
  if (nspRate > 40) return 'Notion non abordée';
  if (precision >= 80 && confidence >= 60) return 'Maîtrisé';
  if (precision >= 50 && confidence >= 40) return 'En progression';
  if (precision < 30 && confidence > 30) return 'Insuffisant';
  if (confidence > 30) return 'Confusions';
  return 'Confusions';
}

/**
 * Detect "Bases Fragiles" pattern: student fails basic questions (weight=1)
 * but passes expert questions (weight=3) in the same category.
 */
export function detectBasesFragiles(
  answers: StudentAnswer[],
  questions: QuestionMetadata[],
  category: string
): BasesFragilesFlag | null {
  const categoryQuestions = questions.filter((q) => q.category === category);
  const basicQuestions = categoryQuestions.filter((q) => q.weight === 1);
  const expertQuestions = categoryQuestions.filter((q) => q.weight === 3);

  if (basicQuestions.length === 0 || expertQuestions.length === 0) return null;

  const basicsFailed = basicQuestions.filter((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return answer?.status === 'incorrect';
  }).length;

  const expertPassed = expertQuestions.filter((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return answer?.status === 'correct';
  }).length;

  // Pattern: fails ≥50% of basics AND passes ≥50% of experts
  if (basicsFailed >= basicQuestions.length * 0.5 && expertPassed >= expertQuestions.length * 0.5) {
    return {
      category,
      basicsFailed,
      expertPassed,
      message: `${category} : réussit les questions expertes mais échoue sur les bases — automatismes à consolider`,
    };
  }

  return null;
}

/**
 * Compute NSI error breakdown from answers.
 */
export function computeNSIErrors(
  answers: StudentAnswer[],
  questions: QuestionMetadata[]
): NSIErrorBreakdown {
  const nsiQuestions = questions.filter((q) => q.subject === 'NSI');
  let syntaxErrors = 0;
  let logicErrors = 0;
  let conceptualErrors = 0;

  for (const q of nsiQuestions) {
    const answer = answers.find((a) => a.questionId === q.id);
    if (answer?.status === 'incorrect' && q.nsiErrorType) {
      if (q.nsiErrorType === 'syntax') syntaxErrors++;
      else if (q.nsiErrorType === 'logic') logicErrors++;
      else if (q.nsiErrorType === 'conceptual') conceptualErrors++;
    }
  }

  return {
    syntaxErrors,
    logicErrors,
    conceptualErrors,
    totalErrors: syntaxErrors + logicErrors + conceptualErrors,
  };
}

/**
 * Generate the lucidity assessment text based on NSP rate and precision.
 */
export function generateLucidityText(confidenceIndex: number, precisionIndex: number): string {
  if (confidenceIndex >= 80 && precisionIndex >= 70) {
    return "L'élève fait preuve d'assurance et de maîtrise — profil solide.";
  }
  if (confidenceIndex >= 80 && precisionIndex < 50) {
    return "L'élève tente beaucoup mais commet de nombreuses erreurs — fausses représentations à corriger.";
  }
  if (confidenceIndex < 40 && precisionIndex >= 70) {
    return "L'élève fait preuve d'une grande lucidité sur ses lacunes — ce qu'il tente, il le réussit.";
  }
  if (confidenceIndex < 40 && precisionIndex < 50) {
    return "L'élève hésite beaucoup et commet des erreurs — accompagnement prioritaire nécessaire.";
  }
  if (confidenceIndex < 60) {
    return "L'élève identifie ses zones d'incertitude — lucidité partielle, à approfondir en séance.";
  }
  return "Profil intermédiaire — des acquis solides mais des zones de fragilité à cibler.";
}

/**
 * Main scoring function: compute the full StageScoringResult from answers + question bank.
 *
 * @param answers - Student's answers
 * @param questions - Question metadata bank
 * @returns Complete scoring result
 */
export function computeStageScore(
  answers: StudentAnswer[],
  questions: QuestionMetadata[]
): StageScoringResult {
  // Group questions by category
  const categories = [...new Set(questions.map((q) => q.category))];

  const categoryScores: CategoryScore[] = [];
  const radarData: RadarDataPoint[] = [];
  const basesFragiles: BasesFragilesFlag[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  let totalWeightedScore = 0;
  let totalWeightedMax = 0;
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalNSP = 0;

  for (const category of categories) {
    const catQuestions = questions.filter((q) => q.category === category);
    const subject = catQuestions[0]?.subject || 'MATHS';

    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    let nsp = 0;
    let weightedScore = 0;
    let weightedMax = 0;

    for (const q of catQuestions) {
      const answer = answers.find((a) => a.questionId === q.id);
      weightedMax += q.weight;

      if (!answer || answer.status === 'nsp') {
        nsp++;
        // NSP = 0 points, NOT penalized
      } else if (answer.status === 'correct') {
        correct++;
        attempted++;
        weightedScore += q.weight;
      } else {
        incorrect++;
        attempted++;
        // Incorrect = 0 points (no negative scoring)
      }
    }

    const total = catQuestions.length;
    const precision = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const confidence = total > 0 ? Math.round((attempted / total) * 100) : 0;
    const nspRate = total > 0 ? Math.round((nsp / total) * 100) : 0;

    // Detect "Bases Fragiles" pattern
    const fragile = detectBasesFragiles(answers, questions, category);
    if (fragile) basesFragiles.push(fragile);

    const tag = computeCategoryTag(precision, confidence, nspRate, fragile !== null);

    categoryScores.push({
      category,
      subject,
      precision,
      confidence,
      totalQuestions: total,
      attemptedQuestions: attempted,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      nspAnswers: nsp,
      weightedScore,
      weightedMax,
      tag,
    });

    radarData.push({ subject: category, score: precision, confidence });

    // Classify strengths/weaknesses
    if (tag === 'Maîtrisé' || (precision >= 70 && confidence >= 50)) {
      strengths.push(category);
    } else if (tag === 'Confusions' || tag === 'Insuffisant' || tag === 'Bases Fragiles') {
      weaknesses.push(category);
    }

    totalWeightedScore += weightedScore;
    totalWeightedMax += weightedMax;
    totalAttempted += attempted;
    totalCorrect += correct;
    totalNSP += nsp;
  }

  const totalQuestions = questions.length;
  const globalScore = totalWeightedMax > 0
    ? Math.round((totalWeightedScore / totalWeightedMax) * 100)
    : 0;
  const confidenceIndex = totalQuestions > 0
    ? Math.round((totalAttempted / totalQuestions) * 100)
    : 0;
  const precisionIndex = totalAttempted > 0
    ? Math.round((totalCorrect / totalAttempted) * 100)
    : 0;

  // NSI error breakdown
  const hasNSI = questions.some((q) => q.subject === 'NSI');
  const nsiErrors = hasNSI ? computeNSIErrors(answers, questions) : null;

  // Diagnostic text
  const diagnosticText = generateDiagnosticText(globalScore, confidenceIndex, strengths, weaknesses, basesFragiles);
  const lucidityText = generateLucidityText(confidenceIndex, precisionIndex);

  return {
    globalScore,
    confidenceIndex,
    precisionIndex,
    radarData,
    strengths,
    weaknesses,
    categoryScores,
    nsiErrors,
    basesFragiles,
    diagnosticText,
    lucidityText,
    totalQuestions,
    totalAttempted,
    totalCorrect,
    totalNSP,
    scoredAt: new Date().toISOString(),
  };
}

/**
 * Generate a human-readable diagnostic summary.
 */
function generateDiagnosticText(
  globalScore: number,
  confidenceIndex: number,
  strengths: string[],
  weaknesses: string[],
  basesFragiles: BasesFragilesFlag[]
): string {
  const parts: string[] = [];

  // Global level
  if (globalScore >= 75) {
    parts.push(`Score global de ${globalScore}/100 — niveau solide.`);
  } else if (globalScore >= 50) {
    parts.push(`Score global de ${globalScore}/100 — niveau intermédiaire, des axes de progression identifiés.`);
  } else {
    parts.push(`Score global de ${globalScore}/100 — des lacunes significatives à combler.`);
  }

  // Confidence
  if (confidenceIndex < 50) {
    parts.push(`Indice de confiance faible (${confidenceIndex}%) — l'élève a préféré ne pas répondre à de nombreuses questions.`);
  }

  // Strengths
  if (strengths.length > 0) {
    parts.push(`Points forts : ${strengths.join(', ')}.`);
  }

  // Weaknesses
  if (weaknesses.length > 0) {
    parts.push(`Points faibles : ${weaknesses.join(', ')}.`);
  }

  // Bases Fragiles
  if (basesFragiles.length > 0) {
    parts.push(`Attention : ${basesFragiles.map((b) => b.message).join(' | ')}`);
  }

  return parts.join(' ');
}
