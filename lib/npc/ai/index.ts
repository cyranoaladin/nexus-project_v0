// ═══════════════════════════════════════════════════════════════════════════════
// NPC AI - Public API
// OpenRouter integration, prompts, schemas, and validators
// ═══════════════════════════════════════════════════════════════════════════════

// Client
export { OpenRouterClient, openRouterClient } from './openrouter-client';

// Schemas
export {
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
  type Strength,
  type Weakness,
  type CompetenceBlock,
  type CompetenceItem,
  type ResourceReference,
  type RoadmapTask,
} from './schemas';

// Prompts
export {
  SYSTEM_CONTEXT,
  buildDiagnosisPrompt,
  buildMatrixPrompt,
  buildRoadmapPrompt,
  buildMentorPrompt,
  type DiagnosisPromptParams,
  type MatrixPromptParams,
  type RoadmapPromptParams,
  type MentorPromptParams,
} from './prompts';

// Validators
export {
  validatePedagogicalDiagnostic,
  validateCompetenceMatrixResult,
  validateRemediationRoadmapResult,
  validateMentorAdviceResult,
  validateOcrResult,
  safeJsonParse,
  generateFallbackDiagnostic,
  generateFallbackMatrix,
  generateFallbackRoadmap,
  generateFallbackMentorAdvice,
  type ValidationResult,
  type ValidationSuccess,
  type ValidationFailure,
} from './validators';
