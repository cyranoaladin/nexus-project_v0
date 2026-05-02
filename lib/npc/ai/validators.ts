// ═══════════════════════════════════════════════════════════════════════════════
// NPC AI - Response Validators
// Post-processing and validation of AI outputs
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';
import {
  PedagogicalDiagnosticSchema,
  CompetenceMatrixSchema,
  RemediationRoadmapSchema,
  MentorAdviceSchema,
  OcrResultSchema,
  validateDiagnostic,
  validateCompetenceMatrix,
  validateRemediationRoadmap,
  validateMentorAdvice,
  type PedagogicalDiagnostic,
  type CompetenceMatrix,
  type RemediationRoadmap,
  type MentorAdvice,
  type OcrResult,
} from './schemas';

// ─── Validation Result Types ───

export interface ValidationSuccess<T> {
  valid: true;
  data: T;
  warnings: string[];
}

export interface ValidationFailure {
  valid: false;
  errors: string[];
  rawData?: unknown;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ─── Diagnostic Validator ───

export function validatePedagogicalDiagnostic(data: unknown): ValidationResult<PedagogicalDiagnostic> {
  const result = validateDiagnostic(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.errors.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      rawData: data,
    };
  }

  const warnings: string[] = [];

  // Business logic validation
  if (result.data.strengths.length > 8) {
    warnings.push('Trop de forces identifiées (max recommandé: 8)');
  }

  if (result.data.weaknesses.length > 10) {
    warnings.push('Trop de faiblesses identifiées (max recommandé: 10)');
  }

  const criticalWeaknesses = result.data.weaknesses.filter(w => w.severity === 'critical');
  if (criticalWeaknesses.length > 3) {
    warnings.push('Nombre élevé de faiblesses critiques - vérifier la pertinence');
  }

  if (result.data.confidenceScore < 0.5) {
    warnings.push('Score de confiance faible - résultats à vérifier');
  }

  return {
    valid: true,
    data: result.data,
    warnings,
  };
}

// ─── Competence Matrix Validator ───

export function validateCompetenceMatrixResult(data: unknown): ValidationResult<CompetenceMatrix> {
  const result = validateCompetenceMatrix(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.errors.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      rawData: data,
    };
  }

  const warnings: string[] = [];
  const matrix = result.data;

  // Validate score consistency
  const calculatedAvg = matrix.blocks.reduce((sum, b) => {
    const blockAvg = b.items.reduce((s, i) => s + i.score, 0) / b.items.length;
    return sum + blockAvg;
  }, 0) / matrix.blocks.length;

  if (Math.abs(calculatedAvg - matrix.globalScore) > 5) {
    warnings.push(`Score global (${matrix.globalScore}) incohérent avec la moyenne calculée (${calculatedAvg.toFixed(1)})`);
  }

  // Check for all zeros or all 100s
  const allScores = matrix.blocks.flatMap(b => b.items.map(i => i.score));
  if (allScores.every(s => s === 0)) {
    warnings.push('Toutes les compétences à 0 - potentiellement une erreur d\'analyse');
  }
  if (allScores.every(s => s === 100)) {
    warnings.push('Toutes les compétences à 100 - potentiellement une erreur d\'analyse');
  }

  return {
    valid: true,
    data: matrix,
    warnings,
  };
}

// ─── Roadmap Validator ───

export function validateRemediationRoadmapResult(data: unknown): ValidationResult<RemediationRoadmap> {
  const result = validateRemediationRoadmap(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.errors.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      rawData: data,
    };
  }

  const warnings: string[] = [];
  const roadmap = result.data;

  // Check task ordering
  const taskIds = roadmap.tasks.map(t => t.id);
  const prerequisiteErrors: string[] = [];

  roadmap.tasks.forEach(task => {
    if (task.prerequisiteTaskIds) {
      task.prerequisiteTaskIds.forEach(prereqId => {
        const prereqIndex = taskIds.indexOf(prereqId);
        const taskIndex = taskIds.indexOf(task.id);

        if (prereqIndex === -1) {
          prerequisiteErrors.push(`Prérequis "${prereqId}" introuvable pour la tâche "${task.id}"`);
        } else if (prereqIndex >= taskIndex) {
          prerequisiteErrors.push(`Prérequis "${prereqId}" doit venir avant "${task.id}"`);
        }
      });
    }
  });

  if (prerequisiteErrors.length > 0) {
    warnings.push(...prerequisiteErrors);
  }

  // Check for circular dependencies (basic check)
  if (roadmap.tasks.length > 15) {
    warnings.push('Roadmap très longue - considérer une division en phases');
  }

  return {
    valid: true,
    data: roadmap,
    warnings,
  };
}

// ─── Mentor Advice Validator ───

export function validateMentorAdviceResult(data: unknown): ValidationResult<MentorAdvice> {
  const result = validateMentorAdvice(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.errors.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      rawData: data,
    };
  }

  const warnings: string[] = [];
  const advice = result.data;

  // Content quality checks
  if (advice.personalizedAdvice.length < 200) {
    warnings.push('Conseil personnalisé très court - potentiellement trop générique');
  }

  if (advice.personalizedAdvice.split('.').length < 5) {
    warnings.push('Conseil avec peu de phrases - vérifier la qualité');
  }

  return {
    valid: true,
    data: advice,
    warnings,
  };
}

// ─── OCR Result Validator ───

export function validateOcrResult(data: unknown): ValidationResult<OcrResult> {
  const result = OcrResultSchema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      rawData: data,
    };
  }

  const warnings: string[] = [];
  const ocr = result.data;

  // Quality checks
  if (ocr.confidence < 0.5) {
    warnings.push('Faible confiance OCR - revérification recommandée');
  }

  if (ocr.text.length < 50 && ocr.text.length > 0) {
    warnings.push('Texte très court détecté - potentiellement incomplet');
  }

  if (ocr.text && !ocr.text.match(/[a-zA-Z]{3,}/)) {
    warnings.push('Peu de texte alphabétique détecté - potentiellement des symboles uniquement');
  }

  return {
    valid: true,
    data: ocr,
    warnings,
  };
}

// ─── Generic JSON Validator ───

export function safeJsonParse<T>(jsonString: string): {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
} {
  try {
    // Remove markdown code blocks if present
    let cleaned = jsonString.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');
    cleaned = cleaned.trim();

    const data = JSON.parse(cleaned) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

// ─── Fallback Generators ───

export function generateFallbackDiagnostic(): PedagogicalDiagnostic {
  return {
    summary: 'Diagnostic automatique non disponible. Une analyse manuelle est nécessaire.',
    overallLevel: 'developing',
    confidenceScore: 0.3,
    strengths: [
      {
        title: 'Participation',
        description: 'L\'élève a soumis une copie pour analyse',
        evidence: 'Copie reçue et traitée',
      },
    ],
    weaknesses: [
      {
        title: 'Analyse non disponible',
        description: 'L\'analyse automatique n\'a pas pu être générée',
        severity: 'medium',
        evidence: 'Erreur technique lors du traitement',
      },
    ],
    keyRecommendations: [
      'Consulter un coach pour une analyse manuelle',
      'Revérifier la qualité de la copie numérisée',
    ],
  };
}

export function generateFallbackMatrix(subject: string): CompetenceMatrix {
  return {
    blocks: [
      {
        code: 'GEN',
        name: 'Compétences générales',
        items: [
          {
            name: 'Analyse de base',
            score: 50,
            maxScore: 100,
            level: 'partially_acquired',
            evidence: 'Score par défaut - analyse non disponible',
          },
        ],
      },
    ],
    globalScore: 50,
    globalLevel: 'partially_acquired',
  };
}

export function generateFallbackRoadmap(): RemediationRoadmap {
  return {
    title: 'Plan de remédiation - À personnaliser',
    description: 'Un plan personnalisé n\'a pas pu être généré automatiquement. Merci de consulter un coach pour établir un parcours adapté.',
    estimatedTotalDuration: 'À déterminer avec un coach',
    recommendedPace: 'regular',
    difficultyLevel: 'intermediate',
    tasks: [
      {
        id: 'task-1',
        title: 'Consultation coach',
        description: 'Prendre rendez-vous avec un coach pour établir un plan personnalisé',
        order: 0,
        type: 'method_learning',
        estimatedDuration: '1 heure',
        difficultyLevel: 'beginner',
        resources: [],
        targetCompetences: [],
      },
    ],
  };
}

export function generateFallbackMentorAdvice(studentName: string): MentorAdvice {
  return {
    personalizedAdvice: `Bonjour ${studentName},\n\nNous avons rencontré une difficulté technique lors de l'analyse de ta copie. Ne t'inquiète pas, cela arrive parfois ! Je t'invite à consulter un coach qui pourra faire une analyse manuelle détaillée de ton travail.\n\nEn attendant, continue à travailler régulièrement et n'hésite pas à poser des questions.`,
    motivationMessage: 'Chaque difficulté est une opportunité de progresser !',
    studyTips: [
      'Prends des notes pendant tes révisions',
      'Fais des exercices régulièrement',
      'Demande de l\'aide quand tu bloques',
    ],
    nextSteps: [
      'Consulter un coach',
      'Continuer les exercices réguliers',
    ],
    encouragement: 'Tu as déjà fait le plus dur en soumettant ta copie. Continue comme ça !',
  };
}
