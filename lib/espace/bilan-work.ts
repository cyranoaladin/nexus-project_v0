import { z } from 'zod';

import { bilanData, getBilanLesson, getBilanSections, getExclusiveBilanChoices, getEligibleBilanTasks, type BilanLevel } from './bilan-data';
import { EspaceError } from './errors';
import { MAX_FIELD_CHARS, type StepContent, type WorkContent } from './work-content';

const evidenceSchema = z.object({
  answer: z.string().max(MAX_FIELD_CHARS).optional(),
  aid: z.string().max(160).optional(),
  retry: z.string().max(MAX_FIELD_CHARS).optional(),
  skipped: z.boolean().optional(),
}).strict();
const DECLINED = 'Je ne souhaite pas répondre';

function invalid(message = 'Réponse de bilan invalide'): never {
  throw new EspaceError('INVALID_INPUT', message);
}
function json(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return invalid(); }
}

/** Les bilans contiennent des déclarations, jamais des notes ni des validations enseignantes. */
export function validateBilanStep(level: BilanLevel, stepId: string, step: StepContent): void {
  const def = getBilanLesson(level).steps.find(s => s.id === stepId);
  if (!def || Object.keys(step).some(key => key !== 'fields')) invalid();
  const allowed = new Set(def.fields.map(f => f.id));
  const entries = Object.entries(step.fields ?? {});
  if (stepId === 'evidence' && entries.filter(([, value]) => value.trim()).length > 2) {
    invalid('Choisis deux essais au maximum');
  }
  for (const [id, value] of entries) {
    if (!allowed.has(id) || value.length > MAX_FIELD_CHARS) invalid();
    if (!value.trim()) continue; // Une réponse omise n’est pas un échec.
    if (stepId === 'scope') {
      if (id !== 'other' && !['yes', 'no', 'unsure'].includes(value)) invalid();
    } else if (stepId === 'mastery') {
      if (!Object.hasOwn(bilanData.mastery, value)) invalid();
    } else if (stepId === 'evidence') {
      if (!evidenceSchema.safeParse(json(value)).success) invalid();
    } else if (stepId === 'review') {
      if (!['yes', 'no'].includes(value)) invalid();
    } else {
      const question = getBilanSections(level).find(s => s.id === stepId)?.questions.find(q => q.id === id);
      if (!question) invalid();
      if (question.type === 'radio' && value !== DECLINED && !question.options?.includes(value)) invalid();
      if (question.type === 'multi') {
        const choices = json(value);
        if (!Array.isArray(choices) || choices.length > (question.max ?? 3) || new Set(choices).size !== choices.length || choices.some(choice => typeof choice !== 'string' || (choice !== DECLINED && !question.options?.includes(choice)))) invalid();
        if (choices.length > 1 && choices.some(choice => getExclusiveBilanChoices(question).includes(choice))) invalid();
      }
    }
  }
}

/** Un changement de parcours retire les essais désormais hors périmètre, sans bloquer la sauvegarde. */
export function normalizeBilanContent(level: BilanLevel, content: WorkContent): WorkContent {
  for (const [id, step] of Object.entries(content.steps)) validateBilanStep(level, id, step);
  if (!content.steps.evidence) return content;
  const eligible = new Set(getEligibleBilanTasks(level, content.steps.scope?.fields ?? {}, content.steps.mastery?.fields ?? {}).map(t => t.id));
  return { ...content, steps: { ...content.steps, evidence: { fields: Object.fromEntries(Object.entries(content.steps.evidence.fields ?? {}).filter(([id, value]) => eligible.has(id) && value.trim())) } } };
}

export function assertBilanReadyToSubmit(level: BilanLevel, content: WorkContent): void {
  normalizeBilanContent(level, content);
  if (content.steps.review?.fields?.confirmed !== 'yes') invalid('Relis tes réponses puis confirme avant de transmettre ton bilan');
}

export function computeBilanProgress(level: BilanLevel, content: WorkContent) {
  const normalized = normalizeBilanContent(level, content);
  const defs = getBilanLesson(level).steps;
  return {
    // Étapes renseignées, pas compétences réussies : toutes les réponses restent facultatives.
    completedSteps: defs.filter(step => Object.values(normalized.steps[step.id]?.fields ?? {}).some(value => value.trim())).length,
    requiredSteps: defs.length,
  };
}
